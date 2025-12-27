/**
 * NAI Image Metadata Parser
 * 
 * NovelAI embeds metadata in PNG images via:
 * 1. Standard PNG tEXt chunks (Comment field with JSON)
 * 2. Stealth PNGInfo in alpha channel (for persistence through SNS)
 * 
 * This parser extracts metadata from both sources.
 */

/**
 * Decompress gzip data using native Web API or fallback
 */
async function decompressGzip(data: Uint8Array): Promise<string> {
    try {
        // Try native DecompressionStream (modern browsers)
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new DecompressionStream('gzip')
            const writer = stream.writable.getWriter()
            writer.write(new Uint8Array(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength))
            writer.close()

            const reader = stream.readable.getReader()
            const chunks: Uint8Array[] = []

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                chunks.push(value)
            }

            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            const result = new Uint8Array(totalLength)
            let offset = 0
            for (const chunk of chunks) {
                result.set(chunk, offset)
                offset += chunk.length
            }

            return new TextDecoder('utf-8').decode(result)
        }
    } catch (e) {
        console.log('Native decompression failed, trying pako fallback:', e)
    }

    // Fallback to pako if available
    try {
        const pako = await import('pako')
        return pako.ungzip(data, { to: 'string' })
    } catch (e) {
        console.error('Gzip decompression failed:', e)
        throw new Error('Failed to decompress gzip data')
    }
}

export interface NAIMetadata {
    // Basic params
    prompt?: string
    negativePrompt?: string  // "uc" in NAI format

    // Generation settings
    model?: string  // Extracted from "Source" PNG tEXt chunk
    steps?: number
    cfgScale?: number  // "scale" in NAI
    cfgRescale?: number
    seed?: number
    sampler?: string
    scheduler?: string  // "noise_schedule" in NAI

    // SMEA
    smea?: boolean  // "sm" in NAI
    smeaDyn?: boolean  // "sm_dyn" in NAI
    variety?: boolean // Derived from "skip_cfg_above_sigma"

    // Resolution
    width?: number
    height?: number

    // V4 specific
    v4_prompt?: {
        caption?: {
            base_caption?: string
            char_captions?: Array<{
                char_caption: string
                centers: Array<{ x: number, y: number }>
            }>
        }
    }
    v4_negative_prompt?: {
        caption?: {
            base_caption?: string
        }
    }

    // Reference images (metadata only, not actual images)
    hasVibeTransfer?: boolean
    hasCharacterReference?: boolean

    // Vibe Transfer details (strength, info_extracted per image)
    vibeTransferInfo?: Array<{
        strength: number
        informationExtracted: number
    }>

    // Pre-encoded vibe data (for reuse without re-encoding)
    encodedVibes?: string[]

    // Character Reference details
    characterReferenceInfo?: Array<{
        strength: number
        informationExtracted: number
    }>

    // Source info
    source?: 'text_chunk' | 'stealth_alpha'

    // Raw data for debugging
    raw?: Record<string, unknown>
}



/**
 * Extract metadata from alpha channel (stealth_pnginfo)
 * This method works even after images are uploaded to SNS
 * Ported from legacy Python stealth_png_reader.py
 */
async function extractStealthMetadata(imageData: ImageData): Promise<NAIMetadata | null> {
    try {
        const { data, width, height } = imageData
        const SIGNATURES = {
            alpha: {
                uncompressed: 'stealth_pnginfo',
                compressed: 'stealth_pngcomp'
            }
        }

        // Get pixel data - data is in RGBA order, row by row
        const getPixel = (x: number, y: number) => {
            const i = (y * width + x) * 4
            return {
                r: data[i],
                g: data[i + 1],
                b: data[i + 2],
                a: data[i + 3]
            }
        }

        const sigLen = SIGNATURES.alpha.uncompressed.length * 8 // bits
        let bufferA = ""
        let indexA = 0
        let sigConfirmed = false
        let confirmingSignature = true
        let readingParamLen = false
        let readingParam = false
        let readEnd = false
        let paramLen = 0
        let binaryData = ""
        let compressed = false

        // Column-major traversal - x first, then y (like legacy code)
        for (let x = 0; x < width && !readEnd; x++) {
            for (let y = 0; y < height && !readEnd; y++) {
                const pixel = getPixel(x, y)

                // Read LSB from alpha channel
                bufferA += (pixel.a & 1).toString()
                indexA++

                if (confirmingSignature) {
                    if (indexA === sigLen) {
                        // Convert binary string to text
                        const sig = binaryToString(bufferA)
                        if (sig === SIGNATURES.alpha.uncompressed) {
                            confirmingSignature = false
                            sigConfirmed = true
                            readingParamLen = true
                            compressed = false
                            bufferA = ""
                            indexA = 0
                        } else if (sig === SIGNATURES.alpha.compressed) {
                            confirmingSignature = false
                            sigConfirmed = true
                            readingParamLen = true
                            compressed = true
                            bufferA = ""
                            indexA = 0
                        } else {
                            readEnd = true
                            break
                        }
                    }
                } else if (readingParamLen) {
                    if (indexA === 32) {
                        paramLen = parseInt(bufferA, 2)
                        readingParamLen = false
                        readingParam = true
                        bufferA = ""
                        indexA = 0
                    }
                } else if (readingParam) {
                    if (indexA === paramLen) {
                        binaryData = bufferA
                        readEnd = true
                        break
                    }
                }
            }
        }

        if (!sigConfirmed || binaryData.length === 0) {
            return null
        }

        // Convert binary string to bytes
        const byteData = binaryToBytes(binaryData)

        // Decompress if needed
        let jsonString: string
        if (compressed) {
            jsonString = await decompressGzip(byteData)
        } else {
            jsonString = new TextDecoder('utf-8').decode(byteData)
        }

        // Parse JSON
        let jsonData = JSON.parse(jsonString)

        // Handle nested Comment field
        if (jsonData.Comment && typeof jsonData.Comment === 'string') {
            try {
                jsonData.Comment = JSON.parse(jsonData.Comment)
            } catch { /* ignore */ }
        }

        // Convert to our format - the main data is often in jsonData.Comment
        const sourceData = jsonData.Comment || jsonData
        const metadata = convertNAIFormat(sourceData)
        metadata.source = 'stealth_alpha'

        return metadata
    } catch (error) {
        console.log('Stealth metadata extraction failed:', error)
        return null
    }
}

/**
 * Convert binary string to text
 */
function binaryToString(binStr: string): string {
    const bytes: number[] = []
    for (let i = 0; i < binStr.length; i += 8) {
        const byte = binStr.slice(i, i + 8)
        if (byte.length === 8) {
            bytes.push(parseInt(byte, 2))
        }
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
}

/**
 * Convert binary string to Uint8Array
 */
function binaryToBytes(binStr: string): Uint8Array {
    const bytes: number[] = []
    for (let i = 0; i < binStr.length; i += 8) {
        const byte = binStr.slice(i, i + 8)
        if (byte.length === 8) {
            bytes.push(parseInt(byte, 2))
        }
    }
    return new Uint8Array(bytes)
}

/**
 * Load image and get ImageData using Canvas API
 */
async function getImageData(imageBytes: Uint8Array): Promise<ImageData | null> {
    return new Promise((resolve) => {
        const blob = new Blob([new Uint8Array(imageBytes.buffer as ArrayBuffer, imageBytes.byteOffset, imageBytes.byteLength)], { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        const img = new Image()

        img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')

            if (!ctx) {
                URL.revokeObjectURL(url)
                resolve(null)
                return
            }

            ctx.drawImage(img, 0, 0)
            const imageData = ctx.getImageData(0, 0, img.width, img.height)
            URL.revokeObjectURL(url)
            resolve(imageData)
        }

        img.onerror = () => {
            URL.revokeObjectURL(url)
            resolve(null)
        }

        img.src = url
    })
}

/**
 * Parse PNG tEXt chunk metadata
 * NAI stores JSON in the "Comment" tEXt chunk
 */
export async function parseNAIMetadata(imageData: ArrayBuffer | Uint8Array): Promise<NAIMetadata | null> {
    try {
        const bytes = imageData instanceof ArrayBuffer ? new Uint8Array(imageData) : imageData

        // Check PNG signature
        const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
        for (let i = 0; i < 8; i++) {
            if (bytes[i] !== pngSignature[i]) {
                console.error('Not a valid PNG file')
                return null
            }
        }

        // First, try to extract from tEXt chunks (faster)
        let metadata = await extractTextChunkMetadata(bytes)

        // If tEXt chunk failed, try stealth alpha channel
        if (!metadata) {
            const imgData = await getImageData(bytes)
            if (imgData) {
                metadata = await extractStealthMetadata(imgData)
            }
        }

        return metadata
    } catch (error) {
        console.error('Failed to parse metadata:', error)
        return null
    }
}

/**
 * Extract metadata from PNG tEXt chunks
 */
async function extractTextChunkMetadata(bytes: Uint8Array): Promise<NAIMetadata | null> {
    let offset = 8
    let metadata: NAIMetadata | null = null
    let modelSource: string | null = null

    while (offset < bytes.length) {
        // Read chunk length (4 bytes, big-endian)
        const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) | bytes[offset + 3]
        offset += 4

        // Read chunk type (4 bytes)
        const type = String.fromCharCode(bytes[offset], bytes[offset + 1],
            bytes[offset + 2], bytes[offset + 3])
        offset += 4

        if (type === 'tEXt' || type === 'iTXt') {
            // Read chunk data
            const chunkData = bytes.slice(offset, offset + length)
            const textData = new TextDecoder('utf-8').decode(chunkData)

            // tEXt format: keyword\0value
            const nullIndex = textData.indexOf('\0')
            if (nullIndex !== -1) {
                const keyword = textData.slice(0, nullIndex)
                let value = textData.slice(nullIndex + 1)

                // iTXt has additional fields before the actual text
                if (type === 'iTXt') {
                    const parts = value.split('\0')
                    value = parts[parts.length - 1] || value
                }

                if (keyword === 'Comment' || keyword === 'parameters') {
                    try {
                        const parsed = JSON.parse(value)
                        metadata = convertNAIFormat(parsed)
                        metadata.source = 'text_chunk'
                    } catch {
                        metadata = parseA1111Format(value)
                        if (metadata) metadata.source = 'text_chunk'
                    }
                } else if (keyword === 'Source') {
                    // Store model source temporarily, will be added after metadata is created
                    modelSource = value
                }
            }
        }

        // Skip chunk data and CRC
        offset += length + 4

        // Stop at IEND
        if (type === 'IEND') break
    }

    // Add model source if found
    if (metadata && modelSource) {
        metadata.model = modelSource
    }

    return metadata
}

/**
 * Convert NAI's internal format to our format
 */
function convertNAIFormat(data: Record<string, unknown>): NAIMetadata {
    const metadata: NAIMetadata = {
        raw: data
    }

    // Basic prompts
    if (data.prompt) metadata.prompt = String(data.prompt)
    if (data.uc) metadata.negativePrompt = String(data.uc)

    // Generation params
    if (data.steps) metadata.steps = Number(data.steps)
    if (data.scale) metadata.cfgScale = Number(data.scale)
    if (data.cfg_rescale) metadata.cfgRescale = Number(data.cfg_rescale)
    if (data.seed) metadata.seed = Number(data.seed)
    if (data.sampler) metadata.sampler = String(data.sampler)
    if (data.noise_schedule) metadata.scheduler = String(data.noise_schedule)

    // SMEA
    if (typeof data.sm === 'boolean') metadata.smea = data.sm
    if (typeof data.sm_dyn === 'boolean') metadata.smeaDyn = data.sm_dyn
    if (data.skip_cfg_above_sigma !== undefined && data.skip_cfg_above_sigma !== null) metadata.variety = true

    // Resolution
    if (data.width) metadata.width = Number(data.width)
    if (data.height) metadata.height = Number(data.height)

    // V4 prompts (if available)
    if (data.v4_prompt) {
        metadata.v4_prompt = data.v4_prompt as NAIMetadata['v4_prompt']
    }
    if (data.v4_negative_prompt) {
        metadata.v4_negative_prompt = data.v4_negative_prompt as NAIMetadata['v4_negative_prompt']
    }

    // Reference images - Vibe Transfer
    if (data.reference_image_multiple && Array.isArray(data.reference_image_multiple) && data.reference_image_multiple.length > 0) {
        metadata.hasVibeTransfer = true
        metadata.encodedVibes = data.reference_image_multiple as string[]
    }
    if (data.reference_strength_multiple && Array.isArray(data.reference_strength_multiple) && data.reference_strength_multiple.length > 0) {
        metadata.hasVibeTransfer = true

        // Build detailed Vibe Transfer info
        const strengths = data.reference_strength_multiple as number[]
        const infoExtracted = (data.reference_information_extracted_multiple as number[]) || []

        metadata.vibeTransferInfo = strengths.map((strength, i) => ({
            strength,
            informationExtracted: infoExtracted[i] ?? 1.0
        }))
    }

    // Character Reference (director tools)
    if (data.director_reference_strengths && Array.isArray(data.director_reference_strengths) && (data.director_reference_strengths as unknown[]).length > 0) {
        metadata.hasCharacterReference = true

        const strengths = data.director_reference_strengths as number[]
        const secondary = (data.director_reference_secondary_strengths as number[]) || []

        metadata.characterReferenceInfo = strengths.map((strength, i) => ({
            strength,
            informationExtracted: secondary[i] ?? 1.0
        }))
    }

    return metadata
}

/**
 * Parse A1111 format (Stable Diffusion WebUI format)
 * Format: prompt\nNegative prompt: neg\nSteps: X, Sampler: Y, ...
 */
function parseA1111Format(text: string): NAIMetadata | null {
    const lines = text.split('\n')
    if (lines.length < 2) return null

    const metadata: NAIMetadata = {}

    let negativeStart = -1
    let paramsStart = -1

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('Negative prompt:')) {
            negativeStart = i
        } else if (lines[i].match(/^Steps:/)) {
            paramsStart = i
            break
        }
    }

    if (negativeStart === -1 && paramsStart === -1) return null

    // Extract prompt
    const promptEnd = negativeStart !== -1 ? negativeStart : paramsStart
    if (promptEnd > 0) {
        metadata.prompt = lines.slice(0, promptEnd).join('\n')
    }

    // Extract negative prompt
    if (negativeStart !== -1 && paramsStart !== -1) {
        const negLines = lines.slice(negativeStart, paramsStart)
        negLines[0] = negLines[0].replace('Negative prompt: ', '')
        metadata.negativePrompt = negLines.join('\n')
    }

    // Parse params line
    if (paramsStart !== -1) {
        const paramsLine = lines[paramsStart]
        const params = paramsLine.split(', ')

        for (const param of params) {
            const [key, value] = param.split(': ')
            if (!key || !value) continue

            switch (key.trim()) {
                case 'Steps':
                    metadata.steps = parseInt(value)
                    break
                case 'Sampler':
                    metadata.sampler = value
                    break
                case 'CFG scale':
                    metadata.cfgScale = parseFloat(value)
                    break
                case 'Seed':
                    metadata.seed = parseInt(value)
                    break
                case 'Size':
                    const [w, h] = value.split('x')
                    metadata.width = parseInt(w)
                    metadata.height = parseInt(h)
                    break
            }
        }
    }

    return metadata
}

/**
 * Parse metadata from a File object
 */
export async function parseMetadataFromFile(file: File): Promise<NAIMetadata | null> {
    const buffer = await file.arrayBuffer()
    return parseNAIMetadata(buffer)
}

/**
 * Parse metadata from a base64 string
 */
export async function parseMetadataFromBase64(base64: string): Promise<NAIMetadata | null> {
    // Remove data URL prefix if present
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')

    // Convert base64 to ArrayBuffer
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
    }

    return parseNAIMetadata(bytes)
}
