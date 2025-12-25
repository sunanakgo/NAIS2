
import { useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { useGenerationStore } from '@/stores/generation-store'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon, Wand2, Minus, Plus, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface I2IDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceImage: string | null
}

export function I2IDialog({ open, onOpenChange, sourceImage: propSourceImage }: I2IDialogProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const {
        setSourceImage,
        strength, setStrength,
        noise, setNoise,
        resetI2IParams,
        generate,
        isGenerating
    } = useGenerationStore()

    // Reset params and set source image when dialog opens
    useEffect(() => {
        if (open) {
            if (propSourceImage) {
                setSourceImage(propSourceImage)
            }
        } else {
            resetI2IParams()
        }
    }, [open, propSourceImage, setSourceImage, resetI2IParams])

    const handleGenerate = async () => {
        if (!propSourceImage) return
        await generate()
        onOpenChange(false)
        navigate('/')
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex flex-col p-6" style={{ maxWidth: '60vw', maxHeight: '85vh', width: '60vw', height: '85vh' }}>
                <DialogHeader className="mb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ImageIcon className="w-5 h-5" />
                        {t('tools.i2i.title', 'Image to Image')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('tools.i2i.description', 'Generate a new image based on an existing image.')}
                    </DialogDescription>
                </DialogHeader>

                {/* Controls */}
                <div className="flex gap-6 mb-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t('tools.i2i.strength', 'Strength')}</Label>
                        <div className="flex items-center gap-2">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <Slider
                                value={[strength]}
                                min={0.01}
                                max={0.99}
                                step={0.01}
                                onValueChange={([v]) => setStrength(v)}
                                className="w-32"
                            />
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-8">{strength.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Label className="text-sm whitespace-nowrap">{t('tools.i2i.noise', 'Noise')}</Label>
                        <div className="flex items-center gap-2">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                            <Slider
                                value={[noise]}
                                min={0}
                                max={0.99}
                                step={0.01}
                                onValueChange={([v]) => setNoise(v)}
                                className="w-32"
                            />
                            <Plus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground w-8">{noise.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Image Preview Container */}
                <div
                    className="flex-1 relative overflow-hidden rounded-lg bg-muted/50 flex items-center justify-center p-4"
                    style={{ minHeight: '400px' }}
                >
                    {propSourceImage ? (
                        <img
                            src={propSourceImage}
                            alt="Source"
                            className="max-w-full max-h-full w-auto h-auto object-contain"
                        />
                    ) : (
                        <div className="text-muted-foreground">
                            No image loaded
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-4 sm:justify-end items-center gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={!propSourceImage || isGenerating}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('common.generating', 'Generating...')}
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4 mr-2" />
                                {t('common.generate', 'Generate')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
