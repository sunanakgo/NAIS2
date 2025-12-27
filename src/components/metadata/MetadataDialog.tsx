import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { NAIMetadata, parseMetadataFromFile, parseMetadataFromBase64 } from '@/lib/metadata-parser'
import { usePresetStore } from '@/stores/preset-store'
import { useGenerationStore } from '@/stores/generation-store'
import { useCharacterPromptStore } from '@/stores/character-prompt-store'
import { toast } from '@/components/ui/use-toast'
import { FileImage, Download, AlertCircle } from 'lucide-react'
import { useCharacterStore } from '@/stores/character-store'

interface MetadataDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialImage?: string // base64 data URL
}

interface LoadOptions {
    prompts: boolean
    parameters: boolean
    resolution: boolean
    seed: boolean
    characterPrompts: boolean
    vibeTransfer: boolean
}

export function MetadataDialog({ open, onOpenChange, initialImage }: MetadataDialogProps) {
    const { t } = useTranslation()
    const { presets, activePresetId, loadPreset, syncFromGenerationStore } = usePresetStore()
    const genStore = useGenerationStore()
    const charStore = useCharacterPromptStore()
    const { addVibeImage } = useCharacterStore()

    const [metadata, setMetadata] = useState<NAIMetadata | null>(null)
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [selectedPresetId, setSelectedPresetId] = useState<string>(activePresetId || 'default')
    const [loadOptions, setLoadOptions] = useState<LoadOptions>({
        prompts: true,
        parameters: true,
        resolution: true,
        seed: true,
        characterPrompts: true,
        vibeTransfer: true,
    })
    const [isDragOver, setIsDragOver] = useState(false)

    // Load metadata from initial image when dialog opens with an image
    useEffect(() => {
        if (open && initialImage) {
            setImageDataUrl(initialImage)
            loadFromBase64(initialImage)
        }
        // Reset when dialog closes
        if (!open) {
            setMetadata(null)
            setImageDataUrl(null)
        }
    }, [open, initialImage])

    const loadFromBase64 = async (base64: string) => {
        setIsLoading(true)
        try {
            const meta = await parseMetadataFromBase64(base64)
            setMetadata(meta)
            if (!meta) {
                toast({
                    title: t('metadata.noData', '메타데이터 없음'),
                    description: t('metadata.noDataDesc', '이 이미지에서 메타데이터를 찾을 수 없습니다.'),
                    variant: 'destructive',
                })
            }
        } catch (error) {
            console.error('Failed to load metadata:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)

        const file = e.dataTransfer.files[0]
        if (!file || !file.type.startsWith('image/')) {
            toast({
                title: t('metadata.invalidFile', '잘못된 파일'),
                description: t('metadata.invalidFileDesc', 'PNG 이미지 파일만 지원합니다.'),
                variant: 'destructive',
            })
            return
        }

        setIsLoading(true)
        try {
            // Read file as data URL for preview
            const reader = new FileReader()
            reader.onload = async () => {
                const dataUrl = reader.result as string
                setImageDataUrl(dataUrl)

                // Parse metadata
                const meta = await parseMetadataFromFile(file)
                setMetadata(meta)
                if (!meta) {
                    toast({
                        title: t('metadata.noData', '메타데이터 없음'),
                        description: t('metadata.noDataDesc', '이 이미지에서 메타데이터를 찾을 수 없습니다.'),
                        variant: 'destructive',
                    })
                }
                setIsLoading(false)
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error('Failed to parse file:', error)
            setIsLoading(false)
        }
    }, [t])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
    }

    const handleApply = () => {
        if (!metadata) return

        // First, load the target preset
        if (selectedPresetId !== activePresetId) {
            loadPreset(selectedPresetId)
        }

        // Apply selected metadata to generation store
        if (loadOptions.prompts) {
            if (metadata.prompt) genStore.setBasePrompt(metadata.prompt)
            if (metadata.negativePrompt) genStore.setNegativePrompt(metadata.negativePrompt)
        }

        if (loadOptions.parameters) {
            if (metadata.steps) genStore.setSteps(metadata.steps)
            if (metadata.cfgScale) genStore.setCfgScale(metadata.cfgScale)
            if (metadata.cfgRescale) genStore.setCfgRescale(metadata.cfgRescale)
            if (metadata.sampler) genStore.setSampler(metadata.sampler)
            if (metadata.scheduler) genStore.setScheduler(metadata.scheduler)
            if (typeof metadata.smea === 'boolean') genStore.setSmea(metadata.smea)
            if (typeof metadata.smeaDyn === 'boolean') genStore.setSmeaDyn(metadata.smeaDyn)
            if (typeof metadata.variety === 'boolean') genStore.setVariety(metadata.variety)
        }

        if (loadOptions.resolution && metadata.width && metadata.height) {
            genStore.setSelectedResolution({
                label: `${metadata.width}x${metadata.height}`,
                width: metadata.width,
                height: metadata.height,
            })
        }

        if (loadOptions.seed && metadata.seed) {
            genStore.setSeed(metadata.seed)
            genStore.setSeedLocked(true)
        }

        if (loadOptions.characterPrompts && metadata.v4_prompt?.caption?.char_captions) {
            charStore.clearAll()
            metadata.v4_prompt.caption.char_captions.forEach((cap, index) => {
                const presetId = Date.now().toString() + Math.random().toString(36).substr(2, 9) + index

                // 1. Add to Library (Presets)
                charStore.addPreset({
                    id: presetId,
                    name: `Imported ${index + 1}`,
                    prompt: cap.char_caption,
                    negative: ''
                })

                // 2. Add to Stage (Linked)
                cap.centers.forEach(center => {
                    charStore.addCharacter({
                        presetId: presetId,
                        prompt: cap.char_caption,
                        position: center,
                        enabled: true
                    })
                })
            })
        }

        if (loadOptions.vibeTransfer && metadata.encodedVibes && metadata.encodedVibes.length > 0) {
            // Import Vibe Transfers (Encoded only)
            const infos = metadata.vibeTransferInfo || []
            metadata.encodedVibes.forEach((encoded, index) => {
                // We don't have the original image, so we pass empty string for base64
                // The CharacterList component will handle displaying a placeholder
                addVibeImage(
                    '',
                    encoded,
                    infos[index]?.informationExtracted ?? 1.0,
                    infos[index]?.strength ?? 0.6
                )
            })
        }

        // Save to preset
        syncFromGenerationStore()

        toast({
            title: t('metadata.applied', '메타데이터 적용됨'),
            description: t('metadata.appliedDesc', '선택한 설정이 프리셋에 적용되었습니다.'),
            variant: 'success',
        })

        onOpenChange(false)
    }

    const toggleOption = (key: keyof LoadOptions) => {
        setLoadOptions(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const allSelected = Object.values(loadOptions).every(v => v)
    const toggleAll = () => {
        const newValue = !allSelected
        setLoadOptions({
            prompts: newValue,
            parameters: newValue,
            resolution: newValue,
            seed: newValue,
            characterPrompts: newValue,
            vibeTransfer: newValue,
        })
    }

    const resetAndLoadAnother = () => {
        setMetadata(null)
        setImageDataUrl(null)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileImage className="h-5 w-5" />
                        {t('metadata.title', '메타데이터 불러오기')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('metadata.description', '이미지에서 생성 설정을 추출하여 프리셋에 적용합니다.')}
                    </DialogDescription>
                </DialogHeader>

                {!metadata ? (
                    // Drop zone
                    <div
                        className={`
                            border-2 border-dashed rounded-xl p-12 text-center transition-colors
                            ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'}
                            ${isLoading ? 'opacity-50' : 'cursor-pointer hover:border-primary/50'}
                        `}
                        onDrop={handleFileDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-base font-medium mb-2">
                            {isLoading ? t('metadata.loading', '불러오는 중...') : t('metadata.dropHere', '이미지를 여기에 드롭하세요')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {t('metadata.dropDesc', 'PNG 파일에서 메타데이터를 추출합니다')}
                        </p>
                    </div>
                ) : (
                    // Two-column layout: Image | Info
                    <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
                        {/* Left: Image Preview */}
                        <div className="w-1/3 flex-shrink-0">
                            {imageDataUrl && (
                                <div className="rounded-xl overflow-hidden bg-muted/30 border">
                                    <img
                                        src={imageDataUrl}
                                        alt="Preview"
                                        className="w-full h-auto object-contain max-h-[400px]"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right: Metadata Info */}
                        <div className="flex-1 flex flex-col min-h-0 min-w-0">
                            <ScrollArea className="flex-1 pr-2">
                                <div className="space-y-4">
                                    {/* Prompt */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="opt-prompts"
                                                checked={loadOptions.prompts}
                                                onCheckedChange={() => toggleOption('prompts')}
                                            />
                                            <Label htmlFor="opt-prompts" className="text-sm font-medium cursor-pointer">
                                                {t('metadata.optPrompts', '프롬프트')}
                                            </Label>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-muted-foreground">
                                                Positive Prompt
                                            </Label>
                                            <Textarea
                                                value={metadata.prompt || ''}
                                                readOnly
                                                className="text-xs resize-none h-48 bg-muted/30 cursor-text select-text"
                                                placeholder="No prompt found"
                                            />
                                        </div>
                                    </div>

                                    {/* Negative Prompt */}
                                    {metadata.negativePrompt && (
                                        <div className="space-y-1">
                                            <Label className="text-xs font-medium text-muted-foreground">
                                                Negative Prompt
                                            </Label>
                                            <Textarea
                                                value={metadata.negativePrompt}
                                                readOnly
                                                className="text-xs resize-none h-24 bg-muted/30 cursor-text select-text"
                                            />
                                        </div>
                                    )}

                                    <Separator />

                                    {/* Parameters */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="opt-params"
                                                checked={loadOptions.parameters}
                                                onCheckedChange={() => toggleOption('parameters')}
                                            />
                                            <Label htmlFor="opt-params" className="text-sm font-medium cursor-pointer">
                                                {t('metadata.optParams', '파라미터')}
                                            </Label>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">Steps:</span>
                                                <span className="ml-1 font-medium">{metadata.steps || '-'}</span>
                                            </div>
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">CFG:</span>
                                                <span className="ml-1 font-medium">{metadata.cfgScale || '-'}</span>
                                            </div>
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">Rescale:</span>
                                                <span className="ml-1 font-medium">{metadata.cfgRescale ?? '-'}</span>
                                            </div>
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">Sampler:</span>
                                                <span className="ml-1 font-medium">{metadata.sampler || '-'}</span>
                                            </div>
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">SMEA:</span>
                                                <span className="ml-1 font-medium">
                                                    {metadata.smea ? 'ON' : 'OFF'}
                                                    {metadata.smeaDyn ? ' (DYN)' : ''}
                                                </span>
                                            </div>
                                            <div className="bg-muted/30 rounded-lg p-2">
                                                <span className="text-muted-foreground">Variety:</span>
                                                <span className="ml-1 font-medium">
                                                    {metadata.variety ? '+19' : 'OFF'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resolution */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="opt-resolution"
                                                checked={loadOptions.resolution}
                                                onCheckedChange={() => toggleOption('resolution')}
                                            />
                                            <Label htmlFor="opt-resolution" className="text-sm font-medium cursor-pointer">
                                                {t('metadata.optResolution', '해상도')}
                                            </Label>
                                            <span className="text-sm text-muted-foreground ml-auto">
                                                {metadata.width && metadata.height
                                                    ? `${metadata.width} × ${metadata.height}`
                                                    : '-'
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* Seed */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="opt-seed"
                                                checked={loadOptions.seed}
                                                onCheckedChange={() => toggleOption('seed')}
                                            />
                                            <Label htmlFor="opt-seed" className="text-sm font-medium cursor-pointer">
                                                {t('metadata.optSeed', '시드')}
                                            </Label>
                                            <span className="text-sm font-mono text-muted-foreground ml-auto">
                                                {metadata.seed || '-'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Character Prompts */}
                                    {metadata.v4_prompt?.caption?.char_captions && metadata.v4_prompt.caption.char_captions.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="opt-char-prompts"
                                                    checked={loadOptions.characterPrompts}
                                                    onCheckedChange={() => toggleOption('characterPrompts')}
                                                />
                                                <Label htmlFor="opt-char-prompts" className="text-sm font-medium cursor-pointer">
                                                    {t('metadata.optCharPrompts', '캐릭터 프롬프트')}
                                                </Label>
                                            </div>
                                            <div className="pl-6 space-y-1">
                                                {metadata.v4_prompt.caption.char_captions.map((cap, idx) => (
                                                    <div key={idx} className="bg-muted/30 rounded-lg p-2 text-xs">
                                                        <div className="font-medium text-muted-foreground mb-1">
                                                            Pos: {cap.centers.map(c => `(${c.x.toFixed(2)}, ${c.y.toFixed(2)})`).join(', ')}
                                                        </div>
                                                        <div className="line-clamp-2">{cap.char_caption}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Warnings / Vibe Transfer Info */}
                                    {metadata.hasVibeTransfer && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="opt-vibe"
                                                    checked={loadOptions.vibeTransfer}
                                                    onCheckedChange={() => toggleOption('vibeTransfer')}
                                                />
                                                <Label htmlFor="opt-vibe" className="text-sm font-medium cursor-pointer">
                                                    {t('metadata.optVibeVersion', '바이브 트랜스퍼 (데이터만 포함)')}
                                                </Label>
                                            </div>
                                            <p className="text-xs text-muted-foreground pl-6">
                                                {t('metadata.vibeDesc', '원본 이미지는 없지만, 인코딩된 바이브 데이터를 복원합니다.')}
                                            </p>
                                        </div>
                                    )}

                                    {metadata.hasCharacterReference && (
                                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                                {t('metadata.charRefWarning', 'Character Reference detected. Extraction supported via Director Tools.')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>

                            <Separator className="my-3" />

                            {/* Bottom Actions */}
                            <div className="space-y-3">
                                {/* Preset selector */}
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm whitespace-nowrap">{t('metadata.targetPreset', '적용할 프리셋')}</Label>
                                    <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                                        <SelectTrigger className="flex-1 h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {presets.map(preset => (
                                                <SelectItem key={preset.id} value={preset.id}>
                                                    {preset.isDefault ? t('preset.default', '기본') : preset.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                                        {allSelected ? t('metadata.deselectAll', '전체 해제') : t('metadata.selectAll', '전체 선택')}
                                    </Button>
                                    <div className="flex-1" />
                                    <Button variant="outline" size="sm" onClick={resetAndLoadAnother}>
                                        {t('metadata.loadAnother', '다른 이미지')}
                                    </Button>
                                    <Button size="sm" onClick={handleApply}>
                                        {t('metadata.apply', '적용')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
