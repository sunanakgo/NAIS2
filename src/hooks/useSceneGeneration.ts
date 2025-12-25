import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/use-toast'
import { useSceneStore } from '@/stores/scene-store'
import { useGenerationStore } from '@/stores/generation-store'
import { useFragmentStore } from '@/stores/fragment-store'
import { useCharacterPromptStore } from '@/stores/character-prompt-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuthStore } from '@/stores/auth-store'
import { generateImage, generateImageStream, GenerationParams } from '@/services/novelai-api'
import { BaseDirectory, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { processWildcards } from '@/lib/wildcard-processor'

import { useCharacterStore } from '@/stores/character-store'

export function useSceneGeneration() {
    const { t } = useTranslation()
    const { token } = useAuthStore()
    const { savePath, useStreaming: streamingView } = useSettingsStore()

    // Stores
    const generationStore = useGenerationStore()
    const characterPromptStore = useCharacterPromptStore()
    const characterStore = useCharacterStore()

    const {
        isGenerating,
        setIsGenerating,
        activePresetId,
        decrementFirstQueuedScene,
        addImageToScene,
        setStreamingData,
        initGenerationProgress,
        setGenerationProgress,
        completedCount,
        totalQueuedCount
    } = useSceneStore()

    // Ref to prevent concurrent processing
    const isProcessingRef = useRef(false)

    useEffect(() => {
        const processQueue = async () => {
            // CRITICAL: Prevent concurrent API requests (429 error fix)
            if (isProcessingRef.current) {
                return
            }

            if (!isGenerating) {
                // If scene generation stopped, ensure global mode is cleared if it was 'scene'
                if (generationStore.generatingMode === 'scene') {
                    generationStore.setGeneratingMode(null)
                }
                return
            }

            // Conflict Check: If Main Mode is generating, stop Scene Mode
            if (generationStore.generatingMode === 'main') {
                setIsGenerating(false)
                toast({
                    title: t('common.error', '오류'),
                    description: t('generate.conflictMain', '메인 모드에서 생성 중입니다.'),
                    variant: 'destructive'
                })
                return
            }

            // Set global mode to scene
            if (generationStore.generatingMode !== 'scene') {
                generationStore.setGeneratingMode('scene')
            }

            if (!activePresetId || !token) {
                setIsGenerating(false)
                return
            }

            const scene = decrementFirstQueuedScene(activePresetId)

            if (!scene) {
                setIsGenerating(false)
                // Global mode will be cleared by the effect or next loop
                generationStore.setGeneratingMode(null)

                // Reset progress
                setGenerationProgress(0, 0)
                toast({ title: t('generate.complete', '생성 완료'), description: t('generate.allComplete', '모든 예약된 작업이 완료되었습니다.'), variant: 'success' })
                return
            }

            // Mark as processing - prevents concurrent requests
            isProcessingRef.current = true

            // Start Streaming State for this scene
            setStreamingData(scene.id, null, 0)

            try {
                // Get fresh generation store state
                const genState = useGenerationStore.getState()

                // Construct Prompt
                const parts = [
                    genState.basePrompt,
                    genState.additionalPrompt,
                    scene.scenePrompt,
                    genState.detailPrompt,
                ].filter(p => p && p.trim())

                const { fragments } = useFragmentStore.getState()

                // Logic to replace <Fragment> tags
                // Matches <FragmentName> and replaces with fragment.prompt
                const processPrompts = (text: string) => {
                    if (!text) return ""
                    let processed = text

                    fragments.forEach(frag => {
                        const tag = `<${frag.label}>`
                        if (processed.includes(tag)) {
                            processed = processed.split(tag).join(frag.prompt)
                        }
                    })

                    return processed
                }

                // Apply substitution to all parts
                const processedParts = parts.map(p => processPrompts(p))
                // Apply wildcard processing to final prompt
                const finalPrompt = processWildcards(processedParts.join(', '))

                // Get Character & Vibe Data
                const { characterImages, vibeImages } = characterStore
                const { characters: characterPrompts } = characterPromptStore

                // Determine Seed (Randomize if not locked)
                const finalSeed = genState.seedLocked ? genState.seed : Math.floor(Math.random() * 4294967295)

                const params: GenerationParams = {
                    prompt: finalPrompt,
                    negative_prompt: genState.negativePrompt,
                    steps: genState.steps,
                    cfg_scale: genState.cfgScale,
                    cfg_rescale: genState.cfgRescale,
                    sampler: genState.sampler,
                    scheduler: genState.scheduler,
                    smea: genState.smea,
                    smea_dyn: genState.smeaDyn,
                    seed: finalSeed,

                    width: scene.width || genState.selectedResolution.width,
                    height: scene.height || genState.selectedResolution.height,

                    model: genState.model,

                    sourceImage: genState.sourceImage || undefined,
                    strength: genState.strength,
                    noise: genState.noise,
                    mask: genState.mask || undefined,

                    // Character Reference
                    charImages: characterImages.map(img => img.base64),
                    charInfo: characterImages.map(img => img.informationExtracted),
                    charStrength: characterImages.map(img => img.strength),

                    // Vibe Transfer
                    vibeImages: vibeImages.map(img => img.base64),
                    vibeInfo: vibeImages.map(img => img.informationExtracted),
                    vibeStrength: vibeImages.map(img => img.strength),

                    // Character Prompts
                    characterPrompts: characterPrompts
                        .filter(c => c.enabled)
                        .map(c => ({
                            prompt: c.prompt,
                            negative: c.negative,
                            enabled: c.enabled,
                            position: c.position
                        }))
                }

                let result

                if (streamingView) {
                    // Streaming Generation
                    result = await generateImageStream(token, params, (progress, image) => {
                        if (image) {
                            setStreamingData(scene.id, `data:image/png;base64,${image}`, progress / 100)
                        }
                    })
                } else {
                    // Normal Generation
                    result = await generateImage(token, params)
                }

                // Check if generation was stopped mid-way
                if (!useSceneStore.getState().isGenerating) {
                    setStreamingData(null, null, 0)
                    isProcessingRef.current = false
                    return
                }

                if (result.success && result.imageData) {
                    // Sanitize scene name for folder name
                    const safeSceneName = scene.name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled_Scene'
                    const fileName = `NAIS_SCENE_${Date.now()}.png`

                    try {
                        const base64Data = result.imageData.replace(/^data:image\/png;base64,/, '')
                        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

                        const { useAbsolutePath } = useSettingsStore.getState()
                        let fullPath: string

                        if (useAbsolutePath && savePath) {
                            // Save to absolute path: savePath/NAIS_Scene/sceneName/
                            const naisSceneDir = await join(savePath, 'NAIS_Scene')
                            const sceneDir = await join(naisSceneDir, safeSceneName)

                            if (!(await exists(naisSceneDir))) {
                                await mkdir(naisSceneDir, { recursive: true })
                            }
                            if (!(await exists(sceneDir))) {
                                await mkdir(sceneDir, { recursive: true })
                            }

                            fullPath = await join(sceneDir, fileName)
                            await writeFile(fullPath, binaryData)
                        } else {
                            // Save to Pictures/NAIS_Scene/sceneName/
                            const baseDir = await pictureDir()
                            const sceneDir = `NAIS_Scene/${safeSceneName}`

                            const naisSceneDir = 'NAIS_Scene'
                            if (!(await exists(naisSceneDir, { baseDir: BaseDirectory.Picture }))) {
                                await mkdir(naisSceneDir, { baseDir: BaseDirectory.Picture })
                            }

                            if (!(await exists(sceneDir, { baseDir: BaseDirectory.Picture }))) {
                                await mkdir(sceneDir, { baseDir: BaseDirectory.Picture })
                            }

                            await writeFile(`${sceneDir}/${fileName}`, binaryData, { baseDir: BaseDirectory.Picture })
                            fullPath = await join(baseDir, sceneDir, fileName)
                        }

                        // Notify HistoryPanel immediately with image data
                        window.dispatchEvent(new CustomEvent('newImageGenerated', {
                            detail: { path: fullPath, data: `data:image/png;base64,${result.imageData}` }
                        }))

                        addImageToScene(activePresetId, scene.id, fullPath)

                        // Add to Global History
                        useGenerationStore.getState().addToHistory({
                            id: Date.now().toString(),
                            url: fullPath,
                            thumbnail: result.imageData ? `data:image/png;base64,${result.imageData}` : undefined,
                            prompt: finalPrompt,
                            seed: params.seed,
                            timestamp: new Date()
                        })

                    } catch (saveError) {
                        console.error('Failed to save scene image file:', saveError)
                        // DON'T add base64 image to store - it will exceed localStorage quota
                        // Just show error and continue
                        toast({ title: t('common.saveFailed', '파일 저장 실패'), description: String(saveError), variant: 'destructive' })
                    }

                    // Update progress counter
                    const currentState = useSceneStore.getState()
                    setGenerationProgress(currentState.completedCount + 1, currentState.totalQueuedCount)

                } else {
                    console.error('Generation failed:', result.error)
                    toast({ title: t('common.error', '오류'), description: result.error || 'Generation failed', variant: 'destructive' })
                    // Don't stop on single failure, continue queue
                }

                // Reset Streaming Data
                setStreamingData(null, null, 0)

                // CRITICAL: Release processing lock BEFORE checking for next item
                isProcessingRef.current = false

                // Small delay to prevent rapid consecutive API calls (extra safety)
                await new Promise(resolve => setTimeout(resolve, 100))

                // Continue Queue - only if still generating
                if (useSceneStore.getState().isGenerating) {
                    processQueue()
                }

            } catch (e) {
                console.error('Process queue error:', e)
                isProcessingRef.current = false
                setStreamingData(null, null, 0)

                // Check if it's a 429 error and retry after delay
                const errorMessage = String(e)
                if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('too many requests')) {
                    console.log('429 error detected, retrying after 3 seconds...')
                    await new Promise(resolve => setTimeout(resolve, 3000))
                    if (useSceneStore.getState().isGenerating) {
                        processQueue()
                    }
                } else {
                    toast({ title: t('common.error', '오류'), description: errorMessage, variant: 'destructive' })
                    setIsGenerating(false)
                }
            }
        }

        if (isGenerating && !isProcessingRef.current) {
            // Initialize progress tracking when generation starts
            if (completedCount === 0 && totalQueuedCount === 0) {
                initGenerationProgress()
            }
            processQueue()
        }
    }, [isGenerating, activePresetId, token, generationStore, characterPromptStore, savePath, t, addImageToScene, decrementFirstQueuedScene, setIsGenerating, streamingView, setStreamingData, initGenerationProgress, setGenerationProgress, completedCount, totalQueuedCount])

    // Reset processing ref when generation stops
    useEffect(() => {
        if (!isGenerating) {
            isProcessingRef.current = false
        }
    }, [isGenerating])

    return {
        isGenerating
    }
}
