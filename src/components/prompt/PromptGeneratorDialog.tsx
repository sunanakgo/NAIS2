import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Check, AlertCircle, ChevronDown } from 'lucide-react'
import GeminiIcon from '@/assets/gemini-color.svg'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { generateTagsFromPrompt, GEMINI_MODELS, type GeminiModel, type TokenUsage } from '@/services/gemini-service'
import { parseAndMatchTags, type TagMatchResult } from '@/lib/tag-matcher'
import { toast } from '@/components/ui/use-toast'

interface PromptGeneratorDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onApply: (tags: string) => void
}

export function PromptGeneratorDialog({ open, onOpenChange, onApply }: PromptGeneratorDialogProps) {
    const { t } = useTranslation()
    const { geminiApiKey } = useSettingsStore()

    const [userInput, setUserInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [results, setResults] = useState<TagMatchResult[]>([])
    const [selectedTags, setSelectedTags] = useState<Map<number, string>>(new Map())
    const [selectedModel, setSelectedModel] = useState<GeminiModel>('gemini-2.5-flash')
    const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setUserInput('')
            setResults([])
            setSelectedTags(new Map())
            setTokenUsage(null)
        }
    }, [open])

    const handleGenerate = async () => {
        if (!geminiApiKey) {
            toast({
                title: t('promptGenerator.apiKeyRequired', 'Gemini API 키가 필요합니다'),
                description: t('promptGenerator.goToSettings', '설정 페이지에서 API 키를 입력해주세요'),
                variant: 'destructive',
            })
            return
        }

        if (!userInput.trim()) return

        setIsLoading(true)
        setResults([])

        try {
            const result = await generateTagsFromPrompt(userInput, geminiApiKey, selectedModel)

            if (!result.success) {
                toast({
                    title: t('promptGenerator.error', '오류 발생'),
                    description: result.error,
                    variant: 'destructive',
                })
                return
            }

            // Match tags with our database
            const rawTags = result.tags.join(', ')
            const matchResults = parseAndMatchTags(rawTags)
            setResults(matchResults)

            // Initialize selected tags with matched ones
            const initialSelections = new Map<number, string>()
            matchResults.forEach((r, i) => {
                if (r.status === 'matched' && r.matched) {
                    initialSelections.set(i, r.matched.value)
                } else if (r.status === 'fuzzy' && r.alternatives.length > 0) {
                    // Pre-select the first alternative
                    initialSelections.set(i, r.alternatives[0].value)
                }
            })
            setSelectedTags(initialSelections)

            // Store token usage if available
            if (result.tokenUsage) {
                setTokenUsage(result.tokenUsage)
            }

        } catch (error) {
            console.error('Generate error:', error)
            toast({
                title: t('promptGenerator.error', '오류 발생'),
                description: String(error),
                variant: 'destructive',
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleSelectTag = (index: number, value: string) => {
        const newSelections = new Map(selectedTags)
        newSelections.set(index, value)
        setSelectedTags(newSelections)
    }

    const handleRemoveTag = (index: number) => {
        const newSelections = new Map(selectedTags)
        newSelections.delete(index)
        setSelectedTags(newSelections)
    }

    const handleApply = () => {
        // Collect all selected tags
        const tags: string[] = []
        results.forEach((_, i) => {
            const selected = selectedTags.get(i)
            if (selected) {
                tags.push(selected)
            }
        })

        if (tags.length > 0) {
            onApply(tags.join(', '))
            onOpenChange(false)
        }
    }

    const getStatusIcon = (result: TagMatchResult) => {
        switch (result.status) {
            case 'matched':
                return <Check className="h-3.5 w-3.5 text-green-500" />
            case 'fuzzy':
                return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
            case 'unmatched':
                return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
        }
    }

    const getStatusClass = (result: TagMatchResult, index: number) => {
        // If tag is removed, show muted style
        if (!selectedTags.has(index)) {
            return 'border-muted/50 bg-muted/20 opacity-50'
        }
        switch (result.status) {
            case 'matched':
                return 'border-green-500/50 bg-green-500/10'
            case 'fuzzy':
                return 'border-yellow-500/50 bg-yellow-500/10'
            case 'unmatched':
                return 'border-red-500/50 bg-red-500/10'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <img src={GeminiIcon} alt="Gemini" className="h-5 w-5" />
                        {t('promptGenerator.title', 'AI 프롬프트 생성')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('promptGenerator.description', '원하는 장면을 설명하면 단부루 태그로 변환합니다')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-hidden">
                    {/* Model Selection */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground shrink-0">
                            {t('promptGenerator.model', '모델')}:
                        </span>
                        <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as GeminiModel)}>
                            <SelectTrigger className="flex-1 h-8 text-sm focus:ring-0 focus:ring-offset-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {GEMINI_MODELS.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Input Area */}
                    <div className="space-y-2">
                        <Textarea
                            placeholder={t('promptGenerator.inputPlaceholder', '예: 카페에서 커피를 마시는 소녀')}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="min-h-[80px] resize-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    handleGenerate()
                                }
                            }}
                        />
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                {t('promptGenerator.hint', 'Ctrl+Enter로 생성')}
                            </p>
                            <Button
                                onClick={handleGenerate}
                                disabled={isLoading || !userInput.trim()}
                                className=""
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {t('promptGenerator.generating', '생성 중...')}
                                    </>
                                ) : (
                                    <>
                                        <img src={GeminiIcon} alt="Gemini" className="h-4 w-4 mr-2" />
                                        {t('promptGenerator.generate', '생성')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Results Area */}
                    {results.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    {t('promptGenerator.results', '생성된 태그')}
                                    {tokenUsage && (
                                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                            {t('promptGenerator.tokenUsage', '토큰')}: {tokenUsage.totalTokens}
                                        </span>
                                    )}
                                </h4>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Check className="h-3 w-3 text-green-500" />
                                        {t('promptGenerator.matched', '매칭됨')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                                        {t('promptGenerator.selectRequired', '선택 필요')}
                                    </span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {t('promptGenerator.rightClickHint', '우클릭으로 태그 제거')}
                            </p>

                            <ScrollArea className="h-[200px] border rounded-lg p-3" data-allow-context-menu>
                                <div className="flex flex-wrap gap-2">
                                    {results.map((result, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm cursor-context-menu transition-opacity",
                                                getStatusClass(result, index)
                                            )}
                                            onContextMenu={(e) => {
                                                e.preventDefault()
                                                if (selectedTags.has(index)) {
                                                    handleRemoveTag(index)
                                                } else {
                                                    // Re-add if previously removed
                                                    if (result.status === 'matched' && result.matched) {
                                                        handleSelectTag(index, result.matched.value)
                                                    } else if (result.status === 'fuzzy' && result.alternatives.length > 0) {
                                                        handleSelectTag(index, result.alternatives[0].value)
                                                    }
                                                }
                                            }}
                                        >
                                            {selectedTags.has(index) && getStatusIcon(result)}

                                            {result.status === 'matched' ? (
                                                <span className={cn("font-medium", !selectedTags.has(index) && "line-through")}>
                                                    {result.matched?.value}
                                                </span>
                                            ) : result.status === 'fuzzy' && result.alternatives.length > 0 ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className={cn(
                                                            "flex items-center gap-1 font-medium hover:underline",
                                                            !selectedTags.has(index) && "line-through"
                                                        )}>
                                                            {selectedTags.get(index) || result.original}
                                                            <ChevronDown className="h-3 w-3" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                                            원본: {result.original}
                                                        </div>
                                                        {result.alternatives.map((alt, altIndex) => (
                                                            <DropdownMenuItem
                                                                key={altIndex}
                                                                onClick={() => handleSelectTag(index, alt.value)}
                                                                className={cn(
                                                                    selectedTags.get(index) === alt.value && "bg-primary/10"
                                                                )}
                                                            >
                                                                <span>{alt.label}</span>
                                                                <span className="ml-auto text-xs text-muted-foreground">
                                                                    {alt.count >= 1000 ? `${(alt.count / 1000).toFixed(1)}k` : alt.count}
                                                                </span>
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <span className="text-muted-foreground line-through">
                                                    {result.original}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>

                {/* Only show Apply button when there are results */}
                {results.length > 0 && (
                    <DialogFooter>
                        <Button
                            onClick={handleApply}
                            disabled={selectedTags.size === 0}
                        >
                            {t('promptGenerator.apply', '프롬프트에 적용')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
