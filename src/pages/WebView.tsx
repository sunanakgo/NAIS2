import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { invoke } from '@tauri-apps/api/core'
import { Store } from '@tauri-apps/plugin-store'
import {
    Globe,
    Home,
    ExternalLink,
    X,
    RefreshCw,
    Plus,
    Edit,
} from 'lucide-react'

interface QuickLink {
    name: string
    url: string
}

// Default quick links (safebooru removed)
const DEFAULT_QUICK_LINKS: QuickLink[] = [
    { name: 'Danbooru', url: 'https://hijiribe.donmai.us' },
    { name: 'novelai.app', url: 'https://novelai.app/' },
    { name: 'Google Translate', url: 'https://translate.google.co.kr/?sl=ko&tl=en&op=translate' },
]

const STORE_KEY = 'webview_quick_links'

export default function WebView() {
    const { t } = useTranslation()
    const [url, setUrl] = useState('https://hijiribe.donmai.us')
    const [inputUrl, setInputUrl] = useState(url)
    const [isLoading, setIsLoading] = useState(false)
    const [isBrowserOpen, setIsBrowserOpen] = useState(false)
    const [quickLinks, setQuickLinks] = useState<QuickLink[]>(DEFAULT_QUICK_LINKS)
    const [isEditMode, setIsEditMode] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newLinkName, setNewLinkName] = useState('')
    const [newLinkUrl, setNewLinkUrl] = useState('')
    const browserAreaRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const storeRef = useRef<Store | null>(null)

    // Hide WebView when dialog opens (z-index fix)
    useEffect(() => {
        if (isAddDialogOpen && isBrowserOpen) {
            invoke('hide_embedded_browser').catch(() => { })
        } else if (!isAddDialogOpen && isBrowserOpen) {
            invoke('show_embedded_browser').catch(() => { })
        }
    }, [isAddDialogOpen, isBrowserOpen])

    // Initialize store and load quick links
    useEffect(() => {
        const initStore = async () => {
            try {
                storeRef.current = await Store.load('webview-settings.json')
                const savedLinks = await storeRef.current.get<QuickLink[]>(STORE_KEY)
                if (savedLinks && savedLinks.length > 0) {
                    setQuickLinks(savedLinks)
                }
            } catch (error) {
                console.error('Failed to load quick links:', error)
            }
        }
        initStore()
    }, [])

    // Save quick links when changed
    const saveQuickLinks = useCallback(async (links: QuickLink[]) => {
        try {
            if (storeRef.current) {
                await storeRef.current.set(STORE_KEY, links)
                await storeRef.current.save()
            }
        } catch (error) {
            console.error('Failed to save quick links:', error)
        }
    }, [])

    const addQuickLink = () => {
        if (!newLinkName.trim() || !newLinkUrl.trim()) return

        let urlToAdd = newLinkUrl.trim()
        if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
            urlToAdd = 'https://' + urlToAdd
        }

        const newLinks = [...quickLinks, { name: newLinkName.trim(), url: urlToAdd }]
        setQuickLinks(newLinks)
        saveQuickLinks(newLinks)

        setNewLinkName('')
        setNewLinkUrl('')
        setIsAddDialogOpen(false)
    }

    const removeQuickLink = (index: number) => {
        const newLinks = quickLinks.filter((_, i) => i !== index)
        setQuickLinks(newLinks)
        saveQuickLinks(newLinks)
    }

    // Resize WebView immediately using requestAnimationFrame
    const updateWebViewSize = useCallback(() => {
        if (!isBrowserOpen || !browserAreaRef.current) return

        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current)
        }

        rafRef.current = requestAnimationFrame(async () => {
            const rect = browserAreaRef.current?.getBoundingClientRect()
            if (!rect) return

            try {
                await invoke('resize_embedded_browser', {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                })
            } catch (error) {
                // Ignore resize errors
            }
        })
    }, [isBrowserOpen])

    // Check if browser exists and restore on mount
    useEffect(() => {
        const checkAndRestoreBrowser = async () => {
            try {
                const isOpen = await invoke<boolean>('is_browser_open')
                if (isOpen) {
                    await invoke('show_embedded_browser')
                    setIsBrowserOpen(true)
                    setTimeout(() => {
                        if (browserAreaRef.current) {
                            const rect = browserAreaRef.current.getBoundingClientRect()
                            invoke('resize_embedded_browser', {
                                x: rect.left,
                                y: rect.top,
                                width: rect.width,
                                height: rect.height
                            })
                        }
                    }, 50)
                }
            } catch (error) {
                console.error('Failed to check browser state:', error)
            }
        }
        checkAndRestoreBrowser()
    }, [])

    // Listen to resize events
    useEffect(() => {
        if (!isBrowserOpen) return

        window.addEventListener('resize', updateWebViewSize)

        const resizeObserver = new ResizeObserver(updateWebViewSize)
        if (browserAreaRef.current) {
            resizeObserver.observe(browserAreaRef.current)
        }

        return () => {
            window.removeEventListener('resize', updateWebViewSize)
            resizeObserver.disconnect()
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
        }
    }, [isBrowserOpen, updateWebViewSize])

    // Hide browser when visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && isBrowserOpen) {
                invoke('hide_embedded_browser').catch(() => { })
            } else if (!document.hidden && isBrowserOpen) {
                invoke('show_embedded_browser').catch(() => { })
                updateWebViewSize()
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isBrowserOpen, updateWebViewSize])

    // Hide browser when leaving the page
    useEffect(() => {
        return () => {
            invoke('hide_embedded_browser').catch(() => { })
        }
    }, [])

    const openBrowserWindow = useCallback(async (targetUrl: string) => {
        setIsLoading(true)
        try {
            const browserArea = browserAreaRef.current
            if (!browserArea) return

            const rect = browserArea.getBoundingClientRect()

            await invoke('open_embedded_browser', {
                url: targetUrl,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            })
            setIsBrowserOpen(true)
        } catch (error) {
            console.error('Failed to open browser:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const closeBrowser = async () => {
        try {
            await invoke('close_embedded_browser')
            setIsBrowserOpen(false)
        } catch (error) {
            console.error('Failed to close browser:', error)
        }
    }

    const handleNavigate = async (e: React.FormEvent) => {
        e.preventDefault()
        let newUrl = inputUrl
        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'https://' + newUrl
        }
        setUrl(newUrl)

        if (isBrowserOpen) {
            try {
                await invoke('navigate_embedded_browser', { url: newUrl })
            } catch (error) {
                await openBrowserWindow(newUrl)
            }
        } else {
            await openBrowserWindow(newUrl)
        }
    }

    const handleQuickLink = async (linkUrl: string) => {
        if (isEditMode) return

        setUrl(linkUrl)
        setInputUrl(linkUrl)

        if (isBrowserOpen) {
            try {
                await invoke('navigate_embedded_browser', { url: linkUrl })
            } catch (error) {
                await openBrowserWindow(linkUrl)
            }
        } else {
            await openBrowserWindow(linkUrl)
        }
    }

    return (
        <div className="flex flex-col h-full gap-3 p-4">
            {/* Browser Controls */}
            <Card glass>
                <CardContent className="p-3">
                    <form onSubmit={handleNavigate} className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-lg"
                                onClick={() => {
                                    setUrl('https://hijiribe.donmai.us')
                                    setInputUrl('https://hijiribe.donmai.us')
                                }}
                            >
                                <Home className="h-4 w-4" />
                            </Button>
                            {isBrowserOpen && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg text-destructive"
                                    onClick={closeBrowser}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="flex-1 relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={inputUrl}
                                onChange={(e) => setInputUrl(e.target.value)}
                                placeholder={t('web.urlPlaceholder')}
                                className="pl-10 h-9 text-sm rounded-xl"
                            />
                        </div>

                        <Button
                            type="submit"
                            size="sm"
                            className="rounded-xl px-4"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <ExternalLink className="h-4 w-4 mr-1" />
                                    {t('web.open')}
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Quick Links */}
            <div className="flex flex-wrap gap-2 items-center">
                {quickLinks.map((link, index) => (
                    <div key={`${link.name}-${index}`} className="relative group">
                        <Button
                            variant="outline"
                            size="sm"
                            className={`text-sm rounded-xl ${isEditMode ? 'pr-8' : ''}`}
                            onClick={() => handleQuickLink(link.url)}
                            disabled={isLoading}
                        >
                            <Globe className="h-3 w-3 mr-1.5" />
                            {link.name}
                        </Button>
                        {isEditMode && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0 hover:bg-destructive/80"
                                onClick={() => removeQuickLink(index)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                ))}

                {/* Add button */}
                <Button
                    variant="outline"
                    size="sm"
                    className="text-sm rounded-xl"
                    onClick={() => setIsAddDialogOpen(true)}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    {t('web.add')}
                </Button>

                {/* Edit mode toggle */}
                <Button
                    variant={isEditMode ? "destructive" : "ghost"}
                    size="sm"
                    className="text-sm rounded-xl"
                    onClick={() => setIsEditMode(!isEditMode)}
                >
                    <Edit className="h-3 w-3 mr-1" />
                    {isEditMode ? t('web.done') : t('web.edit')}
                </Button>

                {isBrowserOpen && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="text-sm rounded-xl ml-auto"
                        onClick={closeBrowser}
                    >
                        <X className="h-3 w-3 mr-1.5" />
                        {t('web.close')}
                    </Button>
                )}
            </div>

            {/* Browser Area */}
            <div
                ref={browserAreaRef}
                className="flex-1 rounded-xl overflow-hidden relative min-h-[400px]"
                style={{ backgroundColor: isBrowserOpen ? 'transparent' : undefined }}
            >
                {!isBrowserOpen && (
                    <Card glass className="h-full">
                        <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
                            <Globe className="h-16 w-16 text-muted-foreground/50 mb-4" />
                            <h2 className="text-xl font-semibold mb-2">
                                {t('web.title')}
                            </h2>
                            <p className="text-muted-foreground max-w-md">
                                {t('web.description')}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Add Quick Link Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('web.addLink')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('web.linkName')}</label>
                            <Input
                                value={newLinkName}
                                onChange={(e) => setNewLinkName(e.target.value)}
                                placeholder={t('web.linkNamePlaceholder')}
                                className="rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('web.linkUrl')}</label>
                            <Input
                                value={newLinkUrl}
                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                placeholder={t('web.linkUrlPlaceholder')}
                                className="rounded-xl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={addQuickLink} className="rounded-xl" disabled={!newLinkName.trim() || !newLinkUrl.trim()}>
                            {t('web.add')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
