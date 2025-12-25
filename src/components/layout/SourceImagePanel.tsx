import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Image as ImageIcon, Paintbrush, Minus, Plus, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { useGenerationStore } from '@/stores/generation-store'
import { InpaintingDialog } from '@/components/tools/InpaintingDialog'
import { cn } from '@/lib/utils'

export function SourceImagePanel() {
    const { t } = useTranslation()
    const {
        sourceImage,
        mask,
        i2iMode,
        strength, setStrength,
        noise, setNoise,
        resetI2IParams
    } = useGenerationStore()

    const [inpaintDialogOpen, setInpaintDialogOpen] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // Don't show if no source image or no mode
    if (!sourceImage || !i2iMode) return null

    const isInpaint = i2iMode === 'inpaint'

    const handleCancel = () => {
        setIsAnimating(true)
        setTimeout(() => {
            resetI2IParams()
            setIsAnimating(false)
        }, 200)
    }

    return (
        <>
            <div
                className={cn(
                    "mb-4 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-xl border border-primary/20 overflow-hidden transition-all duration-300",
                    isAnimating && "opacity-0 scale-95 translate-x-[-20px]"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 bg-primary/5 border-b border-primary/10">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        {isInpaint ? (
                            <>
                                <Paintbrush className="h-4 w-4 text-pink-400" />
                                <span>{t('sourcePanel.inpaintMode', '인페인팅 모드')}</span>
                            </>
                        ) : (
                            <>
                                <ImageIcon className="h-4 w-4 text-indigo-400" />
                                <span>{t('sourcePanel.i2iMode', 'I2I 모드')}</span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Edit Mask Button (only for Inpaint) */}
                        {isInpaint && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full hover:bg-pink-500/20 hover:text-pink-400"
                                onClick={() => setInpaintDialogOpen(true)}
                                title={t('sourcePanel.editMask', '마스크 편집')}
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-destructive/20 hover:text-destructive"
                            onClick={handleCancel}
                            title={t('sourcePanel.cancel', '취소하고 T2I로 돌아가기')}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Image Preview */}
                <div className="p-2">
                    <div className="relative aspect-video bg-muted/30 rounded-lg overflow-hidden">
                        <img
                            src={sourceImage}
                            alt="Source"
                            className="w-full h-full object-contain"
                        />
                        {/* Mask overlay - display actual mask image */}
                        {isInpaint && mask && (
                            <>
                                <img
                                    src={mask}
                                    alt="Mask"
                                    className="absolute inset-0 w-full h-full object-contain opacity-50 pointer-events-none"
                                />
                                <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-pink-500/80 text-white text-[10px] rounded-md">
                                    {t('sourcePanel.maskSet', '마스크 설정됨')}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="px-3 pb-3 space-y-2">
                    {/* Strength Slider */}
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-14">{t('tools.i2i.strength', 'Strength')}</Label>
                        <div className="flex items-center gap-1.5 flex-1">
                            <Minus className="h-3 w-3 text-muted-foreground/50" />
                            <Slider
                                value={[strength]}
                                min={0.01}
                                max={0.99}
                                step={0.01}
                                onValueChange={([v]) => setStrength(v)}
                                className="flex-1"
                            />
                            <Plus className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-xs text-muted-foreground w-8 text-right font-mono">{strength.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Noise Slider (only for I2I) */}
                    {!isInpaint && (
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-14">{t('tools.i2i.noise', 'Noise')}</Label>
                            <div className="flex items-center gap-1.5 flex-1">
                                <Minus className="h-3 w-3 text-muted-foreground/50" />
                                <Slider
                                    value={[noise]}
                                    min={0}
                                    max={0.99}
                                    step={0.01}
                                    onValueChange={([v]) => setNoise(v)}
                                    className="flex-1"
                                />
                                <Plus className="h-3 w-3 text-muted-foreground/50" />
                                <span className="text-xs text-muted-foreground w-8 text-right font-mono">{noise.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Inpainting Dialog for mask editing */}
            <InpaintingDialog
                open={inpaintDialogOpen}
                onOpenChange={setInpaintDialogOpen}
                sourceImage={sourceImage}
            />
        </>
    )
}
