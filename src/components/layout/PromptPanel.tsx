import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { FragmentDialog } from '@/components/fragments/FragmentDialog'
import { SourceImagePanel } from '@/components/layout/SourceImagePanel'
import { CharacterSettingsDialog } from '@/components/character/CharacterSettingsDialog'
import { CharacterPromptDialog } from '@/components/character/CharacterPromptDialog'
import { PromptGeneratorDialog } from '@/components/prompt/PromptGeneratorDialog'
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import Counter from '@/components/ui/counter'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { generateRandomSeed } from '@/lib/utils'
import {
    ImagePlus,
    Dice5,
    Lock,
    Unlock,
    SlidersHorizontal,
    Cpu,
    Film, // Added for Scene Mode icon
} from 'lucide-react'
import GeminiIcon from '@/assets/gemini-color.svg'
import { useGenerationStore, AVAILABLE_MODELS } from '@/stores/generation-store'
import { useSceneStore } from '@/stores/scene-store'
import { useSettingsStore } from '@/stores/settings-store'
import { ResolutionSelector } from '@/components/ui/ResolutionSelector'

const SAMPLERS = [
    'k_euler',
    'k_euler_ancestral',
    'k_dpmpp_2s_ancestral',
    'k_dpmpp_2m',
    'k_dpmpp_sde',
    'ddim',
]

const SCHEDULERS = ['native', 'karras', 'exponential', 'polyexponential']

export function PromptPanel() {
    const { t } = useTranslation()
    const location = useLocation()
    const isSceneMode = location.pathname.startsWith('/scenes')

    // Zustand 선택적 구독 - sceneStore
    const activePresetId = useSceneStore(state => state.activePresetId)
    const getTotalQueueCount = useSceneStore(state => state.getTotalQueueCount)
    const sceneIsGenerating = useSceneStore(state => state.isGenerating)
    const setSceneIsGenerating = useSceneStore(state => state.setIsGenerating)
    const completedCount = useSceneStore(state => state.completedCount)
    const totalQueuedCount = useSceneStore(state => state.totalQueuedCount)

    const sceneQueueCount = activePresetId ? getTotalQueueCount(activePresetId) : 0

    // Zustand 선택적 구독 - generationStore (상태)
    const basePrompt = useGenerationStore(state => state.basePrompt)
    const additionalPrompt = useGenerationStore(state => state.additionalPrompt)
    const detailPrompt = useGenerationStore(state => state.detailPrompt)
    const negativePrompt = useGenerationStore(state => state.negativePrompt)
    const seed = useGenerationStore(state => state.seed)
    const seedLocked = useGenerationStore(state => state.seedLocked)
    const selectedResolution = useGenerationStore(state => state.selectedResolution)
    const isGenerating = useGenerationStore(state => state.isGenerating)
    const model = useGenerationStore(state => state.model)
    const steps = useGenerationStore(state => state.steps)
    const cfgScale = useGenerationStore(state => state.cfgScale)
    const cfgRescale = useGenerationStore(state => state.cfgRescale)
    const sampler = useGenerationStore(state => state.sampler)
    const scheduler = useGenerationStore(state => state.scheduler)
    const smea = useGenerationStore(state => state.smea)
    const smeaDyn = useGenerationStore(state => state.smeaDyn)
    const batchCount = useGenerationStore(state => state.batchCount)
    const currentBatch = useGenerationStore(state => state.currentBatch)
    const generatingMode = useGenerationStore(state => state.generatingMode)

    // Zustand 선택적 구독 - generationStore (액션)
    const setBasePrompt = useGenerationStore(state => state.setBasePrompt)
    const setAdditionalPrompt = useGenerationStore(state => state.setAdditionalPrompt)
    const setDetailPrompt = useGenerationStore(state => state.setDetailPrompt)
    const setNegativePrompt = useGenerationStore(state => state.setNegativePrompt)
    const setSeed = useGenerationStore(state => state.setSeed)
    const setSeedLocked = useGenerationStore(state => state.setSeedLocked)
    const setSelectedResolution = useGenerationStore(state => state.setSelectedResolution)
    const setModel = useGenerationStore(state => state.setModel)
    const setSteps = useGenerationStore(state => state.setSteps)
    const setCfgScale = useGenerationStore(state => state.setCfgScale)
    const setCfgRescale = useGenerationStore(state => state.setCfgRescale)
    const setSampler = useGenerationStore(state => state.setSampler)
    const setScheduler = useGenerationStore(state => state.setScheduler)
    const setSmea = useGenerationStore(state => state.setSmea)
    const setSmeaDyn = useGenerationStore(state => state.setSmeaDyn)
    const setBatchCount = useGenerationStore(state => state.setBatchCount)
    const generate = useGenerationStore(state => state.generate)
    const cancelGeneration = useGenerationStore(state => state.cancelGeneration)

    // Zustand 선택적 구독 - settingsStore
    const addCustomResolution = useSettingsStore(state => state.addCustomResolution)
    const promptFontSize = useSettingsStore(state => state.promptFontSize)

    // Custom resolution dialog state
    const [customDialogOpen, setCustomDialogOpen] = useState(false)
    const [newResLabel, setNewResLabel] = useState('')
    const [newResWidth, setNewResWidth] = useState(1920)
    const [newResHeight, setNewResHeight] = useState(1080)
    const [promptGenOpen, setPromptGenOpen] = useState(false)

    const handleRandomSeed = () => {
        if (!seedLocked) {
            setSeed(generateRandomSeed())
        }
    }

    const handleAddCustomResolution = () => {
        if (newResWidth > 0 && newResHeight > 0) {
            const label = newResLabel || `${newResWidth}×${newResHeight}`
            addCustomResolution({
                label,
                width: newResWidth,
                height: newResHeight
            })
            setSelectedResolution({
                label,
                width: newResWidth,
                height: newResHeight
            })
            setCustomDialogOpen(false)
            setNewResLabel('')
            setNewResWidth(1920)
            setNewResHeight(1080)
        }
    }


    // Conflict Detection
    const isMainGenerating = generatingMode === 'main'
    const isSceneGenerating = generatingMode === 'scene'
    const isConflict = isSceneMode ? isMainGenerating : isSceneGenerating

    const handleGenerateOrCancel = useCallback(() => {
        if (isConflict) return // Prevent action if conflict exists

        if (isSceneMode) {
            setSceneIsGenerating(!sceneIsGenerating)
            return
        }

        if (isGenerating) {
            cancelGeneration()
        } else {
            generate()
        }
    }, [isConflict, isSceneMode, sceneIsGenerating, setSceneIsGenerating, isGenerating, cancelGeneration, generate])

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden p-2">
            {/* Source Image Panel (I2I/Inpaint Mode) */}
            <SourceImagePanel />

            {/* Prompt Inputs Area (Flex Grow, No Scroll on Container) */}
            <div className="flex-1 flex flex-col min-h-0 gap-2 mb-2">
                {/* Base Prompt - 30% */}
                <div className="flex flex-col min-h-0 basis-[30%]">
                    <label className="text-xs font-medium text-muted-foreground mb-1">{t('prompt.base')}</label>
                    <AutocompleteTextarea
                        placeholder={t('prompt.basePlaceholder')}
                        value={basePrompt}
                        onChange={(e) => setBasePrompt(e.target.value)}
                        className="flex-1 min-h-0 resize-none rounded-xl"
                        style={{ fontSize: `${promptFontSize}px` }}
                    />
                </div>

                {/* Additional Prompt - 25% */}
                <div className="flex flex-col min-h-0 basis-[25%]">
                    <label className="text-xs font-medium text-muted-foreground mb-1">{t('prompt.additional')}</label>
                    <AutocompleteTextarea
                        placeholder={t('prompt.additionalPlaceholder')}
                        value={additionalPrompt}
                        onChange={(e) => setAdditionalPrompt(e.target.value)}
                        className="flex-1 min-h-0 resize-none rounded-xl"
                        style={{ fontSize: `${promptFontSize}px` }}
                    />
                </div>

                {/* Detail Prompt - 25% */}
                <div className="flex flex-col min-h-0 basis-[25%]">
                    <label className="text-xs font-medium text-muted-foreground mb-1">{t('prompt.detail')}</label>
                    <AutocompleteTextarea
                        placeholder={t('prompt.detailPlaceholder')}
                        value={detailPrompt}
                        onChange={(e) => setDetailPrompt(e.target.value)}
                        className="flex-1 min-h-0 resize-none rounded-xl"
                        style={{ fontSize: `${promptFontSize}px` }}
                    />
                </div>

                {/* Negative Prompt - 20% */}
                <div className="flex flex-col min-h-0 basis-[20%]">
                    <label className="text-xs font-medium text-destructive/80 mb-1">{t('prompt.negative')}</label>
                    <AutocompleteTextarea
                        placeholder={t('prompt.negativePlaceholder')}
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        className="flex-1 min-h-0 resize-none rounded-xl border-destructive/20"
                        style={{ fontSize: `${promptFontSize}px` }}
                    />
                </div>
            </div>

            {/* Quick Actions & Parameters Button */}
            <div className="flex gap-2 mb-3">
                <CharacterSettingsDialog />
                <CharacterPromptDialog />
                <FragmentDialog />
                {/* AI Prompt Generator Button */}
                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-xl shrink-0 hover:bg-accent"
                    onClick={() => setPromptGenOpen(true)}
                    title={t('promptGenerator.button', 'AI 프롬프트')}
                >
                    <img src={GeminiIcon} alt="Gemini" className="h-5 w-5" />
                </Button>
                {/* Parameter Settings Dialog */}
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
                            <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{t('parameters.title')}</DialogTitle>
                            <DialogDescription>
                                {t('parameters.description')}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-5 py-4">
                            {/* Model Selection */}
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Cpu className="h-4 w-4" />
                                    {t('parameters.model')}
                                </Label>
                                <Select value={model} onValueChange={setModel}>
                                    <SelectTrigger className="rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {AVAILABLE_MODELS.map((m) => (
                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Resolution (Moved here) */}
                            {/* Resolution (Moved here) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    {t('settingsPage.general.resolution', '해상도')}
                                </Label>
                                <ResolutionSelector
                                    value={selectedResolution}
                                    onChange={setSelectedResolution}
                                    disabled={isGenerating}
                                />
                            </div>

                            {/* Seed (Moved here) */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('settings.seed')}</label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={seed}
                                        onChange={(e) => setSeed(Number(e.target.value))}
                                        disabled={seedLocked}
                                        className="flex-1 h-9 text-xs rounded-xl"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className={cn("h-9 w-9 rounded-xl shrink-0", seedLocked && 'border-primary text-primary bg-primary/10')}
                                        onClick={() => setSeedLocked(!seedLocked)}
                                    >
                                        {seedLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl shrink-0"
                                        onClick={handleRandomSeed}
                                        disabled={seedLocked}
                                    >
                                        <Dice5 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Steps */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t('parameters.steps')}</Label>
                                    <span className="text-sm text-muted-foreground">{steps}</span>
                                </div>
                                <Slider
                                    value={[steps]}
                                    onValueChange={([v]) => setSteps(v)}
                                    min={1}
                                    max={50}
                                    step={1}
                                    className={cn("w-full", steps > 28 && "[&>.relative>.bg-primary]:bg-destructive")}
                                />
                            </div>

                            {/* CFG Scale */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t('parameters.cfgScale')}</Label>
                                    <span className="text-sm text-muted-foreground">{cfgScale.toFixed(1)}</span>
                                </div>
                                <Slider
                                    value={[cfgScale]}
                                    onValueChange={([v]) => setCfgScale(v)}
                                    min={1}
                                    max={10}
                                    step={0.5}
                                    className="w-full"
                                />
                            </div>

                            {/* CFG Rescale */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>{t('parameters.cfgRescale')}</Label>
                                    <span className="text-sm text-muted-foreground">{cfgRescale.toFixed(2)}</span>
                                </div>
                                <Slider
                                    value={[cfgRescale]}
                                    onValueChange={([v]) => setCfgRescale(v)}
                                    min={0}
                                    max={1}
                                    step={0.05}
                                    className="w-full"
                                />
                            </div>

                            {/* Sampler & Scheduler */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>{t('parameters.sampler')}</Label>
                                    <Select value={sampler} onValueChange={setSampler}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SAMPLERS.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('parameters.scheduler')}</Label>
                                    <Select value={scheduler} onValueChange={setScheduler}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SCHEDULERS.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* SMEA & SMEA DYN */}
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex flex-col gap-1">
                                    <Label className="cursor-pointer" onClick={() => setSmea(!smea)}>
                                        {t('parameters.smea')}
                                    </Label>
                                    <span className="text-xs text-muted-foreground">Switchable Multi-head External Attention</span>
                                </div>
                                <Switch
                                    checked={smea}
                                    onChange={(e) => setSmea(e.target.checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <Label className="cursor-pointer" onClick={() => setSmeaDyn(!smeaDyn)}>
                                        {t('parameters.smeaDyn')}
                                    </Label>
                                    <span className="text-xs text-muted-foreground">Dynamic SMEA</span>
                                </div>
                                <Switch
                                    checked={smeaDyn}
                                    disabled={!smea}
                                    onChange={(e) => setSmeaDyn(e.target.checked)}
                                />
                            </div>

                        </div>
                        {/* Additional Custom Resolution Dialog inside this context was causing issues if not careful, but it's fine here as long as it's separate */}
                        <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                            <DialogContent className="sm:max-w-[360px]">
                                <DialogHeader>
                                    <DialogTitle>{t('resolutions.addCustom')}</DialogTitle>
                                    <DialogDescription>
                                        {t('resolutions.addCustomDesc')}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label>{t('resolutions.presetName')}</Label>
                                        <Input
                                            value={newResLabel}
                                            onChange={(e) => setNewResLabel(e.target.value)}
                                            placeholder="FHD, 4K, etc."
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <Label>{t('resolutions.width')}</Label>
                                            <Input
                                                type="number"
                                                value={newResWidth}
                                                onChange={(e) => setNewResWidth(Number(e.target.value))}
                                                className="rounded-xl"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('resolutions.height')}</Label>
                                            <Input
                                                type="number"
                                                value={newResHeight}
                                                onChange={(e) => setNewResHeight(Number(e.target.value))}
                                                className="rounded-xl"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setCustomDialogOpen(false)}>
                                        {t('common.cancel')}
                                    </Button>
                                    <Button onClick={handleAddCustomResolution}>
                                        {t('common.save')}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </DialogContent>
                </Dialog>
            </div>

            {/* AI Prompt Generator Dialog */}
            <PromptGeneratorDialog
                open={promptGenOpen}
                onOpenChange={setPromptGenOpen}
                onApply={(tags) => {
                    // Append to additional prompt
                    const current = additionalPrompt.trim()
                    const newValue = current ? `${current}, ${tags}` : tags
                    setAdditionalPrompt(newValue)
                }}
            />

            {/* Bottom Generate Button Area */}
            <div className="p-0">
                {/* Generate Button + Counter */}
                <div className="flex gap-2">
                    <Button
                        variant={(isGenerating || (isSceneMode && sceneIsGenerating)) ? "destructive" : "generate"}
                        size="lg"
                        className={cn(
                            "flex-1 h-12 rounded-xl text-base font-semibold shadow-lg transition-all duration-200",
                            isConflict && "opacity-50 cursor-not-allowed"
                        )}
                        onClick={handleGenerateOrCancel}
                        disabled={
                            (isSceneMode && sceneQueueCount === 0 && !sceneIsGenerating) ||
                            isConflict
                        }
                    >
                        {isSceneMode ? (
                            sceneIsGenerating ? (
                                <>
                                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {t('common.cancel', '취소')} {totalQueuedCount > 0 && `(${completedCount + 1}/${totalQueuedCount})`}
                                </>
                            ) : (
                                <>
                                    <Film className="mr-2 h-5 w-5" />
                                    {t('scene.generateAll', '씬 생성')} {sceneQueueCount > 0 && `(${sceneQueueCount})`}
                                </>
                            )
                        ) : (
                            isGenerating ? (
                                <>
                                    <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {batchCount > 1
                                        ? `${t('generate.cancel')} (${currentBatch}/${batchCount})`
                                        : t('generate.cancel')
                                    }
                                </>
                            ) : (
                                <>
                                    <ImagePlus className="mr-2 h-5 w-5" />
                                    {t('generate.button')}
                                </>
                            )
                        )}
                    </Button>
                    <Counter
                        value={batchCount}
                        onChange={setBatchCount}
                        min={1}
                        max={10}
                        fontSize={16}
                    />
                </div>
            </div>
        </div>
    )
}
