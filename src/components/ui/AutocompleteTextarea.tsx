import { useState, useRef, useEffect, Fragment, KeyboardEvent, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Editor from 'react-simple-code-editor'
import { getCaretCoordinates } from '@/utils/caret-coords'
import { cn } from '@/lib/utils'
import tagsData from '@/assets/tags.json'
import { useWildcardStore } from '@/stores/wildcard-store'

// --- Types ---
interface Tag {
    label: string
    value: string
    count: number
    type: string
}

interface SuggestionItem {
    label: string
    value: string
    count?: number
    type: string
    _lower?: string
}

interface AutocompleteTextareaProps {
    value: string
    onChange: (e: { target: { value: string } }) => void
    className?: string
    maxSuggestions?: number
    style?: React.CSSProperties
    placeholder?: string
    disabled?: boolean
    readOnly?: boolean
}

// --- Constants ---
const ALL_TAGS = tagsData as Tag[]

// 사전 처리: 소문자 변환된 label 캐싱 (최초 1회만)
const TAGS_WITH_LOWER = ALL_TAGS.map(tag => ({
    ...tag,
    _lower: tag.label.toLowerCase()
}))

// 첫 글자별 인덱스 생성 (O(1) 접근)
const TAG_INDEX: Record<string, typeof TAGS_WITH_LOWER> = {}
for (const tag of TAGS_WITH_LOWER) {
    const firstChar = tag._lower[0] || '_'
    if (!TAG_INDEX[firstChar]) TAG_INDEX[firstChar] = []
    TAG_INDEX[firstChar].push(tag)
}

// Single source of truth for Typography to ensure Textarea and Pre match perfectly.
const TYPOGRAPHY = {
    fontFamily: '"Inter", "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    fontVariantLigatures: 'none',
    tabSize: 4,
}

export function AutocompleteTextarea({
    value,
    onChange,
    className,
    maxSuggestions = 15,
    style, // mainly used for fontSize
    placeholder,
    ...props
}: AutocompleteTextareaProps) {
    // --- Refs ---
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const containerRef = useRef<HTMLDivElement>(null) // The scrolling container
    const listRef = useRef<HTMLDivElement>(null)

    // onChange 디바운스를 위한 타이머 ref
    const onChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Wildcard Store 구독 (조각 프롬프트 목록)
    const wildcardFiles = useWildcardStore(state => state.files)

    // --- State ---
    // 내부 state로 즉시 렌더링 (uncontrolled 방식)
    const [internalValue, setInternalValue] = useState(value)
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const [suggestionMode, setSuggestionMode] = useState<'tag' | 'wildcard'>('tag')

    // 외부 value가 변경되면 내부 state 동기화 (예: 프리셋 로드)
    useEffect(() => {
        setInternalValue(value)
    }, [value])

    // --- Helpers ---
    const getCurrentWord = (text: string, position: number) => {
        const left = text.slice(0, position)
        const match = left.match(/[^,\n]*$/) // Match backwards to comma or newline
        return match ? match[0].trimStart() : ''
    }

    // `<` 이후의 와일드카드 이름 추출
    const getWildcardWord = (text: string, position: number): string | null => {
        const left = text.slice(0, position)
        // `<` 이후의 텍스트 찾기 (아직 닫히지 않은 경우)
        const match = left.match(/<([^<>]*)$/)
        return match ? match[1] : null
    }

    // --- Autocomplete Logic ---
    const checkAutocomplete = useCallback((val: string, el: HTMLTextAreaElement) => {

        const pos = el.selectionEnd || val.length

        // 1. 조각 모드 체크 (`<` 이후)
        const wildcardWord = getWildcardWord(val, pos)
        if (wildcardWord !== null) {
            // 조각 프롬프트 자동완성 (즉시, 디바운스 없음)
            const lower = wildcardWord.toLowerCase()
            const matches: SuggestionItem[] = []

            for (const file of wildcardFiles) {
                if (matches.length >= maxSuggestions) break
                const fullPath = file.folder ? `${file.folder}/${file.name}` : file.name
                const fullPathLower = fullPath.toLowerCase()

                // 빈 문자열이면 모든 파일 표시, 아니면 필터링
                if (wildcardWord === '' || fullPathLower.includes(lower)) {
                    matches.push({
                        label: fullPath,
                        value: fullPath,
                        count: file.lineCount,
                        type: 'fragment'
                    })
                }
            }

            if (matches.length > 0) {
                setSuggestions(matches)
                setSuggestionMode('wildcard')
                setSelectedIndex(0)

                const rect = el.getBoundingClientRect()
                const caret = getCaretCoordinates(el, pos)

                setCoords({
                    top: rect.top + window.scrollY + caret.top + 24,
                    left: rect.left + window.scrollX + caret.left
                })
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
            return
        }

        // 2. 일반 태그 자동완성
        const word = getCurrentWord(val, pos)
        if (word.length < 2) {
            setIsVisible(false)
            return
        }

        // 즉시 검색 (디바운스 없음 - 빠른 반응성)
        const lower = word.toLowerCase()
        const firstChar = lower[0] || ''

        // 인덱스 기반 검색 (해당 첫 글자 태그만 검색)
        const indexedTags = TAG_INDEX[firstChar] || []
        const matches: SuggestionItem[] = []

        // 1단계: 인덱스된 태그에서 startsWith 매칭
        for (const tag of indexedTags) {
            if (matches.length >= maxSuggestions) break
            if (tag._lower.startsWith(lower)) {
                matches.push(tag)
            }
        }

        // 2단계: 부족하면 전체에서 includes 검색 (느리지만 fallback)
        if (matches.length < maxSuggestions) {
            for (const tag of TAGS_WITH_LOWER) {
                if (matches.length >= maxSuggestions) break
                if (!tag._lower.startsWith(lower) && tag._lower.includes(lower)) {
                    matches.push(tag)
                }
            }
        }

        if (matches.length > 0) {
            setSuggestions(matches)
            setSuggestionMode('tag')
            setSelectedIndex(0)

            const rect = el.getBoundingClientRect()
            const caret = getCaretCoordinates(el, pos)

            setCoords({
                top: rect.top + window.scrollY + caret.top + 24,
                left: rect.left + window.scrollX + caret.left
            })
            setIsVisible(true)
        } else {
            setIsVisible(false)
        }
    }, [maxSuggestions, wildcardFiles])

    const insertSuggestion = (suggestion: SuggestionItem) => {
        if (!textareaRef.current) return
        const el = textareaRef.current
        const val = value
        const pos = el.selectionEnd || 0

        if (suggestionMode === 'wildcard') {
            // 와일드카드 삽입: <name> 형태로
            const wildcardWord = getWildcardWord(val, pos)
            if (wildcardWord === null) return

            // `<` 위치 찾기
            const left = val.slice(0, pos)
            const bracketPos = left.lastIndexOf('<')
            if (bracketPos === -1) return

            const before = val.slice(0, bracketPos)
            const after = val.slice(pos)

            // <name> 형태로 삽입 (닫는 괄호 포함)
            const newValue = before + '<' + suggestion.value + '>' + after

            onChange({ target: { value: newValue } })
            setIsVisible(false)

            // 커서 위치 설정 (삽입된 와일드카드 뒤)
            setTimeout(() => {
                const newPos = bracketPos + suggestion.value.length + 2 // <name>
                el.setSelectionRange(newPos, newPos)
                el.focus()
            }, 0)
        } else {
            // 일반 태그 삽입
            const left = val.slice(0, pos)
            const wordMatch = left.match(/[^,\n]*$/)
            if (!wordMatch) return

            const wordStart = wordMatch.index!
            const before = val.slice(0, wordStart)
            const after = val.slice(pos)
            // Add space if needed
            const prefix = (before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')) ? ' ' : ''

            const newValue = before + prefix + suggestion.value + ', ' + after

            onChange({ target: { value: newValue } })
            setIsVisible(false)

            // Reset focus and cursor
            setTimeout(() => {
                el.focus()
                const newPos = wordStart + prefix.length + suggestion.value.length + 2 // +2 for ', '
                el.setSelectionRange(newPos, newPos)
                scrollToCaret()
            }, 0)
        }
    }

    // --- Scroll Sync Logic ---
    // Manually scrolls the container to keep the caret in view during typing/navigation
    const scrollToCaret = () => {
        if (!textareaRef.current || !containerRef.current) return
        const el = textareaRef.current
        const container = containerRef.current

        requestAnimationFrame(() => {
            const { top, height } = getCaretCoordinates(el, el.selectionEnd)
            // Padding offset (must match Editor padding prop)
            const PADDING_OFFSET = 12
            const caretTop = top + PADDING_OFFSET
            const caretBottom = caretTop + height + 4 // Small buffer

            const containerTop = container.scrollTop
            const containerBottom = containerTop + container.clientHeight

            // Scroll if out of bounds
            if (caretBottom > containerBottom) {
                container.scrollTop = caretBottom - container.clientHeight
            } else if (caretTop < containerTop) {
                container.scrollTop = caretTop
            }
        })
    }

    // --- Event Handlers ---
    const handleValueChange = (code: string) => {
        // 내부 state 즉시 업데이트 (UI 반응성)
        const isTyping = code.length > internalValue.length
        setInternalValue(code)

        // Smart Debounce: 즉시 저장할 구분자 체크 (공백, 엔터, 구두점)
        const lastChar = code.slice(-1)
        const isDelimiter = /[\s.,;!?]/.test(lastChar)

        if (onChangeTimerRef.current) {
            clearTimeout(onChangeTimerRef.current)
        }

        // 타이핑 중이고 구분자를 입력했다면 즉시 저장 (자연스러운 Undo 포인트 생성)
        if (isTyping && isDelimiter) {
            onChange({ target: { value: code } })
        } else {
            // 일반 입력은 짧은 대기 시간으로 반응성 향상 (100ms -> 50ms)
            onChangeTimerRef.current = setTimeout(() => {
                onChange({ target: { value: code } })
            }, 50)
        }

        if (textareaRef.current) {
            checkAutocomplete(code, textareaRef.current)
            scrollToCaret()
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLDivElement>) => {
        // Ensure ref is captured
        if (e.target instanceof HTMLTextAreaElement) {
            textareaRef.current = e.target
        }

        if (isVisible) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % suggestions.length)
                return
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
                return
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                e.stopPropagation() // Prevent default newline
                if (suggestions[selectedIndex]) {
                    insertSuggestion(suggestions[selectedIndex])
                }
                return
            } else if (e.key === 'Escape') {
                setIsVisible(false)
                return
            }
        }
    }

    // --- Effects ---
    // 타이머 정리 (컴포넌트 언마운트 시)
    useEffect(() => {
        return () => {
            if (onChangeTimerRef.current) clearTimeout(onChangeTimerRef.current)
        }
    }, [])

    // Scroll active suggestion into view
    useEffect(() => {
        if (!isVisible || !listRef.current) return
        const list = listRef.current
        const item = list.children[0]?.children[selectedIndex] as HTMLElement
        if (item) {
            const itemTop = item.offsetTop
            const itemBottom = itemTop + item.offsetHeight
            const listTop = list.scrollTop
            const listBottom = listTop + list.clientHeight
            if (itemTop < listTop) list.scrollTop = itemTop
            else if (itemBottom > listBottom) list.scrollTop = itemBottom - list.clientHeight
        }
    }, [selectedIndex, isVisible])

    // Close on outside events
    useEffect(() => {
        const handleWindowEvents = (e: Event) => {
            if (isVisible && listRef.current && !listRef.current.contains(e.target as Node)) {
                setIsVisible(false)
            }
        }
        if (isVisible) {
            window.addEventListener('scroll', handleWindowEvents, true)
            window.addEventListener('resize', handleWindowEvents)
            window.addEventListener('click', handleWindowEvents)
        }
        return () => {
            window.removeEventListener('scroll', handleWindowEvents, true)
            window.removeEventListener('resize', handleWindowEvents)
            window.removeEventListener('click', handleWindowEvents)
        }
    }, [isVisible])

    // --- Highlighting ---
    const renderHighlights = (text: string) => {
        if (!text) return null
        // Syntax regex: 
        // 1. Weights: 1.2::tag:: OR -0.5::tag::
        // 2. Fragments: <fragment>
        const regex = /(-?[\d.]+::.*?::)|(<[^>]+>)/g
        const parts = text.split(regex)

        return (
            <Fragment>
                {parts.map((part, i) => {
                    if (part === undefined) return null
                    let styleClass = ""
                    if (/^-?[\d.]+::.*::$/.test(part)) {
                        styleClass = part.startsWith('-')
                            ? "bg-sky-500/30 rounded-[2px]"
                            : "bg-pink-500/30 rounded-[2px]"
                    } else if (/^<[^>]+>$/.test(part)) {
                        styleClass = "bg-green-500/30 rounded-[2px]"
                    }
                    return <span key={i} className={styleClass}>{part}</span>
                })}
            </Fragment>
        )
    }

    // --- Styles ---
    // Force sync styles for both Pre (generated by Editor) and Textarea


    return (
        <div
            className={cn(
                "prompt-editor-wrapper relative w-full h-full flex flex-col border rounded-md border-input bg-transparent overflow-hidden group focus-within:ring-1 focus-within:ring-ring",
                className
            )}
        >
            <style>{`
                .prompt-editor-wrapper pre,
                .prompt-editor-wrapper textarea {
                    font-family: "Inter", "Pretendard Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
                    line-height: 1.5 !important;
                    font-size: inherit !important;
                    letter-spacing: normal !important;
                    font-variant-ligatures: none !important;
                    tab-size: 4 !important;
                    white-space: pre-wrap !important;
                    word-break: break-word !important;
                    box-sizing: border-box !important;
                }
                .prompt-editor-wrapper textarea {
                    overflow: hidden !important; /* Hide native scrollbar since container scrolls */
                }
            `}</style>

            {/* Scrollable Container */}
            <div
                ref={containerRef}
                className="flex-1 w-full relative overflow-y-auto"
                style={{ scrollBehavior: 'smooth' }} // Optional smooth scroll
            >
                <Editor
                    value={internalValue}
                    onValueChange={handleValueChange}
                    highlight={renderHighlights}
                    padding={12}
                    textareaId="prompt-editor"

                    // Core Editor Style
                    style={{
                        ...TYPOGRAPHY,
                        fontSize: style?.fontSize || 'inherit',
                        minHeight: '100%',
                        height: 'auto',
                        overflow: 'visible',
                    }}

                    // Wrapper Class
                    className="min-h-full w-full"

                    // Textarea Class
                    // Styles are now handled by global CSS injection above
                    textareaClassName="focus:outline-none bg-transparent min-h-full resize-none"

                    // Event wiring
                    onFocus={(e) => textareaRef.current = e.target as HTMLTextAreaElement}
                    onClick={(e) => {
                        textareaRef.current = e.target as HTMLTextAreaElement
                        scrollToCaret()
                    }}
                    onKeyUp={scrollToCaret} // Handle arrow keys
                    onKeyDown={handleKeyDown}

                    placeholder={placeholder}
                    readOnly={props.readOnly}
                    disabled={props.disabled}
                    {...props}
                />
            </div>

            {/* Autocomplete Dropdown */}
            {isVisible && suggestions.length > 0 && createPortal(
                <div
                    ref={listRef}
                    className="fixed z-[9999] w-64 bg-popover/95 backdrop-blur-md text-popover-foreground rounded-lg border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}
                >
                    <div className="p-1">
                        {suggestions.map((item, index) => (
                            <div
                                key={item.value + index}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer select-none transition-colors",
                                    index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    insertSuggestion(item)
                                }}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate font-semibold">
                                        {item.type === 'fragment' ? `<${item.label}>` : item.label}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] opacity-80">
                                        <span className={cn(
                                            "uppercase tracking-wider font-bold",
                                            item.type === 'fragment' ? "text-green-300" :
                                                item.type === 'artist' ? "text-yellow-300" :
                                                    item.type === 'character' ? "text-green-300" :
                                                        item.type === 'copyright' ? "text-fuchsia-300" :
                                                            "text-blue-300"
                                        )}>
                                            {item.type}
                                        </span>
                                        <span>
                                            {item.type === 'fragment'
                                                ? `${item.count} lines`
                                                : (item.count ?? 0) >= 1000 ? ((item.count ?? 0) / 1000).toFixed(1) + 'k' : item.count}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
