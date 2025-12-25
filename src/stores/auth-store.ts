import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getUserInfo, verifyToken, type AnlasInfo } from '@/services/novelai-api'

interface AuthState {
    token: string
    isVerified: boolean
    tier: string | null
    anlas: AnlasInfo | null
    isLoading: boolean

    setToken: (token: string) => void
    verifyAndSave: (token: string) => Promise<boolean>
    refreshAnlas: () => Promise<void>
    clearToken: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: '',
            isVerified: false,
            tier: null,
            anlas: null,
            isLoading: false,

            setToken: (token) => set({ token }),

            verifyAndSave: async (token) => {
                set({ isLoading: true })

                const result = await verifyToken(token)

                if (result.valid) {
                    set({ token, isVerified: true, tier: result.tier || null })

                    // Fetch Anlas balance
                    const userInfo = await getUserInfo(token)
                    if (userInfo) {
                        set({ anlas: userInfo.anlas })
                    }

                    set({ isLoading: false })
                    return true
                } else {
                    set({ isVerified: false, tier: null, anlas: null, isLoading: false })
                    return false
                }
            },

            refreshAnlas: async () => {
                const { token, isVerified } = get()
                if (!token || !isVerified) return

                const userInfo = await getUserInfo(token)
                if (userInfo) {
                    set({ anlas: userInfo.anlas })
                }
            },

            clearToken: () => set({
                token: '',
                isVerified: false,
                tier: null,
                anlas: null,
            }),
        }),
        {
            name: 'nais2-auth',
            partialize: (state) => ({
                token: state.token,
                isVerified: state.isVerified,
                tier: state.tier,
            }),
        }
    )
)
