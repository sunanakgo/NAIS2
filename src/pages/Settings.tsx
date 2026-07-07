import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Tip } from '@/components/ui/tooltip'
import {
    Key,
    Settings2,
    Save,
    Check,
    X,
    Sun,
    Moon,
    Monitor,
    Languages,
    Loader2,
    Coins,
    FolderOpen,
    Palette,
    Type,
    Zap,
    RotateCcw,
    Info,
    RefreshCw,
    Download,
    Timer,
    Sparkles,
    Keyboard,
    Upload,
    Database,
    AlertTriangle,
    HardDrive,
    MessagesSquare,
    ExternalLink,
} from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useShortcutStore, SHORTCUT_ACTIONS, formatKeyBinding, type ShortcutAction, type KeyBinding } from '@/stores/shortcut-store'
import { toast } from '@/components/ui/use-toast'
import NovelAILogo from '@/assets/novelai_logo.svg'
import GeminiIcon from '@/assets/gemini-color.svg'
import { open, save } from '@tauri-apps/plugin-dialog'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { useUpdateStore, setCurrentUpdateObject, installPendingUpdate } from '@/stores/update-store'
import { exportAllData, importAllData, getStoreSizes } from '@/lib/indexed-db'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'

const LANGUAGES = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
]

type SettingsSection = 'general' | 'appearance' | 'api' | 'storage' | 'shortcuts' | 'backup'

const SECTIONS = [
    { id: 'general' as const, icon: Settings2, labelKey: 'settingsPage.sections.general' },
    { id: 'appearance' as const, icon: Palette, labelKey: 'settingsPage.sections.appearance' },
    { id: 'api' as const, icon: Key, labelKey: 'settingsPage.sections.api' },
    { id: 'storage' as const, icon: FolderOpen, labelKey: 'settingsPage.sections.storage' },
    { id: 'shortcuts' as const, icon: Keyboard, labelKey: 'settingsPage.sections.shortcuts' },
    { id: 'backup' as const, icon: Database, labelKey: 'settingsPage.backup.title' },
]

export default function Settings() {
    const { t, i18n } = useTranslation()
    const { theme, setTheme } = useThemeStore()
    const { token, isVerified, anlas, isLoading, verifyAndSave } = useAuthStore()
    const { savePath, autoSave, setSavePath, setAutoSave, promptFontSize, setPromptFontSize, useStreaming, setUseStreaming, generationDelay, setGenerationDelay, geminiApiKey, setGeminiApiKey, useAbsolutePath, libraryPath, useAbsoluteLibraryPath, setLibraryPath, imageFormat, setImageFormat } = useSettingsStore()
    const { bindings, enabled: shortcutsEnabled, setBinding, resetBinding, resetAllBindings, setEnabled: setShortcutsEnabled } = useShortcutStore()
    const [localGeminiKey, setLocalGeminiKey] = useState(geminiApiKey)

    const [activeSection, setActiveSection] = useState<SettingsSection>('general')
    const [apiToken, setApiToken] = useState(token)
    const [tokenStatus, setTokenStatus] = useState<'idle' | 'valid' | 'invalid' | 'verifying'>(
        isVerified ? 'valid' : 'idle'
    )
    const [localSavePath, setLocalSavePath] = useState(savePath)
    const [isAbsolutePath, setIsAbsolutePath] = useState(useAbsolutePath)
    const [localLibraryPath, setLocalLibraryPath] = useState(libraryPath)
    const [isAbsoluteLibraryPath, setIsAbsoluteLibraryPath] = useState(useAbsoluteLibraryPath)
    const [appVersion, setAppVersion] = useState('')
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const { pendingUpdate, isDownloading, setPendingUpdate, setIsDownloading, setDownloadProgress } = useUpdateStore()

    // 키바인드 편집 상태
    const [editingAction, setEditingAction] = useState<ShortcutAction | null>(null)
    const [recordedBinding, setRecordedBinding] = useState<KeyBinding | null>(null)
    
    // 백업 관련 상태
    const [isExporting, setIsExporting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [storeSizes, setStoreSizes] = useState<{ [key: string]: number }>({})
    const [lastBackupTime, setLastBackupTime] = useState<string | null>(null)

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion('dev'))
        // 마지막 백업 시간 로드
        const lastBackup = localStorage.getItem('nais2-last-backup-time')
        if (lastBackup) setLastBackupTime(lastBackup)
    }, [])
    
    // 데이터 크기 로드 (backup 섹션 진입 시)
    useEffect(() => {
        if (activeSection === 'backup') {
            getStoreSizes().then(setStoreSizes).catch(console.error)
        }
    }, [activeSection])

    useEffect(() => {
        if (token) {
            setApiToken(token)
            if (isVerified) {
                setTokenStatus('valid')
            }
        }
    }, [token, isVerified])

    const handleVerifyToken = async () => {
        if (!apiToken) return
        setTokenStatus('verifying')
        const success = await verifyAndSave(apiToken)
        setTokenStatus(success ? 'valid' : 'invalid')
        if (success) {
            toast({ title: t('settingsPage.api.verified'), variant: 'success' })
        }
    }

    const handleSavePath = () => {
        setSavePath(localSavePath, isAbsolutePath)
        toast({ title: t('settingsPage.saved'), variant: 'success' })
    }

    // Browse for folder using native dialog
    const handleBrowseFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settingsPage.save.selectFolder', 'Select Save Folder'),
            })
            if (selected && typeof selected === 'string') {
                setLocalSavePath(selected)
                setIsAbsolutePath(true)
            }
        } catch (e) {
            console.error('Folder selection failed:', e)
        }
    }

    // Reset to default Pictures subfolder
    const handleResetToDefault = async () => {
        setLocalSavePath('NAIS_Output')
        setIsAbsolutePath(false)
        setSavePath('NAIS_Output', false)
        toast({ title: t('settingsPage.saved'), variant: 'success' })
    }

    // Library path handlers
    const handleSaveLibraryPath = () => {
        setLibraryPath(localLibraryPath, isAbsoluteLibraryPath)
        toast({ title: t('settingsPage.saved'), variant: 'success' })
    }

    const handleBrowseLibraryFolder = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                title: t('settingsPage.library.selectFolder', 'Select Library Folder'),
            })
            if (selected && typeof selected === 'string') {
                setLocalLibraryPath(selected)
                setIsAbsoluteLibraryPath(true)
            }
        } catch (e) {
            console.error('Folder selection failed:', e)
        }
    }

    const handleResetLibraryToDefault = async () => {
        setLocalLibraryPath('NAIS_Library')
        setIsAbsoluteLibraryPath(false)
        setLibraryPath('NAIS_Library', false)
        toast({ title: t('settingsPage.saved'), variant: 'success' })
    }
    
    // 백업 내보내기
    const handleExportBackup = async () => {
        setIsExporting(true)
        try {
            const backup = await exportAllData()
            const storeCount = Object.keys(backup).filter(k => !k.startsWith('_')).length
            
            // 파일 저장 다이얼로그
            const filePath = await save({
                title: t('settingsPage.backup.export'),
                defaultPath: `nais2-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }]
            })
            
            if (filePath) {
                await writeTextFile(filePath, JSON.stringify(backup, null, 2))
                
                // 마지막 백업 시간 저장
                const now = new Date().toISOString()
                localStorage.setItem('nais2-last-backup-time', now)
                setLastBackupTime(now)
                
                toast({
                    title: t('settingsPage.backup.exported'),
                    description: t('settingsPage.backup.exportedDesc', { count: storeCount }),
                    variant: 'success',
                })
            }
        } catch (err) {
            console.error('Backup export failed:', err)
            toast({
                title: t('settingsPage.backup.exportFailed'),
                description: String(err),
                variant: 'destructive',
            })
        } finally {
            setIsExporting(false)
        }
    }
    
    // 백업 복원
    const handleImportBackup = async () => {
        try {
            // 파일 선택 다이얼로그
            const filePath = await open({
                title: t('settingsPage.backup.import'),
                filters: [{ name: 'JSON', extensions: ['json'] }],
                multiple: false,
            })
            
            if (!filePath || typeof filePath !== 'string') return
            
            // 확인 다이얼로그
            const confirmed = window.confirm(
                `${t('settingsPage.backup.confirmRestoreDesc')}\n\n${t('settingsPage.backup.restoreWarning')}`
            )
            if (!confirmed) return
            
            setIsImporting(true)
            
            const content = await readTextFile(filePath)
            const backup = JSON.parse(content)
            
            // 유효성 검증
            if (!backup._exportedAt || !backup._version) {
                toast({
                    title: t('settingsPage.backup.importFailed'),
                    description: t('settingsPage.backup.invalidFile'),
                    variant: 'destructive',
                })
                return
            }
            
            const result = await importAllData(backup, true)
            
            toast({
                title: t('settingsPage.backup.imported'),
                description: t('settingsPage.backup.importedDesc', { success: result.success.length }),
                variant: 'success',
            })
            
            // 앱 재시작
            setTimeout(() => {
                relaunch()
            }, 1500)
            
        } catch (err) {
            console.error('Backup import failed:', err)
            toast({
                title: t('settingsPage.backup.importFailed'),
                description: String(err),
                variant: 'destructive',
            })
        } finally {
            setIsImporting(false)
        }
    }
    
    // 데이터 크기 포맷팅
    const formatSize = (bytes: number) => {
        if (bytes < 0) return 'Error'
        if (bytes === 0) return '0 B'
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    }
    
    const totalSize = Object.values(storeSizes).reduce((sum, size) => sum + (size > 0 ? size : 0), 0)

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <aside className="w-56 border-r border-border/50 p-4 space-y-1">
                <h2 className="text-lg font-semibold mb-4 px-2">{t('settingsPage.title')}</h2>
                {SECTIONS.map((section) => (
                    <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            activeSection === section.id
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )}
                    >
                        <section.icon className="h-4 w-4" />
                        {t(section.labelKey)}
                    </button>
                ))}

                <div className="pt-2 mt-2 border-t border-border/50">
                    <button
                        onClick={() => openUrl('https://discord.gg/N78K9GPN')}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-[#5865F2]/10 hover:text-[#5865F2]"
                    >
                        <MessagesSquare className="h-4 w-4" />
                        <span className="flex-1 text-left">{t('settingsPage.sections.discord', '디스코드 커뮤니티')}</span>
                        <ExternalLink className="h-3 w-3 opacity-60" />
                    </button>
                </div>
            </aside>

            {/* Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl space-y-8">
                    {/* NAIS3 이전 안내 배너 — 항상 표시 */}
                    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                        <Sparkles className="h-5 w-5 shrink-0 text-amber-400" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">NAIS3가 나왔습니다</p>
                            <p className="text-xs text-muted-foreground">
                                백업 내보내기 → NAIS3 설정에서 불러오면 데이터가 그대로 이전됩니다
                            </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={handleExportBackup} disabled={isExporting}>
                            백업 내보내기
                        </Button>
                        <Button size="sm" onClick={() => openUrl('https://github.com/sunanakgo/NAIS3/releases')}>
                            NAIS3 받기
                        </Button>
                    </div>

                    {/* General Section */}
                    {activeSection === 'general' && (
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold">{t('settingsPage.sections.general')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.language.description')}
                                </p>
                            </div>
                            <div className="border border-border/50 rounded-xl p-6 space-y-6 bg-card/30">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <Languages className="h-4 w-4 text-muted-foreground" />
                                            {t('settingsPage.language.select')}
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.language.description')}
                                        </p>
                                    </div>
                                    <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
                                        <SelectTrigger className="w-40">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LANGUAGES.map((lang) => (
                                                <SelectItem key={lang.code} value={lang.code}>
                                                    {lang.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Streaming Toggle */}
                                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <Zap className="h-4 w-4 text-yellow-500" />
                                            {t('settingsPage.streaming.title', 'Streaming Generation')}
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.streaming.description', 'Show real-time progress during image generation')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={useStreaming}
                                        onChange={(e) => setUseStreaming(e.target.checked)}
                                    />
                                </div>

                                {/* Generation Delay */}
                                <div className="space-y-3 pt-4 border-t border-border/30">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <Timer className="h-4 w-4 text-blue-500" />
                                            {t('settingsPage.generationDelay.title', 'Generation Delay')}
                                        </label>
                                        <span className="text-sm text-muted-foreground">{generationDelay}ms</span>
                                    </div>
                                    <Slider
                                        value={[generationDelay]}
                                        onValueChange={([v]) => setGenerationDelay(v)}
                                        min={0}
                                        max={5000}
                                        step={100}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('settingsPage.generationDelay.description', 'Delay between batch image generations to avoid API rate limits.')}
                                    </p>
                                </div>

                                {/* Version Info */}
                                <div className="space-y-4 pt-4 border-t border-border/30">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <label className="text-sm font-medium flex items-center gap-2">
                                                <Info className="h-4 w-4 text-blue-500" />
                                                {t('settingsPage.version.title', 'Version')}
                                            </label>
                                            <p className="text-xs text-muted-foreground">
                                                NAIS2 v{appVersion}
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={async () => {
                                                setIsCheckingUpdate(true)
                                                try {
                                                    const update = await check()
                                                    if (update) {
                                                        // Store the update object
                                                        setCurrentUpdateObject(update)

                                                        // Check if already downloaded
                                                        if (pendingUpdate && pendingUpdate.version === update.version) {
                                                            toast({
                                                                title: t('update.readyToInstall', '업데이트 설치 준비됨'),
                                                                description: t('update.version', { version: update.version }),
                                                            })
                                                        } else {
                                                            toast({
                                                                title: t('update.available', '업데이트 사용 가능'),
                                                                description: t('update.version', { version: update.version }),
                                                                action: (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={async () => {
                                                                            setIsDownloading(true)
                                                                            toast({ title: t('update.downloading', '다운로드 중...'), description: t('update.pleaseWait', '잠시만 기다려주세요') })
                                                                            try {
                                                                                let totalBytes = 0
                                                                                let downloadedBytes = 0
                                                                                await update.download((event) => {
                                                                                    if (event.event === 'Started' && event.data.contentLength) {
                                                                                        totalBytes = event.data.contentLength
                                                                                    } else if (event.event === 'Progress') {
                                                                                        downloadedBytes += event.data.chunkLength
                                                                                        if (totalBytes > 0) {
                                                                                            setDownloadProgress(Math.round((downloadedBytes / totalBytes) * 100))
                                                                                        }
                                                                                    }
                                                                                })
                                                                                setPendingUpdate({ version: update.version, downloadedAt: Date.now() })
                                                                                toast({
                                                                                    title: t('update.downloadComplete', '다운로드 완료'),
                                                                                    description: t('update.readyToInstallDesc', '작업을 저장한 후 설치하세요.'),
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
                                                                            } catch (e) {
                                                                                toast({ title: t('update.failed', '다운로드 실패'), variant: 'destructive' })
                                                                            } finally {
                                                                                setIsDownloading(false)
                                                                            }
                                                                        }}
                                                                        disabled={isDownloading}
                                                                    >
                                                                        {isDownloading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                                                    </Button>
                                                                ),
                                                            })
                                                        }
                                                    } else {
                                                        toast({ title: t('update.upToDate', '최신 버전입니다'), variant: 'success' })
                                                    }
                                                } catch (e) {
                                                    toast({ title: t('update.checkFailed', '업데이트 확인 실패'), variant: 'destructive' })
                                                } finally {
                                                    setIsCheckingUpdate(false)
                                                }
                                            }}
                                            disabled={isCheckingUpdate}
                                        >
                                            {isCheckingUpdate ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-4 w-4 mr-2" />
                                                    {t('settingsPage.version.checkUpdate', 'Check for Updates')}
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {/* Pending Update Install Section - only show if pending version is newer */}
                                    {pendingUpdate && appVersion && (() => {
                                        // Compare versions
                                        const current = appVersion.replace(/^v/, '').split('.').map(Number)
                                        const pending = pendingUpdate.version.replace(/^v/, '').split('.').map(Number)
                                        let isNewer = false
                                        for (let i = 0; i < Math.max(current.length, pending.length); i++) {
                                            const c = current[i] || 0
                                            const p = pending[i] || 0
                                            if (p > c) { isNewer = true; break }
                                            if (p < c) break
                                        }
                                        if (!isNewer) return null
                                        return (
                                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-500/20">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="h-4 w-4 text-green-500" />
                                                    <div>
                                                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                                            {t('update.readyToInstall', '업데이트 설치 준비됨')}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            v{pendingUpdate.version}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            toast({ title: t('update.installing', '설치 중...'), description: t('update.pleaseWait', '잠시만 기다려주세요') })
                                                            await installPendingUpdate()
                                                        } catch (e) {
                                                            console.error('Install failed:', e)
                                                            toast({ title: t('update.failed', '설치 실패'), description: String(e), variant: 'destructive' })
                                                        }
                                                    }}
                                                >
                                                    <Sparkles className="h-4 w-4 mr-1" />
                                                    {t('update.installNow', '지금 설치')}
                                                </Button>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Appearance Section */}
                    {activeSection === 'appearance' && (
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold">{t('settingsPage.sections.appearance')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.theme.description')}
                                </p>
                            </div>
                            <div className="border border-border/50 rounded-xl p-6 space-y-6 bg-card/30">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium">{t('settingsPage.theme.mode')}</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { value: 'light' as const, icon: Sun, labelKey: 'settingsPage.theme.light' },
                                            { value: 'dark' as const, icon: Moon, labelKey: 'settingsPage.theme.dark' },
                                            { value: 'system' as const, icon: Monitor, labelKey: 'settingsPage.theme.system' },
                                        ].map((option) => (
                                            <button
                                                key={option.value}
                                                onClick={() => setTheme(option.value)}
                                                className={cn(
                                                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                                                    theme === option.value
                                                        ? 'border-primary bg-primary/5'
                                                        : 'border-border/50 hover:border-border hover:bg-muted/30'
                                                )}
                                            >
                                                <option.icon className={cn(
                                                    'h-6 w-6',
                                                    theme === option.value ? 'text-primary' : 'text-muted-foreground'
                                                )} />
                                                <span className={cn(
                                                    'text-sm font-medium',
                                                    theme === option.value ? 'text-primary' : 'text-muted-foreground'
                                                )}>
                                                    {t(option.labelKey)}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium flex items-center gap-2">
                                            <Type className="h-4 w-4" />
                                            {t('settingsPage.theme.fontSize', 'Prompt Font Size')}
                                        </label>
                                        <span className="text-sm text-muted-foreground">{promptFontSize}px</span>
                                    </div>
                                    <Slider
                                        value={[promptFontSize]}
                                        onValueChange={([v]) => setPromptFontSize(v)}
                                        min={12}
                                        max={24}
                                        step={1}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('settingsPage.theme.fontSizeHelp', 'Adjust the font size of the prompt input areas.')}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* API Section */}
                    {activeSection === 'api' && (
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold">{t('settingsPage.sections.api')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.api.description')}
                                </p>
                            </div>

                            {/* Anlas Balance Card */}
                            {isVerified && anlas && (
                                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 rounded-xl border border-amber-500/20">
                                    <div className="p-3 bg-amber-500/20 rounded-full">
                                        <Coins className="h-6 w-6 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                            {anlas.total.toLocaleString()} Anlas
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.api.anlas.fixed')}: {anlas.fixed.toLocaleString()} / {t('settingsPage.api.anlas.purchased')}: {anlas.purchased.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="border border-border/50 rounded-xl p-6 space-y-4 bg-card/30">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <img src={NovelAILogo} alt="NovelAI" className="h-4 w-4" />
                                        {t('settingsPage.api.token')}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                type="password"
                                                placeholder={t('settingsPage.api.tokenPlaceholder')}
                                                value={apiToken}
                                                onChange={(e) => {
                                                    setApiToken(e.target.value)
                                                    setTokenStatus('idle')
                                                }}
                                                className={cn(
                                                    'pr-10',
                                                    tokenStatus === 'valid' && 'border-green-500 focus-visible:ring-green-500',
                                                    tokenStatus === 'invalid' && 'border-destructive focus-visible:ring-destructive'
                                                )}
                                            />
                                            {tokenStatus !== 'idle' && tokenStatus !== 'verifying' && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    {tokenStatus === 'valid' ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <X className="h-4 w-4 text-destructive" />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleVerifyToken}
                                            disabled={tokenStatus === 'verifying' || isLoading}
                                        >
                                            {tokenStatus === 'verifying' || isLoading ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                t('settingsPage.api.verify')
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('settingsPage.api.tokenHelp')}
                                    </p>
                                </div>

                                <div className="space-y-2 pt-4 border-t border-border/30">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <img src={GeminiIcon} alt="Gemini" className="h-4 w-4" />
                                        {t('settingsPage.api.geminiKey', 'Gemini API Key')}
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="password"
                                            placeholder={t('settingsPage.api.geminiKeyPlaceholder', 'AIza...')}
                                            value={localGeminiKey}
                                            onChange={(e) => setLocalGeminiKey(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            onClick={() => {
                                                setGeminiApiKey(localGeminiKey)
                                                toast({ title: t('settingsPage.saved'), variant: 'success' })
                                            }}
                                        >
                                            {t('settingsPage.saveBtn')}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('settingsPage.api.geminiKeyHelp', 'Get your API key from Google AI Studio')}
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Storage Section */}
                    {activeSection === 'storage' && (
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold">{t('settingsPage.sections.storage')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.save.description')}
                                </p>
                            </div>
                            <div className="border border-border/50 rounded-xl p-6 space-y-6 bg-card/30">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">{t('settingsPage.save.folder')}</label>
                                        {isAbsolutePath && (
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                {t('settingsPage.save.customPath', 'Custom Path')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={localSavePath}
                                            onChange={(e) => {
                                                setLocalSavePath(e.target.value)
                                                // If user manually types, assume it's relative unless it looks like an absolute path
                                                const isAbsolute = /^[A-Za-z]:[\\/]/.test(e.target.value) || e.target.value.startsWith('/')
                                                setIsAbsolutePath(isAbsolute)
                                            }}
                                            placeholder="NAIS_Output"
                                            className="flex-1"
                                        />
                                        <Button variant="outline" onClick={handleBrowseFolder}>
                                            <FolderOpen className="h-4 w-4 mr-2" />
                                            {t('settingsPage.save.browse', 'Browse')}
                                        </Button>
                                        <Button
                                            onClick={handleSavePath}
                                            variant={(localSavePath !== savePath || isAbsolutePath !== useAbsolutePath) ? "default" : "outline"}
                                            className={(localSavePath !== savePath || isAbsolutePath !== useAbsolutePath)
                                                ? "animate-pulse bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/50"
                                                : ""}
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            {t('settingsPage.saveBtn')}
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {isAbsolutePath
                                                ? t('settingsPage.save.absolutePathHelp', 'Images will be saved to this exact folder.')
                                                : t('settingsPage.save.folderHelp')}
                                        </p>
                                        {isAbsolutePath && (
                                            <Button variant="ghost" size="sm" onClick={handleResetToDefault} className="h-6 text-xs">
                                                <RotateCcw className="h-3 w-3 mr-1" />
                                                {t('settingsPage.save.resetDefault', 'Reset to Default')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-medium">{t('settingsPage.save.autoSave')}</label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.save.autoSaveHelp')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={autoSave}
                                        onChange={(e) => setAutoSave(e.target.checked)}
                                    />
                                </div>
                            </div>

                            {/* Library Path Setting */}
                            <div className="border border-border/50 rounded-xl p-6 space-y-6 bg-card/30">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">{t('settingsPage.library.folder', 'Library Folder')}</label>
                                        {isAbsoluteLibraryPath && (
                                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                                {t('settingsPage.save.customPath', 'Custom Path')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={localLibraryPath}
                                            onChange={(e) => {
                                                setLocalLibraryPath(e.target.value)
                                                const isAbsolute = /^[A-Za-z]:[\\/]/.test(e.target.value) || e.target.value.startsWith('/')
                                                setIsAbsoluteLibraryPath(isAbsolute)
                                            }}
                                            placeholder="NAIS_Library"
                                            className="flex-1"
                                        />
                                        <Button variant="outline" onClick={handleBrowseLibraryFolder}>
                                            <FolderOpen className="h-4 w-4 mr-2" />
                                            {t('settingsPage.save.browse', 'Browse')}
                                        </Button>
                                        <Button
                                            onClick={handleSaveLibraryPath}
                                            variant={(localLibraryPath !== libraryPath || isAbsoluteLibraryPath !== useAbsoluteLibraryPath) ? "default" : "outline"}
                                            className={(localLibraryPath !== libraryPath || isAbsoluteLibraryPath !== useAbsoluteLibraryPath)
                                                ? "animate-pulse bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg shadow-yellow-500/50"
                                                : ""}
                                        >
                                            <Save className="h-4 w-4 mr-2" />
                                            {t('settingsPage.saveBtn')}
                                        </Button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            {isAbsoluteLibraryPath
                                                ? t('settingsPage.library.absolutePathHelp', 'Library files will be saved to this exact folder.')
                                                : t('settingsPage.library.folderHelp', 'Default: Pictures/NAIS_Library')}
                                        </p>
                                        {isAbsoluteLibraryPath && (
                                            <Button variant="ghost" size="sm" onClick={handleResetLibraryToDefault} className="h-6 text-xs">
                                                <RotateCcw className="h-3 w-3 mr-1" />
                                                {t('settingsPage.save.resetDefault', 'Reset to Default')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Image Format Setting */}
                            <div className="border border-border/50 rounded-xl p-6 space-y-4 bg-card/30">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <label className="text-sm font-medium">{t('settingsPage.save.imageFormat.title', 'Image Format')}</label>
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.save.imageFormat.description', 'Choose the format for generated images.')}
                                        </p>
                                    </div>
                                    <Select value={imageFormat} onValueChange={(value: 'png' | 'webp') => setImageFormat(value)}>
                                        <SelectTrigger className="w-32">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="png">PNG</SelectItem>
                                            <SelectItem value="webp">WebP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t('settingsPage.save.imageFormat.help', 'WebP offers smaller file sizes with similar quality. PNG provides lossless quality.')}
                                </p>
                            </div>
                        </section>
                    )}

                    {/* Shortcuts Section */}
                    {activeSection === 'shortcuts' && (
                        <section className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold">{t('settingsPage.shortcuts.title', '단축키')}</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.shortcuts.description', '전역 단축키를 설정합니다.')}
                                </p>
                            </div>

                            {/* Enable/Disable Shortcuts */}
                            <div className="border border-border/50 rounded-xl p-6 bg-card/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-sm font-medium">{t('settingsPage.shortcuts.enable', '단축키 활성화')}</label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('settingsPage.shortcuts.enableHelp', '전역 단축키를 활성화하거나 비활성화합니다.')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={shortcutsEnabled}
                                        onChange={(e) => setShortcutsEnabled(e.target.checked)}
                                    />
                                </div>
                            </div>

                            {/* Shortcut Bindings */}
                            <div className="border border-border/50 rounded-xl p-6 space-y-4 bg-card/30">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">{t('settingsPage.shortcuts.bindings', '키 바인딩')}</h3>
                                    <Button variant="ghost" size="sm" onClick={resetAllBindings}>
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        {t('settingsPage.shortcuts.resetAll', '전체 초기화')}
                                    </Button>
                                </div>

                                {/* Navigation */}
                                <div className="space-y-2">
                                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
                                        {t('settingsPage.shortcuts.navigation', '네비게이션')}
                                    </h4>
                                    {SHORTCUT_ACTIONS.filter(a => a.category === 'navigation').map(({ action }) => (
                                        <ShortcutRow
                                            key={action}
                                            action={action}
                                            binding={bindings[action]}
                                            allBindings={bindings}
                                            isEditing={editingAction === action}
                                            recordedBinding={editingAction === action ? recordedBinding : null}
                                            onStartEdit={() => {
                                                setEditingAction(action)
                                                setRecordedBinding(null)
                                            }}
                                            onSave={(binding) => {
                                                setBinding(action, binding)
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onCancel={() => {
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onReset={() => resetBinding(action)}
                                            onKeyRecord={setRecordedBinding}
                                            t={t}
                                        />
                                    ))}
                                </div>

                                {/* Dialogs */}
                                <div className="space-y-2">
                                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
                                        {t('settingsPage.shortcuts.dialogs', '다이얼로그')}
                                    </h4>
                                    {SHORTCUT_ACTIONS.filter(a => a.category === 'dialog').map(({ action }) => (
                                        <ShortcutRow
                                            key={action}
                                            action={action}
                                            binding={bindings[action]}
                                            allBindings={bindings}
                                            isEditing={editingAction === action}
                                            recordedBinding={editingAction === action ? recordedBinding : null}
                                            onStartEdit={() => {
                                                setEditingAction(action)
                                                setRecordedBinding(null)
                                            }}
                                            onSave={(binding) => {
                                                setBinding(action, binding)
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onCancel={() => {
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onReset={() => resetBinding(action)}
                                            onKeyRecord={setRecordedBinding}
                                            t={t}
                                        />
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="space-y-2">
                                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
                                        {t('settingsPage.shortcuts.actions', '액션')}
                                    </h4>
                                    {SHORTCUT_ACTIONS.filter(a => a.category === 'action').map(({ action }) => (
                                        <ShortcutRow
                                            key={action}
                                            action={action}
                                            binding={bindings[action]}
                                            allBindings={bindings}
                                            isEditing={editingAction === action}
                                            recordedBinding={editingAction === action ? recordedBinding : null}
                                            onStartEdit={() => {
                                                setEditingAction(action)
                                                setRecordedBinding(null)
                                            }}
                                            onSave={(binding) => {
                                                setBinding(action, binding)
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onCancel={() => {
                                                setEditingAction(null)
                                                setRecordedBinding(null)
                                            }}
                                            onReset={() => resetBinding(action)}
                                            onKeyRecord={setRecordedBinding}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}
                    
                    {/* Backup Section */}
                    {activeSection === 'backup' && (
                        <section className="space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold">{t('settingsPage.backup.title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('settingsPage.backup.description')}
                                </p>
                            </div>
                            
                            {/* Export/Import */}
                            <div className="border border-border/50 rounded-xl p-6 space-y-6 bg-card/30">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium flex items-center gap-2">
                                                <Download className="h-4 w-4 text-blue-500" />
                                                {t('settingsPage.backup.export')}
                                            </label>
                                            <p className="text-xs text-muted-foreground">
                                                {t('settingsPage.backup.exportDesc')}
                                            </p>
                                        </div>
                                        <Button onClick={handleExportBackup} disabled={isExporting}>
                                            {isExporting ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Download className="h-4 w-4 mr-2" />
                                            )}
                                            {isExporting ? t('settingsPage.backup.exporting') : t('settingsPage.backup.export')}
                                        </Button>
                                    </div>
                                </div>
                                
                                <div className="border-t border-border/30 pt-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium flex items-center gap-2">
                                                <Upload className="h-4 w-4 text-green-500" />
                                                {t('settingsPage.backup.import')}
                                            </label>
                                            <p className="text-xs text-muted-foreground">
                                                {t('settingsPage.backup.importDesc')}
                                            </p>
                                        </div>
                                        <Button variant="outline" onClick={handleImportBackup} disabled={isImporting}>
                                            {isImporting ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Upload className="h-4 w-4 mr-2" />
                                            )}
                                            {isImporting ? t('settingsPage.backup.importing') : t('settingsPage.backup.import')}
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Last Backup Time */}
                                {lastBackupTime && (
                                    <div className="border-t border-border/30 pt-4">
                                        <p className="text-xs text-muted-foreground">
                                            {t('settingsPage.backup.lastBackup')}: {new Date(lastBackupTime).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Data Sizes */}
                            <div className="border border-border/50 rounded-xl p-6 space-y-4 bg-card/30">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-medium flex items-center gap-2">
                                        <HardDrive className="h-4 w-4 text-muted-foreground" />
                                        {t('settingsPage.backup.sizes')}
                                    </h4>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => getStoreSizes().then(setStoreSizes)}
                                    >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        {t('common.change', 'Refresh')}
                                    </Button>
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                    {Object.entries(storeSizes).map(([key, size]) => (
                                        <div key={key} className="flex items-center justify-between py-1">
                                            <span className="text-muted-foreground">
                                                {key.replace('nais2-', '')}
                                            </span>
                                            <span className={cn(
                                                "font-mono",
                                                size > 1024 * 1024 && "text-yellow-500",
                                                size > 5 * 1024 * 1024 && "text-red-500"
                                            )}>
                                                {formatSize(size)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="border-t border-border/30 pt-2 flex items-center justify-between font-medium">
                                        <span>{t('settingsPage.backup.totalSize')}</span>
                                        <span className="font-mono">{formatSize(totalSize)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Warning */}
                            <div className="border border-yellow-500/30 rounded-xl p-4 bg-yellow-500/5">
                                <div className="flex gap-3">
                                    <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                                    <div className="text-sm text-yellow-600 dark:text-yellow-400">
                                        <p className="font-medium">{t('settingsPage.backup.restoreWarning')}</p>
                                        <p className="text-xs mt-1 opacity-80">
                                            {t('settingsPage.backup.confirmRestoreDesc')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </main>
        </div>
    )
}

// 단축키 행 컴포넌트
interface ShortcutRowProps {
    action: ShortcutAction
    binding: KeyBinding
    allBindings: Record<ShortcutAction, KeyBinding>
    isEditing: boolean
    recordedBinding: KeyBinding | null
    onStartEdit: () => void
    onSave: (binding: KeyBinding) => void
    onCancel: () => void
    onReset: () => void
    onKeyRecord: (binding: KeyBinding) => void
    t: ReturnType<typeof useTranslation>['t']
}

function ShortcutRow({ action, binding, allBindings, isEditing, recordedBinding, onStartEdit, onSave, onCancel, onReset, onKeyRecord, t }: ShortcutRowProps) {
    const [conflictAction, setConflictAction] = useState<ShortcutAction | null>(null)

    // 충돌 체크 함수
    const checkConflict = (newBinding: KeyBinding): ShortcutAction | null => {
        for (const [otherAction, otherBinding] of Object.entries(allBindings)) {
            if (otherAction === action) continue // 자기 자신은 제외

            // 키 조합이 정확히 같은지 확인
            if (
                otherBinding.key === newBinding.key &&
                !!otherBinding.ctrl === !!newBinding.ctrl &&
                !!otherBinding.shift === !!newBinding.shift &&
                !!otherBinding.alt === !!newBinding.alt
            ) {
                return otherAction as ShortcutAction
            }
        }
        return null
    }

    const handleSave = () => {
        if (!recordedBinding) return

        const conflict = checkConflict(recordedBinding)
        if (conflict) {
            setConflictAction(conflict)
            return
        }

        onSave(recordedBinding)
        setConflictAction(null)
    }

    const handleForceOverride = () => {
        if (!recordedBinding) return
        onSave(recordedBinding)
        setConflictAction(null)
    }
    useEffect(() => {
        if (!isEditing) return

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault()
            e.stopPropagation()

            // Escape로 취소
            if (e.key === 'Escape') {
                onCancel()
                return
            }

            // 단독 modifier 키는 무시
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
                return
            }

            const newBinding: KeyBinding = {
                key: e.key,
                ctrl: e.ctrlKey || e.metaKey,
                shift: e.shiftKey,
                alt: e.altKey,
                label: '',
                description: binding.description,
            }
            newBinding.label = formatKeyBinding(newBinding)
            onKeyRecord(newBinding)
        }

        window.addEventListener('keydown', handleKeyDown, true)
        return () => window.removeEventListener('keydown', handleKeyDown, true)
    }, [isEditing, binding.description, onCancel, onKeyRecord])

    const displayBinding = recordedBinding || binding

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                <span className="text-sm">{t(binding.description, binding.description)}</span>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <div className={cn(
                                "px-3 py-1.5 rounded-md text-sm font-mono min-w-[100px] text-center",
                                recordedBinding ? "bg-primary text-primary-foreground" : "bg-muted animate-pulse"
                            )}>
                                {recordedBinding ? recordedBinding.label : t('settingsPage.shortcuts.pressKey', '키 입력...')}
                            </div>
                            <Button size="sm" variant="ghost" onClick={onCancel}>
                                <X className="h-4 w-4" />
                            </Button>
                            {recordedBinding && (
                                <Button size="sm" variant="default" onClick={handleSave}>
                                    <Check className="h-4 w-4" />
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onStartEdit}
                                className="px-3 py-1.5 rounded-md text-sm font-mono bg-muted hover:bg-muted/80 min-w-[100px] text-center"
                            >
                                {displayBinding.label}
                            </button>
                            <Tip content={t('settingsPage.shortcuts.reset', '초기화')}>
                                <Button size="sm" variant="ghost" onClick={onReset}>
                                    <RotateCcw className="h-3 w-3" />
                                </Button>
                            </Tip>
                        </>
                    )}
                </div>
            </div>

            {/* 충돌 경고 */}
            {conflictAction && recordedBinding && (
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 text-sm text-destructive">
                        <Info className="h-4 w-4" />
                        <span>
                            {t('settingsPage.shortcuts.conflict', '이미 사용 중:')} {t(allBindings[conflictAction].description, allBindings[conflictAction].description)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConflictAction(null)}
                            className="text-destructive hover:text-destructive"
                        >
                            {t('common.cancel', '취소')}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleForceOverride}
                        >
                            {t('settingsPage.shortcuts.override', '덮어쓰기')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
