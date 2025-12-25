import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ResolutionSelector, Resolution } from '@/components/ui/ResolutionSelector'
import {
    ChevronLeft,
    Check,
    Play,
    Image as ImageIcon,
    FolderOpen,
    Minus,
    Plus,
    X,
    Pencil,
    Star
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { AutocompleteTextarea } from "@/components/ui/AutocompleteTextarea";
import { cn } from '@/lib/utils'
import { useSceneStore, SceneImage } from '@/stores/scene-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useSceneGeneration } from '@/hooks/useSceneGeneration'
import { Command } from '@tauri-apps/plugin-shell'
import { MetadataDialog } from '@/components/metadata/MetadataDialog'
import { ImageReferenceDialog } from '@/components/metadata/ImageReferenceDialog'
import { pictureDir, join } from '@tauri-apps/api/path'
import { exists, readFile } from '@tauri-apps/plugin-fs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SceneDetail() {
    const { id: sceneId } = useParams()
    const { t } = useTranslation()
    const {
        activePresetId,
        getScene,
        renameScene,
        toggleFavorite,
        deleteImage,
        incrementQueue,
        decrementQueue,
        validateSceneImages,
        updateSceneSettings,
    } = useSceneStore()
    const { isGenerating: _isGlobalGenerating } = useSceneGeneration()
    const { promptFontSize } = useSettingsStore()

    const scene = activePresetId && sceneId ? getScene(activePresetId, sceneId) : undefined

    // --- Resolution Logic ---
    const currentWidth = scene?.width || 832
    const currentHeight = scene?.height || 1216

    // Handler for ResolutionSelector
    const handleResolutionChange = (resolution: Resolution) => {
        if (activePresetId && sceneId) {
            updateSceneSettings(activePresetId, sceneId, { width: resolution.width, height: resolution.height })
        }
    }

    // Current resolution value for ResolutionSelector
    const currentResolution: Resolution = {
        label: `${currentWidth} × ${currentHeight}`,
        width: currentWidth,
        height: currentHeight
    }

    const [editName, setEditName] = useState(scene?.name || '')
    // Dialog states
    const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
    const [selectedImageForMetadata, setSelectedImageForMetadata] = useState<string | undefined>()
    const [imageRefDialogOpen, setImageRefDialogOpen] = useState(false)
    const [selectedImageForRef, setSelectedImageForRef] = useState<string | null>(null)
    const [isEditingName, setIsEditingName] = useState(false)
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
    const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null)
    const { streamingSceneId, streamingImage, streamingProgress } = useSceneStore()

    // ESC key handler for closing viewer
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && viewerImageSrc) {
                setViewerImageSrc(null)
            }
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [viewerImageSrc])

    const nav = useNavigate()

    useEffect(() => {
        if (scene) {
            setEditName(scene.name)
        }
    }, [scene?.name])

    const handleBack = () => {
        nav('/scenes')
    }

    if (!scene || !activePresetId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
                <p>{t('scene.notFound', '씬을 찾을 수 없습니다')}</p>
                <Button onClick={handleBack} variant="outline">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    {t('common.back', '돌아가기')}
                </Button>
            </div>
        )
    }

    // Auto-save prompt logic...
    const updateScenePrompt = useSceneStore(state => state.updateScenePrompt)
    const [localPrompt, setLocalPrompt] = useState(scene.scenePrompt)

    // Sync local state when store changes (only if not editing actively? No, store is truth)
    // Actually we want local state to drive the input, and debounce save to store.
    // But if we switch scenes, we need to reset.
    useEffect(() => {
        setLocalPrompt(scene.scenePrompt)
    }, [scene.id]) // Only when scene ID changes

    useEffect(() => {
        // Don't save if it's the same
        if (localPrompt === scene.scenePrompt) return

        const timer = setTimeout(() => {
            updateScenePrompt(activePresetId, scene.id, localPrompt)
        }, 1000) // 1 second debounce

        return () => clearTimeout(timer)
    }, [localPrompt, scene, activePresetId, updateScenePrompt])

    const handleSaveName = () => {
        if (editName.trim()) {
            renameScene(activePresetId, scene.id, editName.trim())
        }
        setIsEditingName(false)
    }

    const handleGenerate = () => {
        if (!activePresetId || !scene) return
        incrementQueue(activePresetId, scene.id)
        useSceneStore.getState().setIsGenerating(true)
    }

    const handleOpenFolder = async () => {
        try {
            if (!scene) return

            // Sanitize scene name for folder name - MUST match useSceneGeneration.ts logic
            const safeSceneName = scene.name.replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled_Scene'
            const picDir = await pictureDir()

            // Construct the path: Pictures/NAIS_Scene/<SceneName>
            const folderPath = await join(picDir, 'NAIS_Scene', safeSceneName)

            // Check if directory exists
            const dirExists = await exists(folderPath)
            if (!dirExists) {
                // If specific scene folder doesn't exist, try parent folder
                const parentPath = await join(picDir, 'NAIS_Scene')
                if (await exists(parentPath)) {
                    await Command.create('explorer', [parentPath]).execute()
                }
                return
            }

            // Open folder in explorer
            await Command.create('explorer', [folderPath]).execute()
        } catch (error) {
            console.error("Failed to open folder:", error)
        }
    }

    // Auto-validate images on mount
    useEffect(() => {
        if (!scene || !activePresetId || !validateSceneImages) return

        const validateImages = async () => {
            if (scene.images.length === 0) return

            const validImageIds: string[] = []
            let hasChanges = false

            for (const img of scene.images) {
                try {
                    // Check if url is a file path
                    if (!img.url.startsWith('data:')) {
                        if (await exists(img.url)) {
                            validImageIds.push(img.id)
                        } else {
                            hasChanges = true
                        }
                    } else {
                        // Keep base64 images
                        validImageIds.push(img.id)
                    }
                } catch (e) {
                    // If check fails, assume valid to be safe
                    validImageIds.push(img.id)
                }
            }

            // Only update if changes needed
            if (hasChanges && validImageIds.length !== scene.images.length) {
                validateSceneImages(activePresetId, scene.id, validImageIds)
            }
        }

        validateImages()
    }, [scene?.id, activePresetId, validateSceneImages])


    const isStreaming = streamingSceneId === scene.id

    const sortedImages = showFavoritesOnly
        ? scene.images.filter(img => img.isFavorite)
        : scene.images

    return (
        <div className="flex flex-col h-full gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleOpenFolder} title={t('actions.openFolder', '폴더 열기')}>
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleBack}>
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="text-2xl font-bold h-9 w-64 rounded-lg"
                                    autoFocus
                                    onBlur={handleSaveName}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName()
                                        if (e.key === 'Escape') setIsEditingName(false)
                                    }}
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleSaveName}>
                                    <Check className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setIsEditingName(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold">{scene.name}</h1>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-50 hover:opacity-100" onClick={() => setIsEditingName(true)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                        <p className="text-muted-foreground text-sm">{t('scene.editPrompt')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Resolution Settings */}
                    <div className="w-[220px]">
                        <ResolutionSelector
                            value={currentResolution}
                            onChange={handleResolutionChange}
                        />
                    </div>

                    <div className="w-px h-8 bg-border mx-2" />

                    {/* Queue Controls */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/50">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => decrementQueue(activePresetId, scene.id)}
                            disabled={scene.queueCount === 0}
                        >
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm font-medium w-8 text-center">{scene.queueCount}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => incrementQueue(activePresetId, scene.id)}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>


                    <Button size="sm" className="rounded-xl" onClick={handleGenerate}>
                        <Play className="mr-2 h-4 w-4" />
                        {t('generate.button')}
                    </Button>
                </div>
            </div >

            {/* Scene Prompt - Clean Style like PromptPanel */}
            < div className="flex flex-col min-h-[140px] shrink-0" >
                <label className="text-xs font-medium text-muted-foreground mb-1">{t('scene.scenePrompt')}</label>
                <AutocompleteTextarea
                    placeholder=""
                    className="flex-1 min-h-0 resize-none rounded-xl"
                    style={{ fontSize: `${promptFontSize}px` }}
                    value={localPrompt}
                    onChange={(e: any) => setLocalPrompt(e.target.value)}
                />
            </div >

            {/* Generated Images - Large Section */}
            < Card glass className="flex-1 overflow-hidden flex flex-col mt-2" >
                <CardHeader className="py-3 flex-row items-center justify-between shrink-0">
                    <CardTitle className="text-sm flex items-center gap-2">
                        {t('scene.generatedImages')}
                        <span className="text-muted-foreground font-normal">({scene.images.length})</span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={showFavoritesOnly ? "default" : "outline"}
                            size="sm"
                            className="h-7 rounded-lg gap-1"
                            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        >
                            <Star className={`h-3 w-3 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                            {t('scene.favoritesOnly', '즐겨찾기')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    {sortedImages.length === 0 && !isStreaming ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                            <ImageIcon className="h-16 w-16 mb-4 stroke-1" />
                            <p>{t('scene.noImages', '생성된 이미지가 없습니다')}</p>
                        </div>
                    ) : (
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                            {/* Streaming Card Slot */}
                            {isStreaming && streamingImage && (
                                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted/30 relative border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                    <img src={streamingImage} alt="Generating..." className="w-full h-full object-cover animate-pulse opacity-80" />
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-500/50">
                                        <div className="h-full bg-white transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.8)]" style={{ width: `${streamingProgress * 100}%` }} />
                                    </div>
                                </div>
                            )}

                            {sortedImages.map((image) => (
                                <SceneImageCard
                                    key={image.id}
                                    image={image}
                                    onDelete={() => deleteImage(activePresetId, scene.id, image.id)}
                                    onToggleFavorite={() => toggleFavorite(activePresetId, scene.id, image.id)}
                                    // Handlers for new context menu items
                                    onAddRef={async () => {
                                        // Reuse image loading logic or read file
                                        try {
                                            let dataUrl = image.url
                                            if (!dataUrl.startsWith('data:')) {
                                                const data = await readFile(image.url)
                                                let binary = ''
                                                const len = data.byteLength
                                                for (let i = 0; i < len; i++) {
                                                    binary += String.fromCharCode(data[i])
                                                }
                                                dataUrl = `data:image/png;base64,${btoa(binary)}`
                                            }
                                            setSelectedImageForRef(dataUrl)
                                            setImageRefDialogOpen(true)
                                        } catch (e) {
                                            console.error("Failed to load reference image", e)
                                        }
                                    }}
                                    onLoadMetadata={async () => {
                                        try {
                                            let dataUrl = image.url
                                            if (!dataUrl.startsWith('data:')) {
                                                const data = await readFile(image.url)
                                                let binary = ''
                                                const len = data.byteLength
                                                for (let i = 0; i < len; i++) {
                                                    binary += String.fromCharCode(data[i])
                                                }
                                                dataUrl = `data:image/png;base64,${btoa(binary)}`
                                            }
                                            setSelectedImageForMetadata(dataUrl)
                                            setMetadataDialogOpen(true)
                                        } catch (e) {
                                            console.error("Failed to load metadata image", e)
                                        }
                                    }}
                                    onImageClick={(imgSrc) => setViewerImageSrc(imgSrc)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card >

            <MetadataDialog
                open={metadataDialogOpen}
                onOpenChange={(open) => {
                    setMetadataDialogOpen(open)
                    if (!open) setSelectedImageForMetadata(undefined)
                }}
                initialImage={selectedImageForMetadata}
            />

            <ImageReferenceDialog
                open={imageRefDialogOpen}
                onOpenChange={setImageRefDialogOpen}
                imageBase64={selectedImageForRef}
            />

            {/* Full-Screen Image Viewer Overlay */}
            {viewerImageSrc && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer"
                    onClick={() => setViewerImageSrc(null)}
                >
                    <img
                        src={viewerImageSrc}
                        alt="Full view"
                        className="max-w-[90vw] max-h-[90vh] object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-4 right-4 text-white hover:bg-white/20 h-10 w-10"
                        onClick={() => setViewerImageSrc(null)}
                    >
                        <X className="h-6 w-6" />
                    </Button>
                </div>
            )}
        </div >
    )
}

import { SceneImageContextMenu } from '@/components/scene/SceneImageContextMenu'

function SceneImageCard({
    image,
    onToggleFavorite,
    onDelete,
    onAddRef,
    onLoadMetadata,
    onImageClick,
}: {
    image: SceneImage
    onToggleFavorite: () => void
    onDelete: () => void
    onAddRef?: () => void
    onLoadMetadata?: () => void
    onImageClick?: (imgSrc: string) => void
}) {
    // SceneImageCard now just renders the image and overlay.
    // Logic for loading the image data is handled by the browser <img> tag directly using the file path (image.url).
    // Note: If Tauri requires a special protocol for local files, it's usually `asset://` or handled by `tauri-plugin-fs` + convertFileSrc.
    // Assuming standard `src={image.url}` works for now based on context, or user has configured identifying protocol.
    // If image.url is strictly a Windows path "C:\...", we might need convertFileSrc.
    // BUT the previous code was using readFile + base64. Let's stick to that if needed, 
    // OR try the simpler approach first if supported. 
    // Wait, the previous code had `loadImage` logic because `image.url` is a raw path. 
    // I will restore the `loadImage` logic inside SceneImageCard to ensure images display correctly.

    const [imgSrc, setImgSrc] = useState<string>('')

    useEffect(() => {
        let active = true
        const loadImage = async () => {
            if (!image.url) return
            if (image.url.startsWith('data:')) {
                if (active) setImgSrc(image.url)
                return
            }
            try {
                const data = await readFile(image.url)
                let binary = ''
                const len = data.byteLength
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(data[i])
                }
                const base64 = btoa(binary)
                if (active) setImgSrc(`data:image/png;base64,${base64}`)
            } catch (e) {
                console.error('Failed to load image:', e)
            }
        }
        loadImage()
        return () => { active = false }
    }, [image.url])

    return (
        <SceneImageContextMenu
            image={image}
            onDelete={onDelete}
            onAddRef={onAddRef}
            onLoadMetadata={onLoadMetadata}
        >
            <div
                className="relative group aspect-[2/3] rounded-xl overflow-hidden bg-muted/30 border border-border/50 hover:border-primary/50 transition-all duration-300 shadow-sm cursor-pointer"
                onClick={() => imgSrc && onImageClick?.(imgSrc)}
            >
                {/* Image */}
                {imgSrc && (
                    <img
                        src={imgSrc}
                        alt="Scene Image"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                )}

                {/* Overlay */}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
                    >
                        <Star className={cn("h-3.5 w-3.5", image.isFavorite && "fill-current")} />
                    </Button>
                </div>

                <div className="absolute inset-0 rounded-xl border border-transparent group-hover:border-primary/50 pointer-events-none" />
            </div>
        </SceneImageContextMenu>
    )
}
