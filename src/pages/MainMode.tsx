import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, ImagePlus, Download, Copy, RotateCcw, Save, Users, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGenerationStore } from '@/stores/generation-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { MetadataDialog } from '@/components/metadata/MetadataDialog'
import { ImageReferenceDialog } from '@/components/metadata/ImageReferenceDialog'
import { parseMetadataFromBase64 } from '@/lib/metadata-parser'
import { generateImage } from '@/services/novelai-api'
import { toast } from '@/components/ui/use-toast'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Command } from '@tauri-apps/plugin-shell'
import { save } from '@tauri-apps/plugin-dialog'
import { pictureDir, join } from '@tauri-apps/api/path'
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { useNavigate } from 'react-router-dom'
import { useToolsStore } from '@/stores/tools-store'
import { Wand2 } from 'lucide-react'

export default function MainMode() {
    const { t } = useTranslation()
    const {
        previewImage,
        isGenerating,
        selectedResolution,
        seed,

        lastGenerationTime,
        batchCount,
        currentBatch,
        streamProgress,
    } = useGenerationStore()

    const navigate = useNavigate()
    const { setActiveImage } = useToolsStore()

    const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
    const [metadataImage, setMetadataImage] = useState<string | undefined>(undefined)
    const [isDragOver, setIsDragOver] = useState(false)
    const [imageRefDialogOpen, setImageRefDialogOpen] = useState(false)

    // Get more store functions for regenerate with metadata
    const genStore = useGenerationStore()

    // Regenerate with metadata - direct API call without modifying UI
    const handleRegenerateWithMetadata = async () => {
        if (!previewImage || isGenerating) return

        const token = useAuthStore.getState().token
        if (!token) {
            toast({
                title: t('toast.tokenRequired.title', '토큰 필요'),
                variant: 'destructive',
            })
            return
        }

        try {
            // Parse metadata from current image
            const metadata = await parseMetadataFromBase64(previewImage)
            if (!metadata) {
                toast({
                    title: t('toast.noMetadata', '메타데이터 없음'),
                    description: t('toast.noMetadataDesc', '이 이미지에서 메타데이터를 찾을 수 없습니다'),
                    variant: 'destructive',
                })
                return
            }

            // Set generating state
            genStore.setIsGenerating(true)

            // Generate random seed
            const newSeed = Math.floor(Math.random() * 4294967295)

            // Map metadata model name to API model ID
            // Metadata returns display names like "NovelAI Diffusion V4.5 ..." 
            // but API needs IDs like "nai-diffusion-4-5-full"
            const mapModelNameToId = (name?: string): string => {
                if (!name) return 'nai-diffusion-4-5-full'
                const lower = name.toLowerCase()
                if (lower.includes('4.5') || lower.includes('4-5')) {
                    if (lower.includes('curated')) return 'nai-diffusion-4-5-curated'
                    return 'nai-diffusion-4-5-full'
                }
                if (lower.includes('v4') || lower.includes('4')) {
                    if (lower.includes('curated')) return 'nai-diffusion-4-curated-preview'
                    return 'nai-diffusion-4-full'
                }
                if (lower.includes('furry')) return 'nai-diffusion-furry-3'
                if (lower.includes('v3') || lower.includes('3')) return 'nai-diffusion-3'
                return 'nai-diffusion-4-5-full'
            }

            // Call API directly with metadata (without modifying UI store)
            // Use all settings from metadata, only randomize seed
            const result = await generateImage(token, {
                prompt: metadata.prompt || '',
                negative_prompt: metadata.negativePrompt || '',
                model: mapModelNameToId(metadata.model),
                width: metadata.width || 832,
                height: metadata.height || 1216,
                steps: metadata.steps || 28,
                cfg_scale: metadata.cfgScale || 5,
                cfg_rescale: metadata.cfgRescale || 0,
                sampler: metadata.sampler || 'k_euler',
                scheduler: metadata.scheduler || 'native',
                smea: metadata.smea ?? true,
                smea_dyn: metadata.smeaDyn ?? false,
                seed: newSeed,
            })

            if (result.success && result.imageData) {
                // Update preview with new image
                genStore.setPreviewImage(`data:image/png;base64,${result.imageData}`)

                // Save to disk if autoSave is enabled
                const { savePath, autoSave, useAbsolutePath } = useSettingsStore.getState()
                if (autoSave) {
                    try {
                        const binaryString = atob(result.imageData)
                        const bytes = new Uint8Array(binaryString.length)
                        for (let j = 0; j < binaryString.length; j++) {
                            bytes[j] = binaryString.charCodeAt(j)
                        }

                        const fileName = `NAIS_${Date.now()}.png`
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

                        // Dispatch event for instant history update
                        try {
                            window.dispatchEvent(new CustomEvent('newImageGenerated', {
                                detail: { path: fullPath, data: `data:image/png;base64,${result.imageData}` }
                            }))
                        } catch (e) {
                            console.warn('Failed to dispatch newImageGenerated event:', e)
                        }
                    } catch (e) {
                        console.warn('Failed to save regenerated image:', e)
                    }
                }

                toast({
                    title: t('toast.regenerated', '재생성 완료'),
                    variant: 'success',
                })
            } else {
                toast({
                    title: t('toast.generateFailed', '생성 실패'),
                    description: result.error,
                    variant: 'destructive',
                })
            }
        } catch (e) {
            console.error('Regenerate failed:', e)
        } finally {
            genStore.setIsGenerating(false)
        }
    }



    const handleCopy = async () => {
        if (!previewImage) return
        try {
            const response = await fetch(previewImage)
            const blob = await response.blob()
            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ])
        } catch (e) {
            console.error('Copy failed', e)
        }
    }

    // Save As with native Windows dialog
    const handleSaveAs = async () => {
        if (!previewImage) return
        try {
            const filePath = await save({
                defaultPath: `NAIS_${Date.now()}.png`,
                filters: [{ name: 'PNG Image', extensions: ['png'] }],
            })

            if (filePath) {
                const base64Data = previewImage.split(',')[1]
                const binaryString = atob(base64Data)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }

                await writeFile(filePath, bytes)
                toast({
                    title: t('toast.saved', '저장 완료'),
                    variant: 'success',
                })
            }
        } catch (e) {
            console.error('Save failed:', e)
            toast({
                title: t('toast.saveFailed', '저장 실패'),
                variant: 'destructive',
            })
        }
    }

    // Open folder containing saved images
    const handleOpenFolder = async () => {
        try {
            const { savePath, useAbsolutePath } = useSettingsStore.getState()
            const finalSavePath = savePath || 'NAIS_Output'

            let folderPath: string
            if (useAbsolutePath) {
                folderPath = finalSavePath
            } else {
                const picPath = await pictureDir()
                folderPath = await join(picPath, finalSavePath)
            }

            const dirExists = await exists(folderPath)
            if (!dirExists) {
                await mkdir(folderPath, { recursive: true })
            }

            // Use explorer to enter the directory
            await Command.create('explorer', [folderPath]).execute()
        } catch (e) {
            console.error('Failed to open folder:', e)
        }
    }

    const handleOpenSmartTools = () => {
        if (previewImage) {
            setActiveImage(previewImage)
            navigate('/tools')
        }
    }

    // Image Reference popup
    const handleAddAsReference = () => {
        if (previewImage) {
            setImageRefDialogOpen(true)
        }
    }

    // Metadata loading from current preview
    const handleLoadMetadata = () => {
        if (previewImage) {
            setMetadataImage(previewImage)
            setMetadataDialogOpen(true)
        }
    }

    // Drag counter to prevent flickering from child elements
    const dragCounter = useRef(0)

    // Drag & Drop for metadata loading
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragOver(false)

        const file = e.dataTransfer.files[0]
        if (file && file.type.startsWith('image/')) {
            // Convert file to base64
            const reader = new FileReader()
            reader.onload = () => {
                setMetadataImage(reader.result as string)
                setMetadataDialogOpen(true)
            }
            reader.readAsDataURL(file)
        }
    }, [])

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragOver(true)
        }
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) {
            setIsDragOver(false)
        }
    }, [])

    // Timer Logic
    const [elapsedTime, setElapsedTime] = useState(0)

    useEffect(() => {
        let interval: any
        if (isGenerating) {
            const start = Date.now()
            setElapsedTime(0)
            interval = setInterval(() => {
                setElapsedTime(Date.now() - start)
            }, 100)
        } else {
            setElapsedTime(0)
        }
        return () => clearInterval(interval)
    }, [isGenerating])

    // Format time (s.ms)
    const formatTime = (ms: number) => (ms / 1000).toFixed(1)

    return (
        <div
            className="relative w-full h-full min-h-0 bg-background/50"
            onDrop={handleDrop}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            {/* Drag overlay - Modern glassmorphism style */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center">
                    <div className="relative">
                        {/* Animated ring */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-primary animate-pulse opacity-50 blur-xl" />

                        {/* Main card */}
                        <div className="relative bg-background/80 backdrop-blur-xl border border-white/20 rounded-3xl p-12 shadow-2xl">
                            <div className="text-center space-y-4">
                                {/* Animated icon container */}
                                <div className="relative mx-auto w-20 h-20">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                                        <ImagePlus className="h-10 w-10 text-white" />
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xl font-semibold text-foreground">
                                        {t('metadata.dropToLoad', '이미지를 드롭하여 메타데이터 불러오기')}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('metadata.extractDesc', 'PNG 파일에서 프롬프트와 설정을 추출합니다')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Full Screen Image Area */}
            <div className="w-full h-full flex items-center justify-center overflow-hidden">
                {previewImage ? (
                    // Generated Image with Context Menu
                    <ContextMenu>
                        <ContextMenuTrigger asChild>
                            <div className="relative w-full h-full group cursor-context-menu">
                                <img
                                    src={previewImage}
                                    alt="Generated preview"
                                    className="w-full h-full object-contain"
                                />
                                {/* Image Actions Overlay (Visible on hover) */}
                                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="rounded-full h-10 w-10 shadow-lg backdrop-blur-md bg-black/30 border border-white/10 hover:bg-black/50 text-white"
                                        onClick={handleRegenerateWithMetadata}
                                        disabled={isGenerating}
                                    >
                                        <RotateCcw className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="rounded-full h-10 w-10 shadow-lg backdrop-blur-md bg-black/30 border border-white/10 hover:bg-black/50 text-white"
                                        onClick={handleCopy}
                                    >
                                        <Copy className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="rounded-full h-10 w-10 shadow-lg backdrop-blur-md bg-black/30 border border-white/10 hover:bg-black/50 text-white"
                                        onClick={handleSaveAs}
                                    >
                                        <Download className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                            <ContextMenuItem onClick={handleSaveAs}>
                                <Save className="h-4 w-4 mr-2" />
                                {t('actions.saveAs', '저장')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleCopy}>
                                <Copy className="h-4 w-4 mr-2" />
                                {t('actions.copy', '복사')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleRegenerateWithMetadata} disabled={isGenerating}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                {t('actions.regenerate', '재생성')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleOpenSmartTools}>
                                <Wand2 className="h-4 w-4 mr-2" />
                                {t('smartTools.title', '스마트 툴')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleAddAsReference}>
                                <Users className="h-4 w-4 mr-2" />
                                {t('actions.addAsRef', '이미지 참조')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleOpenFolder}>
                                <FolderOpen className="h-4 w-4 mr-2" />
                                {t('actions.openFolder', '폴더 열기')}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={handleLoadMetadata}>
                                <ImageIcon className="h-4 w-4 mr-2" />
                                {t('metadata.loadFromImage', '메타데이터 불러오기')}
                            </ContextMenuItem>
                        </ContextMenuContent>
                    </ContextMenu>
                ) : isGenerating ? (
                    // Loading State (Only shown when no previous image exists)
                    <div className="flex flex-col items-center justify-center z-10">
                        <div className="relative mb-6">
                            <div className="h-24 w-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                            <ImagePlus className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-10 text-primary" />
                        </div>
                        <p className="text-xl font-medium text-foreground mb-3">
                            {batchCount > 1
                                ? `${t('generate.loadingTitle')} (${currentBatch}/${batchCount})`
                                : t('generate.loadingTitle')
                            }
                        </p>
                        {/* Timer Display */}
                        <div className="text-sm font-mono text-muted-foreground bg-muted/20 px-3 py-1 rounded-full">
                            {formatTime(elapsedTime)}s
                            {lastGenerationTime && (
                                <span className="opacity-50 mx-1">/ ~{formatTime(lastGenerationTime)}s</span>
                            )}
                        </div>
                    </div>
                ) : (
                    // Empty State - Drop zone hint
                    <div className="flex flex-col items-center justify-center text-muted-foreground/50">
                        <div className="w-32 h-32 rounded-full bg-muted/20 flex items-center justify-center mb-6 border-4 border-dashed border-muted-foreground/20">
                            <ImageIcon className="h-16 w-16" />
                        </div>
                        <p className="text-xl font-medium text-foreground/80">{t('generate.emptyState')}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t('generate.emptyDescription')}
                        </p>
                        <p className="mt-4 text-xs text-muted-foreground/60">
                            {t('metadata.dropHint', '이미지를 드래그하여 메타데이터를 불러올 수 있습니다')}
                        </p>
                    </div>
                )}
            </div>

            {/* Generation Progress Bar - Above Info Bar */}
            {isGenerating && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl flex items-center gap-4 text-sm text-white/90 transition-all hover:bg-black/50">
                    <div className="h-4 w-4 rounded-full border-2 border-primary/50 border-t-primary animate-spin" />
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-emerald-400 leading-none mb-0.5">
                            {t('generate.generating')}
                        </span>
                        <span className="text-[10px] font-mono text-white/60 leading-none">
                            {formatTime(elapsedTime)}s
                            {lastGenerationTime && (
                                <> / {formatTime(lastGenerationTime)}s</>
                            )}
                        </span>
                    </div>
                    {/* Streaming Progress */}
                    {streamProgress > 0 && streamProgress < 100 && (
                        <div className="flex items-center gap-2 ml-2">
                            <div className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-200"
                                    style={{ width: `${streamProgress}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400">{streamProgress}%</span>
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Info Bar Overlay */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-xl flex items-center gap-6 text-sm text-white/90 transition-all hover:bg-black/50">
                <span className="flex items-center gap-2">
                    <span className="opacity-60 text-xs uppercase tracking-wider">{t('settings.resolution')}</span>
                    <span className="font-medium">{selectedResolution.width} × {selectedResolution.height}</span>
                </span>
                <div className="w-px h-4 bg-white/20" />
                <span className="flex items-center gap-2">
                    <span className="opacity-60 text-xs uppercase tracking-wider">{t('settings.seed')}</span>
                    <span className="font-mono">{seed || t('settings.random')}</span>
                </span>
            </div>

            {/* Metadata Dialog */}
            <MetadataDialog
                open={metadataDialogOpen}
                onOpenChange={(open) => {
                    setMetadataDialogOpen(open)
                    if (!open) setMetadataImage(undefined)
                }}
                initialImage={metadataImage}
            />

            {/* Image Reference Dialog */}
            <ImageReferenceDialog
                open={imageRefDialogOpen}
                onOpenChange={setImageRefDialogOpen}
                imageBase64={previewImage || null}
            />
        </div>
    )
}
