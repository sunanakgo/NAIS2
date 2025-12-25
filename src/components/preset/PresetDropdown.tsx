import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Pencil, Check, X, FolderOpen } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usePresetStore } from '@/stores/preset-store'
import { cn } from '@/lib/utils'

function PresetDialogContent() {
    const { t } = useTranslation()
    const {
        presets,
        activePresetId,
        addPreset,
        deletePreset,
        loadPreset,
        renamePreset,
    } = usePresetStore()

    const [open, setOpen] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    const handleCreate = () => {
        if (newName.trim()) {
            addPreset(newName.trim())
            setNewName('')
            setIsCreating(false)
        }
    }

    const handleRename = (id: string) => {
        if (editName.trim()) {
            renamePreset(id, editName.trim())
            setEditingId(null)
            setEditName('')
        }
    }

    const handleSelect = (id: string) => {
        loadPreset(id)
        setOpen(false)
    }

    const startEdit = (id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingId(id)
        setEditName(currentName)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <FolderOpen className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('preset.title', '프리셋 관리')}</DialogTitle>
                    <DialogDescription>
                        {t('preset.description', '프롬프트와 설정을 프리셋으로 저장하고 불러올 수 있습니다.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {presets.map(preset => (
                        <div
                            key={preset.id}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                                activePresetId === preset.id
                                    ? "bg-primary/10 border border-primary/30"
                                    : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                            )}
                            onClick={() => handleSelect(preset.id)}
                        >
                            {editingId === preset.id ? (
                                <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                    <Input
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="h-7 text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename(preset.id)
                                            if (e.key === 'Escape') setEditingId(null)
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => handleRename(preset.id)}
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => setEditingId(null)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <span className="flex-1 text-sm font-medium truncate">
                                        {preset.isDefault ? t('preset.default', '기본') : preset.name}
                                    </span>
                                    {activePresetId === preset.id && (
                                        <span className="text-[10px] text-primary font-medium px-1.5 py-0.5 bg-primary/10 rounded">
                                            {t('preset.active', '활성')}
                                        </span>
                                    )}
                                    {!preset.isDefault && (
                                        <div className="flex items-center gap-0.5">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                onClick={(e) => startEdit(preset.id, preset.name, e)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6 text-destructive hover:text-destructive"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deletePreset(preset.id)
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add new preset */}
                <div className="pt-2 border-t">
                    {isCreating ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('preset.newName', '프리셋 이름')}
                                className="h-9 text-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate()
                                    if (e.key === 'Escape') {
                                        setIsCreating(false)
                                        setNewName('')
                                    }
                                }}
                            />
                            <Button size="sm" onClick={handleCreate}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    setIsCreating(false)
                                    setNewName('')
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsCreating(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {t('preset.add', '새 프리셋')}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

// Export as PresetDropdown for backward compatibility
export { PresetDialogContent as PresetDropdown }
