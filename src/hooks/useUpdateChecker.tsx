import { useEffect } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw, Sparkles } from 'lucide-react'
import { useUpdateStore, setCurrentUpdateObject } from '@/stores/update-store'

export function useUpdateChecker() {
    const { t } = useTranslation()
    const {
        pendingUpdate,
        isDownloading,
        setPendingUpdate,
        setIsDownloading,
        setDownloadProgress
    } = useUpdateStore()

    // Function to download update (but not install)
    const downloadUpdate = async (update: Update) => {
        setIsDownloading(true)
        try {
            toast({
                title: t('update.downloading', '다운로드 중...'),
                description: t('update.pleaseWait', '잠시만 기다려주세요'),
            })

            // Download only (not install)
            let totalBytes = 0
            let downloadedBytes = 0
            await update.download((event) => {
                if (event.event === 'Started' && event.data.contentLength) {
                    totalBytes = event.data.contentLength
                } else if (event.event === 'Progress') {
                    downloadedBytes += event.data.chunkLength
                    if (totalBytes > 0) {
                        const percent = Math.round((downloadedBytes / totalBytes) * 100)
                        setDownloadProgress(percent)
                    }
                }
            })

            // Store the update object for later installation
            setCurrentUpdateObject(update)
            setPendingUpdate({
                version: update.version,
                downloadedAt: Date.now(),
            })

            // Show toast with install option
            toast({
                title: t('update.downloadComplete', '다운로드 완료'),
                description: t('update.readyToInstall', '업데이트를 설치할 준비가 되었습니다. 작업을 저장한 후 설치하세요.'),
                action: (
                    <Button
                        size="sm"
                        onClick={async () => {
                            await update.install()
                            await relaunch()
                        }}
                    >
                        <Sparkles className="h-4 w-4 mr-1" />
                        {t('update.installNow', '지금 설치')}
                    </Button>
                ),

            })
        } catch (error) {
            console.error('Download failed:', error)
            toast({
                title: t('update.failed', '업데이트 실패'),
                description: String(error),
                variant: 'destructive',
            })
        } finally {
            setIsDownloading(false)
        }
    }

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const update = await check()
                if (update) {
                    // Check if we already have this version downloaded
                    if (pendingUpdate && pendingUpdate.version === update.version) {
                        // Already downloaded, just show install option
                        setCurrentUpdateObject(update)
                        toast({
                            title: t('update.readyToInstall', '업데이트 설치 준비됨'),
                            description: t('update.version', { version: update.version }),
                            action: (
                                <Button
                                    size="sm"
                                    onClick={async () => {
                                        await update.install()
                                        await relaunch()
                                    }}
                                >
                                    <Sparkles className="h-4 w-4 mr-1" />
                                    {t('update.installNow', '지금 설치')}
                                </Button>
                            ),
                        })
                        return
                    }

                    // New update available, show download option
                    toast({
                        title: t('update.available', '업데이트 사용 가능'),
                        description: t('update.version', { version: update.version }),
                        action: (
                            <Button
                                size="sm"
                                onClick={() => downloadUpdate(update)}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                            </Button>
                        ),
                    })
                }
            } catch (error) {
                console.log('Update check skipped (dev mode or offline):', error)
            }
        }

        // Check for updates after a short delay on app start
        const timer = setTimeout(checkForUpdates, 3000)
        return () => clearTimeout(timer)
    }, [t, pendingUpdate])

    return {
        isDownloading,
        pendingUpdate,
        downloadUpdate,
    }
}
