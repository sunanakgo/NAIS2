import { useState, useRef, useEffect, Fragment, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import Editor from 'react-simple-code-editor'
import { getCaretCoordinates } from '@/utils/caret-coords'
import { cn } from '@/lib/utils'
import tagsData from '@/assets/tags.json'

// --- Types ---
interface Tag {
    label: string
    value: string
    count: number
    type: string
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

    // --- State ---
    const [suggestions, setSuggestions] = useState<Tag[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })

    // --- Helpers ---
    const getCurrentWord = (text: string, position: number) => {
        const left = text.slice(0, position)
        const match = left.match(/[^,\n]*$/) // Match backwards to comma or newline
        return match ? match[0].trimStart() : ''
    }

    // --- Autocomplete Logic ---
    const checkAutocomplete = (val: string, el: HTMLTextAreaElement) => {
        const pos = el.selectionEnd || val.length
        const word = getCurrentWord(val, pos)

        if (word.length >= 2) {
            const lower = word.toLowerCase()
            const matches = ALL_TAGS.filter(tag => {
                if (tag.type === 'artist') return tag.label.toLowerCase().includes(lower)
                return tag.label.toLowerCase().startsWith(lower) || tag.label.toLowerCase().includes(lower)
            }).slice(0, maxSuggestions)

            if (matches.length > 0) {
                setSuggestions(matches)
                setSelectedIndex(0)

                const rect = el.getBoundingClientRect()
                const caret = getCaretCoordinates(el, pos)

                setCoords({
                    top: rect.top + window.scrollY + caret.top + 24, // Place below line
                    left: rect.left + window.scrollX + caret.left
                })
                setIsVisible(true)
                return
            }
        }
        setIsVisible(false)
    }

    const insertTag = (tag: Tag) => {
        if (!textareaRef.current) return
        const el = textareaRef.current
        const val = value
        const pos = el.selectionEnd || 0

        const left = val.slice(0, pos)
        const wordMatch = left.match(/[^,\n]*$/)
        if (!wordMatch) return

        const wordStart = wordMatch.index!
        const before = val.slice(0, wordStart)
        const after = val.slice(pos)
        // Add space if needed
        const prefix = (before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')) ? ' ' : ''

        const newValue = before + prefix + tag.value + ', ' + after

        // Update parent
        onChange({ target: { value: newValue } })

        setIsVisible(false)

        // Reset focus and cursor
        setTimeout(() => {
            el.focus()
            const newPos = wordStart + prefix.length + tag.value.length + 2 // +2 for ', '
            el.setSelectionRange(newPos, newPos)
            scrollToCaret()
        }, 0)
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
        onChange({ target: { value: code } })

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
                    insertTag(suggestions[selectedIndex])
                }
                return
            } else if (e.key === 'Escape') {
                setIsVisible(false)
                return
            }
        }
    }

    // --- Effects ---
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
                    value={value}
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
                        {suggestions.map((tag, index) => (
                            <div
                                key={tag.value + index}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer select-none transition-colors",
                                    index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                                onMouseDown={(e) => {
                                    e.preventDefault()
                                    insertTag(tag)
                                }}
                            >
                                <div className="flex flex-col overflow-hidden">
                                    <span className="truncate font-semibold">{tag.label}</span>
                                    <div className="flex items-center gap-2 text-[10px] opacity-80">
                                        <span className={cn(
                                            "uppercase tracking-wider font-bold",
                                            tag.type === 'artist' ? "text-yellow-300" :
                                                tag.type === 'character' ? "text-green-300" :
                                                    tag.type === 'copyright' ? "text-fuchsia-300" :
                                                        "text-blue-300"
                                        )}>
                                            {tag.type}
                                        </span>
                                        <span>{tag.count >= 1000 ? (tag.count / 1000).toFixed(1) + 'k' : tag.count}</span>
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
