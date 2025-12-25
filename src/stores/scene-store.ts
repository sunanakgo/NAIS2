import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SceneImage {
    id: string
    url: string  // data:image/png;base64,... format
    timestamp: number
    isFavorite: boolean
}

export interface SceneCard {
    id: string
    name: string
    scenePrompt: string
    queueCount: number  // Number of images to generate
    images: SceneImage[]  // Generated images for this scene
    width?: number
    height?: number
    createdAt: number
}

export interface ScenePreset {
    id: string
    name: string
    scenes: SceneCard[]
    createdAt: number
}

interface SceneState {
    presets: ScenePreset[]
    activePresetId: string | null

    // Actions - Presets
    addPreset: (name: string) => void
    deletePreset: (id: string) => void
    renamePreset: (id: string, name: string) => void
    setActivePreset: (id: string) => void
    getActivePreset: () => ScenePreset | undefined

    // Actions - Scenes
    addScene: (presetId: string, name?: string) => void
    deleteScene: (presetId: string, sceneId: string) => void
    duplicateScene: (presetId: string, sceneId: string) => void
    renameScene: (presetId: string, sceneId: string, name: string) => void
    updateScenePrompt: (presetId: string, sceneId: string, prompt: string) => void
    updateSceneSettings: (presetId: string, sceneId: string, settings: { width?: number, height?: number }) => void
    updateAllScenesResolution: (presetId: string, width: number, height: number) => void
    reorderScenes: (presetId: string, scenes: SceneCard[]) => void
    getScene: (presetId: string, sceneId: string) => SceneCard | undefined

    // Actions - Queue
    setQueueCount: (presetId: string, sceneId: string, count: number) => void
    incrementQueue: (presetId: string, sceneId: string) => void
    decrementQueue: (presetId: string, sceneId: string) => void
    addAllToQueue: (presetId: string, count?: number) => void
    clearAllQueue: (presetId: string) => void
    getTotalQueueCount: (presetId: string) => number
    getQueuedScenes: (presetId: string) => SceneCard[]

    // Actions - Images
    addImageToScene: (presetId: string, sceneId: string, imageUrl: string) => void
    toggleFavorite: (presetId: string, sceneId: string, imageId: string) => void
    deleteImage: (presetId: string, sceneId: string, imageId: string) => void
    getSceneThumbnail: (scene: SceneCard) => string | undefined

    // Actions - Generation
    decrementFirstQueuedScene: (presetId: string) => SceneCard | null

    // Generation Status
    isGenerating: boolean
    setIsGenerating: (isGenerating: boolean) => void

    // Streaming State
    streamingSceneId: string | null
    streamingImage: string | null
    streamingProgress: number
    setStreamingData: (sceneId: string | null, image: string | null, progress: number) => void

    // History Refresh Trigger
    historyRefreshTrigger: number
    triggerHistoryRefresh: () => void

    // File Management
    importPreset: (preset: ScenePreset) => void
    validateSceneImages: (presetId: string, sceneId: string, validImageIds: string[]) => void

    // Multi-Select / Edit Mode
    isEditMode: boolean
    selectedSceneIds: string[]
    setEditMode: (isEdit: boolean) => void
    toggleSceneSelection: (sceneId: string, clearOthers?: boolean) => void
    selectSceneRange: (fromId: string, toId: string) => void
    selectAllScenes: () => void
    clearSelection: () => void
    deleteSelectedScenes: () => void
    moveSelectedScenesToPreset: (targetPresetId: string) => void
    updateSelectedScenesResolution: (width: number, height: number) => void
    lastSelectedSceneId: string | null
    setLastSelectedSceneId: (id: string | null) => void

    // Generation Progress
    completedCount: number
    totalQueuedCount: number
    setGenerationProgress: (completed: number, total: number) => void
    initGenerationProgress: () => void

    // Grid Layout
    gridColumns: number
    setGridColumns: (columns: number) => void
}

const DEFAULT_PRESET_ID = 'scene-default'

const createDefaultPreset = (): ScenePreset => ({
    id: DEFAULT_PRESET_ID,
    name: '기본',
    scenes: [],
    createdAt: Date.now(),
})

export const useSceneStore = create<SceneState>()(
    persist(
        (set, get) => ({
            presets: [createDefaultPreset()],
            activePresetId: DEFAULT_PRESET_ID,

            // Preset Actions
            addPreset: (name) => {
                const newPreset: ScenePreset = {
                    id: Date.now().toString(),
                    name,
                    scenes: [],
                    createdAt: Date.now(),
                }
                set(state => ({
                    presets: [...state.presets, newPreset],
                    activePresetId: newPreset.id,
                }))
            },

            deletePreset: (id) => {
                if (id === DEFAULT_PRESET_ID) return
                const wasActive = get().activePresetId === id
                set(state => ({
                    presets: state.presets.filter(p => p.id !== id),
                    activePresetId: wasActive ? DEFAULT_PRESET_ID : state.activePresetId,
                }))
            },

            renamePreset: (id, name) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === id ? { ...p, name } : p
                    ),
                }))
            },

            setActivePreset: (id) => set({ activePresetId: id }),

            getActivePreset: () => {
                return get().presets.find(p => p.id === get().activePresetId)
            },

            // Scene Actions
            addScene: (presetId, name) => {
                set(state => ({
                    presets: state.presets.map(p => {
                        if (p.id !== presetId) return p
                        const newScene: SceneCard = {
                            id: Date.now().toString(),
                            name: name || `씬 ${p.scenes.length + 1}`,
                            scenePrompt: '',
                            queueCount: 0,
                            images: [],
                            createdAt: Date.now(),
                        }
                        return { ...p, scenes: [...p.scenes, newScene] }
                    }),
                }))
            },

            deleteScene: (presetId, sceneId) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? { ...p, scenes: p.scenes.filter(s => s.id !== sceneId) }
                            : p
                    ),
                }))
            },

            duplicateScene: (presetId, sceneId) => {
                set(state => ({
                    presets: state.presets.map(p => {
                        if (p.id !== presetId) return p
                        const scene = p.scenes.find(s => s.id === sceneId)
                        if (!scene) return p
                        const duplicated: SceneCard = {
                            ...scene,
                            id: Date.now().toString(),
                            name: `${scene.name} (복사본)`,
                            queueCount: 0,
                            images: [],
                            createdAt: Date.now(),
                        }
                        const index = p.scenes.findIndex(s => s.id === sceneId)
                        const newScenes = [...p.scenes]
                        newScenes.splice(index + 1, 0, duplicated)
                        return { ...p, scenes: newScenes }
                    }),
                }))
            },

            renameScene: (presetId, sceneId, name) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId ? { ...s, name } : s
                                ),
                            }
                            : p
                    ),
                }))
            },

            updateScenePrompt: (presetId, sceneId, prompt) => set((state) => ({
                presets: state.presets.map((preset) =>
                    preset.id === presetId
                        ? {
                            ...preset,
                            scenes: preset.scenes.map((scene) =>
                                scene.id === sceneId ? { ...scene, scenePrompt: prompt } : scene
                            ),
                        }
                        : preset
                ),
            })),
            updateSceneSettings: (presetId, sceneId, settings) => set((state) => ({
                presets: state.presets.map((preset) =>
                    preset.id === presetId
                        ? {
                            ...preset,
                            scenes: preset.scenes.map((scene) =>
                                scene.id === sceneId ? { ...scene, ...settings } : scene
                            ),
                        }
                        : preset
                ),
            })),
            updateAllScenesResolution: (presetId, width, height) => set((state) => ({
                presets: state.presets.map((preset) =>
                    preset.id === presetId
                        ? {
                            ...preset,
                            scenes: preset.scenes.map((scene) => ({
                                ...scene,
                                width,
                                height
                            })),
                        }
                        : preset
                ),
            })),
            reorderScenes: (presetId, scenes) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId ? { ...p, scenes } : p
                    ),
                }))
            },

            getScene: (presetId, sceneId) => {
                const preset = get().presets.find(p => p.id === presetId)
                return preset?.scenes.find(s => s.id === sceneId)
            },

            // Queue Actions
            setQueueCount: (presetId, sceneId, count) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId ? { ...s, queueCount: Math.max(0, count) } : s
                                ),
                            }
                            : p
                    ),
                }))
            },

            incrementQueue: (presetId, sceneId) => {
                const preset = get().presets.find(p => p.id === presetId)
                const scene = preset?.scenes.find(s => s.id === sceneId)
                if (scene) {
                    get().setQueueCount(presetId, sceneId, scene.queueCount + 1)
                }
            },

            decrementQueue: (presetId, sceneId) => {
                const preset = get().presets.find(p => p.id === presetId)
                const scene = preset?.scenes.find(s => s.id === sceneId)
                if (scene && scene.queueCount > 0) {
                    get().setQueueCount(presetId, sceneId, scene.queueCount - 1)
                }
            },

            addAllToQueue: (presetId, count = 1) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s => ({ ...s, queueCount: s.queueCount + count })),
                            }
                            : p
                    ),
                }))
            },

            clearAllQueue: (presetId) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s => ({ ...s, queueCount: 0 })),
                            }
                            : p
                    ),
                }))
            },

            getTotalQueueCount: (presetId) => {
                const preset = get().presets.find(p => p.id === presetId)
                return preset?.scenes.reduce((sum, s) => sum + s.queueCount, 0) || 0
            },

            getQueuedScenes: (presetId) => {
                const preset = get().presets.find(p => p.id === presetId)
                return preset?.scenes.filter(s => s.queueCount > 0) || []
            },

            // Image Actions
            addImageToScene: (presetId, sceneId, imageUrl) => {
                const newImage: SceneImage = {
                    id: Date.now().toString(),
                    url: imageUrl,
                    timestamp: Date.now(),
                    isFavorite: false,
                }
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? { ...s, images: [newImage, ...s.images] }
                                        : s
                                ),
                            }
                            : p
                    ),
                }))
                // Trigger history refresh after adding image
                get().triggerHistoryRefresh()
            },

            toggleFavorite: (presetId, sceneId, imageId) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? {
                                            ...s,
                                            images: s.images.map(img =>
                                                img.id === imageId
                                                    ? { ...img, isFavorite: !img.isFavorite }
                                                    : img
                                            ),
                                        }
                                        : s
                                ),
                            }
                            : p
                    ),
                }))
            },

            deleteImage: (presetId, sceneId, imageId) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? { ...s, images: s.images.filter(img => img.id !== imageId) }
                                        : s
                                ),
                            }
                            : p
                    ),
                }))
            },

            getSceneThumbnail: (scene) => {
                // Priority: favorite > newest
                const favorite = scene.images.find(img => img.isFavorite)
                if (favorite) return favorite.url
                if (scene.images.length > 0) return scene.images[0].url
                return undefined
            },

            // Generation Actions
            decrementFirstQueuedScene: (presetId) => {
                const preset = get().presets.find(p => p.id === presetId)
                if (!preset) return null

                const queuedScene = preset.scenes.find(s => s.queueCount > 0)
                if (!queuedScene) return null

                get().setQueueCount(presetId, queuedScene.id, queuedScene.queueCount - 1)
                return queuedScene
            },

            isGenerating: false,
            setIsGenerating: (isGenerating) => set({ isGenerating }),

            streamingSceneId: null,
            streamingImage: null,
            streamingProgress: 0,
            setStreamingData: (sceneId, image, progress) => set({
                streamingSceneId: sceneId,
                streamingImage: image,
                streamingProgress: progress
            }),

            // History Refresh Trigger
            historyRefreshTrigger: 0,
            triggerHistoryRefresh: () => set(state => ({ historyRefreshTrigger: state.historyRefreshTrigger + 1 })),

            // File Management Actions
            importPreset: (jsonContent: any) => {
                set(state => {
                    let newName = "Imported Preset"
                    let newScenes: SceneCard[] = []

                    // 1. Detect Format

                    // Case A: Legacy Array Format (scene_preset_export.json)
                    if (Array.isArray(jsonContent)) {
                        newName = `Legacy Import ${new Date().toLocaleDateString()}`
                        newScenes = jsonContent.map((item: any) => ({
                            id: crypto.randomUUID(),
                            name: item.scene_name || "Untitled Scene",
                            scenePrompt: item.scene_prompt || "",
                            queueCount: 0,
                            images: [], // Legacy images not imported automatically
                            createdAt: Date.now()
                        }))
                    }
                    // Case B: Interaction Share Format (상호작용공유용.json) - New Logic
                    else if (jsonContent.scenes && !Array.isArray(jsonContent.scenes) && typeof jsonContent.scenes === 'object') {
                        newName = jsonContent.name || "Interaction Share"
                        const sceneMap = jsonContent.scenes

                        // Helper to generate prompt combinations
                        const generatePrompts = (slots: any[][]): string[] => {
                            if (slots.length === 0) return [""]

                            const firstSlot = slots[0] || []
                            const enabledItems = firstSlot.filter((item: any) => item.enabled)
                            const remainingPrompts = generatePrompts(slots.slice(1))

                            if (enabledItems.length === 0) return remainingPrompts

                            const results: string[] = []
                            for (const item of enabledItems) {
                                for (const nextPrompt of remainingPrompts) {
                                    const current = item.prompt || ""
                                    // simple join
                                    const combined = nextPrompt ? `${current}, ${nextPrompt}` : current
                                    results.push(combined)
                                }
                            }
                            return results
                        }

                        Object.values(sceneMap).forEach((sceneData: any) => {
                            if (sceneData.slots && Array.isArray(sceneData.slots)) {
                                const combinations = generatePrompts(sceneData.slots)
                                combinations.forEach((fullPrompt, index) => {
                                    // If there are multiple variations, append index to name
                                    const suffix = combinations.length > 1 ? `_${index + 1}` : ""

                                    newScenes.push({
                                        id: crypto.randomUUID(),
                                        name: (sceneData.name || "Untitled") + suffix,
                                        scenePrompt: fullPrompt,
                                        queueCount: 0,
                                        images: [],
                                        createdAt: Date.now()
                                    })
                                })
                            }
                        })
                    }
                    // Case C: SDImageGenEasy Presets (Fallback if 'scenes' object missing but has presets)
                    else if (jsonContent.presets && jsonContent.presets.SDImageGenEasy) {
                        // ... (Existing logic for SDImageGenEasy if needed, or remove if B covers it)
                        // Keeping it as fallback for files that might only have presets
                        newName = jsonContent.name || "Interaction Share (Presets)"
                        const presets = jsonContent.presets.SDImageGenEasy
                        if (Array.isArray(presets)) {
                            newScenes = presets.map((item: any) => {
                                const promptParts = []
                                if (item.frontPrompt) promptParts.push(item.frontPrompt)
                                if (item.backPrompt) promptParts.push(item.backPrompt)
                                return {
                                    id: crypto.randomUUID(),
                                    name: item.name || "Untitled",
                                    scenePrompt: promptParts.join(", "),
                                    queueCount: 0,
                                    images: [],
                                    createdAt: Date.now()
                                }
                            })
                        }
                    }
                    // Case D: Standard ScenePreset Format (NAIS2)
                    else if (jsonContent.scenes && Array.isArray(jsonContent.scenes)) {
                        newName = jsonContent.name || "Use Preset"
                        newScenes = jsonContent.scenes.map((s: any) => ({
                            ...s,
                            id: s.id || crypto.randomUUID(), // Ensure ID exists
                            images: s.images || []
                        }))
                        // If importing a full preset object, try to preserve its ID if unique, otherwise gen new
                        if (jsonContent.id && !state.presets.some(p => p.id === jsonContent.id)) {
                            // ID is unique, use it? No, safer to always generate new ID for imported stuff to avoid conflicts later
                        }
                    } else {
                        console.error("Unknown preset format", jsonContent)
                        return state // No change
                    }

                    if (newScenes.length === 0) {
                        console.warn("No scenes found in import")
                        return state
                    }

                    // Create the new preset
                    const newPreset: ScenePreset = {
                        id: Date.now().toString(), // Generate new ID
                        name: newName,
                        scenes: newScenes,
                        createdAt: Date.now()
                    }

                    // Check for name collision
                    let nameSuffix = 1
                    while (state.presets.some(p => p.name === newPreset.name)) {
                        newPreset.name = `${newName} (${nameSuffix++})`
                    }

                    return {
                        presets: [...state.presets, newPreset],
                        activePresetId: newPreset.id // Switch to imported preset
                    }
                })
            },

            exportPreset: () => {
                // Implementation moved to UI component (SceneMode.tsx) for file saving
            },

            validateSceneImages: (presetId, sceneId, validImageIds) => {
                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === presetId
                            ? {
                                ...p,
                                scenes: p.scenes.map(s =>
                                    s.id === sceneId
                                        ? { ...s, images: s.images.filter(img => validImageIds.includes(img.id)) }
                                        : s
                                )
                            }
                            : p
                    )
                }))
            },

            // Multi-Select / Edit Mode Implementation
            isEditMode: false,
            selectedSceneIds: [],
            lastSelectedSceneId: null,

            setEditMode: (isEdit) => set({
                isEditMode: isEdit,
                selectedSceneIds: isEdit ? [] : [],
                lastSelectedSceneId: null
            }),

            toggleSceneSelection: (sceneId, clearOthers = true) => set(state => {
                const isSelected = state.selectedSceneIds.includes(sceneId)
                let newSelection: string[]

                if (clearOthers) {
                    // Single click - toggle single selection
                    newSelection = isSelected ? [] : [sceneId]
                } else {
                    // Ctrl+click - toggle in multi-select
                    newSelection = isSelected
                        ? state.selectedSceneIds.filter(id => id !== sceneId)
                        : [...state.selectedSceneIds, sceneId]
                }

                return {
                    selectedSceneIds: newSelection,
                    lastSelectedSceneId: sceneId
                }
            }),

            selectSceneRange: (fromId, toId) => set(state => {
                const preset = state.presets.find(p => p.id === state.activePresetId)
                if (!preset) return state

                const fromIndex = preset.scenes.findIndex(s => s.id === fromId)
                const toIndex = preset.scenes.findIndex(s => s.id === toId)

                if (fromIndex === -1 || toIndex === -1) return state

                const start = Math.min(fromIndex, toIndex)
                const end = Math.max(fromIndex, toIndex)

                const rangeIds = preset.scenes.slice(start, end + 1).map(s => s.id)

                // Merge with existing selection
                const newSelection = [...new Set([...state.selectedSceneIds, ...rangeIds])]

                return {
                    selectedSceneIds: newSelection,
                    lastSelectedSceneId: toId
                }
            }),

            selectAllScenes: () => set(state => {
                const preset = state.presets.find(p => p.id === state.activePresetId)
                if (!preset) return state
                return { selectedSceneIds: preset.scenes.map(s => s.id) }
            }),

            clearSelection: () => set({ selectedSceneIds: [], lastSelectedSceneId: null }),

            setLastSelectedSceneId: (id) => set({ lastSelectedSceneId: id }),

            deleteSelectedScenes: () => set(state => {
                const preset = state.presets.find(p => p.id === state.activePresetId)
                if (!preset) return state

                return {
                    presets: state.presets.map(p =>
                        p.id === state.activePresetId
                            ? { ...p, scenes: p.scenes.filter(s => !state.selectedSceneIds.includes(s.id)) }
                            : p
                    ),
                    selectedSceneIds: [],
                    lastSelectedSceneId: null
                }
            }),

            moveSelectedScenesToPreset: (targetPresetId) => set(state => {
                const sourcePreset = state.presets.find(p => p.id === state.activePresetId)
                if (!sourcePreset || targetPresetId === state.activePresetId) return state

                const scenesToMove = sourcePreset.scenes.filter(s => state.selectedSceneIds.includes(s.id))
                if (scenesToMove.length === 0) return state

                return {
                    presets: state.presets.map(p => {
                        if (p.id === state.activePresetId) {
                            // Remove from source
                            return { ...p, scenes: p.scenes.filter(s => !state.selectedSceneIds.includes(s.id)) }
                        }
                        if (p.id === targetPresetId) {
                            // Add to target
                            return { ...p, scenes: [...p.scenes, ...scenesToMove] }
                        }
                        return p
                    }),
                    selectedSceneIds: [],
                    lastSelectedSceneId: null
                }
            }),

            updateSelectedScenesResolution: (width, height) => set(state => ({
                presets: state.presets.map(p =>
                    p.id === state.activePresetId
                        ? {
                            ...p,
                            scenes: p.scenes.map(s =>
                                state.selectedSceneIds.includes(s.id)
                                    ? { ...s, width, height }
                                    : s
                            )
                        }
                        : p
                )
            })),

            // Generation Progress Implementation
            completedCount: 0,
            totalQueuedCount: 0,

            setGenerationProgress: (completed, total) => set({
                completedCount: completed,
                totalQueuedCount: total
            }),

            initGenerationProgress: () => set(state => {
                const total = state.activePresetId ? state.presets.find(p => p.id === state.activePresetId)?.scenes.reduce((sum, s) => sum + s.queueCount, 0) || 0 : 0
                return {
                    completedCount: 0,
                    totalQueuedCount: total
                }
            }),

            // Grid Layout
            gridColumns: 4,
            setGridColumns: (columns) => set({ gridColumns: columns }),
        }),
        {
            name: 'nais2-scenes',
            onRehydrateStorage: () => (state) => {
                if (state && !state.presets.find(p => p.id === DEFAULT_PRESET_ID)) {
                    state.presets = [createDefaultPreset(), ...state.presets]
                }
                if (state && !state.activePresetId) {
                    state.activePresetId = DEFAULT_PRESET_ID
                }
            },
        }
    )
)
