import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useGenerationStore } from './generation-store'

export const DEFAULT_PRESET_ID = 'default'

export interface Preset {
    id: string
    name: string
    createdAt: number
    isDefault?: boolean // Cannot be deleted

    // Prompts
    basePrompt: string
    additionalPrompt: string
    detailPrompt: string
    negativePrompt: string

    // Model & Settings
    model: string
    steps: number
    cfgScale: number
    cfgRescale: number
    sampler: string
    scheduler: string
    smea: boolean
    smeaDyn: boolean

    // Resolution
    selectedResolution: {
        label: string
        width: number
        height: number
    }
}

const createDefaultPreset = (): Preset => ({
    id: DEFAULT_PRESET_ID,
    name: '기본',
    createdAt: 0,
    isDefault: true,
    basePrompt: '',
    additionalPrompt: '',
    detailPrompt: '',
    negativePrompt: '',
    model: 'nai-diffusion-4-5-full',
    steps: 28,
    cfgScale: 5.0,
    cfgRescale: 0.0,
    sampler: 'k_euler_ancestral',
    scheduler: 'karras',
    smea: true,
    smeaDyn: true,
    selectedResolution: { label: 'Portrait', width: 832, height: 1216 },
})

interface PresetState {
    presets: Preset[]
    activePresetId: string

    // Actions
    addPreset: (name: string) => void
    deletePreset: (id: string) => void
    syncFromGenerationStore: () => void
    loadPreset: (id: string) => void
    renamePreset: (id: string, name: string) => void
    getActivePreset: () => Preset | undefined
}

export const usePresetStore = create<PresetState>()(
    persist(
        (set, get) => ({
            presets: [createDefaultPreset()],
            activePresetId: DEFAULT_PRESET_ID,

            addPreset: (name) => {
                // First sync current state to active preset
                get().syncFromGenerationStore()

                const newPreset: Preset = {
                    id: Date.now().toString(),
                    name,
                    createdAt: Date.now(),
                    // Blank values for new preset
                    basePrompt: '',
                    additionalPrompt: '',
                    detailPrompt: '',
                    negativePrompt: '',
                    model: 'nai-diffusion-4-5-full',
                    steps: 28,
                    cfgScale: 5.0,
                    cfgRescale: 0.0,
                    sampler: 'k_euler_ancestral',
                    scheduler: 'karras',
                    smea: true,
                    smeaDyn: true,
                    selectedResolution: { label: 'Portrait', width: 832, height: 1216 },
                }

                set(state => ({
                    presets: [...state.presets, newPreset],
                    activePresetId: newPreset.id
                }))

                // Apply blank preset to generation store
                const genStore = useGenerationStore.getState()
                genStore.setBasePrompt('')
                genStore.setAdditionalPrompt('')
                genStore.setDetailPrompt('')
                genStore.setNegativePrompt('')
                genStore.setModel('nai-diffusion-4-5-full')
                genStore.setSteps(28)
                genStore.setCfgScale(5.0)
                genStore.setCfgRescale(0.0)
                genStore.setSampler('k_euler_ancestral')
                genStore.setScheduler('karras')
                genStore.setSmea(true)
                genStore.setSmeaDyn(true)
                genStore.setSelectedResolution({ label: 'Portrait', width: 832, height: 1216 })
            },

            deletePreset: (id) => {
                // Cannot delete default preset
                const preset = get().presets.find(p => p.id === id)
                if (preset?.isDefault) return

                const wasActive = get().activePresetId === id

                set(state => ({
                    presets: state.presets.filter(p => p.id !== id),
                    activePresetId: wasActive ? DEFAULT_PRESET_ID : state.activePresetId
                }))

                // If deleted active, load default
                if (wasActive) {
                    get().loadPreset(DEFAULT_PRESET_ID)
                }
            },

            // Sync current generation-store values to active preset
            syncFromGenerationStore: () => {
                const activeId = get().activePresetId
                if (!activeId) return

                const genStore = useGenerationStore.getState()

                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === activeId
                            ? {
                                ...p,
                                basePrompt: genStore.basePrompt,
                                additionalPrompt: genStore.additionalPrompt,
                                detailPrompt: genStore.detailPrompt,
                                negativePrompt: genStore.negativePrompt,
                                model: genStore.model,
                                steps: genStore.steps,
                                cfgScale: genStore.cfgScale,
                                cfgRescale: genStore.cfgRescale,
                                sampler: genStore.sampler,
                                scheduler: genStore.scheduler,
                                smea: genStore.smea,
                                smeaDyn: genStore.smeaDyn,
                                selectedResolution: genStore.selectedResolution,
                            }
                            : p
                    )
                }))
            },

            loadPreset: (id) => {
                // First sync current state before switching
                if (get().activePresetId !== id) {
                    get().syncFromGenerationStore()
                }

                const preset = get().presets.find(p => p.id === id)
                if (!preset) return

                // Set active preset
                set({ activePresetId: id })

                // Load preset values into generation store
                const genStore = useGenerationStore.getState()
                genStore.setBasePrompt(preset.basePrompt)
                genStore.setAdditionalPrompt(preset.additionalPrompt)
                genStore.setDetailPrompt(preset.detailPrompt)
                genStore.setNegativePrompt(preset.negativePrompt)
                genStore.setModel(preset.model)
                genStore.setSteps(preset.steps)
                genStore.setCfgScale(preset.cfgScale)
                genStore.setCfgRescale(preset.cfgRescale)
                genStore.setSampler(preset.sampler)
                genStore.setScheduler(preset.scheduler)
                genStore.setSmea(preset.smea)
                genStore.setSmeaDyn(preset.smeaDyn)
                genStore.setSelectedResolution(preset.selectedResolution)
            },

            renamePreset: (id, name) => {
                // Cannot rename default preset
                const preset = get().presets.find(p => p.id === id)
                if (preset?.isDefault) return

                set(state => ({
                    presets: state.presets.map(p =>
                        p.id === id ? { ...p, name } : p
                    )
                }))
            },

            getActivePreset: () => {
                return get().presets.find(p => p.id === get().activePresetId)
            },
        }),
        {
            name: 'nais2-presets',
            // Ensure default preset exists on hydration
            onRehydrateStorage: () => (state) => {
                if (state && !state.presets.find(p => p.id === DEFAULT_PRESET_ID)) {
                    state.presets = [createDefaultPreset(), ...state.presets]
                }
                if (state && !state.activePresetId) {
                    state.activePresetId = DEFAULT_PRESET_ID
                }
            }
        }
    )
)

// ============================================
// Debounced Auto-Sync: generation-store → active preset
// ============================================

let syncTimeout: ReturnType<typeof setTimeout> | null = null
let isLoadingPreset = false

// Subscribe to generation-store changes
useGenerationStore.subscribe((state, prevState) => {
    if (isLoadingPreset) return

    const fieldsToWatch = [
        'basePrompt', 'additionalPrompt', 'detailPrompt', 'negativePrompt',
        'model', 'steps', 'cfgScale', 'cfgRescale',
        'sampler', 'scheduler', 'smea', 'smeaDyn', 'selectedResolution'
    ] as const

    const hasChange = fieldsToWatch.some(field => state[field] !== prevState[field])
    if (!hasChange) return

    if (syncTimeout) clearTimeout(syncTimeout)
    syncTimeout = setTimeout(() => {
        usePresetStore.getState().syncFromGenerationStore()
    }, 500)
})

// Wrapper for loadPreset to set loading flag
const originalLoadPreset = usePresetStore.getState().loadPreset
usePresetStore.setState({
    loadPreset: (id: string) => {
        isLoadingPreset = true
        originalLoadPreset(id)
        setTimeout(() => {
            isLoadingPreset = false
        }, 100)
    }
})
