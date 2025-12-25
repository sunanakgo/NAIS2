/**
 * Wildcard Processor
 * 프롬프트에서 와일드카드를 랜덤 선택으로 치환
 * 
 * 지원 형식:
 * 1. 괄호 형식 (권장): (option1/option2/option3)
 *    - 각 옵션에 쉼표 포함 가능: (white hair, blue eyes/red hair, purple eyes)
 * 2. 단순 형식: red/blue/green (쉼표로 구분된 단일 태그 내에서만)
 */

/**
 * 괄호로 감싸진 와일드카드 처리
 * "(a, b/c, d/e, f)" → "a, b" 또는 "c, d" 또는 "e, f" 중 하나
 */
function processParenthesisWildcards(prompt: string): string {
    // 괄호 안에 슬래시가 있는 패턴 찾기
    // 중첩 괄호는 지원하지 않음
    const parenPattern = /\(([^()]+\/[^()]+)\)/g

    return prompt.replace(parenPattern, (_match, content: string) => {
        // 슬래시로 옵션 분리
        const options = content.split('/').map((o: string) => o.trim()).filter((o: string) => o.length > 0)

        if (options.length <= 1) {
            return content // 와일드카드 아님
        }

        // 랜덤 선택
        const randomIndex = Math.floor(Math.random() * options.length)
        return options[randomIndex]
    })
}

/**
 * 쉼표로 구분된 태그 내에서 단순 와일드카드 처리
 * "tag1, a/b/c, tag2" → "tag1, [선택된값], tag2"
 * 주의: 공백이 포함된 옵션은 괄호 형식 사용 필요
 */
function processSimpleWildcards(prompt: string): string {
    // 쉼표로 태그 분리
    const tags = prompt.split(',')

    const processedTags = tags.map(tag => {
        const trimmed = tag.trim()

        // 슬래시가 있고, URL이 아니며, 공백이 없는 단순 형태만 처리
        // 공백이 있으면 괄호 형식을 사용해야 함
        if (trimmed.includes('/') &&
            !trimmed.startsWith('http') &&
            !trimmed.includes('://') &&
            !trimmed.includes(' ')) {

            const options = trimmed.split('/').map(o => o.trim()).filter(o => o.length > 0)
            if (options.length > 1) {
                const randomIndex = Math.floor(Math.random() * options.length)
                return options[randomIndex]
            }
        }

        return trimmed
    })

    return processedTags.join(', ')
}

/**
 * 프롬프트에서 모든 와일드카드 처리
 * @param prompt 원본 프롬프트
 * @returns 와일드카드가 랜덤 선택으로 치환된 프롬프트
 * 
 * 사용 예시:
 * - (white hair, blue eyes/red hair, purple eyes) → 세트 중 하나 선택
 * - red/blue/green_hair → 단순 옵션 중 하나 선택
 * - (long hair/short hair), smile → 괄호 내 선택 + 일반 태그
 */
export function processWildcards(prompt: string): string {
    if (!prompt) return prompt

    let result = prompt

    // 1단계: 괄호 형식 와일드카드 처리 (우선 - 쉼표 포함 옵션 지원)
    // (white hair, blue eyes/red hair, purple eyes) → 선택된 세트
    result = processParenthesisWildcards(result)

    // 2단계: 단순 와일드카드 처리 (공백 없는 단일 태그만)
    // red/blue/green → 선택된 값
    result = processSimpleWildcards(result)

    return result
}

/**
 * 프롬프트에 와일드카드가 있는지 확인
 */
export function hasWildcards(prompt: string): boolean {
    if (!prompt) return false

    // 괄호 형식 체크
    const parenPattern = /\([^()]+\/[^()]+\)/
    if (parenPattern.test(prompt)) return true

    // 단순 형식 체크 (쉼표로 구분된 태그 내 슬래시, 공백 없음)
    const tags = prompt.split(',')
    for (const tag of tags) {
        const trimmed = tag.trim()
        if (trimmed.includes('/') &&
            !trimmed.startsWith('http') &&
            !trimmed.includes('://') &&
            !trimmed.includes(' ')) {
            return true
        }
    }

    return false
}
