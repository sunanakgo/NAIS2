import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CharacterPrompt {
    id: string
    prompt: string        // Character-specific tags
    negative: string      // Character-specific negative tags
    enabled: boolean
    position: { x: number, y: number }  // 0-1 coordinates (0,0 = top-left, 1,1 = bottom-right)
}

interface CharacterPromptState {
    characters: CharacterPrompt[]
    addCharacter: (initialData?: Partial<CharacterPrompt>) => void
    updateCharacter: (id: string, data: Partial<CharacterPrompt>) => void
    removeCharacter: (id: string) => void
    setPosition: (id: string, x: number, y: number) => void
    toggleEnabled: (id: string) => void
    clearAll: () => void
}

// Color palette for character markers (up to 6 characters)
export const CHARACTER_COLORS = [
    '#22c55e', // Green
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#f59e0b', // Amber
    '#a855f7', // Purple
    '#06b6d4', // Cyan
]

export interface CharacterPreset {
    id: string
    name: string
    prompt: string
    negative: string
    image?: string // Base64 or URL
}

export interface CharacterPrompt {
    id: string
    presetId?: string // Link to origin preset
    prompt: string        // Character-specific tags
    negative: string      // Character-specific negative tags
    enabled: boolean
    position: { x: number, y: number }  // 0-1 coordinates (0,0 = top-left, 1,1 = bottom-right)
}

interface CharacterPromptState {
    characters: CharacterPrompt[]
    presets: CharacterPreset[]

    // Active Characters (Stage)
    addCharacter: (initialData?: Partial<CharacterPrompt>) => void
    updateCharacter: (id: string, data: Partial<CharacterPrompt>) => void
    removeCharacter: (id: string) => void
    setPosition: (id: string, x: number, y: number) => void
    toggleEnabled: (id: string) => void
    clearAll: () => void

    // Presets (Library)
    addPreset: (data: Partial<CharacterPreset> & Omit<CharacterPreset, 'id'>) => void
    updatePreset: (id: string, data: Partial<CharacterPreset>) => void
    deletePreset: (id: string) => void
    importFromStart: (presetId: string) => void // Add preset to stage
}

export const useCharacterPromptStore = create<CharacterPromptState>()(
    persist(
        (set) => ({
            characters: [],
            presets: [],

            addCharacter: (initialData?: Partial<CharacterPrompt>) => {
                const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
                set(state => ({
                    characters: [
                        ...state.characters,
                        {
                            id: newId,
                            prompt: '',
                            negative: '',
                            enabled: true,
                            position: { x: 0.5, y: 0.5 }, // Center by default
                            ...initialData
                        }
                    ]
                }))
            },

            updateCharacter: (id, data) => {
                set(state => ({
                    characters: state.characters.map(char =>
                        char.id === id ? { ...char, ...data } : char
                    )
                }))
            },

            removeCharacter: (id) => {
                set(state => ({
                    characters: state.characters.filter(char => char.id !== id)
                }))
            },

            setPosition: (id, x, y) => {
                // Clamp values to 0-1 range
                const clampedX = Math.max(0, Math.min(1, x))
                const clampedY = Math.max(0, Math.min(1, y))
                set(state => ({
                    characters: state.characters.map(char =>
                        char.id === id ? { ...char, position: { x: clampedX, y: clampedY } } : char
                    )
                }))
            },

            toggleEnabled: (id) => {
                set(state => ({
                    characters: state.characters.map(char =>
                        char.id === id ? { ...char, enabled: !char.enabled } : char
                    )
                }))
            },

            clearAll: () => set({ characters: [] }),

            // Preset Actions
            addPreset: (data) => {
                const newId = data.id || (Date.now().toString() + Math.random().toString(36).substr(2, 9))
                set(state => ({
                    presets: [...state.presets, { ...data, id: newId } as CharacterPreset]
                }))
            },

            updatePreset: (id, data) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === id ? { ...p, ...data } : p
                    )
                }))
            },

            deletePreset: (id) => {
                set(state => ({
                    presets: state.presets.filter(p => p.id !== id)
                }))
            },

            importFromStart: (presetId) => {
                set(state => {
                    const preset = state.presets.find(p => p.id === presetId)
                    if (!preset) return state

                    // Check if already exists? Maybe allow duplicates for twins etc.
                    // For now, allow duplicates.

                    const newId = Date.now().toString() + Math.random().toString(36).substr(2, 9)
                    return {
                        characters: [
                            ...state.characters,
                            {
                                id: newId,
                                presetId: preset.id,
                                prompt: preset.prompt,
                                negative: preset.negative,
                                enabled: true,
                                position: { x: 0.5, y: 0.5 }
                            }
                        ]
                    }
                })
            }
        }),
        {
            name: 'nais2-character-prompts',
            version: 1 // Increment version if needed for migration logic handling in persist (optional)
        }
    )
)
