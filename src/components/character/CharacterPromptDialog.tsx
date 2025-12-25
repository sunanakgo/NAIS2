import { useState, useRef, useEffect, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Users, Eye, EyeOff, MapPin, Search, Edit, MoreVertical, Check, X } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AutocompleteTextarea } from '@/components/ui/AutocompleteTextarea'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCharacterPromptStore, CHARACTER_COLORS, CharacterPrompt, CharacterPreset } from '@/stores/character-prompt-store'
import { cn } from '@/lib/utils'

// --- Position Grid Component ---
interface PositionGridProps {
    characters: CharacterPrompt[]
    selectedId: string | null
    onSelect: (id: string) => void
    onPositionChange: (id: string, x: number, y: number) => void
}

function PositionGrid({ characters, selectedId, onSelect, onPositionChange }: PositionGridProps) {
    const { t } = useTranslation()
    const gridRef = useRef<HTMLDivElement>(null)
    const [dragging, setDragging] = useState<string | null>(null)

    const handleMouseDown = (e: MouseEvent, id: string) => {
        e.preventDefault()
        setDragging(id)
        onSelect(id)
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!dragging || !gridRef.current) return
        const rect = gridRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
        onPositionChange(dragging, x, y)
    }

    const handleMouseUp = () => {
        setDragging(null)
    }

    useEffect(() => {
        const handleGlobalMouseUp = () => setDragging(null)
        window.addEventListener('mouseup', handleGlobalMouseUp)
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }, [])

    const zones = [
        { label: t('characterPromptDialog.position.topLeft', '상단\n왼쪽'), x: 0.17, y: 0.15 },
        { label: t('characterPromptDialog.position.top', '상단'), x: 0.5, y: 0.15 },
        { label: t('characterPromptDialog.position.topRight', '상단\n오른쪽'), x: 0.83, y: 0.15 },
        { label: t('characterPromptDialog.position.left', '왼쪽'), x: 0.17, y: 0.5 },
        { label: t('characterPromptDialog.position.center', '중앙'), x: 0.5, y: 0.5 },
        { label: t('characterPromptDialog.position.right', '오른쪽'), x: 0.83, y: 0.5 },
        { label: t('characterPromptDialog.position.bottomLeft', '하단\n왼쪽'), x: 0.17, y: 0.85 },
        { label: t('characterPromptDialog.position.bottom', '하단'), x: 0.5, y: 0.85 },
        { label: t('characterPromptDialog.position.bottomRight', '하단\n오른쪽'), x: 0.83, y: 0.85 },
    ]

    return (
        <div
            ref={gridRef}
            className="relative w-full aspect-[3/4] bg-muted/30 rounded-lg border cursor-crosshair select-none overflow-hidden shadow-inner"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Grid lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {[...Array(9)].map((_, i) => (
                    <div key={i} className="border border-border/20" />
                ))}
            </div>

            {/* Zone labels */}
            {zones.map((zone, i) => (
                <div
                    key={i}
                    className="absolute text-[10px] text-muted-foreground/50 whitespace-pre-line text-center pointer-events-none select-none"
                    style={{
                        left: `${zone.x * 100}%`,
                        top: `${zone.y * 100}%`,
                        transform: 'translate(-50%, -50%)'
                    }}
                >
                    {zone.label}
                </div>
            ))}

            {/* Character markers */}
            {characters.filter(c => c.enabled).map((char) => {
                // Find visible index among enabled characters to keep colors consistent? 
                // Actually existing logic uses index in full array which is better for stability
                const colorIndex = characters.findIndex(c => c.id === char.id)

                return (
                    <div
                        key={char.id}
                        className={cn(
                            "absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold cursor-grab active:cursor-grabbing shadow-md transition-transform",
                            selectedId === char.id && "ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-110 z-10",
                            dragging === char.id && "scale-125 z-20"
                        )}
                        style={{
                            left: `${char.position.x * 100}%`,
                            top: `${char.position.y * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: CHARACTER_COLORS[colorIndex % CHARACTER_COLORS.length],
                        }}
                        onMouseDown={(e) => handleMouseDown(e, char.id)}
                    >
                        {colorIndex + 1}
                    </div>
                )
            })}

            {/* Empty state overlay */}
            {characters.filter(c => c.enabled).length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/5 backdrop-blur-[1px]">
                    <div className="text-muted-foreground text-xs flex flex-col items-center gap-2">
                        <MapPin className="w-8 h-8 opacity-40" />
                        <span>{t('characterPromptDialog.noCharacters', '캐릭터 추가')}</span>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- Preset Editor Dialog ---
interface PresetEditorProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: CharacterPreset
    onSave: (data: Omit<CharacterPreset, 'id'>) => void
}

function PresetEditor({ open, onOpenChange, initialData, onSave }: PresetEditorProps) {
    const { t } = useTranslation()
    const [name, setName] = useState(initialData?.name || '')
    const [prompt, setPrompt] = useState(initialData?.prompt || '')
    const [negative, setNegative] = useState(initialData?.negative || '')

    useEffect(() => {
        if (open) {
            setName(initialData?.name || '')
            setPrompt(initialData?.prompt || '')
            setNegative(initialData?.negative || '')
        }
    }, [open, initialData])

    const handleSave = () => {
        if (!name.trim()) return
        onSave({ name, prompt, negative })
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {initialData ? t('common.edit', '편집') : t('preset.add', '새 프리셋')}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>{t('preset.newName', '프리셋 이름')}</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Character Name..."
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Prompt</Label>
                        <AutocompleteTextarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="Character appearance tags..."
                            className="h-24"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Negative Prompt</Label>
                        <AutocompleteTextarea
                            value={negative}
                            onChange={e => setNegative(e.target.value)}
                            placeholder="Optional negative tags..."
                            className="h-16"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel', '취소')}
                    </Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        {t('common.save', '저장')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// --- Main Component ---
export function CharacterPromptDialog() {
    const { t } = useTranslation()
    const {
        characters, presets,
        addPreset, updatePreset, deletePreset, importFromStart,
        removeCharacter, setPosition, toggleEnabled
    } = useCharacterPromptStore()

    const [search, setSearch] = useState('')
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
    const [isCreatorOpen, setIsCreatorOpen] = useState(false)
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

    const filteredPresets = presets.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleTogglePreset = (preset: CharacterPreset) => {
        // Check if already on stage
        const existing = characters.find(c => c.presetId === preset.id)
        if (existing) {
            removeCharacter(existing.id)
        } else {
            importFromStart(preset.id)
        }
    }

    const getStateColor = (presetId: string) => {
        const index = characters.findIndex(c => c.presetId === presetId)
        if (index === -1) return null
        return CHARACTER_COLORS[index % CHARACTER_COLORS.length]
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl h-9 relative">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    {t('prompt.character', '캐릭터')}
                    {characters.filter(c => c.enabled).length > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold rounded-md px-1 py-0.5 min-w-[16px] h-[16px] flex items-center justify-center shadow-sm">
                            {characters.filter(c => c.enabled).length}
                        </div>
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl h-[75vh] flex flex-col p-0 overflow-hidden gap-0">
                <DialogTitle className="sr-only">
                    {t('characterPromptDialog.title', '배치 및 설정')}
                </DialogTitle>
                <div className="flex h-full">

                    {/* LEFT: Library Panel */}
                    <div className="w-[400px] border-r flex flex-col bg-muted/10">
                        <div className="p-4 border-b space-y-3 bg-background/50 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    {t('characterPromptDialog.list', '라이브러리')}
                                </h3>
                                <Button size="sm" onClick={() => setIsCreatorOpen(true)} className="h-8 text-xs">
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    {t('common.add', '새 캐릭터')}
                                </Button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder={t('common.search', '검색...')}
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            <div className="grid grid-cols-2 gap-3">
                                {filteredPresets.map(preset => {
                                    const isActive = characters.some(c => c.presetId === preset.id)
                                    const activeColor = getStateColor(preset.id)

                                    return (
                                        <Card
                                            key={preset.id}
                                            className={cn(
                                                "cursor-pointer transition-all hover:shadow-md group relative overflow-hidden",
                                                isActive ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"
                                            )}
                                            onClick={() => handleTogglePreset(preset)}
                                        >
                                            <CardHeader className="p-3 pb-0 space-y-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="font-bold text-sm truncate leading-tight pr-4" title={preset.name}>
                                                        {preset.name}
                                                    </div>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <MoreVertical className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={(e) => {
                                                                e.stopPropagation()
                                                                setEditingPresetId(preset.id)
                                                            }}>
                                                                <Edit className="w-4 h-4 mr-2" />
                                                                {t('common.edit', '편집')}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    deletePreset(preset.id)
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                {t('common.delete', '삭제')}
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-3">
                                                <div className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em] leading-relaxed">
                                                    {preset.prompt || <span className="italic opacity-50">No prompt...</span>}
                                                </div>
                                            </CardContent>

                                            {/* Active Indicator Badge */}
                                            {isActive && (
                                                <div
                                                    className="absolute top-0 right-0 w-0 h-0 border-l-[24px] border-l-transparent border-t-[24px]"
                                                    style={{ borderTopColor: activeColor || 'currentColor' }}
                                                />
                                            )}
                                            {isActive && (
                                                <Check className="absolute top-0.5 right-0.5 w-3 h-3 text-white" />
                                            )}
                                        </Card>
                                    )
                                })}

                                {filteredPresets.length === 0 && (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                                        <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        {search ? '검색 결과가 없습니다.' : '저장된 캐릭터가 없습니다.'}
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT: Stage Panel */}
                    <div className="flex-1 flex flex-col min-w-0 bg-background">
                        <div className="p-4 pr-12 border-b flex justify-between items-center bg-muted/10">
                            <div className="flex flex-col">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />
                                    {t('characterPromptDialog.title', '배치 및 설정')}
                                </h3>
                                <span className="text-xs text-muted-foreground">
                                    {characters.filter(c => c.enabled).length} Active Characters
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => useCharacterPromptStore.getState().clearAll()}
                                    disabled={characters.length === 0}
                                >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    {t('actions.clear', '초기화')}
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 px-8 py-6 overflow-y-auto">
                            <div className="flex flex-col h-full gap-6">
                                {/* Grid Area - Reduced Size */}
                                <div className="flex-none flex items-center justify-center min-h-[400px] bg-muted/5 rounded-xl border-dashed border-2 border-muted">
                                    <div className="w-[70%] max-w-[350px]">
                                        <PositionGrid
                                            characters={characters}
                                            selectedId={selectedStageId}
                                            onSelect={setSelectedStageId}
                                            onPositionChange={setPosition}
                                        />
                                    </div>
                                </div>

                                {/* Active List Details - Moved to Bottom */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                        {t('characterPromptDialog.activeList', 'Active List')}
                                    </h4>
                                    <div className="space-y-2">
                                        {characters.map((char, index) => {
                                            const preset = presets.find(p => p.id === char.presetId)
                                            const name = preset?.name || `Character ${index + 1}`

                                            // 1 (Number) / Name / Coords / X
                                            return (
                                                <div
                                                    key={char.id}
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 rounded-md border bg-card text-sm transition-all hover:bg-accent/50",
                                                        selectedStageId === char.id && "ring-1 ring-primary border-primary",
                                                        !char.enabled && "opacity-60 grayscale"
                                                    )}
                                                    onClick={() => setSelectedStageId(char.id)}
                                                >
                                                    {/* 1. Character Number */}
                                                    <div
                                                        className="flex-none w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                                        style={{ backgroundColor: CHARACTER_COLORS[index % CHARACTER_COLORS.length] }}
                                                    >
                                                        {index + 1}
                                                    </div>

                                                    {/* 2. Name */}
                                                    <span className="font-medium truncate flex-1 leading-none pt-0.5">
                                                        {name}
                                                    </span>

                                                    {/* 3. Coordinates */}
                                                    <div className="text-xs text-muted-foreground font-mono tabular-nums leading-none pt-0.5">
                                                        X: {char.position.x.toFixed(2)}, Y: {char.position.y.toFixed(2)}
                                                    </div>

                                                    {/* 4. Actions (Toggle / Delete) */}
                                                    <div className="flex items-center gap-1 border-l pl-2 ml-2">
                                                        <Button
                                                            size="icon" variant="ghost" className="h-6 w-6"
                                                            onClick={(e) => { e.stopPropagation(); toggleEnabled(char.id) }}
                                                        >
                                                            {char.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                                        </Button>
                                                        <Button
                                                            size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                                            onClick={(e) => { e.stopPropagation(); removeCharacter(char.id) }}
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {characters.length === 0 && (
                                            <div className="text-center py-4 text-muted-foreground/50 text-xs italic border rounded-md border-dashed">
                                                {t('characterPromptDialog.noActive', '선택된 캐릭터가 없습니다.')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Sub-Dialogs */}
            <PresetEditor
                open={isCreatorOpen}
                onOpenChange={setIsCreatorOpen}
                onSave={addPreset}
            />

            {editingPresetId && (
                <PresetEditor
                    open={!!editingPresetId}
                    onOpenChange={(open) => !open && setEditingPresetId(null)}
                    initialData={presets.find(p => p.id === editingPresetId)}
                    onSave={(data) => {
                        updatePreset(editingPresetId, data)
                        setEditingPresetId(null)
                    }}
                />
            )}
        </Dialog>
    )
}
