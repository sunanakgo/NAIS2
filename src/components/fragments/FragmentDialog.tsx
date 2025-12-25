import { useState } from 'react'
import { Plus, Trash2, Check, X as XIcon, Puzzle, Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { Label } from '@/components/ui/label'
import { useFragmentStore, TextFragment } from '@/stores/fragment-store'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { toast } from '@/components/ui/use-toast'

export function FragmentDialog() {
    const { t } = useTranslation()
    const { fragments, addFragment, updateFragment, removeFragment, exportFragments, importFragments } = useFragmentStore()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    // Form state
    const [label, setLabel] = useState('')
    const [prompt, setPrompt] = useState('')

    const resetForm = () => {
        setLabel('')
        setPrompt('')
        setEditingId(null)
        setIsCreating(false)
    }

    const handleSave = () => {
        if (!label.trim() || !prompt.trim()) return

        if (editingId) {
            updateFragment(editingId, { label, prompt })
        } else {
            addFragment({ label, prompt })
        }
        resetForm()
    }

    const startEdit = (fragment: TextFragment) => {
        setEditingId(fragment.id)
        setLabel(fragment.label)
        setPrompt(fragment.prompt)
        setIsCreating(false)
    }

    const startCreate = () => {
        setEditingId(null)
        setLabel('')
        setPrompt('')
        setIsCreating(true)
    }

    const handleExport = async () => {
        try {
            const data = exportFragments()
            const json = JSON.stringify(data, null, 2)

            const filePath = await save({
                defaultPath: 'fragments.json',
                filters: [{ name: 'JSON', extensions: ['json'] }]
            })

            if (filePath) {
                await writeTextFile(filePath, json)
                toast({ description: t('fragmentDialog.exportSuccess') })
            }
        } catch (error) {
            console.error('Export failed:', error)
            toast({ description: t('fragmentDialog.exportError'), variant: 'destructive' })
        }
    }

    const handleImport = async () => {
        try {
            const filePath = await open({
                filters: [{ name: 'JSON', extensions: ['json'] }],
                multiple: false
            })

            if (filePath) {
                const content = await readTextFile(filePath as string)
                const data = JSON.parse(content) as { name: string; prompt: string }[]

                // Validate structure
                if (!Array.isArray(data) || !data.every(item =>
                    typeof item.name === 'string' && typeof item.prompt === 'string'
                )) {
                    throw new Error('Invalid format')
                }

                importFragments(data, 'merge')
                toast({ description: t('fragmentDialog.importSuccess', { count: data.length }) })
            }
        } catch (error) {
            console.error('Import failed:', error)
            toast({ description: t('fragmentDialog.importError'), variant: 'destructive' })
        }
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl h-9">
                    <Puzzle className="h-3.5 w-3.5 mr-1.5" />
                    {t('prompt.fragment')}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="mb-4">
                    <DialogTitle>{t('fragmentDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('fragmentDialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
                    {/* List Section - Only show when NOT editing/creating */}
                    {!(isCreating || editingId) ? (
                        <div className="flex flex-col gap-2 min-h-0 w-full">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium text-muted-foreground">{t('fragmentDialog.available')}</span>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={handleImport} title={t('fragmentDialog.import')}>
                                        <Upload className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleExport} disabled={fragments.length === 0} title={t('fragmentDialog.export')}>
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={startCreate}>
                                        <Plus className="w-4 h-4 mr-1" /> {t('fragmentDialog.new')}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2 pr-2 content-start">
                                {fragments.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                                        {t('fragmentDialog.noFragments')}
                                    </div>
                                )}
                                {fragments.map((fragment) => (
                                    <div
                                        key={fragment.id}
                                        className="p-3 rounded-lg border bg-card text-card-foreground transition-all cursor-pointer hover:bg-accent/50 hover:border-primary/50 group"
                                        onClick={() => startEdit(fragment)}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-sm text-primary">&lt;{fragment.label}&gt;</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    removeFragment(fragment.id)
                                                }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2 font-mono break-all">
                                            {fragment.prompt}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Editor Section - Only show when editing/creating */
                        /* Editor Section - Only show when editing/creating */
                        <div className="flex-1 flex flex-col gap-4 min-h-0">
                            <div className="flex items-center justify-between pb-2 border-b">
                                <span className="font-semibold text-sm">
                                    {isCreating ? t('fragmentDialog.new') : t('fragmentDialog.edit')}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={resetForm}>
                                    <XIcon className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="flex-1 flex flex-col gap-4 min-h-0">
                                <div className="space-y-1.5">
                                    <Label htmlFor="label" className="text-xs font-medium">{t('fragmentDialog.label')}</Label>
                                    <Input
                                        id="label"
                                        placeholder={t('fragmentDialog.labelPlaceholder')}
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                                    <Label htmlFor="prompt" className="text-xs font-medium">{t('fragmentDialog.content')}</Label>
                                    <div className="flex-1 border rounded-md overflow-hidden bg-background min-h-[150px]">
                                        <AutocompleteTextarea
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder={t('fragmentDialog.contentPlaceholder')}
                                            className="h-full w-full border-0 focus-within:ring-0 rounded-none bg-transparent"
                                            style={{ fontSize: '0.875rem' }}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button variant="ghost" size="sm" onClick={resetForm}>{t('fragmentDialog.cancel')}</Button>
                                    <Button size="sm" onClick={handleSave} disabled={!label.trim() || !prompt.trim()}>
                                        <Check className="w-4 h-4 mr-1" /> {t('fragmentDialog.save')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
