import { useState, useEffect } from 'react'
import { LibraryItem as LibraryItemType } from '@/stores/library-store'
import { readFile } from '@tauri-apps/plugin-fs'
import { LibraryContextMenu } from './LibraryContextMenu'
import { cn } from '@/lib/utils'

interface LibraryItemProps {
    item: LibraryItemType
    className?: string
    isOverlay?: boolean
    onRename?: (item: LibraryItemType) => void
    onAddRef?: (item: LibraryItemType) => void
    onLoadMetadata?: (item: LibraryItemType) => void
    onImageClick?: (imageUrl: string) => void
}

export function LibraryItem({ item, className, isOverlay, onRename, onAddRef, onLoadMetadata, onImageClick }: LibraryItemProps) {
    const [imageUrl, setImageUrl] = useState<string>('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        const loadImage = async () => {
            try {
                const data = await readFile(item.path)

                // Convert to base64 safely without stack overflow
                let binary = ''
                const len = data.byteLength
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(data[i])
                }
                const base64 = btoa(binary)

                if (active) {
                    setImageUrl(`data:image/png;base64,${base64}`)
                    setIsLoading(false)
                }
            } catch (e) {
                console.error('Failed to load library image:', e)
                if (active) setIsLoading(false)
            }
        }
        loadImage()
        return () => { active = false }
    }, [item.path])

    const content = (
        <div
            className={cn(
                "relative group aspect-[2/3] rounded-xl overflow-hidden bg-muted/30 border border-border/50 shadow-sm transition-all hover:ring-2 hover:ring-primary/50",
                isOverlay && "ring-2 ring-primary shadow-xl cursor-grabbing z-50",
                className
            )}
            onClick={() => { if (imageUrl && onImageClick) onImageClick(imageUrl) }}
        >
            {isLoading ? (
                <div className="w-full h-full flex items-center justify-center animate-pulse bg-muted">
                    <span className="sr-only">Loading...</span>
                </div>
            ) : (
                <img
                    src={imageUrl}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    draggable={false} // Prevent native drag
                />
            )}

            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate px-1">{item.name}</p>
            </div>
        </div>
    )

    if (isOverlay) return content

    return (
        <LibraryContextMenu
            item={item}
            onRename={onRename ? () => onRename(item) : undefined}
            onAddRef={onAddRef ? () => onAddRef(item) : undefined}
            onLoadMetadata={onLoadMetadata ? () => onLoadMetadata(item) : undefined}
        >
            {content}
        </LibraryContextMenu>
    )
}
