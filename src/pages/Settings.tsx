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
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { toast } from '@/components/ui/use-toast'
import NovelAILogo from '@/assets/novelai_logo.svg'
import GeminiIcon from '@/assets/gemini-color.svg'
import { open } from '@tauri-apps/plugin-dialog'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { useUpdateStore, setCurrentUpdateObject } from '@/stores/update-store'

const LANGUAGES = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
    { code: 'ja', name: '日本語' },
]

type SettingsSection = 'general' | 'appearance' | 'api' | 'storage'

const SECTIONS = [
    { id: 'general' as const, icon: Settings2, labelKey: 'settingsPage.sections.general' },
    { id: 'appearance' as const, icon: Palette, labelKey: 'settingsPage.sections.appearance' },
    { id: 'api' as const, icon: Key, labelKey: 'settingsPage.sections.api' },
    { id: 'storage' as const, icon: FolderOpen, labelKey: 'settingsPage.sections.storage' },
]

export default function Settings() {
    const { t, i18n } = useTranslation()
    const { theme, setTheme } = useThemeStore()
    const { token, isVerified, anlas, isLoading, verifyAndSave } = useAuthStore()
    const { savePath, autoSave, setSavePath, setAutoSave, promptFontSize, setPromptFontSize, useStreaming, setUseStreaming, generationDelay, setGenerationDelay, geminiApiKey, setGeminiApiKey, useAbsolutePath, libraryPath, useAbsoluteLibraryPath, setLibraryPath } = useSettingsStore()
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

    useEffect(() => {
        getVersion().then(setAppVersion).catch(() => setAppVersion('dev'))
    }, [])

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
            </aside>

            {/* Content */}
            <main className="flex-1 p-6 overflow-y-auto">
                <div className="max-w-2xl space-y-8">
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

                                    {/* Pending Update Install Section */}
                                    {pendingUpdate && (
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
                                                        const update = await check()
                                                        if (update) {
                                                            await update.install()
                                                            await relaunch()
                                                        }
                                                    } catch (e) {
                                                        toast({ title: t('update.failed', '설치 실패'), variant: 'destructive' })
                                                    }
                                                }}
                                            >
                                                <Sparkles className="h-4 w-4 mr-1" />
                                                {t('update.installNow', '지금 설치')}
                                            </Button>
                                        </div>
                                    )}
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
                                                ? "animate-pulse bg-primary hover:bg-primary/90 text-primary-foreground"
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
                                                ? "animate-pulse bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        </section>
                    )}
                </div>
            </main>
        </div>
    )
}
