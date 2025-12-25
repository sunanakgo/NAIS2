import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { LibraryItem, useLibraryStore } from '@/stores/library-store'
import { Copy, FolderOpen, Save, Trash2, Wand2, Users, Pencil, FileSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/use-toast'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, remove, readFile } from '@tauri-apps/plugin-fs'
import { Command } from '@tauri-apps/plugin-shell'
import { useNavigate } from 'react-router-dom'
import { useToolsStore } from '@/stores/tools-store'

interface LibraryContextMenuProps {
    item: LibraryItem
    children: React.ReactNode
    onRename?: () => void
    onAddRef?: () => void
    onLoadMetadata?: () => void
}

export function LibraryContextMenu({ item, children, onRename, onAddRef, onLoadMetadata }: LibraryContextMenuProps) {
    const { t } = useTranslation()
    const { removeItem } = useLibraryStore()
    const navigate = useNavigate()
    const { setActiveImage } = useToolsStore()

    const handleCopy = async () => {
        try {
            const data = await readFile(item.path)
            const blob = new Blob([data], { type: 'image/png' })
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
            const data = await readFile(item.path)
            const filePath = await save({
                defaultPath: item.name,
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
            const data = await readFile(item.path)
            let binary = ''
            const len = data.byteLength
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(data[i])
            }
            const base64 = btoa(binary)

            setActiveImage(`data:image/png;base64,${base64}`)
            navigate('/tools')
        } catch (e) {
            console.error('Failed to load for tools:', e)
            toast({ title: t('smartTools.error', '이미지 로드 실패'), variant: 'destructive' })
        }
    }

    const handleOpenFolder = async () => {
        try {
            await Command.create('explorer', ['/select,', item.path]).execute()
        } catch (e) {
            console.error('Failed to open folder:', e)
        }
    }

    const handleDelete = async () => {
        try {
            // Optional: Ask for confirmation or just delete? 
            // Usually direct delete in context menu is fine if there's no undo, but let's just delete for now as per requirement.
            // Requirement didn't specify confirmation dialog.
            await remove(item.path)
            removeItem(item.id)
            toast({ title: t('actions.deleted', '삭제 완료'), variant: 'success' })
        } catch (e) {
            console.error('Delete failed:', e)
            removeItem(item.id) // Still remove from store if file not found
        }
    }

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent className="w-64">
                <ContextMenuItem onClick={onRename}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('actions.rename', '이름 변경')}
                </ContextMenuItem>
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
                    {t('smartTools.title', '스마트 툴')}
                </ContextMenuItem>
                <ContextMenuItem onClick={onAddRef}>
                    <Users className="h-4 w-4 mr-2" />
                    {t('actions.addAsRef', '이미지 참조')}
                </ContextMenuItem>
                <ContextMenuItem onClick={onLoadMetadata}>
                    <FileSearch className="h-4 w-4 mr-2" />
                    {t('metadata.loadFromImage', '메타데이터 불러오기')}
                </ContextMenuItem>
                <ContextMenuItem onClick={handleOpenFolder}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {t('actions.openFolder', '폴더 열기')}
                </ContextMenuItem>
                <ContextMenuItem onClick={handleDelete} className="text-red-500 focus:text-red-500">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t('actions.delete', '삭제')}
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    )
}
