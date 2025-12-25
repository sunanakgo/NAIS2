import { ReactNode, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    ImagePlus,
    Film,
    Images,
    Settings,
    ChevronLeft,
    Sparkles,
} from 'lucide-react'

interface MainLayoutProps {
    children: ReactNode
}

const navItems = [
    { path: '/', icon: LayoutDashboard, label: '대시보드' },
    { path: '/generate', icon: ImagePlus, label: '이미지 생성' },
    { path: '/scenes', icon: Film, label: '씬 모드' },
    { path: '/library', icon: Images, label: '라이브러리' },
    { path: '/settings', icon: Settings, label: '설정' },
]

export function MainLayout({ children }: MainLayoutProps) {
    const [collapsed, setCollapsed] = useState(false)
    const location = useLocation()

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    'flex flex-col border-r border-border bg-card/50 backdrop-blur-sm transition-all duration-300',
                    collapsed ? 'w-16' : 'w-56'
                )}
            >
                {/* Logo */}
                <div className="flex h-14 items-center justify-between border-b border-border px-4">
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-6 w-6 text-primary" />
                            <span className="text-lg font-bold text-gradient">NAIS2</span>
                        </div>
                    )}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors',
                            collapsed && 'mx-auto'
                        )}
                    >
                        <ChevronLeft
                            className={cn(
                                'h-4 w-4 text-muted-foreground transition-transform',
                                collapsed && 'rotate-180'
                            )}
                        />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 space-y-1 p-2">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                                    'hover:bg-muted',
                                    isActive
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground',
                                    collapsed && 'justify-center px-2'
                                )}
                            >
                                <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
                                {!collapsed && <span>{item.label}</span>}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* Footer */}
                <div className="border-t border-border p-3">
                    {!collapsed && (
                        <div className="text-xs text-muted-foreground text-center">
                            NAIS2 v0.1.0
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <div className="h-full overflow-y-auto p-6">
                    {children}
                </div>
            </main>
        </div>
    )
}
