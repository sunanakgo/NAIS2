/**
 * Google Gemini API Service
 * 자연어를 단부루 태그 스타일 프롬프트로 변환
 */

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// 시스템 프롬프트
const SYSTEM_PROMPT = `You are an expert at creating image generation prompts for NovelAI and Stable Diffusion.
Your task is to convert user requests into Danbooru-style tags.

Rules:
1. Output ONLY comma-separated English tags, nothing else
2. Use lowercase letters with underscores for multi-word tags (e.g., "long_hair" not "long hair")
3. Start with character count tags (1girl, 1boy, 2girls, etc.) if applicable
4. Include general tags (solo, couple, group, etc.)
5. Add appearance tags (hair color, eye color, body features)
6. Include clothing and accessories
7. Add pose/action tags (sitting, standing, eating, etc.)
8. Include background/location tags (indoors, outdoors, etc.)
9. Do NOT include quality tags like "masterpiece", "best quality", "highres", "absurdres", etc.
10. Focus ONLY on describing what the user requested, nothing extra

Example input: "A girl eating ramen at a Japanese restaurant"
Example output: 1girl, solo, eating, ramen, chopsticks, noodles, bowl, restaurant, indoors, table, sitting, steam, food

Now convert the following request to Danbooru tags:`

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string
            }>
        }
    }>
    error?: {
        message: string
        code: number
    }
}

export interface GenerateTagsResult {
    success: boolean
    tags: string[]
    rawResponse?: string
    error?: string
}

// Available Gemini models
export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)' },
] as const

export type GeminiModel = typeof GEMINI_MODELS[number]['id']

/**
 * Gemini API를 사용하여 자연어를 태그로 변환
 */
export async function generateTagsFromPrompt(
    userInput: string,
    apiKey: string,
    model: GeminiModel = 'gemini-2.5-flash'
): Promise<GenerateTagsResult> {
    if (!apiKey) {
        return {
            success: false,
            tags: [],
            error: 'API key is required'
        }
    }

    if (!userInput.trim()) {
        return {
            success: false,
            tags: [],
            error: 'Input is empty'
        }
    }

    try {
        const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `${SYSTEM_PROMPT}\n\n"${userInput}"`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            return {
                success: false,
                tags: [],
                error: `API Error: ${response.status} - ${errorData.error?.message || response.statusText}`
            }
        }

        const data: GeminiResponse = await response.json()

        if (data.error) {
            return {
                success: false,
                tags: [],
                error: `Gemini Error: ${data.error.message}`
            }
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // 태그 파싱: 쉼표로 분리하고 정리
        const tags = text
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0)
            // 불필요한 문자 제거 (따옴표, 줄바꿈 등)
            .map(t => t.replace(/["\n\r]/g, '').trim())
            .filter(t => t.length > 0)

        return {
            success: true,
            tags,
            rawResponse: text
        }

    } catch (error) {
        console.error('Gemini API Error:', error)
        return {
            success: false,
            tags: [],
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    }
}

/**
 * Gemini API 키 유효성 검사
 */
export async function verifyGeminiApiKey(apiKey: string): Promise<boolean> {
    if (!apiKey || apiKey.length < 10) {
        return false
    }

    try {
        // 간단한 테스트 요청
        const result = await generateTagsFromPrompt('test', apiKey)
        return result.success || !result.error?.includes('API key')
    } catch {
        return false
    }
}
