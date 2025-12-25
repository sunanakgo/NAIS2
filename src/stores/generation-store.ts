import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuthStore } from './auth-store'
import { useSettingsStore } from './settings-store'
import { generateImage, generateImageStream } from '@/services/novelai-api'
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { useFragmentStore } from './fragment-store'
import { useCharacterStore } from './character-store'
import { useCharacterPromptStore } from './character-prompt-store'
import { processWildcards } from '@/lib/wildcard-processor'
import i18n from '@/i18n'
import { toast } from '@/components/ui/use-toast'

interface Resolution {
    label: string
    width: number
    height: number
}

interface HistoryItem {
    id: string
    url: string // Base64 or Blob URL
    thumbnail?: string
    prompt: string
    seed: number
    timestamp: Date
}

export const AVAILABLE_MODELS = [
    { id: 'nai-diffusion-4-5-curated', name: 'NAI Diffusion V4.5 Curated' },
    { id: 'nai-diffusion-4-5-full', name: 'NAI Diffusion V4.5 Full' },
    { id: 'nai-diffusion-4-curated-preview', name: 'NAI Diffusion V4 Curated' },
    { id: 'nai-diffusion-4-full', name: 'NAI Diffusion V4 Full' },
    { id: 'nai-diffusion-3', name: 'NAI Diffusion V3 (Anime)' },
    { id: 'nai-diffusion-furry-3', name: 'NAI Diffusion Furry V3' },
] as const

interface GenerationState {
    // Prompt fields
    basePrompt: string
    additionalPrompt: string
    detailPrompt: string
    negativePrompt: string
    inpaintingPrompt: string

    // Model selection
    model: string

    // Generation settings
    steps: number
    cfgScale: number
    cfgRescale: number
    sampler: string
    scheduler: string
    smea: boolean
    smeaDyn: boolean

    seed: number
    seedLocked: boolean
    selectedResolution: Resolution

    // Batch generation
    batchCount: number
    currentBatch: number

    // I2I & Inpainting
    sourceImage: string | null
    strength: number
    noise: number
    mask: string | null
    i2iMode: 'i2i' | 'inpaint' | null

    // Timing
    lastGenerationTime: number | null  // ms
    estimatedTime: number | null

    // State
    isGenerating: boolean // Deprecated in favor of generatingMode check? Or keep for local main mode state?
    generatingMode: 'main' | 'scene' | null
    isCancelled: boolean
    previewImage: string | null
    history: HistoryItem[]

    // AbortController for cancellation
    abortController: AbortController | null

    // Streaming progress (0-100)
    streamProgress: number

    // Actions
    setBasePrompt: (prompt: string) => void
    setAdditionalPrompt: (prompt: string) => void
    setDetailPrompt: (prompt: string) => void
    setNegativePrompt: (prompt: string) => void
    setInpaintingPrompt: (prompt: string) => void

    setModel: (model: string) => void
    setSteps: (steps: number) => void
    setCfgScale: (v: number) => void
    setCfgRescale: (v: number) => void
    setSampler: (v: string) => void
    setScheduler: (v: string) => void
    setSmea: (v: boolean) => void
    setSmeaDyn: (v: boolean) => void

    setSeed: (seed: number) => void
    setSeedLocked: (locked: boolean) => void
    setSelectedResolution: (resolution: Resolution) => void

    setBatchCount: (count: number) => void

    // I2I Actions
    setSourceImage: (img: string | null) => void
    setReferenceImage: (img: string | null) => void
    setStrength: (v: number) => void
    setNoise: (v: number) => void
    setMask: (mask: string | null) => void
    setI2IMode: (mode: 'i2i' | 'inpaint' | null) => void
    resetI2IParams: () => void

    generate: () => Promise<void>
    cancelGeneration: () => void
    addToHistory: (item: HistoryItem) => void
    clearHistory: () => void
    setPreviewImage: (url: string | null) => void
    setIsGenerating: (v: boolean) => void // Only for Main Mode use ideally
    setGeneratingMode: (mode: 'main' | 'scene' | null) => void
    setStreamProgress: (progress: number) => void
}

export const useGenerationStore = create<GenerationState>()(
    persist(
        (set, get) => ({
            // Initial state
            basePrompt: '',
            additionalPrompt: '',
            detailPrompt: '',
            negativePrompt: '',
            inpaintingPrompt: '',

            model: 'nai-diffusion-4-5-full',

            steps: 28,
            cfgScale: 5.0,
            cfgRescale: 0.0,
            sampler: 'k_euler_ancestral',
            scheduler: 'karras',
            smea: true,
            smeaDyn: true,

            seed: Math.floor(Math.random() * 4294967295),
            seedLocked: false,
            selectedResolution: { label: 'Portrait', width: 832, height: 1216 },

            batchCount: 1,
            currentBatch: 0,

            // I2I Init
            sourceImage: null,
            strength: 0.7,
            noise: 0.0,
            mask: null,
            i2iMode: null,

            lastGenerationTime: null,
            estimatedTime: null,

            isGenerating: false,
            generatingMode: null,
            isCancelled: false,
            previewImage: null,
            history: [],
            abortController: null,
            streamProgress: 0,

            // Actions
            setBasePrompt: (prompt) => set({ basePrompt: prompt }),
            setAdditionalPrompt: (prompt) => set({ additionalPrompt: prompt }),
            setDetailPrompt: (prompt) => set({ detailPrompt: prompt }),
            setNegativePrompt: (prompt) => set({ negativePrompt: prompt }),
            setInpaintingPrompt: (prompt) => set({ inpaintingPrompt: prompt }),

            setModel: (model) => set({ model }),
            setSteps: (steps) => set({ steps }),
            setCfgScale: (cfgScale) => set({ cfgScale }),
            setCfgRescale: (cfgRescale) => set({ cfgRescale }),
            setSampler: (sampler) => set({ sampler }),
            setScheduler: (scheduler) => set({ scheduler }),
            setSmea: (smea) => set({ smea }),
            setSmeaDyn: (smeaDyn) => set({ smeaDyn }),

            setSeed: (seed) => set({ seed }),
            setSeedLocked: (locked) => set({ seedLocked: locked }),
            setSelectedResolution: (resolution) => set({ selectedResolution: resolution }),

            setBatchCount: (count) => set({ batchCount: count }),

            setSourceImage: (img) => set({ sourceImage: img }),
            setReferenceImage: (img) => set({ sourceImage: img }), // Alias for now
            setStrength: (v) => set({ strength: v }),
            setNoise: (v) => set({ noise: v }),
            setMask: (mask) => set({ mask }),
            setI2IMode: (mode) => set({ i2iMode: mode }),
            resetI2IParams: () => set({ sourceImage: null, mask: null, strength: 0.7, noise: 0.0, inpaintingPrompt: '', i2iMode: null }),

            cancelGeneration: () => {
                const { abortController } = get()
                if (abortController) {
                    abortController.abort()
                }
                set({ isCancelled: true, isGenerating: false, generatingMode: null, currentBatch: 0 })
                toast({
                    title: i18n.t('toast.generationCancelled.title'),
                    description: i18n.t('toast.generationCancelled.desc'),
                })
            },

            generate: async () => {
                const {
                    basePrompt, additionalPrompt, detailPrompt, negativePrompt, inpaintingPrompt,
                    model, steps, cfgScale, cfgRescale, sampler, scheduler, smea, smeaDyn,
                    selectedResolution, seed, batchCount, lastGenerationTime,
                    sourceImage, strength, noise, mask
                } = get()

                const token = useAuthStore.getState().token
                const isVerified = useAuthStore.getState().isVerified

                if (!token || !isVerified) {
                    toast({
                        title: i18n.t('toast.tokenRequired.title'),
                        description: i18n.t('toast.tokenRequired.desc'),
                        variant: 'destructive',
                    })
                    return
                }

                // Check for cross-mode conflict
                if (get().generatingMode === 'scene') {
                    toast({
                        title: i18n.t('common.error'),
                        description: i18n.t('generate.conflictScene', '씬 모드에서 생성 중입니다.'),
                        variant: 'destructive',
                    })
                    return
                }

                // Create new AbortController
                const abortController = new AbortController()
                set({
                    isGenerating: true,
                    generatingMode: 'main',
                    isCancelled: false,
                    abortController,
                    estimatedTime: lastGenerationTime ? lastGenerationTime * batchCount : null
                })

                try {
                    for (let i = 0; i < batchCount; i++) {
                        // Check if cancelled
                        if (get().isCancelled) {
                            break
                        }

                        set({ currentBatch: i + 1 })

                        const startTime = Date.now()
                        let finalPrompt = [basePrompt, inpaintingPrompt, additionalPrompt, detailPrompt].filter(Boolean).join(', ')

                        // Fragment Substitution
                        const fragments = useFragmentStore.getState().fragments
                        finalPrompt = finalPrompt.replace(/<([^>]+)>/g, (match, label) => {
                            const fragment = fragments.find(f => f.label === label)
                            return fragment ? fragment.prompt : match
                        })

                        // Wildcard Processing (a/b/c → random selection)
                        finalPrompt = processWildcards(finalPrompt)

                        // Get current seed (may be different for each batch)
                        const currentSeed = get().seedLocked ? seed : (i === 0 ? seed : Math.floor(Math.random() * 4294967295))

                        if (!get().seedLocked && i > 0) {
                            set({ seed: currentSeed })
                        }

                        // Character & Vibe Data
                        const { characterImages, vibeImages } = useCharacterStore.getState()

                        // Character Prompts (Position-based)
                        const { characters: characterPrompts } = useCharacterPromptStore.getState()

                        // Check if streaming is enabled
                        const { useStreaming } = useSettingsStore.getState()

                        // For I2I and Inpainting, use source image dimensions instead of global resolution
                        let finalWidth = selectedResolution.width
                        let finalHeight = selectedResolution.height

                        if (sourceImage) {
                            // Extract dimensions from base64 image
                            try {
                                const img = new Image()
                                await new Promise<void>((resolve, reject) => {
                                    img.onload = () => resolve()
                                    img.onerror = () => reject(new Error('Failed to load source image'))
                                    img.src = sourceImage
                                })
                                finalWidth = img.width
                                finalHeight = img.height
                                console.log(`[Generate] Using source image dimensions: ${finalWidth}x${finalHeight}`)
                            } catch (e) {
                                console.warn('[Generate] Failed to get source image dimensions, using global resolution')
                            }
                        }

                        const generationParams = {
                            prompt: finalPrompt,
                            negative_prompt: negativePrompt,
                            model,
                            width: finalWidth,
                            height: finalHeight,
                            steps,
                            cfg_scale: cfgScale,
                            cfg_rescale: cfgRescale,
                            sampler,
                            scheduler,
                            smea,
                            smea_dyn: smeaDyn,
                            seed: currentSeed,

                            // I2I & Inpainting
                            sourceImage: sourceImage || undefined,
                            strength,
                            noise,
                            mask: mask || undefined,

                            // Character Reference
                            charImages: characterImages.map(img => img.base64),
                            charInfo: characterImages.map(img => img.informationExtracted),
                            charStrength: characterImages.map(img => img.strength),

                            // Vibe Transfer
                            vibeImages: vibeImages.map(img => img.base64),
                            vibeInfo: vibeImages.map(img => img.informationExtracted),
                            vibeStrength: vibeImages.map(img => img.strength),

                            // Character Prompts (V4 char_captions with positions)
                            characterPrompts: characterPrompts.filter(c => c.enabled),
                        }

                        // Reset progress
                        set({ streamProgress: 0 })

                        // Use streaming or non-streaming based on settings
                        // Streaming API supports I2I/Inpainting (same ImageGenerationRequest schema)
                        const canUseStreaming = useStreaming

                        let result
                        if (canUseStreaming) {
                            console.log('[Generate] Using streaming API...')
                            result = await generateImageStream(token, generationParams, (progress, partialImage) => {
                                set({ streamProgress: progress })
                                // Display intermediate preview images as they arrive
                                if (partialImage) {
                                    set({ previewImage: `data:image/png;base64,${partialImage}` })
                                }
                            })
                        } else {
                            console.log('[Generate] Using standard API...')
                            result = await generateImage(token, generationParams)
                        }

                        // Check if cancelled after API call
                        if (get().isCancelled) {
                            break
                        }

                        const generationTime = Date.now() - startTime
                        set({ lastGenerationTime: generationTime })

                        if (result.success && result.imageData) {
                            const imageUrl = `data:image/png;base64,${result.imageData}`
                            set({ previewImage: imageUrl })

                            const historyItem: HistoryItem = {
                                id: Date.now().toString(),
                                url: imageUrl,
                                prompt: finalPrompt,
                                seed: currentSeed,
                                timestamp: new Date(),
                            }

                            // Save Image: Try Tauri FS first, fallback to browser
                            const { savePath, autoSave, useAbsolutePath } = useSettingsStore.getState()

                            if (autoSave) {
                                try {
                                    const binaryString = atob(result.imageData)
                                    const bytes = new Uint8Array(binaryString.length)
                                    for (let j = 0; j < binaryString.length; j++) {
                                        bytes[j] = binaryString.charCodeAt(j)
                                    }

                                    // Determine generation type prefix
                                    let typePrefix = ''
                                    if (mask) {
                                        typePrefix = 'INPAINT_'
                                    } else if (sourceImage) {
                                        typePrefix = 'I2I_'
                                    }
                                    const fileName = `NAIS_${typePrefix}${Date.now()}.png`
                                    const outputDir = savePath || 'NAIS_Output'

                                    let fullPath: string

                                    if (useAbsolutePath) {
                                        // Save to absolute path directly
                                        const dirExists = await exists(outputDir)
                                        if (!dirExists) {
                                            await mkdir(outputDir, { recursive: true })
                                        }
                                        fullPath = await join(outputDir, fileName)
                                        await writeFile(fullPath, bytes)
                                    } else {
                                        // Save relative to Pictures directory
                                        const dirExists = await exists(outputDir, { baseDir: BaseDirectory.Picture })
                                        if (!dirExists) {
                                            await mkdir(outputDir, { baseDir: BaseDirectory.Picture })
                                        }
                                        await writeFile(`${outputDir}/${fileName}`, bytes, { baseDir: BaseDirectory.Picture })
                                        const picPath = await pictureDir()
                                        fullPath = await join(picPath, outputDir, fileName)
                                    }

                                    // Notify HistoryPanel immediately with image data
                                    try {
                                        window.dispatchEvent(new CustomEvent('newImageGenerated', {
                                            detail: { path: fullPath, data: imageUrl }
                                        }))
                                    } catch (e) {
                                        console.warn('Failed to dispatch newImageGenerated event:', e)
                                    }
                                } catch (e) {
                                    console.warn('Tauri FS save failed, using download fallback:', e)
                                    const link = document.createElement('a')
                                    link.href = imageUrl
                                    link.download = `NAIS_${Date.now()}.png`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                }
                            }

                            set(state => ({
                                history: [historyItem, ...state.history].slice(0, 50)
                            }))

                            // Refresh Anlas balance
                            useAuthStore.getState().refreshAnlas()

                            // New seed if not locked
                            if (!get().seedLocked) {
                                set({ seed: Math.floor(Math.random() * 4294967295) })
                            }
                        } else {
                            toast({
                                title: i18n.t('toast.generationFailed.title'),
                                description: result.error || i18n.t('toast.unknownError'),
                                variant: 'destructive',
                            })
                            break
                        }
                    }

                    // Show completion toast for batch
                    if (!get().isCancelled && batchCount > 1) {
                        toast({
                            title: i18n.t('toast.batchComplete.title'),
                            description: i18n.t('toast.batchComplete.desc', { count: batchCount }),
                            variant: 'success',
                        })
                    }

                } catch (error) {
                    if (get().isCancelled) {
                        return
                    }
                    console.error('Generation failed:', error)
                    toast({
                        title: i18n.t('toast.errorOccurred.title'),
                        description: i18n.t('toast.errorOccurred.desc'),
                        variant: 'destructive',
                    })
                } finally {
                    set({ isGenerating: false, generatingMode: null, currentBatch: 0, abortController: null })
                }
            },

            addToHistory: (item) => set(state => ({
                history: [item, ...state.history].slice(0, 50)
            })),

            clearHistory: () => set({ history: [] }),

            setPreviewImage: (url) => set({ previewImage: url }),
            setIsGenerating: (v) => set({ isGenerating: v, generatingMode: v ? 'main' : null }),
            setGeneratingMode: (mode) => set({ generatingMode: mode }),
            setStreamProgress: (progress) => set({ streamProgress: progress }),
        }),
        {
            name: 'nais2-generation',
            partialize: (state) => ({
                // Prompts
                basePrompt: state.basePrompt,
                additionalPrompt: state.additionalPrompt,
                detailPrompt: state.detailPrompt,
                negativePrompt: state.negativePrompt,
                // Model & Parameters
                model: state.model,
                steps: state.steps,
                cfgScale: state.cfgScale,
                cfgRescale: state.cfgRescale,
                sampler: state.sampler,
                scheduler: state.scheduler,
                smea: state.smea,
                smeaDyn: state.smeaDyn,
                // Seed - only save if locked
                ...(state.seedLocked ? { seed: state.seed } : {}),
                seedLocked: state.seedLocked,
                selectedResolution: state.selectedResolution,
                // Batch
                batchCount: state.batchCount,
                // Timing (for estimated time)
                lastGenerationTime: state.lastGenerationTime,
                // NOTE: history is NOT persisted to avoid localStorage quota issues
            }),
        }
    )
)
