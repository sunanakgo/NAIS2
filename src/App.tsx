import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThreeColumnLayout } from '@/components/layout/ThreeColumnLayout'
import { Toaster } from '@/components/ui/toaster'
import { useSceneGeneration } from '@/hooks/useSceneGeneration'
import MainMode from '@/pages/MainMode'
import SceneMode from '@/pages/SceneMode'
import SceneDetail from '@/pages/SceneDetail'
import WebView from '@/pages/WebView'
import Library from '@/pages/Library'
import Settings from '@/pages/Settings'
import ToolsMode from '@/pages/ToolsMode'

function App() {
    // Scene generation hook at App level - persists across page navigation
    useSceneGeneration()

    return (
        <BrowserRouter>
            <ThreeColumnLayout>
                <Routes>
                    <Route path="/" element={<MainMode />} />
                    <Route path="/scenes" element={<SceneMode />} />
                    <Route path="/scenes/:id" element={<SceneDetail />} />
                    <Route path="/tools" element={<ToolsMode />} />
                    <Route path="/web" element={<WebView />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </ThreeColumnLayout>
            <Toaster />
        </BrowserRouter>
    )
}

export default App
