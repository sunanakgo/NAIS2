
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToolsStore } from '@/stores/tools-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useGenerationStore } from '@/stores/generation-store'
import { smartTools } from '@/services/smart-tools'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { Eraser, Tags, Grid3X3, Wand2, Upload, RefreshCw, Download, X, Maximize2, Image as ImageIcon, Paintbrush, ImagePlus } from 'lucide-react'
import { writeFile, BaseDirectory, exists, mkdir } from '@tauri-apps/plugin-fs'
import { pictureDir, join } from '@tauri-apps/api/path'
import { TagAnalysisDialog } from '@/components/tools/TagAnalysisDialog'
import { BackgroundRemovalDialog } from '@/components/tools/BackgroundRemovalDialog'
import { MosaicDialog } from '@/components/tools/MosaicDialog'
import { InpaintingDialog } from '@/components/tools/InpaintingDialog'


export default function ToolsMode() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { activeImage, setActiveImage } = useToolsStore()
    const { token } = useAuthStore()

    const [processedImage, setProcessedImage] = useState<string | null>(activeImage)
    const [isLoading, setIsLoading] = useState(false)

    // Tagger State
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false)

    // Background Removal State
    const [isRembgOpen, setIsRembgOpen] = useState(false)
    const [rembgOriginal, setRembgOriginal] = useState<string | null>(null)
    const [rembgResult, setRembgResult] = useState<string | null>(null)

    // Download Progress State
    const [downloadStatus, setDownloadStatus] = useState<{
        is_downloading: boolean
        model_name: string
        percent: number
        message: string
    } | null>(null)

    // Poll download status during loading
    useEffect(() => {
        if (!isLoading) return

        const interval = setInterval(async () => {
            const status = await smartTools.getDownloadStatus()
            if (status && status.is_downloading) {
                setDownloadStatus(status)
            } else {
                setDownloadStatus(null)
            }
        }, 500)

        return () => clearInterval(interval)
    }, [isLoading])


    // Mosaic State
    const [isMosaicOpen, setIsMosaicOpen] = useState(false)
    const [isInpaintingOpen, setIsInpaintingOpen] = useState(false)  // For mask editing only
    const containerRef = useRef<HTMLDivElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const dragCounter = useRef(0)

    // Sync store to local state
    useEffect(() => {
        setProcessedImage(activeImage)
    }, [activeImage])

    // Handle File Upload
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e) => {
                const result = e.target?.result as string
                setActiveImage(result)
            }
            reader.readAsDataURL(file)
        }
    }

    // Drag & Drop Handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current++
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragOver(true)
        }
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current--
        if (dragCounter.current === 0) {
            setIsDragOver(false)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        dragCounter.current = 0
        setIsDragOver(false)

        const file = e.dataTransfer.files?.[0]
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = (ev) => {
                const result = ev.target?.result as string
                setActiveImage(result)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleRemoveBackground = async () => {
        if (!processedImage) return
        setIsLoading(true)
        try {
            const result = await smartTools.removeBackground(processedImage)
            // Open comparison dialog instead of directly replacing
            setRembgOriginal(processedImage)
            setRembgResult(result)
            setIsRembgOpen(true)
        } catch (e) {
            console.error(e)
            toast({ title: t('smartTools.error', '작업 실패'), description: String(e), variant: 'destructive' })
        } finally {
            setIsLoading(false)
        }
    }



    const handleUpscale = async () => {
        if (!processedImage) return
        if (!token) {
            toast({ title: t('toast.tokenRequired.title', 'API 토큰 필요'), description: t('toast.tokenRequired.desc', '설정에서 토큰을 입력해주세요.'), variant: 'destructive' })
            return
        }

        setIsLoading(true)
        try {
            const result = await smartTools.upscale(processedImage, token)

            // Save to configured save path with UPSCALE prefix
            const { savePath, useAbsolutePath } = useSettingsStore.getState()
            const outputDir = savePath || 'NAIS_Output'
            const fileName = `NAIS_UPSCALE_${Date.now()}.png`

            try {
                const base64Data = result.replace(/^data:image\/png;base64,/, '')
                const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

                let fullPath: string

                if (useAbsolutePath) {
                    // Save to absolute path directly
                    const dirExists = await exists(outputDir)
                    if (!dirExists) {
                        await mkdir(outputDir, { recursive: true })
                    }
                    fullPath = await join(outputDir, fileName)
                    await writeFile(fullPath, binaryData)
                } else {
                    // Save relative to Pictures directory
                    const dirExists = await exists(outputDir, { baseDir: BaseDirectory.Picture })
                    if (!dirExists) {
                        await mkdir(outputDir, { baseDir: BaseDirectory.Picture })
                    }
                    await writeFile(`${outputDir}/${fileName}`, binaryData, { baseDir: BaseDirectory.Picture })
                    const picPath = await pictureDir()
                    fullPath = await join(picPath, outputDir, fileName)
                }

                // Dispatch event for instant history update
                try {
                    window.dispatchEvent(new CustomEvent('newImageGenerated', {
                        detail: { path: fullPath, data: result }
                    }))
                } catch (e) {
                    console.warn('Failed to dispatch newImageGenerated event:', e)
                }
            } catch (e) {
                console.warn('Failed to save upscaled image:', e)
            }

            // Set as preview image
            const { setPreviewImage } = useGenerationStore.getState()
            setPreviewImage(result)

            toast({ title: t('smartTools.upscaleComplete', '업스케일 완료'), description: t('smartTools.upscaleCompleteDesc', '이미지가 4배 확대되었습니다.'), variant: 'success' })

            // Navigate to main mode
            navigate('/')
        } catch (e) {
            console.error(e)
            toast({ title: t('smartTools.error', '작업 실패'), description: String(e), variant: 'destructive' })
        } finally {
            setIsLoading(false)
        }
    }

    // Save to Disk (New functionality for Tools Page)
    const handleSaveFile = async () => {
        if (!processedImage) return
        try {
            // Remove header
            const base64Data = processedImage.replace(/^data:image\/\w+;base64,/, "")
            // Decode
            const binary = atob(base64Data)
            const array = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)

            const filename = `NAIS_Edit_${Date.now()}.png`
            const { savePath, useAbsolutePath } = useSettingsStore.getState()
            const outputDir = savePath || 'NAIS_Output'

            if (useAbsolutePath) {
                // Save to absolute path directly
                const dirExists = await exists(outputDir)
                if (!dirExists) {
                    await mkdir(outputDir, { recursive: true })
                }
                const fullPath = await join(outputDir, filename)
                await writeFile(fullPath, array)
            } else {
                // Save relative to Pictures directory
                const dirExists = await exists(outputDir, { baseDir: BaseDirectory.Picture })
                if (!dirExists) {
                    await mkdir(outputDir, { baseDir: BaseDirectory.Picture })
                }
                await writeFile(`${outputDir}/${filename}`, array, { baseDir: BaseDirectory.Picture })
            }

            toast({ title: t('common.saved', '저장됨'), description: filename, variant: 'success' })
        } catch (e) {
            console.error(e)
            toast({ title: t('common.saveFailed', '저장 실패'), variant: 'destructive' })
        }
    }

    return (
        <div
            className="flex h-full gap-4 relative"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragOver && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center rounded-xl">
                    <div className="relative">
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-primary animate-pulse opacity-50 blur-xl" />
                        <div className="relative bg-background/80 backdrop-blur-xl border border-white/20 rounded-3xl p-12 shadow-2xl">
                            <div className="text-center space-y-4">
                                <div className="relative mx-auto w-20 h-20">
                                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                                        <ImagePlus className="h-10 w-10 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xl font-semibold text-foreground">
                                        {t('smartTools.dropToLoad', '이미지를 드롭하여 열기')}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('smartTools.supportedFormats', 'PNG, JPG, WEBP 지원')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Left: Image Workspace */}
            <div className="flex-1 bg-muted/20 rounded-xl border border-border overflow-hidden flex flex-col relative" ref={containerRef}>
                {processedImage ? (
                    <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
                        <img
                            src={processedImage}
                            className="max-w-full max-h-full object-contain shadow-lg"
                            alt="Workspace"
                        />

                        {isLoading && (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                                {/* Pulsing Background Circle */}
                                <div className="relative">
                                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-primary/30 animate-ping" />
                                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-xl">
                                        <RefreshCw className="h-8 w-8 animate-spin" />
                                    </div>
                                </div>

                                {downloadStatus?.is_downloading ? (
                                    <>
                                        <div className="mt-6 text-lg font-semibold tracking-wide">
                                            {t('smartTools.downloading', '모델 다운로드 중...')}
                                        </div>
                                        <div className="mt-2 text-sm text-white/80">
                                            {downloadStatus.model_name}
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="mt-4 w-48 h-2 bg-white/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-300 rounded-full"
                                                style={{ width: `${downloadStatus.percent}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 text-sm font-medium">
                                            {downloadStatus.percent}%
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="mt-6 text-lg font-semibold tracking-wide">
                                            {t('smartTools.processing', '처리 중...')}
                                        </div>
                                        <div className="mt-2 text-sm text-white/60">
                                            {t('smartTools.pleaseWait', '잠시만 기다려주세요')}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 border-2 border-dashed border-border rounded-lg m-4 transition-colors hover:border-primary/50"
                    >
                        <Upload className="h-16 w-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-medium mb-2">{t('smartTools.dropHint', '이미지를 열거나 드래그하세요')}</h3>
                        <p className="text-sm opacity-60 mb-6">{t('smartTools.supportedFormats', 'PNG, JPG, WEBP 지원')}</p>
                        <Button variant="outline" className="relative">
                            {t('smartTools.openImage', '이미지 열기')}
                            <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </Button>
                    </div>
                )}

                {/* Image Actions (Bottom Overlay) */}
                {processedImage && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-background/80 backdrop-blur-md rounded-full shadow-lg border border-border z-20">
                        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setActiveImage(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-6 bg-border mx-1 my-auto" />
                        <Button size="icon" variant="ghost" className="rounded-full" onClick={handleSaveFile}>
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {/* Right: Tools Options */}
            <div className="w-[320px] bg-card rounded-xl border border-border flex flex-col overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-primary" />
                        {t('smartTools.title', '스마트 툴')}
                    </h2>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    {/* Background Removal */}
                    <ToolCard
                        icon={Eraser}
                        color="text-rose-400"
                        title={t('smartTools.rembg', '배경 제거')}
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={handleRemoveBackground}
                            disabled={!processedImage || isLoading}
                        >
                            {t('smartTools.runRembg', '배경 제거 실행')}
                        </Button>
                    </ToolCard>

                    {/* Combined Analysis Tool (Tag & Style) */}
                    <ToolCard
                        icon={Tags}
                        color="text-blue-400"
                        title={t('smartTools.smartAnalysis', 'Smart Tag & Style Analysis')}
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => setIsAnalysisOpen(true)}
                            disabled={!processedImage || isLoading}
                        >
                            {t('smartTools.openAnalyzer', 'Open Tag & Style Analyzer')}
                        </Button>
                    </ToolCard>

                    {/* Image to Image */}
                    <ToolCard
                        icon={ImageIcon}
                        color="text-indigo-400"
                        title={t('tools.i2i.title', 'Image to Image')}
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => {
                                if (!processedImage) return
                                const { setSourceImage, setI2IMode } = useGenerationStore.getState()
                                setSourceImage(processedImage)
                                setI2IMode('i2i')
                                navigate('/')
                            }}
                            disabled={!processedImage || isLoading}
                        >
                            {t('tools.i2i.open', 'I2I 모드로 이동')}
                        </Button>
                    </ToolCard>

                    {/* Inpainting */}
                    <ToolCard
                        icon={Paintbrush}
                        color="text-pink-400"
                        title={t('tools.inpainting.title', 'Inpainting')}
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => {
                                if (!processedImage) return
                                const { setSourceImage, setI2IMode } = useGenerationStore.getState()
                                setSourceImage(processedImage)
                                setI2IMode('inpaint')
                                navigate('/')  // Navigate directly, mask editing done from sidebar
                            }}
                            disabled={!processedImage || isLoading}
                        >
                            {t('tools.inpainting.open', '인페인팅 모드로 이동')}
                        </Button>
                    </ToolCard>

                    {/* Mosaic */}
                    <ToolCard
                        icon={Grid3X3}
                        color="text-amber-400"
                        title={t('smartTools.mosaic', '모자이크')}
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => setIsMosaicOpen(true)}
                            disabled={!processedImage || isLoading}
                        >
                            {t('smartTools.startMosaic', '모자이크 편집기 열기')}
                        </Button>
                    </ToolCard>

                    {/* Upscale (4K) */}
                    <ToolCard
                        icon={Maximize2}
                        color="text-purple-400"
                        title={
                            <span className="flex items-center gap-2">
                                {t('smartTools.upscale', '4K 업스케일')}
                                <span className="text-orange-400 text-xs font-medium">-7 Anlas</span>
                            </span>
                        }
                        disabled={!processedImage || isLoading}
                    >
                        <Button
                            className="w-full"
                            variant="secondary"
                            onClick={handleUpscale}
                            disabled={!processedImage || isLoading}
                        >
                            {t('smartTools.startUpscale', '4배 업스케일 시작')}
                        </Button>
                    </ToolCard>
                </div>
            </div>

            <TagAnalysisDialog
                imageUrl={processedImage}
                isOpen={isAnalysisOpen}
                onClose={() => setIsAnalysisOpen(false)}
            />

            <BackgroundRemovalDialog
                originalImage={rembgOriginal}
                processedImage={rembgResult}
                isOpen={isRembgOpen}
                onClose={() => setIsRembgOpen(false)}
            />

            <MosaicDialog
                sourceImage={processedImage}
                isOpen={isMosaicOpen}
                onClose={() => setIsMosaicOpen(false)}
            />

            <InpaintingDialog
                open={isInpaintingOpen}
                onOpenChange={(open) => {
                    setIsInpaintingOpen(open)
                    // Navigate to main mode after mask editing is done
                    if (!open && useGenerationStore.getState().i2iMode === 'inpaint') {
                        navigate('/')
                    }
                }}
                sourceImage={processedImage}
            />
        </div>
    )
}

function ToolCard({ children, icon: Icon, color, title, disabled }: any) {
    return (
        <div className={cn("p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors", disabled && "opacity-50 pointer-events-none")}>
            <div className="flex items-center gap-3 mb-3">
                <Icon className={cn("h-5 w-5", color)} />
                <span className="font-medium">{title}</span>
            </div>
            {children}
        </div>
    )
}

import { cn } from '@/lib/utils'
