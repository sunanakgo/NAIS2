import { useState, useCallback, useEffect } from 'react'
import {
    DndContext,
    pointerWithin,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragEndEvent,
    MeasuringStrategy
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { useLibraryStore, LibraryItem } from '@/stores/library-store'
import { SortableLibraryItem } from '@/components/library/SortableLibraryItem'
import { LibraryItem as LibraryItemComponent } from '@/components/library/LibraryItem'
import { useTranslation } from 'react-i18next'
import { mkdir, exists, writeFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { toast } from '@/components/ui/use-toast'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
}

import { LibraryRenameDialog } from '@/components/library/LibraryRenameDialog'
import { ImageReferenceDialog } from '@/components/metadata/ImageReferenceDialog'
import { MetadataDialog } from '@/components/metadata/MetadataDialog'
import { readFile } from '@tauri-apps/plugin-fs'

// ... existing imports

export default function Library() {
    const { t } = useTranslation()
    const { items, addItem, setItems, updateItem } = useLibraryStore()
    const [activeId, setActiveId] = useState<string | null>(null)
    const [isDraggingFile, setIsDraggingFile] = useState(false)

    // Dialog States
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [selectedItemForRename, setSelectedItemForRename] = useState<LibraryItem | null>(null)
    const [imageRefDialogOpen, setImageRefDialogOpen] = useState(false)
    const [selectedImageRef, setSelectedImageRef] = useState<string | null>(null)
    const [metadataDialogOpen, setMetadataDialogOpen] = useState(false)
    const [selectedImageForMetadata, setSelectedImageForMetadata] = useState<string | undefined>()

    // Fullscreen viewer state
    const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

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

    // Ensure Library Directory Exists & Sync Files
    useEffect(() => {
        const initDir = async () => {
            try {
                // 1. Ensure Dir Exists
                const existsDir = await exists('NAIS_Library', { baseDir: BaseDirectory.Picture })
                if (!existsDir) {
                    await mkdir('NAIS_Library', { baseDir: BaseDirectory.Picture })
                }

                // 2. Sync: Remove items that no longer exist on disk
                // We process this strictly to keep the library clean.
                // Note: 'items' comes from store, which is persisted.
                // We can't directly map 'items' inside this async function if it changes, 
                // but for init sync (on mount), using the initial state is fine.
                // However, 'items' in dependency array might cause loops if we simply set items.
                // We'll trust the store's current state on mount.

                const currentItems = useLibraryStore.getState().items
                const validItems: LibraryItem[] = []
                let removedCount = 0

                for (const item of currentItems) {
                    try {
                        const fileExists = await exists(item.path)
                        if (fileExists) {
                            validItems.push(item)
                        } else {
                            removedCount++
                        }
                    } catch (e) {
                        // If checking existence fails (e.g. permission), assume valid to be safe? 
                        // Or assume invalid? 'exists' usually returns false on error or file not found.
                        // But tauri v2 exists might throw.
                        // Let's assume if we can't verify it, we keep it, OR we remove it.
                        // Safest is to keep if uncertain, but if file is surely gone, remove.
                        // If error is "file not found", it's gone.
                        console.warn(`Failed to check file existence for ${item.name}:`, e)
                        // For now, keep it to avoid accidental deletion on IO errors.
                        validItems.push(item)
                    }
                }

                if (removedCount > 0) {
                    setItems(validItems)
                    console.log(`[Library] Synced: Removed ${removedCount} missing items.`)
                }

            } catch (e) {
                console.error('Failed to init/sync library:', e)
            }
        }
        initDir()
    }, [setItems])

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id)
            const newIndex = items.findIndex((item) => item.id === over.id)
            setItems(arrayMove(items, oldIndex, newIndex))
        }

        setActiveId(null)
    }

    // Handle File Drop from OS
    const onFileDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingFile(false)

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files)
            const imageFiles = files.filter(f => f.type.startsWith('image/'))

            if (imageFiles.length === 0) return

            try {
                const picturePath = await pictureDir()
                const libraryDir = await join(picturePath, 'NAIS_Library')

                // Ensure dir exists again just in case
                if (!(await exists('NAIS_Library', { baseDir: BaseDirectory.Picture }))) {
                    await mkdir('NAIS_Library', { baseDir: BaseDirectory.Picture })
                }

                let addedCount = 0

                // Check for custom app metadata
                const customFilename = e.dataTransfer.getData('nais/filename')

                for (const file of imageFiles) {
                    const buffer = await file.arrayBuffer()
                    const uint8Array = new Uint8Array(buffer)
                    const ext = file.name.split('.').pop() || 'png'
                    const uuid = crypto.randomUUID()
                    const shortUuid = uuid.split('-')[0] // First 8 chars for shorter names

                    // Determine filename - add UUID suffix to prevent collisions
                    let baseName = file.name.replace(/\.[^.]+$/, '') // Remove extension
                    if (customFilename && imageFiles.length === 1) {
                        baseName = customFilename.replace(/\.[^.]+$/, '')
                    }

                    // Create unique filename: originalName_xxxxxxxx.ext
                    const fileName = `${baseName}_${shortUuid}.${ext}`

                    const newPath = await join(libraryDir, fileName)

                    // Write
                    await writeFile(`NAIS_Library/${fileName}`, uint8Array, { baseDir: BaseDirectory.Picture })

                    const newItem: LibraryItem = {
                        id: uuid,
                        name: fileName.replace(`.${ext}`, ''), // Display Name matched
                        path: newPath,
                        width: 0,
                        height: 0,
                        createdAt: Date.now()
                    }

                    addItem(newItem)
                    addedCount++
                }

                if (addedCount > 0) {
                    toast({
                        title: t('library.added', '이미지 추가됨'),
                        description: t('library.addedDesc', { count: addedCount }),
                        variant: 'success'
                    })
                }
            } catch (error) {
                console.error('File import failed:', error)
                toast({
                    title: t('library.error', '가져오기 실패'),
                    variant: 'destructive'
                })
            }
        }
    }, [addItem, t])

    const activeItem = activeId ? items.find(i => i.id === activeId) : null

    // Helper
    const arrayBufferToBase64 = (buffer: Uint8Array): string => {
        let binary = ''
        const len = buffer.byteLength
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(buffer[i])
        }
        return btoa(binary)
    }

    // Handlers
    const handleRenameClick = (item: LibraryItem) => {
        setSelectedItemForRename(item)
        setRenameDialogOpen(true)
    }

    const handleRenameConfirm = (newName: string) => {
        if (selectedItemForRename) {
            updateItem(selectedItemForRename.id, { name: newName })
            // Note: We are currently NOT renaming the physical file to avoid file referencing issues or complexity for now.
            // The user request was "Rename in context menu", which usually implies display name.
            // If physical rename is strictly required, we'd need `rename`.
            // Given "Unify filenames" requirement earlier, maybe physical rename is expected?
            // "Name change" usually means the display name in the app.
            // Let's stick to display name update in the store for safety.
            toast({ title: t('actions.saved', '저장 완료'), variant: 'success' })
        }
    }

    const handleAddRefClick = async (item: LibraryItem) => {
        try {
            const data = await readFile(item.path)
            const base64 = arrayBufferToBase64(data)
            setSelectedImageRef(`data:image/png;base64,${base64}`)
            setImageRefDialogOpen(true)
        } catch (e) {
            console.error('Failed to load for ref:', e)
            toast({ title: t('library.error', '오류 발생'), variant: 'destructive' })
        }
    }

    const handleLoadMetadata = async (item: LibraryItem) => {
        try {
            const data = await readFile(item.path)
            const base64 = arrayBufferToBase64(data)
            setSelectedImageForMetadata(`data:image/png;base64,${base64}`)
            setMetadataDialogOpen(true)
        } catch (e) {
            console.error('Failed to load metadata:', e)
            toast({ title: t('library.error', '오류 발생'), variant: 'destructive' })
        }
    }

    return (
        <div
            className="h-full flex flex-col relative"
            onDragOver={(e) => {
                e.preventDefault()
                // Check if it's a file drag from OS
                if (e.dataTransfer.types.includes('Files')) {
                    if (!isDraggingFile) setIsDraggingFile(true)
                }
            }}
            onDragLeave={(e) => {
                e.preventDefault()
                // Simple check to see if we left the window
                if (e.currentTarget.contains(e.relatedTarget as Node)) return
                setIsDraggingFile(false)
            }}
            onDrop={onFileDrop}
        >
            {/* Header */}
            <div className="h-14 border-b flex items-center px-6 justify-between bg-background/50 backdrop-blur-sm z-10 w-full box-border">
                <h2 className="text-lg font-semibold tracking-tight">{t('library.title', '라이브러리')}</h2>
                <span className="text-sm text-muted-foreground">{items.length} {t('library.items', 'items')}</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar w-full">
                <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    measuring={{
                        droppable: {
                            strategy: MeasuringStrategy.Always,
                        },
                    }}
                >
                    <SortableContext
                        items={items.map(i => i.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div
                            className="grid gap-6 pb-10"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
                        >
                            {items.map((item) => (
                                <SortableLibraryItem
                                    key={item.id}
                                    item={item}
                                    onRename={handleRenameClick}
                                    onAddRef={handleAddRefClick}
                                    onLoadMetadata={handleLoadMetadata}
                                    onImageClick={(imgUrl) => setViewerImageSrc(imgUrl)}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    <DragOverlay dropAnimation={dropAnimation} modifiers={[snapCenterToCursor]}>
                        {activeItem ? (
                            <LibraryItemComponent item={activeItem} isOverlay />
                        ) : null}
                    </DragOverlay>
                </DndContext>

                {items.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                        <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-6 animate-pulse">
                            <ImagePlus className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 text-foreground/80">
                            {t('library.emptyTitle', '라이브러리가 비어있습니다')}
                        </h3>
                        <p className="text-sm text-muted-foreground text-center max-w-sm px-4 leading-relaxed">
                            {t('library.emptyDesc', '이미지를 드래그하여 컬렉션을 만들어보세요')}
                        </p>
                    </div>
                )}
            </div>

            {/* File Drop Overlay - Modern Style from MainMode */}
            {isDraggingFile && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center transition-all duration-300 pointer-events-none">
                    <div className="relative">
                        {/* Animated ring */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-primary animate-pulse opacity-50 blur-xl" />

                        {/* Main card */}
                        <div className="relative bg-background/80 backdrop-blur-xl border border-white/20 rounded-3xl p-12 shadow-2xl transform transition-transform scale-100">
                            <div className="text-center space-y-4">
                                {/* Animated icon container */}
                                <div className="relative mx-auto w-20 h-20">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-inner">
                                        <ImagePlus className="h-10 w-10 text-white" />
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xl font-bold text-foreground">
                                        {t('library.drop', '여기에 놓아서 추가')}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {t('library.dropHint', '이미지를 드래그하여 추가하세요')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialogs */}
            <LibraryRenameDialog
                open={renameDialogOpen}
                onOpenChange={setRenameDialogOpen}
                initialName={selectedItemForRename?.name || ''}
                onConfirm={handleRenameConfirm}
            />

            <ImageReferenceDialog
                open={imageRefDialogOpen}
                onOpenChange={setImageRefDialogOpen}
                imageBase64={selectedImageRef}
            />

            <MetadataDialog
                open={metadataDialogOpen}
                onOpenChange={(open) => {
                    setMetadataDialogOpen(open)
                    if (!open) setSelectedImageForMetadata(undefined)
                }}
                initialImage={selectedImageForMetadata}
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
        </div>
    )
}
