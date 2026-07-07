import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout'
import { Toaster } from '@/components/ui/toaster'
import { Nais3MigrationDialog } from '@/components/Nais3MigrationDialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSceneGeneration } from '@/hooks/useSceneGeneration'
import { useUpdateChecker } from '@/hooks/useUpdateChecker'
import { useShortcuts } from '@/hooks/useShortcuts'
import MainMode from '@/pages/MainMode'
import SceneMode from '@/pages/SceneMode'
import SceneDetail from '@/pages/SceneDetail'
import WebView from '@/pages/WebView'
import Library from '@/pages/Library'
import Settings from '@/pages/Settings'
import ToolsMode from '@/pages/ToolsMode'
import Marketplace from '@/pages/Marketplace'
import MarketplaceDetail from '@/pages/MarketplaceDetail'
import { useMarketAuthStore } from '@/stores/market-auth-store'

function AppContent() {
    // Scene generation hook at App level - persists across page navigation
    useSceneGeneration()
    useUpdateChecker()
    useShortcuts()

    // Initialize marketplace auth on app mount
    const initMarketAuth = useMarketAuthStore(s => s.init)
    useEffect(() => {
        initMarketAuth()
    }, [initMarketAuth])

    // Disable right-click globally except for allowed elements
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            // Check if the target or any parent has data-allow-context-menu attribute
            let element = e.target as HTMLElement | null
            while (element) {
                if (element.hasAttribute('data-allow-context-menu')) {
                    return // Allow context menu
                }
                element = element.parentElement
            }
            e.preventDefault() // Block context menu
        }

        document.addEventListener('contextmenu', handleContextMenu)
        return () => document.removeEventListener('contextmenu', handleContextMenu)
    }, [])

    return (
        <ThreeColumnLayout>
            <Routes>
                <Route path="/" element={<MainMode />} />
                <Route path="/scenes" element={<SceneMode />} />
                <Route path="/scenes/:id" element={<SceneDetail />} />
                <Route path="/tools" element={<ToolsMode />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/marketplace/:id" element={<MarketplaceDetail />} />
                <Route path="/web" element={<WebView />} />
                <Route path="/library" element={<Library />} />
                <Route path="/settings" element={<Settings />} />
            </Routes>
        </ThreeColumnLayout>
    )
}

function App() {
    return (
        <TooltipProvider delayDuration={300}>
            <BrowserRouter>
                <AppContent />
                <Toaster />
                <Nais3MigrationDialog />
            </BrowserRouter>
        </TooltipProvider>
    )
}

export default App
