import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CustomResolution {
    id: string
    label: string
    width: number
    height: number
}

interface SettingsState {
    // Save settings
    savePath: string
    autoSave: boolean

    // Custom resolution presets
    customResolutions: CustomResolution[]

    // UI settings
    promptFontSize: number

    // Generation settings
    useStreaming: boolean  // Use streaming API for image generation

    // Gemini API settings
    geminiApiKey: string

    // Actions
    setSavePath: (path: string) => void
    setAutoSave: (autoSave: boolean) => void
    addCustomResolution: (resolution: Omit<CustomResolution, 'id'>) => void
    removeCustomResolution: (id: string) => void
    setPromptFontSize: (size: number) => void
    setUseStreaming: (useStreaming: boolean) => void
    setGeminiApiKey: (key: string) => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            savePath: 'NAIS_Output',
            autoSave: true,
            customResolutions: [],
            promptFontSize: 16, // Default text-base equivalent approximately
            useStreaming: true, // Default: enabled
            geminiApiKey: '', // Default: empty

            setSavePath: (savePath) => set({ savePath }),
            setAutoSave: (autoSave) => set({ autoSave }),

            addCustomResolution: (resolution) => set((state) => ({
                customResolutions: [
                    ...state.customResolutions,
                    { ...resolution, id: Date.now().toString() }
                ]
            })),

            removeCustomResolution: (id) => set((state) => ({
                customResolutions: state.customResolutions.filter(r => r.id !== id)
            })),
            setPromptFontSize: (size) => set({ promptFontSize: size }),
            setUseStreaming: (useStreaming) => set({ useStreaming }),
            setGeminiApiKey: (key) => set({ geminiApiKey: key }),
        }),
        {
            name: 'nais2-settings',
        }
    )
)
