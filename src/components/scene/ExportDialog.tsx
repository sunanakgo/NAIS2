import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SceneCard } from '@/stores/scene-store'
import JSZip from 'jszip'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile, readFile } from '@tauri-apps/plugin-fs'
import { toast } from '@/components/ui/use-toast'

interface ExportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activePresetName: string
    scenes: SceneCard[]
}

type ExportFormat = 'png' | 'jpeg' | 'webp'

export function ExportDialog({ open, onOpenChange, activePresetName, scenes }: ExportDialogProps) {
    const { t } = useTranslation()
    const [format, setFormat] = useState<ExportFormat>('png')
    const [quality, setQuality] = useState(90)
    const [isExporting, setIsExporting] = useState(false)
    const [progress, setProgress] = useState(0)

    const handleExport = async () => {
        if (scenes.length === 0) return
        setIsExporting(true)
        setProgress(0)

        try {
            const zip = new JSZip()
            let count = 0
            const total = scenes.reduce((acc, scene) => acc + (scene.images.length > 0 ? 1 : 0), 0)

            for (const scene of scenes) {
                const favorite = scene.images.find(img => img.isFavorite)
                const targetImage = favorite || (scene.images.length > 0 ? scene.images[0] : null)

                if (targetImage) {
                    let imageData: Uint8Array | null = null

                    // 1. Get Image Data (Uint8Array)
                    try {
                        if (targetImage.url.startsWith('data:')) {
                            const res = await fetch(targetImage.url)
                            const buf = await res.arrayBuffer()
                            imageData = new Uint8Array(buf)
                        } else {
                            imageData = await readFile(targetImage.url)
                        }
                    } catch (e) {
                        console.error("Failed to read image", e)
                        continue
                    }

                    if (!imageData) continue;

                    // 2. Convert if necessary (or if format is not PNG)
                    // Note: If source is PNG and format is PNG, we can just save it directly?
                    // But if we want to ensure it is valid or re-encode, we should convert.
                    // However, avoiding re-encoding PNG-to-PNG preserves quality best.

                    let finalBlob: Blob | null = null

                    // Simple heuristic: If target is PNG and source lookup suggests PNG (or unknown), 
                    // we might skip conversion, BUT 'imageData' is raw bytes.

                    if (format === 'png' && targetImage.url.endsWith('.png')) {
                        finalBlob = new Blob([imageData as any], { type: 'image/png' })
                    } else {
                        // Use OffscreenCanvas or ImageBitmap for conversion
                        const blob = new Blob([imageData as any])
                        const bitmap = await createImageBitmap(blob)

                        // We can use a canvas
                        const canvas = document.createElement('canvas')
                        canvas.width = bitmap.width
                        canvas.height = bitmap.height
                        const ctx = canvas.getContext('2d')
                        if (ctx) {
                            ctx.drawImage(bitmap, 0, 0)
                            const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
                            const q = format === 'png' ? undefined : quality / 100

                            // To get Blob from canvas
                            finalBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, q))
                        }
                    }

                    if (finalBlob) {
                        const safeName = scene.name.replace(/[<>:"/\\|?*]/g, '_').trim() || `Scene_${count}`
                        const ext = format === 'jpeg' ? 'jpg' : format
                        const arrayBuffer = await finalBlob.arrayBuffer()
                        zip.file(`${safeName}.${ext}`, new Uint8Array(arrayBuffer) as any)
                        count++
                        setProgress(Math.round((count / total) * 100))
                    }
                }
            }

            if (count > 0) {
                const zipContent = await zip.generateAsync({ type: 'uint8array' })
                const fileName = `${activePresetName}_${format.toUpperCase()}_${Date.now()}.zip`
                const filePath = await save({ defaultPath: fileName, filters: [{ name: 'ZIP File', extensions: ['zip'] }] })

                if (filePath) {
                    await writeFile(filePath, zipContent)
                    toast({ title: t('common.saved'), variant: 'success' })
                    onOpenChange(false)
                }
            } else {
                toast({ title: t('scene.noImagesToExport'), variant: 'destructive' })
            }

        } catch (e) {
            console.error(e)
            toast({ title: t('display.exportFailed'), description: String(e), variant: 'destructive' })
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !isExporting && onOpenChange(v)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('scene.exportZip', 'ZIP 내보내기 설정')}</DialogTitle>
                    <DialogDescription>{t('scene.exportZipDesc', '이미지 형식과 품질을 선택하세요.')}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>{t('scene.format', '이미지 형식')}</Label>
                        <Select value={format} onValueChange={(v: ExportFormat) => setFormat(v)} disabled={isExporting}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="png">PNG (Lossless)</SelectItem>
                                <SelectItem value="webp">WEBP (High Efficiency)</SelectItem>
                                <SelectItem value="jpeg">JPG (Standard)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {format !== 'png' && (
                        <div className="grid gap-2">
                            <Label>{t('scene.quality', '품질')} ({quality}%)</Label>
                            <Slider
                                value={[quality]}
                                onValueChange={(v) => setQuality(v[0])}
                                min={10}
                                max={100}
                                step={1}
                                disabled={isExporting}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-between items-center">
                    {isExporting && <span className="text-xs text-muted-foreground">Converting... {progress}%</span>}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('actions.export')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
