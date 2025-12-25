import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { TagResult, smartTools } from "@/services/smart-tools"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Copy, Tags, Palette } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface TagAnalysisDialogProps {
    imageUrl: string | null
    isOpen: boolean
    onClose: () => void
}

export function TagAnalysisDialog({ imageUrl, isOpen, onClose }: TagAnalysisDialogProps) {
    const { t } = useTranslation()
    const [isLoading, setIsLoading] = useState(false)
    const [wdTags, setWdTags] = useState<TagResult[]>([])
    const [styleTags, setStyleTags] = useState<TagResult[]>([])

    useEffect(() => {
        if (isOpen && imageUrl) {
            analyze()
        } else {
            setWdTags([])
            setStyleTags([])
        }
    }, [isOpen, imageUrl])

    const analyze = async () => {
        if (!imageUrl) return
        setIsLoading(true)
        try {
            // Run both in parallel
            const [tagsResult, styleResult] = await Promise.allSettled([
                smartTools.analyzeTags(imageUrl),
                smartTools.analyzeStyle(imageUrl)
            ])

            if (tagsResult.status === 'fulfilled') {
                const filtered = tagsResult.value
                    .filter(r => r.score > 0.35)
                    .sort((a, b) => b.score - a.score)
                setWdTags(filtered)
            } else {
                console.error("WD Tagger failed", tagsResult.reason)
                toast({ title: t('smartTools.taggerError'), description: String(tagsResult.reason), variant: "destructive" })
            }

            if (styleResult.status === 'fulfilled') {
                const filtered = styleResult.value
                    .filter(r => r.score > 0.1)
                    .sort((a, b) => b.score - a.score)
                setStyleTags(filtered)
            } else {
                console.error("Style Analysis failed", styleResult.reason)
            }

        } catch (e) {
            console.error(e)
            toast({ title: t('smartTools.error'), variant: 'destructive' })
        } finally {
            setIsLoading(false)
        }
    }

    const wdTagString = wdTags.map(t => t.label).join(', ')
    const styleTagString = styleTags.map(t => t.label).join(', ')

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast({ title: t('common.copy') })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6">
                <DialogHeader className="mb-2 shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Tags className="h-5 w-5" />
                        {t('smartTools.analysisTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('smartTools.analysisDescription')}
                    </DialogDescription>
                </DialogHeader>

                {/* Main Content: Left Image, Right Tools */}
                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                    {/* Left: Image Preview - Full Height */}
                    <div className="w-[40%] flex items-center justify-center bg-secondary/20 rounded-lg p-2 border border-border/50 shrink-0">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt="Analysis Target"
                                className="max-w-full max-h-full object-contain rounded shadow-sm"
                            />
                        ) : (
                            <div className="flex items-center justify-center w-full text-muted-foreground">
                                {t('smartTools.noImage')}
                            </div>
                        )}
                    </div>

                    {/* Right: Analysis Tools (Stacked Vertically) */}
                    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                        {/* WD Tagger Section (Top Half) */}
                        <div className="flex-1 flex flex-col gap-2 min-h-0">
                            <div className="flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 font-semibold text-blue-500">
                                    <Tags className="h-4 w-4" />
                                    {t('smartTools.wdTags')}
                                </div>
                                <span className="text-xs text-muted-foreground">{t('smartTools.detected', { count: wdTags.length })}</span>
                            </div>

                            {isLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-md bg-muted/10 gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground">{t('smartTools.analyzingTags')}</span>
                                </div>
                            ) : (
                                <Textarea
                                    className="flex-1 resize-none font-mono text-sm leading-relaxed custom-scrollbar bg-card min-h-[100px]"
                                    value={wdTagString}
                                    readOnly
                                    placeholder={t('smartTools.noTagsDetected')}
                                />
                            )}

                            <Button size="sm" variant="secondary" className="shrink-0 w-full" onClick={() => copyToClipboard(wdTagString)} disabled={!wdTagString}>
                                <Copy className="h-3 w-3 mr-2" />
                                {t('smartTools.copyTags')}
                            </Button>
                        </div>

                        {/* Kaloscope Section (Bottom Half) */}
                        <div className="flex-1 flex flex-col gap-2 min-h-0">
                            <div className="flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 font-medium text-purple-400">
                                    <Palette className="h-4 w-4" />
                                    {t('smartTools.kaloscopeStyle')}
                                </div>
                                <span className="text-xs text-muted-foreground">{t('smartTools.detected', { count: styleTags.length })}</span>
                            </div>

                            {isLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center border rounded-md bg-muted/10 gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <span className="text-xs text-muted-foreground">{t('smartTools.analyzingStyles')}</span>
                                </div>
                            ) : (
                                <Textarea
                                    className="flex-1 resize-none font-mono text-sm leading-relaxed custom-scrollbar bg-card min-h-[100px]"
                                    value={styleTagString}
                                    readOnly
                                    placeholder={t('smartTools.noStylesDetected')}
                                />
                            )}

                            <Button size="sm" variant="secondary" className="shrink-0 w-full" onClick={() => copyToClipboard(styleTagString)} disabled={!styleTagString}>
                                <Copy className="h-3 w-3 mr-2" />
                                {t('smartTools.copyStyle')}
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="mt-4 sm:justify-between items-center bg-muted/20 -mx-6 -mb-6 p-4 border-t border-border shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center">
                        {t('smartTools.modelDownloadNote')}
                    </div>
                    <Button variant="outline" onClick={onClose}>
                        {t('smartTools.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
