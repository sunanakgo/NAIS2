import React, { useRef } from 'react'
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
import { Users, Upload, X } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useCharacterStore, ReferenceImage } from '@/stores/character-store'


const SafeSlider = ({
    value,
    onValueCommit,
    max = 1,
    step = 0.01,
}: {
    value: number[]
    onValueCommit: (val: number[]) => void
    max?: number
    step?: number
}) => {
    const [localValue, setLocalValue] = React.useState(value)

    React.useEffect(() => {
        setLocalValue(value)
    }, [value])

    return (
        <Slider
            value={localValue}
            min={0}
            max={max}
            step={step}
            onValueChange={setLocalValue}
            onValueCommit={onValueCommit}
        />
    )
}

export function CharacterSettingsDialog() {
    const { t } = useTranslation()
    const {
        characterImages,
        vibeImages,
        addCharacterImage,
        removeCharacterImage,
        updateCharacterImage,
        addVibeImage,
        removeVibeImage,
        updateVibeImage
    } = useCharacterStore()

    const charInputRef = useRef<HTMLInputElement>(null)
    const vibeInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'character' | 'vibe') => {
        const files = e.target.files
        if (!files || files.length === 0) return

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const base64 = await convertToBase64(file)
            if (mode === 'character') {
                addCharacterImage(base64)
            } else {
                addVibeImage(base64)
            }
        }
        // Reset input
        e.target.value = ''
    }

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => {
                resolve(reader.result as string)
            }
            reader.onerror = error => reject(error)
        })
    }

    // Image List Component (Reusable)
    const ImageList = ({
        images,
        onRemove,
        onUpdate
    }: {
        images: ReferenceImage[],
        onRemove: (id: string) => void,
        onUpdate: (id: string, updates: Partial<ReferenceImage>) => void
    }) => (
        <div className="space-y-4 pt-4">
            {images.length === 0 && (
                <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    {t('characterDialog.noImages')}
                </div>
            )}
            {images.map(img => (
                <div key={img.id} className="flex gap-4 p-3 border rounded-lg bg-card bg-muted/10">
                    <div className="relative shrink-0 w-24 h-24 bg-black rounded-md overflow-hidden border">
                        <img src={img.base64} alt="Reference" className="w-full h-full object-cover" />
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-80 hover:opacity-100"
                            onClick={() => onRemove(img.id)}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                    <div className="flex-1 space-y-3 min-w-0">
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <Label className="text-xs text-muted-foreground">{t('characterDialog.infoExtracted')}</Label>
                                <span className="text-xs font-mono">{img.informationExtracted.toFixed(2)}</span>
                            </div>
                            <SafeSlider
                                value={[img.informationExtracted]}
                                onValueCommit={([v]) => onUpdate(img.id, { informationExtracted: v })}
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <Label className="text-xs text-muted-foreground">{t('characterDialog.strength')}</Label>
                                <span className="text-xs font-mono">{img.strength.toFixed(2)}</span>
                            </div>
                            <SafeSlider
                                value={[img.strength]}
                                onValueCommit={([v]) => onUpdate(img.id, { strength: v })}
                            />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )

    const totalCount = characterImages.length + vibeImages.length

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl h-9 relative group">
                    <Users className="h-3.5 w-3.5 mr-1.5" />
                    {t('prompt.imageReference')}
                    {totalCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-md px-1 py-0.5 min-w-[16px] h-[16px] flex items-center justify-center shadow-sm">
                            {totalCount}
                        </div>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>{t('characterDialog.title')}</DialogTitle>
                    <DialogDescription>{t('characterDialog.description')}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="character" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid grid-cols-2 w-full">
                        <TabsTrigger value="character">{t('characterDialog.tabCharacter')}</TabsTrigger>
                        <TabsTrigger value="vibe">{t('characterDialog.tabVibe')}</TabsTrigger>
                    </TabsList>

                    <TabsContent value="character" className="flex-1 overflow-y-auto min-h-0 pr-1">
                        <div className="py-2">
                            {characterImages.length === 0 && (
                                <div
                                    className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => charInputRef.current?.click()}
                                >
                                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground font-medium">{t('characterDialog.uploadCharacter')}</p>
                                    <input
                                        type="file"
                                        multiple={false}
                                        accept="image/*"
                                        className="hidden"
                                        ref={charInputRef}
                                        onChange={(e) => handleFileUpload(e, 'character')}
                                    />
                                </div>
                            )}
                            <ImageList
                                images={characterImages}
                                onRemove={removeCharacterImage}
                                onUpdate={updateCharacterImage}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="vibe" className="flex-1 overflow-y-auto min-h-0 pr-1">
                        <div className="py-2">
                            <div
                                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => vibeInputRef.current?.click()}
                            >
                                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground font-medium">{t('characterDialog.uploadVibe')}</p>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    className="hidden"
                                    ref={vibeInputRef}
                                    onChange={(e) => handleFileUpload(e, 'vibe')}
                                />
                            </div>
                            <ImageList
                                images={vibeImages}
                                onRemove={removeVibeImage}
                                onUpdate={updateVibeImage}
                            />
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
