import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LayoutState {
    leftSidebarVisible: boolean
    rightSidebarVisible: boolean
    toggleLeftSidebar: () => void
    toggleRightSidebar: () => void
    setLeftSidebarVisible: (visible: boolean) => void
    setRightSidebarVisible: (visible: boolean) => void
}

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            leftSidebarVisible: true,
            rightSidebarVisible: true,
            toggleLeftSidebar: () => set((state) => ({ leftSidebarVisible: !state.leftSidebarVisible })),
            toggleRightSidebar: () => set((state) => ({ rightSidebarVisible: !state.rightSidebarVisible })),
            setLeftSidebarVisible: (visible) => set({ leftSidebarVisible: visible }),
            setRightSidebarVisible: (visible) => set({ rightSidebarVisible: visible }),
        }),
        {
            name: 'nais2-layout',
        }
    )
)
