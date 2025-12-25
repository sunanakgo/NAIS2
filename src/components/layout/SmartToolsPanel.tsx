
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eraser, Tags, Grid3X3, Copy, RefreshCw, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { smartTools, TagResult } from '@/services/smart-tools'


interface SmartToolsPanelProps {
    imageUrl: string | null
    onClose: () => void
    onUpdateImage: (newImageUrl: string) => void
}

export function SmartToolsPanel({ imageUrl, onClose, onUpdateImage }: SmartToolsPanelProps) {
    const { t } = useTranslation()
    const [processedImage, setProcessedImage] = useState<string | null>(imageUrl)
    const [activeTool, setActiveTool] = useState<'none' | 'mosaic' | 'rembg' | 'tagger'>('none')
    const [isLoading, setIsLoading] = useState(false)
    const [progress, setProgress] = useState(0)

    // Tagger State
    const [tags, setTags] = useState<TagResult[]>([])

    // Mosaic State
    const [pixelSize, setPixelSize] = useState(10)
    // Modals
    const [isTaggerAvailable, setIsTaggerAvailable] = useState(false)
    const [isCheckingTagger, setIsCheckingTagger] = useState(true)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    // Check availability on mount
    useEffect(() => {
        smartTools.checkTaggerAvailable().then(available => {
            setIsTaggerAvailable(available)
            setIsCheckingTagger(false)
            if (!available) {
                console.log("Tagger binary not found. Tag extraction disabled.")
            }
        })
    }, [])

    // Update internal state when prop changes
    useEffect(() => {
        setProcessedImage(imageUrl)
    }, [imageUrl])

    // --- Background Removal ---
    const handleRemoveBackground = async () => {
        if (!processedImage) return
        setActiveTool('rembg')
        setIsLoading(true)
        setProgress(0)
        try {
            const result = await smartTools.removeBackground(processedImage, (p) => setProgress(Math.round(p * 100)))
            setProcessedImage(result)
            toast({ title: t('smartTools.rembgComplete', '배경 제거 완료'), variant: 'success' })
        } catch (e) {
            console.error(e)
            toast({ title: t('smartTools.error', '작업 실패'), description: String(e), variant: 'destructive' })
        } finally {
            setIsLoading(false)
            setActiveTool('none')
        }
    }

    // --- WD Tagger ---
    const handleAnalyzeTags = async () => {
        if (!processedImage) return
        setActiveTool('tagger')
        setIsLoading(true)
        setProgress(0)
        try {
            const result = await smartTools.analyzeTags(processedImage, (p) => setProgress(Math.round(p * 100)))
            // Filter and sort tags
            const filtered = result.filter(r => r.score > 0.35).sort((a, b) => b.score - a.score)
            setTags(filtered)
            toast({ title: t('smartTools.taggingComplete', '태그 분석 완료'), variant: 'success' })
        } catch (e) {
            console.error(e)
            toast({ title: t('smartTools.error', '작업 실패'), variant: 'destructive' })
        } finally {
            setIsLoading(false)
            // Keep tool active to show tags
        }
    }

    // --- Mosaic Tool ---
    // Simple canvas-based mosaic: click/drag to pixelate region
    // Ideally we need an "Apply" flow. For now, let's do full image pixelate demo or region if complex.
    // Let's implement full image pixelate toggle for simplicity first, or region if user wants.
    // User asked "Mosaic function", usually implies obscuring parts.
    // Implementing Region Mosaic:

    useEffect(() => {
        if (activeTool === 'mosaic' && processedImage && canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const img = new Image()
            img.onload = () => {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0)
            }
            img.src = processedImage
        }
    }, [activeTool, processedImage])

    const applyMosaicToRegion = (x: number, y: number, size: number) => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        // Simple pixelate algo for a region around x,y
        const regionSize = size // Size of brush
        const startX = Math.max(0, x - regionSize / 2)
        const startY = Math.max(0, y - regionSize / 2)
        const w = Math.min(canvas.width - startX, regionSize)
        const h = Math.min(canvas.height - startY, regionSize)

        // Get data
        // For true pixelate: subsample
        const sampleSize = pixelSize

        for (let py = startY; py < startY + h; py += sampleSize) {
            for (let px = startX; px < startX + w; px += sampleSize) {
                const p = ctx.getImageData(px, py, 1, 1).data
                ctx.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${p[3] / 255})`
                ctx.fillRect(px, py, sampleSize, sampleSize)
            }
        }
    }

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || activeTool !== 'mosaic') return
        const rect = canvasRef.current!.getBoundingClientRect()
        const scaleX = canvasRef.current!.width / rect.width
        const scaleY = canvasRef.current!.height / rect.height
        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY
        applyMosaicToRegion(x, y, pixelSize)
    }

    const saveCanvas = () => {
        if (canvasRef.current) {
            const newData = canvasRef.current.toDataURL('image/png')
            setProcessedImage(newData)
            setActiveTool('none')
        }
    }

    return (
        <div className="flex flex-col h-full bg-background border-l border-border w-[350px] shadow-xl">
            {/* Header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 font-medium">
                    <Wand2 className="h-4 w-4 text-primary" />
                    {t('smartTools.title', '스마트 툴')}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Image Preview */}
                <div className="relative aspect-[2/3] bg-muted/50 rounded-lg overflow-hidden border border-border flex items-center justify-center">
                    {activeTool === 'mosaic' ? (
                        <canvas
                            ref={canvasRef}
                            className="w-full h-full object-contain cursor-crosshair"
                            onMouseDown={() => setIsDrawing(true)}
                            onMouseUp={() => setIsDrawing(false)}
                            onMouseLeave={() => setIsDrawing(false)}
                            onMouseMove={handleCanvasMouseMove}
                        />
                    ) : (
                        processedImage ? (
                            <img src={processedImage} className="w-full h-full object-contain" alt="Target" />
                        ) : (
                            <div className="text-muted-foreground text-sm">No Image</div>
                        )
                    )}

                    {isLoading && (
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                            <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                            <span className="text-sm font-medium">{progress}%</span>
                        </div>
                    )}
                </div>

                {/* Toolbar */}
                <div className="space-y-4">

                    {/* Background Removal */}
                    <div className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <Eraser className="h-5 w-5 text-rose-400" />
                            <span className="font-medium text-sm">{t('smartTools.rembg', '배경 제거')}</span>
                        </div>
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={handleRemoveBackground}
                            disabled={isLoading || !processedImage}
                        >
                            {t('smartTools.runRembg', '배경 제거 실행')}
                        </Button>
                    </div>

                    {/* Tagger */}
                    <div className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <Tags className="h-5 w-5 text-blue-400" />
                            <span className="font-medium text-sm">{t('smartTools.tagger', '태그 분석')}</span>
                        </div>
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={handleAnalyzeTags}
                            disabled={isLoading || !processedImage || !isTaggerAvailable}
                            title={isTaggerAvailable ? "" : "Tagger binary (tagger-server) not found in app directory."}
                        >
                            {isCheckingTagger ? "Checking..." : (isTaggerAvailable ? t('smartTools.runTagger', '태그 분석 실행') : t('smartTools.taggerUnavailable', '태그 실행 파일 없음'))}
                        </Button>

                        {/* Tags Display */}
                        {tags.length > 0 && activeTool === 'tagger' && (
                            <ScrollArea className="h-32 mt-3 rounded border bg-muted/30 p-2">
                                <div className="flex flex-wrap gap-1">
                                    {tags.map((tag, i) => (
                                        <Badge key={i} variant="outline" className="text-xs bg-background/50">
                                            {tag.label} <span className="text-[10px] opacity-50 ml-1">{(tag.score).toFixed(2)}</span>
                                        </Badge>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                        {tags.length > 0 && activeTool === 'tagger' && (
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={() => {
                                    const tagStr = tags.map(t => t.label).join(', ')
                                    navigator.clipboard.writeText(tagStr)
                                    toast({ title: 'Copied!' })
                                }}>
                                    <Copy className="h-3 w-3 mr-1" /> Copy
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Mosaic */}
                    <div className="p-3 border rounded-lg bg-card hover:bg-muted/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <Grid3X3 className="h-5 w-5 text-amber-400" />
                            <span className="font-medium text-sm">{t('smartTools.mosaic', '모자이크')}</span>
                        </div>
                        {activeTool === 'mosaic' ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Size: {pixelSize}px</span>
                                </div>
                                <Slider
                                    value={[pixelSize]}
                                    min={5}
                                    max={50}
                                    step={1}
                                    onValueChange={(v) => setPixelSize(v[0])}
                                />
                                <div className="flex gap-2">
                                    <Button className="flex-1" size="sm" onClick={saveCanvas}>
                                        {t('common.apply', '적용')}
                                    </Button>
                                    <Button className="flex-1" size="sm" variant="outline" onClick={() => setActiveTool('none')}>
                                        {t('common.cancel', '취소')}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground text-center">
                                    {t('smartTools.mosaicHint', '이미지를 드래그하여 모자이크 적용')}
                                </p>
                            </div>
                        ) : (
                            <Button
                                className="w-full"
                                variant="secondary"
                                onClick={() => setActiveTool('mosaic')}
                                disabled={isLoading || !processedImage}
                            >
                                {t('smartTools.startMosaic', '모자이크 도구 열기')}
                            </Button>
                        )}
                    </div>

                    {/* Save Actions */}
                    <div className="pt-4 border-t flex gap-2">
                        <Button className="flex-1" onClick={() => onUpdateImage(processedImage!)} disabled={!processedImage}>
                            {t('smartTools.saveChanges', '변경사항 저장')}
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    )
}
