import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Download, Layers } from "lucide-react"
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile } from "@tauri-apps/plugin-fs"
import { toast } from "@/components/ui/use-toast"

interface BackgroundRemovalDialogProps {
    originalImage: string | null
    processedImage: string | null
    isOpen: boolean
    onClose: () => void
}

export function BackgroundRemovalDialog({
    originalImage,
    processedImage,
    isOpen,
    onClose
}: BackgroundRemovalDialogProps) {
    const { t } = useTranslation()
    const [sliderPosition, setSliderPosition] = useState(50)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    const updateSliderPosition = useCallback((clientX: number) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = clientX - rect.left
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
        setSliderPosition(percentage)
    }, [])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
        updateSliderPosition(e.clientX)
    }, [updateSliderPosition])

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            updateSliderPosition(e.clientX)
        }
    }, [isDragging, updateSliderPosition])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
    }, [])

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [isDragging, handleMouseMove, handleMouseUp])

    useEffect(() => {
        if (isOpen) {
            setSliderPosition(50)
        }
    }, [isOpen])

    const handleSaveAs = async () => {
        if (!processedImage) return

        try {
            // Open Save As dialog
            const filePath = await save({
                defaultPath: `background_removed_${Date.now()}.png`,
                filters: [{ name: 'PNG Image', extensions: ['png'] }]
            })

            if (!filePath) return // User cancelled

            // Convert base64 to binary
            const base64Data = processedImage.replace(/^data:image\/png;base64,/, '')
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

            // Write to file
            await writeFile(filePath, binaryData)

            toast({ title: t('common.saved', '저장되었습니다'), variant: 'success' })
            onClose()
        } catch (e) {
            console.error("Failed to save image", e)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-6">
                <DialogHeader className="mb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Layers className="h-5 w-5" />
                        {t('smartTools.rembgPreview', '배경 제거 미리보기')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('smartTools.rembgPreviewDesc', '세로선을 좌우로 드래그하여 원본과 결과를 비교하세요.')}
                    </DialogDescription>
                </DialogHeader>

                {/* Comparison Container */}
                <div
                    ref={containerRef}
                    className="flex-1 relative overflow-hidden rounded-lg cursor-ew-resize select-none"
                    style={{ backgroundColor: '#4a4a4a', minHeight: '500px', aspectRatio: '4/3' }}
                    onMouseDown={handleMouseDown}
                >
                    {/* Checkerboard pattern */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: `
                                linear-gradient(45deg, #555 25%, transparent 25%),
                                linear-gradient(-45deg, #555 25%, transparent 25%),
                                linear-gradient(45deg, transparent 75%, #555 75%),
                                linear-gradient(-45deg, transparent 75%, #555 75%)
                            `,
                            backgroundSize: '20px 20px',
                            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                            backgroundColor: '#666'
                        }}
                    />

                    {/* Original Image (Right side) */}
                    {originalImage && (
                        <div
                            className="absolute inset-0 overflow-hidden pointer-events-none"
                            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                        >
                            <img
                                src={originalImage}
                                alt="Original"
                                className="w-full h-full object-contain"
                                draggable={false}
                            />
                        </div>
                    )}

                    {/* Processed Image (Left side) */}
                    {processedImage && (
                        <div
                            className="absolute inset-0 overflow-hidden pointer-events-none"
                            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                        >
                            <img
                                src={processedImage}
                                alt="Processed"
                                className="w-full h-full object-contain"
                                draggable={false}
                            />
                        </div>
                    )}

                    {/* Draggable Slider */}
                    <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10 pointer-events-none"
                        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-gray-300">
                            <div className="flex gap-1">
                                <div className="w-0.5 h-4 bg-gray-500 rounded" />
                                <div className="w-0.5 h-4 bg-gray-500 rounded" />
                            </div>
                        </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute bottom-4 left-4 px-2 py-1 bg-black/60 text-white text-xs rounded pointer-events-none">
                        {t('smartTools.processed', '결과')}
                    </div>
                    <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 text-white text-xs rounded pointer-events-none">
                        {t('smartTools.original', '원본')}
                    </div>
                </div>

                <DialogFooter className="mt-4 sm:justify-end items-center gap-2">
                    <Button variant="outline" onClick={onClose}>
                        {t('common.cancel', '취소')}
                    </Button>
                    <Button onClick={handleSaveAs} disabled={!processedImage}>
                        <Download className="h-4 w-4 mr-2" />
                        {t('library.download', '다운로드')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
