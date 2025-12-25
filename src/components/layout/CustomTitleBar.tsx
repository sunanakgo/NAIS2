import { useState, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PanelLeft, PanelRight, Minus, Square, X, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLayoutStore } from '@/stores/layout-store'

export function CustomTitleBar() {
    const [isMaximized, setIsMaximized] = useState(false)
    const appWindow = getCurrentWindow()

    const {
        leftSidebarVisible,
        rightSidebarVisible,
        toggleLeftSidebar,
        toggleRightSidebar
    } = useLayoutStore()

    useEffect(() => {
        appWindow.isMaximized().then(setIsMaximized)

        const unlisten = appWindow.onResized(async () => {
            setIsMaximized(await appWindow.isMaximized())
        })

        return () => {
            unlisten.then(fn => fn())
        }
    }, [appWindow])

    const handleMinimize = async () => {
        await appWindow.minimize()
    }

    const handleMaximize = async () => {
        await appWindow.toggleMaximize()
    }

    const handleClose = async () => {
        await appWindow.close()
    }

    const handleMouseDown = async (e: React.MouseEvent) => {
        // Only start dragging on single click, not double click
        if (e.button === 0 && e.detail === 1) {
            await appWindow.startDragging()
        }
    }

    const handleDoubleClick = async () => {
        await appWindow.toggleMaximize()
    }

    return (
        <div
            className="h-8 flex items-center justify-between bg-background select-none shrink-0"
        >
            {/* Drag Region */}
            <div
                className="flex-1 h-full cursor-default"
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
            />

            {/* Controls */}
            <div className="flex h-full">
                {/* Left Sidebar Toggle */}
                <button
                    onClick={toggleLeftSidebar}
                    className={cn(
                        "h-full w-10 flex items-center justify-center",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        "transition-colors",
                        !leftSidebarVisible && "text-muted-foreground/50"
                    )}
                    aria-label="Toggle Left Sidebar"
                    title="Toggle Left Sidebar"
                >
                    <PanelLeft className="h-4 w-4" />
                </button>

                {/* Right Sidebar Toggle */}
                <button
                    onClick={toggleRightSidebar}
                    className={cn(
                        "h-full w-10 flex items-center justify-center",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        "transition-colors",
                        !rightSidebarVisible && "text-muted-foreground/50"
                    )}
                    aria-label="Toggle Right Sidebar"
                    title="Toggle Right Sidebar"
                >
                    <PanelRight className="h-4 w-4" />
                </button>

                {/* Separator */}
                <div className="w-px h-4 my-auto bg-border/50 mx-1" />

                {/* Minimize */}
                <button
                    onClick={handleMinimize}
                    className={cn(
                        "h-full w-[46px] flex items-center justify-center",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-colors"
                    )}
                    aria-label="Minimize"
                >
                    <Minus className="h-4 w-4" />
                </button>

                {/* Maximize/Restore */}
                <button
                    onClick={handleMaximize}
                    className={cn(
                        "h-full w-[46px] flex items-center justify-center",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "transition-colors"
                    )}
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? <Maximize2 className="h-4 w-4" /> : <Square className="h-3.5 w-3.5" />}
                </button>

                {/* Close */}
                <button
                    onClick={handleClose}
                    className={cn(
                        "h-full w-[46px] flex items-center justify-center",
                        "text-muted-foreground hover:text-white hover:bg-red-500",
                        "transition-colors"
                    )}
                    aria-label="Close"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
