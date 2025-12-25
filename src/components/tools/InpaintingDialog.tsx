
import { useState, useRef, useEffect, MouseEvent } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { useGenerationStore } from '@/stores/generation-store'
import { useTranslation } from 'react-i18next'
import { Paintbrush, Eraser, Undo, Trash2, Save } from 'lucide-react'

interface InpaintingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    sourceImage: string | null
}

export function InpaintingDialog({ open, onOpenChange, sourceImage: propSourceImage }: InpaintingDialogProps) {
    const { t } = useTranslation()
    const {
        setSourceImage,
        setMask,
        resetI2IParams
    } = useGenerationStore()

    const [brushSize, setBrushSize] = useState([50])
    const [isErasing, setIsErasing] = useState(false)

    // Canvas & State
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)


    // History
    const [history, setHistory] = useState<ImageData[]>([])
    const [historyStep, setHistoryStep] = useState(-1)

    // Reset when dialog closes - but only if we're NOT in the new sidebar workflow
    // (i.e., only reset if i2iMode is null, meaning dialog was opened for standalone generation)
    useEffect(() => {
        if (!open) {
            // Check if we're in sidebar workflow mode - if so, don't reset
            const currentI2IMode = useGenerationStore.getState().i2iMode
            if (!currentI2IMode) {
                // Old workflow: reset params when dialog closes
                resetI2IParams()
            }
            setHistory([])
            setHistoryStep(-1)
        } else if (propSourceImage) {
            // Set source image in store
            setSourceImage(propSourceImage)
        }
    }, [open, propSourceImage, resetI2IParams, setSourceImage])

    // Initial Canvas Setup (similar to MosaicDialog)
    useEffect(() => {
        if (!open || !propSourceImage) return

        const timer = setTimeout(() => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                canvas.width = img.width
                canvas.height = img.height
            }
            img.src = propSourceImage
        }, 100)
        return () => clearTimeout(timer)
    }, [open, propSourceImage])

    // Grid cell size (NovelAI uses 8x8 pixel blocks)
    const GRID_SIZE = 8

    // Track which grid cells are painted (for display overlay)
    const gridDataRef = useRef<Set<string>>(new Set())

    // Last grid position for continuous drawing
    const lastGridPosRef = useRef<{ gx: number; gy: number } | null>(null)

    // Convert pixel coordinates to grid coordinates
    const pixelToGrid = (pixelX: number, pixelY: number, canvasWidth: number, canvasHeight: number) => {
        const gx = Math.floor(pixelX / GRID_SIZE)
        const gy = Math.floor(pixelY / GRID_SIZE)
        // Clamp to grid boundaries
        const maxGx = Math.floor(canvasWidth / GRID_SIZE) - 1
        const maxGy = Math.floor(canvasHeight / GRID_SIZE) - 1
        return {
            gx: Math.max(0, Math.min(gx, maxGx)),
            gy: Math.max(0, Math.min(gy, maxGy))
        }
    }

    // Fill a single grid cell (8x8 block)
    const fillGridCell = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const cellKey = `${gx},${gy}`

        if (erase) {
            // Erase: clear the cell
            ctx.clearRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.delete(cellKey)
        } else {
            // Paint: fill with semi-transparent sky blue for visibility
            // Skip if already painted
            if (gridDataRef.current.has(cellKey)) return

            ctx.fillStyle = 'rgba(99, 102, 241, 0.7)'  // Vibrant indigo (better visibility)
            ctx.fillRect(gx * GRID_SIZE, gy * GRID_SIZE, GRID_SIZE, GRID_SIZE)
            gridDataRef.current.add(cellKey)
        }
    }

    // Fill brush area (multiple grid cells based on brush size)
    const fillBrushArea = (ctx: CanvasRenderingContext2D, gx: number, gy: number, erase: boolean) => {
        const brushGridSize = Math.max(1, Math.floor(brushSize[0] / GRID_SIZE))
        const halfBrush = Math.floor(brushGridSize / 2)

        for (let offsetY = -halfBrush; offsetY <= halfBrush; offsetY++) {
            for (let offsetX = -halfBrush; offsetX <= halfBrush; offsetX++) {
                const targetGx = gx + offsetX
                const targetGy = gy + offsetY

                // Check bounds
                if (targetGx >= 0 && targetGy >= 0) {
                    fillGridCell(ctx, targetGx, targetGy, erase)
                }
            }
        }
    }

    // Draw line between two grid positions (Bresenham's algorithm)
    const drawGridLine = (ctx: CanvasRenderingContext2D, startGx: number, startGy: number, endGx: number, endGy: number, erase: boolean) => {
        const dx = Math.abs(endGx - startGx)
        const dy = Math.abs(endGy - startGy)
        const sx = startGx < endGx ? 1 : -1
        const sy = startGy < endGy ? 1 : -1
        let err = dx - dy

        let gx = startGx
        let gy = startGy

        while (true) {
            fillBrushArea(ctx, gx, gy, erase)

            if (gx === endGx && gy === endGy) break

            const e2 = 2 * err
            if (e2 > -dy) {
                err -= dy
                gx += sx
            }
            if (e2 < dx) {
                err += dx
                gy += sy
            }
        }
    }

    const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        const { gx, gy } = pixelToGrid(x, y, canvas.width, canvas.height)
        lastGridPosRef.current = { gx, gy }
        fillBrushArea(ctx, gx, gy, isErasing)
        setIsDrawing(true)
    }

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false)
            saveHistory()
        }
        lastGridPosRef.current = null
    }

    const draw = (e: MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !lastGridPosRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return

        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        const { gx, gy } = pixelToGrid(x, y, canvas.width, canvas.height)

        // Only draw if moved to a different grid cell
        if (gx !== lastGridPosRef.current.gx || gy !== lastGridPosRef.current.gy) {
            drawGridLine(ctx, lastGridPosRef.current.gx, lastGridPosRef.current.gy, gx, gy, isErasing)
            lastGridPosRef.current = { gx, gy }
        }
    }

    // Save current canvas state to history
    const saveHistory = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const newHistory = history.slice(0, historyStep + 1)
        setHistory([...newHistory, imageData])
        setHistoryStep(newHistory.length)
    }

    // Undo last action
    const undo = () => {
        if (historyStep > 0) {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const prevImageData = history[historyStep - 1]
            ctx.putImageData(prevImageData, 0, 0)
            setHistoryStep(historyStep - 1)
        }
    }

    // Clear canvas
    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        gridDataRef.current.clear()  // Clear grid data tracking
        saveHistory() // Save empty canvas to history
    }

    // Handle save mask button click - only saves mask, no generation
    const handleSaveMask = () => {
        const canvas = canvasRef.current
        if (!canvas || !propSourceImage) return

        // Get mask data and save to store
        const maskDataUrl = canvas.toDataURL('image/png')
        setMask(maskDataUrl)

        // Close dialog - mask is now saved in store
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onOpenChange(false)}>
            <DialogContent className="flex flex-col p-6 gap-4" style={{ maxWidth: '60vw', maxHeight: '85vh', width: '60vw', height: '85vh' }}>
                <DialogHeader className="mb-0 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Paintbrush className="w-5 h-5" />
                        {t('tools.inpainting.title', 'Inpainting')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('tools.inpainting.description', 'Mask areas to regenerate.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
                    {/* Canvas Area - now takes full width */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                        {/* Toolbar */}
                        <div className="flex gap-6 shrink-0 items-center justify-center p-2 bg-muted/20 rounded-lg border">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={!isErasing ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setIsErasing(false)}
                                    className={!isErasing ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}
                                >
                                    <Paintbrush className="w-4 h-4 mr-2" />
                                    {t('common.brush', 'Brush')}
                                </Button>
                                <Button
                                    variant={isErasing ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setIsErasing(true)}
                                    className={isErasing ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
                                >
                                    <Eraser className="w-4 h-4 mr-2" />
                                    {t('common.eraser', 'Eraser')}
                                </Button>
                            </div>

                            <div className="h-6 w-px bg-border mx-2" />

                            <div className="flex items-center gap-3">
                                <Label className="text-sm whitespace-nowrap">{t('common.size', 'Size')}</Label>
                                <div className="flex items-center gap-2">
                                    <Slider
                                        value={brushSize}
                                        min={5}
                                        max={100}
                                        step={5}
                                        onValueChange={setBrushSize}
                                        className="w-32"
                                    />
                                    <span className="text-xs text-muted-foreground w-8 text-center">{brushSize[0]}</span>
                                </div>
                            </div>

                            <div className="h-6 w-px bg-border mx-2" />

                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={undo} disabled={historyStep < 0}>
                                    <Undo className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={clearCanvas}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Canvas Container */}
                        <div
                            ref={containerRef}
                            className="flex-1 relative overflow-hidden rounded-lg bg-muted/50 flex items-center justify-center p-4 min-h-0"
                        >
                            {propSourceImage && (
                                <div className="relative inline-flex" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                                    <img
                                        src={propSourceImage}
                                        alt="Source"
                                        className="block max-w-full max-h-full w-auto h-auto object-contain"
                                        style={{ maxHeight: '100%' }}
                                        onLoad={(e) => {
                                            if (canvasRef.current) {
                                                canvasRef.current.width = e.currentTarget.naturalWidth
                                                canvasRef.current.height = e.currentTarget.naturalHeight
                                            }
                                        }}
                                    />
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 w-full h-full touch-none cursor-crosshair opacity-50"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-4 sm:justify-end items-center gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button
                        className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
                        onClick={handleSaveMask}
                        disabled={!propSourceImage}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        {t('sourcePanel.saveMask', '마스크 저장')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
