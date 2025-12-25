
import { create } from 'zustand'

interface ToolsState {
    activeImage: string | null
    setActiveImage: (image: string | null) => void
}

export const useToolsStore = create<ToolsState>((set) => ({
    activeImage: null,
    setActiveImage: (image) => set({ activeImage: image }),
}))
