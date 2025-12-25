import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Copy, FolderOpen, Save, Trash2, Wand2, Users, FileSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/use-toast'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, remove, readFile } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { useNavigate } from 'react-router-dom'
import { useToolsStore } from '@/stores/tools-store'
import { SceneImage } from '@/stores/scene-store'

interface SceneContextMenuProps {
    image: SceneImage
    children: React.ReactNode
    onDelete: () => void
    onAddRef?: () => void
    onLoadMetadata?: () => void
}

export function SceneImageContextMenu({ image, children, onDelete, onAddRef, onLoadMetadata }: SceneContextMenuProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { setActiveImage } = useToolsStore()

    // Determine file path. 
    // image.url is expected to be the full file path for saved images.
    // If it's data: URI, some features like Open Folder won't work well, but logic below handles standard paths.
    const isFile = !image.url.startsWith('data:')

    const handleCopy = async () => {
        try {
            let blob: Blob
            if (isFile) {
                const data = await readFile(image.url)
                blob = new Blob([data], { type: 'image/png' })
            } else {
                // Handle Base64 (Streaming/Preview)
                const res = await fetch(image.url)
                blob = await res.blob()
            }

            await navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
            ])
            toast({ title: t('actions.copied', '복사 완료'), variant: 'success' })
        } catch (e) {
            console.error('Copy failed:', e)
            toast({ title: t('actions.copyFailed', '복사 실패'), variant: 'destructive' })
        }
    }

    const handleSaveAs = async () => {
        try {
            let data: Uint8Array
            if (isFile) {
                data = await readFile(image.url)
            } else {
                const res = await fetch(image.url)
                const buffer = await res.arrayBuffer()
                data = new Uint8Array(buffer)
            }

            const filePath = await save({
                defaultPath: `NAIS_${image.timestamp}.png`,
                filters: [{ name: 'Image', extensions: ['png', 'jpg', 'webp'] }],
            })
            if (filePath) {
                await writeFile(filePath, data)
                toast({ title: t('toast.saved', '저장 완료'), variant: 'success' })
            }
        } catch (e) {
            console.error('Save failed:', e)
            toast({ title: t('toast.saveFailed', '저장 실패'), variant: 'destructive' })
        }
    }

    const handleSmartTools = async () => {
        try {
            let base64 = ''
            if (isFile) {
                const data = await readFile(image.url)
                // Convert to base64
                let binary = ''
                const len = data.byteLength
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(data[i])
                }
                base64 = btoa(binary)
            } else {
                base64 = image.url.split(',')[1]
            }

            setActiveImage(`data:image/png;base64,${base64}`)
            navigate('/tools')
        } catch (e) {
            console.error('Failed to load for tools:', e)
            toast({ title: t('smartTools.error', '이미지 로드 실패'), variant: 'destructive' })
        }
    }

    const handleOpenFolder = async () => {
        if (!isFile) return
        try {
            await Command.create('explorer', ['/select,', image.url]).execute()
        } catch (e) {
            console.error('Failed to open folder:', e)
        }
    }

    const handleDelete = async () => {
        if (isFile) {
            try {
                await remove(image.url)
            } catch (e) {
                console.error('File delete failed (might already be deleted):', e)
            }
        }
        // Always call parent onDelete to remove from UI store
        onDelete()
        toast({ title: t('actions.deleted', '삭제 완료'), variant: 'success' })
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                <ContextMenuItem onClick={handleSaveAs}>
                    <Save className="h-4 w-4 mr-2" />
                    {t('actions.saveAs', '다른 이름으로 저장')}
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-2" />
                    {t('actions.copy', '복사')}
                </ContextMenuItem>
                <ContextMenuItem onClick={handleSmartTools}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    {t('smartTools.title', '스마트 툴 (Inpaint/Upscale)')}
                </ContextMenuItem>

                {onAddRef && (
                    <ContextMenuItem onClick={onAddRef}>
                        <Users className="h-4 w-4 mr-2" />
                        {t('actions.addAsRef', '이미지 참조')}
                    </ContextMenuItem>
                )}

                {onLoadMetadata && (
                    <ContextMenuItem onClick={onLoadMetadata}>
                        <FileSearch className="h-4 w-4 mr-2" />
                        {t('metadata.loadFromImage', '메타데이터 불러오기')}
                    </ContextMenuItem>
                )}

                {isFile && (
                    <ContextMenuItem onClick={handleOpenFolder}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        {t('actions.openFolder', '탐색기에서 열기')}
                    </ContextMenuItem>
                )}

                <ContextMenuItem onClick={handleDelete} className="text-red-500 focus:text-red-500">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('actions.delete', '삭제')}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
