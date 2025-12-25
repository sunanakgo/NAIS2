import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface TextFragment {
    id: string
    label: string
    prompt: string
}

interface FragmentState {
    fragments: TextFragment[]

    // Actions
    addFragment: (fragment: Omit<TextFragment, 'id'>) => void
    updateFragment: (id: string, updates: Partial<TextFragment>) => void
    removeFragment: (id: string) => void
    exportFragments: () => { name: string; prompt: string }[]
    importFragments: (data: { name: string; prompt: string }[], mode: 'replace' | 'merge') => void
}

export const useFragmentStore = create<FragmentState>()(
    persist(
        (set, get) => ({
            fragments: [],

            addFragment: (fragment) => set((state) => ({
                fragments: [
                    ...state.fragments,
                    { ...fragment, id: Date.now().toString() }
                ]
            })),

            updateFragment: (id, updates) => set((state) => ({
                fragments: state.fragments.map((f) =>
                    f.id === id ? { ...f, ...updates } : f
                )
            })),

            removeFragment: (id) => set((state) => ({
                fragments: state.fragments.filter((f) => f.id !== id)
            })),

            exportFragments: () => {
                const { fragments } = get()
                return fragments.map(f => ({
                    name: f.label,
                    prompt: f.prompt
                }))
            },

            importFragments: (data, mode) => set((state) => {
                const newFragments = data.map((item, index) => ({
                    id: (Date.now() + index).toString(),
                    label: item.name,
                    prompt: item.prompt
                }))

                if (mode === 'replace') {
                    return { fragments: newFragments }
                } else {
                    // Merge: add only if label doesn't exist
                    const existingLabels = new Set(state.fragments.map(f => f.label))
                    const toAdd = newFragments.filter(f => !existingLabels.has(f.label))
                    return { fragments: [...state.fragments, ...toAdd] }
                }
            }),
        }),
        {
            name: 'nais2-fragments',
        }
    )
)
