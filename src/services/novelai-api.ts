import JSZip from 'jszip'
import { decode as msgpackDecode } from '@msgpack/msgpack'

// TESTING: Always use native window.fetch
// Tauri's plugin-http causes 500 errors - the webview may handle CORS differently
const CLIENT_FETCH = window.fetch.bind(window)

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'User-Agent': 'NAIS2_Client/1.0',
}

const API_ENDPOINTS = {
    // Primary API
    USER_DATA: 'https://api.novelai.net/user/data',
    USER_INFO: 'https://api.novelai.net/user/information',
    SUBSCRIPTION: 'https://api.novelai.net/user/subscription',

    // Image Generation API (separate from primary)
    IMAGE_GENERATE: 'https://image.novelai.net/ai/generate-image',
    IMAGE_GENERATE_STREAM: 'https://image.novelai.net/ai/generate-image-stream',
}

export interface AnlasInfo {
    fixed: number
    purchased: number
    total: number
}

export interface GenerationParams {
    prompt: string
    negative_prompt: string
    model: string
    width: number
    height: number
    steps: number
    cfg_scale: number
    cfg_rescale: number
    sampler: string
    scheduler: string
    smea: boolean
    smea_dyn: boolean
    seed: number

    // Character Reference
    charImages?: string[]
    charInfo?: number[]
    charStrength?: number[]

    // Vibe Transfer
    vibeImages?: string[]
    vibeInfo?: number[]
    vibeStrength?: number[]

    // Character Prompts (V4 char_captions)
    characterPrompts?: {
        prompt: string
        negative: string
        enabled: boolean
        position: { x: number, y: number }
    }[]

    // I2I (Image-to-Image) Parameters
    sourceImage?: string    // Base64 encoded source image
    strength?: number       // 0.0 ~ 1.0 (higher = more change from original)
    noise?: number          // 0.0 ~ 1.0 (additional noise level)

    // Inpainting Parameters
    mask?: string           // Base64 encoded mask (white = inpaint area)
}

/**
 * Get user info including Anlas balance
 */
export async function getUserInfo(token: string): Promise<{ anlas: AnlasInfo } | null> {
    try {
        const trimmedToken = token.trim()

        // In production, use Rust backend to avoid CORS
        if (!import.meta.env.DEV) {
            const { invoke } = await import('@tauri-apps/api/core')
            const result = await invoke<{ success: boolean; fixed?: number; purchased?: number; error?: string }>('get_anlas_balance', { token: trimmedToken })

            if (result.success) {
                const fixed = result.fixed || 0
                const purchased = result.purchased || 0
                return {
                    anlas: {
                        fixed,
                        purchased,
                        total: fixed + purchased,
                    }
                }
            }
            return null
        }

        // Development mode - use native fetch
        const response = await CLIENT_FETCH(API_ENDPOINTS.SUBSCRIPTION, {
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${trimmedToken}`,
            },
        })

        if (!response.ok) {
            return null
        }

        const data = await response.json()
        const fixed = data.trainingStepsLeft?.fixedTrainingStepsLeft || 0
        const purchased = data.trainingStepsLeft?.purchasedTrainingSteps || 0

        return {
            anlas: {
                fixed,
                purchased,
                total: fixed + purchased,
            }
        }
    } catch (error) {
        console.error('getUserInfo error:', error)
        return null
    }
}

/**
 * Verify API token and get user info
 */
export async function verifyToken(token: string): Promise<{
    valid: boolean
    tier?: 'paper' | 'tablet' | 'scroll' | 'opus'
    error?: string
}> {
    console.log('[TokenVerify] Starting verification...')
    console.log('[TokenVerify] Environment:', import.meta.env.DEV ? 'DEV (Native Fetch)' : 'PROD (Rust Backend)')
    console.log('[TokenVerify] Token length:', token?.length)

    try {
        const trimmedToken = token.trim()

        // In production, use Tauri Rust backend to avoid CORS issues
        if (!import.meta.env.DEV) {
            console.log('[TokenVerify] Using Rust backend via invoke...')
            const { invoke } = await import('@tauri-apps/api/core')
            const result = await invoke<{ valid: boolean; tier?: string; error?: string }>('verify_token', { token: trimmedToken })
            console.log('[TokenVerify] Rust result:', result)

            if (result.valid && result.tier) {
                return { valid: true, tier: result.tier as 'paper' | 'tablet' | 'scroll' | 'opus' }
            }
            return { valid: false, error: result.error || '인증 실패' }
        }

        // In development, use native fetch (works because of localhost)
        console.log('[TokenVerify] Calling fetch to:', API_ENDPOINTS.SUBSCRIPTION)
        const response = await CLIENT_FETCH(API_ENDPOINTS.SUBSCRIPTION, {
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${trimmedToken}`,
            },
        })

        console.log('[TokenVerify] Response received. Status:', response.status)

        if (!response.ok) {
            console.warn('[TokenVerify] Response not OK:', response.status, response.statusText)
            if (response.status === 401) {
                return { valid: false, error: '유효하지 않은 API 토큰' }
            }
            return { valid: false, error: `API 오류: ${response.status}` }
        }

        const data = await response.json()
        console.log('[TokenVerify] Response JSON parsed:', data)

        // Determine tier from subscription data
        let tier: 'paper' | 'tablet' | 'scroll' | 'opus' = 'paper'
        if (data.tier === 3) tier = 'opus'
        else if (data.tier === 2) tier = 'scroll'
        else if (data.tier === 1) tier = 'tablet'

        console.log('[TokenVerify] Success. Tier:', tier)
        return { valid: true, tier }
    } catch (error) {
        console.error('[TokenVerify] CRITICAL ERROR:', error)
        console.error('[TokenVerify] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return { valid: false, error: `인증 실패: ${error}` }
    }
}

/**
 * Get user's Anlas balance
 */
export async function getAnlasBalance(token: string): Promise<{
    success: boolean
    fixedTrainingStepsLeft?: number
    purchasedTrainingSteps?: number
    error?: string
}> {
    try {
        const trimmedToken = token.trim()

        // In production, use Rust backend to avoid CORS
        if (!import.meta.env.DEV) {
            const { invoke } = await import('@tauri-apps/api/core')
            const result = await invoke<{ success: boolean; fixed?: number; purchased?: number; error?: string }>('get_anlas_balance', { token: trimmedToken })

            return {
                success: result.success,
                fixedTrainingStepsLeft: result.fixed,
                purchasedTrainingSteps: result.purchased,
                error: result.error,
            }
        }

        // Development mode - use native fetch
        const response = await CLIENT_FETCH(API_ENDPOINTS.SUBSCRIPTION, {
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${trimmedToken}`,
            },
        })

        if (!response.ok) {
            return { success: false, error: `API 오류: ${response.status}` }
        }

        const data = await response.json()
        const fixedTrainingStepsLeft = data.trainingStepsLeft?.fixedTrainingStepsLeft || 0
        const purchasedTrainingSteps = data.trainingStepsLeft?.purchasedTrainingSteps || 0

        return {
            success: true,
            fixedTrainingStepsLeft,
            purchasedTrainingSteps,
        }
    } catch (error) {
        console.error('Anlas balance error:', error)
        return { success: false, error: `Anlas 조회 실패: ${error}` }
    }
}

const stripBase64Header = (base64: string) => {
    return base64.replace(/^data:image\/[a-z]+;base64,/, '')
}

/**
 * Convert RGBA mask to pure grayscale for NAI API
 * NAI expects: Black (0) = preserve, White (255) = inpaint
 * Input: Any painted area (has alpha > 0 or color)
 * Output: Pure grayscale PNG where painted = white, unpainted = black
 * Also resizes mask to match target dimensions (source image size)
 */
async function convertMaskToGrayscale(maskBase64: string, targetWidth: number, targetHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            // Create canvas at TARGET size (source image dimensions)
            const canvas = document.createElement('canvas')
            canvas.width = targetWidth
            canvas.height = targetHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Canvas context failed'))
                return
            }

            // First, draw the mask on a transparent background to read alpha values
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

            // Get pixel data (with original alpha)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const data = imageData.data

            // Convert to binary grayscale: any pixel with alpha > 0 becomes white
            // This works correctly with semi-transparent colored masks
            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3]  // Original alpha before blending

                // If pixel has any opacity, it's part of the mask (inpaint area)
                if (alpha > 10) {  // Small threshold to ignore anti-aliasing artifacts
                    data[i] = 255     // R
                    data[i + 1] = 255 // G
                    data[i + 2] = 255 // B
                    data[i + 3] = 255 // A
                } else {
                    // Transparent -> black (preserve area)
                    data[i] = 0       // R
                    data[i + 1] = 0   // G
                    data[i + 2] = 0   // B
                    data[i + 3] = 255 // A (fully opaque)
                }
            }

            // Put processed data back
            ctx.putImageData(imageData, 0, 0)

            console.log(`[Inpaint] Mask converted: ${img.width}x${img.height} -> ${targetWidth}x${targetHeight}`)

            // Export as PNG and strip header
            const dataUrl = canvas.toDataURL('image/png')
            resolve(stripBase64Header(dataUrl))
        }
        img.onerror = () => reject(new Error('Mask image load failed'))
        img.src = maskBase64.startsWith('data:') ? maskBase64 : `data:image/png;base64,${maskBase64}`
    })
}

/**
 * Encode image for Vibe Transfer
 */
async function encodeVibeImage(token: string, imageBase64: string, info: number = 1.0): Promise<string> {
    const rawBase64 = stripBase64Header(imageBase64)
    const payload = {
        image: rawBase64,
        model: 'nai-diffusion-4-5-full',
        information_extracted: info
    }

    const response = await CLIENT_FETCH('https://image.novelai.net/ai/encode-vibe', {
        method: 'POST',
        headers: {
            ...DEFAULT_HEADERS,
            'Authorization': `Bearer ${token.trim()}`,
        },
        body: JSON.stringify(payload)
    })

    if (!response.ok) {
        throw new Error(`Vibe encoding failed: ${response.status}`)
    }

    const blob = await response.blob()
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64data = reader.result as string
            // Reader returns data:application/octet-stream;base64,.....
            const parts = base64data.split(',')
            resolve(parts.length > 1 ? parts[1] : parts[0])
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })
}

/**
 * Resize and pad image for Character Reference (Director Tools)
 */
function processCharacterImage(imageBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            const width = img.width
            const height = img.height
            let targetW = 1472, targetH = 1472

            if (width > height) { targetW = 1536; targetH = 1024 }
            else if (width < height) { targetW = 1024; targetH = 1536 }

            const canvas = document.createElement('canvas')
            canvas.width = targetW
            canvas.height = targetH
            const ctx = canvas.getContext('2d')
            if (!ctx) {
                reject(new Error('Canvas context failed'))
                return
            }

            // Fill black
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, targetW, targetH)

            // Calculate fit
            const scale = Math.min(targetW / width, targetH / height)
            const w = width * scale
            const h = height * scale
            const x = (targetW - w) / 2
            const y = (targetH - h) / 2

            // Draw
            ctx.drawImage(img, x, y, w, h)

            // Export as JPEG quality 0.95
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
            resolve(dataUrl.split(',')[1])
        }
        img.onerror = () => reject(new Error("Image load failed"))
        img.src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
    })
}

/**
 * Generate image using NovelAI API
 * Based on NAIS1 working implementation
 */
export async function generateImage(
    token: string,
    params: GenerationParams
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    if (!token) {
        return { success: false, error: 'API 토큰이 필요합니다' }
    }

    try {
        // Process Vibe Images
        const processedVibeImages: string[] = []
        if (params.vibeImages && params.vibeImages.length > 0) {
            for (let i = 0; i < params.vibeImages.length; i++) {
                try {
                    const encoded = await encodeVibeImage(token, params.vibeImages[i], params.vibeInfo?.[i] || 1.0)
                    processedVibeImages.push(encoded)
                } catch (e) {
                    console.error('Vibe encoding error:', e)
                    // Continue or fail? Let's fail for now to be safe
                    return { success: false, error: `Vibe Processing Failed: ${e}` }
                }
            }
        }

        // Process Character Reference Images
        const processedCharImages: string[] = []
        if (params.charImages && params.charImages.length > 0) {
            for (const img of params.charImages) {
                try {
                    const processed = await processCharacterImage(img)
                    processedCharImages.push(processed)
                } catch (e) {
                    console.error('Character image processing error:', e)
                    return { success: false, error: `Character Processing Failed: ${e}` }
                }
            }
        }

        // Build API parameters - matching NAIS1 working format
        const apiParameters = {
            // Core parameters
            width: params.width,
            height: params.height,
            n_samples: 1,
            seed: params.seed,
            extra_noise_seed: params.seed,
            sampler: params.sampler,
            steps: params.steps,
            scale: params.cfg_scale,
            negative_prompt: params.negative_prompt,
            cfg_rescale: params.cfg_rescale,
            noise_schedule: params.scheduler,

            // Version and legacy settings
            params_version: 3,
            legacy: false,
            legacy_v3_extend: false,

            // SMEA settings (sm must be true for sm_dyn to work)
            // Note: NAI v4/v4.5 models don't support SMEA
            sm: params.model.includes('diffusion-4') ? false : params.smea,
            sm_dyn: params.model.includes('diffusion-4') ? false : (params.smea && params.smea_dyn),

            // Dynamic Thresholding
            dynamic_thresholding: false,

            // Skip CFG settings
            skip_cfg_above_sigma: null,

            // V4 specific
            add_original_image: true,
            legacy_uc: false,
            prefer_brownian: true,
            ucPreset: 0,
            use_coords: false,

            // Reference/Vibe Transfer
            reference_image_multiple: processedVibeImages,
            reference_information_extracted_multiple: params.vibeInfo || [],
            reference_strength_multiple: params.vibeStrength || [],

            // Character Reference (Director tools)
            director_reference_images: processedCharImages,
            director_reference_information_extracted: (params.charInfo || []).map(() => 1.0), // Force 1.0 as per legacy
            director_reference_strength_values: params.charStrength || [],
            director_reference_secondary_strength_values: (params.charStrength || []).map(() => 0), // Default to 0

            // V4 prompt format
            v4_prompt: {
                caption: {
                    base_caption: params.prompt,
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
                use_coords: false,
                use_order: true,
            },
            v4_negative_prompt: {
                caption: {
                    base_caption: params.negative_prompt,
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
                use_coords: false,
                use_order: false,
                legacy_uc: false,
            },
        }

        // Add character prompts if present
        if (params.characterPrompts && params.characterPrompts.length > 0) {
            for (const char of params.characterPrompts) {
                if (char.enabled && char.prompt.trim()) {
                    apiParameters.v4_prompt.caption.char_captions.push({
                        char_caption: char.prompt,
                        centers: [{ x: char.position.x, y: char.position.y }]
                    })
                    // Also add negative if exists
                    if (char.negative.trim()) {
                        apiParameters.v4_negative_prompt.caption.char_captions.push({
                            char_caption: char.negative,
                            centers: [{ x: char.position.x, y: char.position.y }]
                        })
                    }
                }
            }
            // Enable coords if any character prompts exist
            if (apiParameters.v4_prompt.caption.char_captions.length > 0) {
                apiParameters.v4_prompt.use_coords = true
                apiParameters.v4_negative_prompt.use_coords = true
                // @ts-ignore
                apiParameters.use_coords = true
            }
        }

        if (processedVibeImages.length > 1) {
            // @ts-ignore
            apiParameters.normalize_reference_strength_multiple = true
        }

        // Add character descriptions if character references exist
        if (processedCharImages.length > 0) {
            // @ts-ignore
            apiParameters.director_reference_descriptions = processedCharImages.map(() => ({
                caption: {
                    base_caption: "character",
                    char_captions: []
                },
                legacy_uc: false
            }))
        }

        // Determine action type based on params
        let action = 'generate'
        let requestModel = params.model

        if (params.sourceImage) {
            const rawSourceImage = stripBase64Header(params.sourceImage)
            // @ts-ignore
            apiParameters.image = rawSourceImage

            if (params.mask) {
                // --- INPAINTING (INFILL) CONFIGURATION ---
                action = 'infill'

                // Switch to Inpainting Model
                // Confirmed by NAI-Auto-Generator-V4 and NAIA2.0: append -inpainting suffix
                if (!requestModel.includes('inpainting')) {
                    requestModel = requestModel + '-inpainting'
                }

                const userStrength = params.strength ?? 0.7

                // Fixed Strength for Inpainting Top-Level
                // @ts-ignore
                apiParameters.strength = 0.7

                // Img2Img Nested Object with User Strength
                // @ts-ignore
                apiParameters.img2img = {
                    strength: userStrength,
                    color_correct: true // Often forced to true in reference impl
                }

                // Extra Inpainting Specific Strength Parameter
                // @ts-ignore
                apiParameters.inpaintImg2ImgStrength = userStrength

                // Noise is REMOVED for Infill in reference implementation
                // @ts-ignore
                delete apiParameters.noise

                // Mask Parameters - Convert to grayscale (NAI requires pure black/white mask)
                // Get actual source image dimensions (not selected resolution!)
                const getImageDimensions = async (base64: string): Promise<{ width: number; height: number }> => {
                    return new Promise((resolve, reject) => {
                        const img = new Image()
                        img.onload = () => resolve({ width: img.width, height: img.height })
                        img.onerror = reject
                        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
                    })
                }
                const srcDimensions = await getImageDimensions(params.sourceImage)
                console.log(`[Inpaint] Source image: ${srcDimensions.width}x${srcDimensions.height}`)

                const grayscaleMask = await convertMaskToGrayscale(params.mask, srcDimensions.width, srcDimensions.height)
                // @ts-ignore
                apiParameters.mask = grayscaleMask
                // @ts-ignore
                apiParameters.add_original_image = true

                // Inpainting model doesn't support director reference images - DELETE them entirely
                // (NAI-Auto-Generator-V4 uses pop() to remove, not empty arrays)
                // @ts-ignore
                delete apiParameters.director_reference_images
                // @ts-ignore
                delete apiParameters.director_reference_information_extracted
                // @ts-ignore
                delete apiParameters.director_reference_strength_values
                // @ts-ignore
                delete apiParameters.director_reference_secondary_strength_values
                // @ts-ignore
                delete apiParameters.director_reference_descriptions

            } else {
                // --- REGULAR IMAGE TO IMAGE CONFIGURATION ---
                action = 'img2img'
                // @ts-ignore
                apiParameters.strength = params.strength ?? 0.7
                // @ts-ignore
                apiParameters.noise = params.noise ?? 0.0
            }
        }

        // Build request payload
        const payload = {
            input: params.prompt,
            model: requestModel,
            action: action,
            parameters: apiParameters,
        }


        const response = await CLIENT_FETCH(API_ENDPOINTS.IMAGE_GENERATE, {
            method: 'POST',
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${token.trim()}`,
            },
            body: JSON.stringify(payload),
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('API Error:', response.status, errorText)
            return { success: false, error: `API 오류 (${response.status}): ${errorText}` }
        }

        // Response is a ZIP file containing the image
        const zipData = await response.arrayBuffer()

        // Load ZIP using JSZip
        const zip = await JSZip.loadAsync(zipData)

        // Find the first file in the ZIP
        const filename = Object.keys(zip.files)[0]
        if (!filename) {
            throw new Error("ZIP 파일이 비어있습니다.")
        }

        const file = zip.file(filename)
        if (!file) {
            throw new Error("ZIP 파일에서 이미지를 읽을 수 없습니다.")
        }

        // Convert to base64
        const base64 = await file.async('base64')

        return { success: true, imageData: base64 }
    } catch (error) {
        console.error('Generation error:', error)
        return { success: false, error: `생성 오류: ${error}` }
    }
}

/**
 * Upscale image using NovelAI's upscale API (4x upscale)
 */
export async function upscaleImage(
    token: string,
    imageBase64: string,
    width: number,
    height: number,
    scale: number = 4
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    try {
        const rawBase64 = stripBase64Header(imageBase64)

        // In production, use Rust backend to avoid CORS
        if (!import.meta.env.DEV) {
            console.log('[Upscale] Using Rust backend via invoke...')
            const { invoke } = await import('@tauri-apps/api/core')
            const result = await invoke<{ success: boolean; image_data?: string; error?: string }>('upscale_image', {
                token: token.trim(),
                image: rawBase64,
                width,
                height,
                scale,
            })
            console.log('[Upscale] Rust result:', result.success ? 'Success' : result.error)

            return {
                success: result.success,
                imageData: result.image_data,
                error: result.error,
            }
        }

        // Development mode - use native fetch
        const payload = {
            image: rawBase64,
            width: width,
            height: height,
            scale: scale
        }

        const response = await CLIENT_FETCH('https://api.novelai.net/ai/upscale', {
            method: 'POST',
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${token.trim()}`,
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Upscale failed: ${response.status} - ${errorText}`)
        }

        // Response is a ZIP file containing the upscaled image
        const arrayBuffer = await response.arrayBuffer()
        const zip = await JSZip.loadAsync(arrayBuffer)

        const filename = Object.keys(zip.files)[0]
        const file = zip.file(filename)
        if (!file) {
            throw new Error("ZIP 파일에서 이미지를 읽을 수 없습니다.")
        }

        const base64 = await file.async('base64')
        return { success: true, imageData: base64 }
    } catch (error) {
        console.error('Upscale error:', error)
        return { success: false, error: `업스케일 오류: ${error}` }
    }
}


/**
 * Generate image using NovelAI Streaming API
 * Returns images progressively with progress updates
 */
export async function generateImageStream(
    token: string,
    params: GenerationParams,
    onProgress?: (progress: number, partialImage?: string) => void
): Promise<{ success: boolean; imageData?: string; error?: string }> {
    if (!token) {
        return { success: false, error: 'API 토큰이 필요합니다' }
    }

    try {
        // Use the streaming endpoint
        const endpoint = API_ENDPOINTS.IMAGE_GENERATE_STREAM

        // ===========================================
        // 1. Process Vibe Images & Reference Images (Copied from generateImage)
        // ===========================================

        // Process Vibe Images
        const processedVibeImages: string[] = []
        if (params.vibeImages && params.vibeImages.length > 0) {
            for (let i = 0; i < params.vibeImages.length; i++) {
                try {
                    const encoded = await encodeVibeImage(token, params.vibeImages[i], params.vibeInfo?.[i] || 1.0)
                    processedVibeImages.push(encoded)
                } catch (e) {
                    console.error('Vibe encoding error (Stream):', e)
                    return { success: false, error: `Vibe Processing Failed: ${e}` }
                }
            }
        }

        // Process Character Reference Images
        const processedCharImages: string[] = []
        if (params.charImages && params.charImages.length > 0) {
            for (const img of params.charImages) {
                try {
                    const processed = await processCharacterImage(img)
                    processedCharImages.push(processed)
                } catch (e) {
                    console.error('Character image processing error (Stream):', e)
                    return { success: false, error: `Character Processing Failed: ${e}` }
                }
            }
        }

        // ===========================================
        // 2. Build API Parameters
        // ===========================================

        const requestModel = params.model
        let action = 'generate'

        // Base API Parameters (Common)
        const apiParameters: Record<string, any> = {
            width: params.width,
            height: params.height,
            n_samples: 1,
            seed: params.seed,
            extra_noise_seed: params.seed,
            sampler: params.sampler,
            steps: params.steps,
            scale: params.cfg_scale,
            negative_prompt: params.negative_prompt,
            cfg_rescale: params.cfg_rescale,
            noise_schedule: params.scheduler,

            // Version and legacy settings
            params_version: 3,
            legacy: false,
            legacy_v3_extend: false,

            // SMEA settings (sm must be true for sm_dyn to work)
            // Note: NAI v4/v4.5 models don't support SMEA
            sm: params.model.includes('diffusion-4') ? false : params.smea,
            sm_dyn: params.model.includes('diffusion-4') ? false : (params.smea && params.smea_dyn),

            // Dynamic Thresholding
            dynamic_thresholding: false,

            // Skip CFG settings
            skip_cfg_above_sigma: null,

            // V4 specific
            add_original_image: true,
            legacy_uc: false,
            prefer_brownian: true,
            ucPreset: 0,
            use_coords: false,

            // Streaming specific
            stream: 'msgpack',
            qualityToggle: true,

            // Reference/Vibe Transfer
            reference_image_multiple: processedVibeImages,
            reference_information_extracted_multiple: params.vibeInfo || [],
            reference_strength_multiple: params.vibeStrength || [],

            // Character Reference (Director tools)
            director_reference_images: processedCharImages,
            director_reference_information_extracted: (params.charInfo || []).map(() => 1.0), // Force 1.0 as per legacy
            director_reference_strength_values: params.charStrength || [],
            director_reference_secondary_strength_values: (params.charStrength || []).map(() => 0), // Default to 0

            // V4 prompt format initialization
            v4_prompt: {
                caption: {
                    base_caption: params.prompt,
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
                use_coords: false,
                use_order: true,
            },
            v4_negative_prompt: {
                caption: {
                    base_caption: params.negative_prompt,
                    char_captions: [] as { char_caption: string, centers: { x: number, y: number }[] }[],
                },
                use_coords: false,
                use_order: false,
                legacy_uc: false,
            },
        }

        // Add character prompts if present
        if (params.characterPrompts && params.characterPrompts.length > 0) {
            for (const char of params.characterPrompts) {
                if (char.enabled && char.prompt.trim()) {
                    apiParameters.v4_prompt.caption.char_captions.push({
                        char_caption: char.prompt,
                        centers: [{ x: char.position.x, y: char.position.y }]
                    })
                    // Also add negative if exists
                    if (char.negative.trim()) {
                        apiParameters.v4_negative_prompt.caption.char_captions.push({
                            char_caption: char.negative,
                            centers: [{ x: char.position.x, y: char.position.y }]
                        })
                    }
                }
            }
            // Enable coords if any character prompts exist
            if (apiParameters.v4_prompt.caption.char_captions.length > 0) {
                apiParameters.v4_prompt.use_coords = true
                apiParameters.v4_negative_prompt.use_coords = true
                apiParameters.use_coords = true
            }
        }

        if (processedVibeImages.length > 1) {
            apiParameters.normalize_reference_strength_multiple = true
        }

        // Add character descriptions if character references exist
        if (processedCharImages.length > 0) {
            apiParameters.director_reference_descriptions = processedCharImages.map(() => ({
                caption: {
                    base_caption: "character",
                    char_captions: []
                },
                legacy_uc: false
            }))
        }

        // ===========================================
        // 3. Handle I2I and Inpainting logic
        // ===========================================
        let finalModel = requestModel

        if (params.sourceImage) {
            const rawSourceImage = stripBase64Header(params.sourceImage)
            apiParameters.image = rawSourceImage

            if (params.mask) {
                // --- INPAINTING (INFILL) CONFIGURATION ---
                action = 'infill'

                // Switch to Inpainting Model
                if (!finalModel.includes('inpainting')) {
                    finalModel = finalModel + '-inpainting'
                }

                const userStrength = params.strength ?? 0.7
                apiParameters.strength = 0.7 // Infill top level fixed

                apiParameters.img2img = {
                    strength: userStrength,
                    color_correct: true
                }
                apiParameters.inpaintImg2ImgStrength = userStrength
                delete apiParameters.noise // Remove noise for infill

                // Mask Logic
                const getImageDimensions = async (base64: string): Promise<{ width: number; height: number }> => {
                    return new Promise((resolve, reject) => {
                        const img = new Image()
                        img.onload = () => resolve({ width: img.width, height: img.height })
                        img.onerror = reject
                        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`
                    })
                }

                try {
                    const srcDimensions = await getImageDimensions(params.sourceImage)
                    console.log(`[Stream][Inpaint] Source image: ${srcDimensions.width}x${srcDimensions.height}`)
                    const grayscaleMask = await convertMaskToGrayscale(params.mask, srcDimensions.width, srcDimensions.height)
                    apiParameters.mask = grayscaleMask
                } catch (err) {
                    console.error('[Stream] Mask processing failed:', err)
                    return { success: false, error: 'Mask processing failed' }
                }

                apiParameters.add_original_image = true

                // Cleanup incompatible params for inpainting
                delete apiParameters.director_reference_images
                delete apiParameters.director_reference_information_extracted
                delete apiParameters.director_reference_strength_values
                delete apiParameters.director_reference_secondary_strength_values
                delete apiParameters.director_reference_descriptions

            } else {
                // --- REGULAR IMAGE TO IMAGE CONFIGURATION ---
                action = 'img2img'
                apiParameters.strength = params.strength ?? 0.7
                apiParameters.noise = params.noise ?? 0.0
            }
        }

        const requestBody = {
            input: params.prompt,
            model: finalModel,
            action: action,
            parameters: apiParameters
        }

        console.log('[Stream] Starting streaming generation...')

        const response = await CLIENT_FETCH(endpoint, {
            method: 'POST',
            headers: {
                ...DEFAULT_HEADERS,
                'Authorization': `Bearer ${token.trim()}`,
                'Accept': 'application/x-msgpack'
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Stream] API Error:', response.status, errorText)
            return { success: false, error: `API Error: ${response.status} ${errorText}` }
        }

        if (!response.body) {
            return { success: false, error: '스트리밍 응답 없음' }
        }

        // Helper function to convert binary to base64 (chunk-safe)
        const binaryToBase64 = (uint8: Uint8Array): string => {
            let binary = ''
            const chunkSize = 32768
            for (let i = 0; i < uint8.length; i += chunkSize) {
                const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length))
                binary += String.fromCharCode.apply(null, Array.from(chunk))
            }
            return btoa(binary)
        }

        // Read the streaming response and parse events in real-time
        const reader = response.body.getReader()
        let buffer = new Uint8Array(0) // Accumulated buffer for incomplete messages
        let finalImageData: string | null = null
        let lastStepShown = -1
        const totalSteps = params.steps || 28

        console.log('[Stream] Starting real-time event processing...')

        while (true) {
            const { done, value } = await reader.read()

            if (value) {
                // Append new data to buffer
                const newBuffer = new Uint8Array(buffer.length + value.length)
                newBuffer.set(buffer)
                newBuffer.set(value, buffer.length)
                buffer = newBuffer

                // Try to parse complete msgpack messages from buffer
                while (buffer.length >= 4) {
                    // Read 4-byte length header (big-endian)
                    const length = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3]

                    if (length <= 0 || length > 10_000_000) {
                        console.error('[Stream] Invalid message length:', length)
                        break
                    }

                    // Check if we have the complete message
                    if (buffer.length < 4 + length) {
                        // Need more data
                        break
                    }

                    // Extract and process this message
                    const messageData = buffer.slice(4, 4 + length)
                    buffer = buffer.slice(4 + length) // Remove processed data from buffer

                    try {
                        const decoded = msgpackDecode(messageData) as Record<string, unknown>
                        const eventType = decoded.event_type || decoded.event || 'unknown'
                        const stepIx = decoded.step_ix as number | undefined

                        // Calculate progress based on step index
                        if (typeof stepIx === 'number') {
                            const progress = Math.round((stepIx / totalSteps) * 100)

                            // Process image from event
                            const imgField = decoded.image as Uint8Array | undefined

                            if (imgField && imgField instanceof Uint8Array) {
                                // Only show every few steps to avoid overwhelming UI
                                if (eventType === 'intermediate' && stepIx > lastStepShown + 1) {
                                    lastStepShown = stepIx
                                    console.log(`[Stream] Step ${stepIx}/${totalSteps} (${progress}%)`)

                                    // Convert intermediate image to base64 and send to callback
                                    const previewBase64 = binaryToBase64(imgField)
                                    onProgress?.(progress, previewBase64)
                                }
                            }
                        }

                        if (eventType === 'final') {
                            console.log('[Stream] Received final event')
                            const imgField = decoded.image as Uint8Array | undefined

                            if (imgField && imgField instanceof Uint8Array) {
                                finalImageData = binaryToBase64(imgField)
                                console.log('[Stream] Final image converted, length:', finalImageData.length)
                            }

                            onProgress?.(100)
                        }

                        // Check for error
                        if (decoded.error || decoded.message) {
                            const errorMsg = (decoded.error || decoded.message) as string
                            console.error('[Stream] API Error:', errorMsg)
                            return { success: false, error: `API 오류: ${errorMsg}` }
                        }

                    } catch (e) {
                        console.error('[Stream] Failed to decode message:', e)
                    }
                }
            }

            if (done) {
                console.log('[Stream] Stream ended, remaining buffer:', buffer.length)
                break
            }
        }

        if (finalImageData) {
            return { success: true, imageData: finalImageData }
        }

        return { success: false, error: '스트림에서 이미지 데이터를 찾을 수 없음' }

    } catch (error) {
        console.error('[Stream] Error:', error)
        return { success: false, error: `스트리밍 오류: ${error}` }
    }
}
