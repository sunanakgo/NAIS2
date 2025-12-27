import { useEffect, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useTranslation } from 'react-i18next'
import { toast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw } from 'lucide-react'

export function useUpdateChecker() {
    const { t } = useTranslation()
    const [isUpdating, setIsUpdating] = useState(false)

    useEffect(() => {
        const checkForUpdates = async () => {
            try {
                const update = await check()
                if (update) {
                    toast({
                        title: t('update.available', '업데이트 사용 가능'),
                        description: t('update.version', { version: update.version }),
                        action: (
                            <Button
                                size="sm"
                                onClick={async () => {
                                    setIsUpdating(true)
                                    try {
                                        toast({
                                            title: t('update.downloading', '다운로드 중...'),
                                            description: t('update.pleaseWait', '잠시만 기다려주세요'),
                                        })

                                        await update.downloadAndInstall()

                                        // Show restart confirmation instead of auto-restart
                                        toast({
                                            title: t('update.installed', '설치 완료'),
                                            description: t('update.restartConfirm', '앱을 재시작하시겠습니까? 저장하지 않은 작업이 있다면 먼저 저장해주세요.'),
                                            action: (
                                                <Button
                                                    size="sm"
                                                    onClick={async () => {
                                                        await relaunch()
                                                    }}
                                                >
                                                    <RefreshCw className="h-4 w-4 mr-1" />
                                                    {t('update.restart', '재시작')}
                                                </Button>
                                            ),
                                        })
                                    } catch (error) {
                                        console.error('Update failed:', error)
                                        toast({
                                            title: t('update.failed', '업데이트 실패'),
                                            description: String(error),
                                            variant: 'destructive',
                                        })
                                    } finally {
                                        setIsUpdating(false)
                                    }
                                }}
                                disabled={isUpdating}
                            >
                                {isUpdating ? (
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
    }, [t, isUpdating])

    return { isUpdating }
}
