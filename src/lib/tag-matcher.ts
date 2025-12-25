import tagsData from '@/assets/tags.json'
import Fuse from 'fuse.js'

// --- Types ---
interface Tag {
    label: string
    value: string
    count: number
    type: string
}

export interface TagMatchResult {
    original: string      // LLM이 생성한 태그
    matched: Tag | null   // 매칭된 태그 (없으면 null)
    alternatives: Tag[]   // Fuzzy 검색 결과 (매칭 실패 시)
    status: 'matched' | 'fuzzy' | 'unmatched'
}

// --- Constants ---
const ALL_TAGS = tagsData as Tag[]

// 동의어 사전 (LLM 출력 → Danbooru 태그)
const SYNONYMS: Record<string, string> = {
    'naked': 'nude',
    'blonde': 'blonde_hair',
    'brunette': 'brown_hair',
    'redhead': 'red_hair',
    'duo': '1boy, 1girl',  // 특수 케이스: 복수 태그로 확장
    'couple': '1boy, 1girl',
    'big breasts': 'large_breasts',
    'small breasts': 'flat_chest',
    'short': 'short_hair',
    'long': 'long_hair',
}

// Fuse.js 인스턴스 생성 (한 번만 생성하여 재사용)
const fuse = new Fuse(ALL_TAGS, {
    keys: ['label'],
    threshold: 0.3,       // 더 엄격하게 (0.4 → 0.3)
    distance: 50,         // 거리 제한 강화 (100 → 50)
    includeScore: true,
    minMatchCharLength: 2,
})

/**
 * 동의어 확장 - 하나의 태그를 여러 태그로 확장할 수 있음
 */
function expandSynonyms(tag: string): string[] {
    const normalized = tag.trim().toLowerCase()
    const synonym = SYNONYMS[normalized]

    if (synonym) {
        // 쉼표가 있으면 여러 태그로 분리
        if (synonym.includes(',')) {
            return synonym.split(',').map(t => t.trim())
        }
        return [synonym]
    }
    return [normalized]
}

/**
 * 단일 태그 매칭
 */
function matchSingleTag(tag: string): TagMatchResult {
    // 언더스코어를 띄어쓰기로 변환 (LLM은 open_mouth로 출력하지만 DB는 open mouth)
    const normalizedTag = tag.trim().toLowerCase().replace(/_/g, ' ')

    if (!normalizedTag) {
        return {
            original: tag,
            matched: null,
            alternatives: [],
            status: 'unmatched'
        }
    }

    // 1단계: 정확한 매칭 (exact match)
    const exactMatch = ALL_TAGS.find(t => t.label.toLowerCase() === normalizedTag)
    if (exactMatch) {
        return {
            original: tag,
            matched: exactMatch,
            alternatives: [],
            status: 'matched'
        }
    }

    // 2단계: 동의어로 매칭 시도
    const synonymTag = SYNONYMS[normalizedTag.replace(/_/g, ' ')] || SYNONYMS[normalizedTag]
    if (synonymTag && !synonymTag.includes(',')) {
        const synonymMatch = ALL_TAGS.find(t => t.label.toLowerCase() === synonymTag.toLowerCase())
        if (synonymMatch) {
            return {
                original: tag,
                matched: synonymMatch,
                alternatives: [],
                status: 'matched'
            }
        }
    }

    // 3단계: Prefix 매칭 (입력이 태그의 시작과 일치하면 우선)
    const prefixMatches = ALL_TAGS
        .filter(t => t.label.toLowerCase().startsWith(normalizedTag))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

    if (prefixMatches.length > 0) {
        return {
            original: tag,
            matched: null,
            alternatives: prefixMatches,
            status: 'fuzzy'
        }
    }

    // 4단계: Fuzzy 검색
    const fuzzyResults = fuse.search(normalizedTag)

    if (fuzzyResults.length > 0) {
        // 상위 5개 결과를 대안으로 제시
        const alternatives = fuzzyResults
            .slice(0, 5)
            .map(r => r.item)
            .sort((a, b) => b.count - a.count) // 인기순 정렬

        return {
            original: tag,
            matched: null,
            alternatives,
            status: 'fuzzy'
        }
    }

    // 5단계: 매칭 실패
    return {
        original: tag,
        matched: null,
        alternatives: [],
        status: 'unmatched'
    }
}

/**
 * 여러 태그 매칭
 * @param llmTags LLM이 생성한 태그 배열
 * @returns 매칭 결과 배열
 */
export function matchTags(llmTags: string[]): TagMatchResult[] {
    const results: TagMatchResult[] = []

    for (const tag of llmTags) {
        // 동의어 확장
        const expandedTags = expandSynonyms(tag)

        for (const expandedTag of expandedTags) {
            results.push(matchSingleTag(expandedTag))
        }
    }

    return results
}

/**
 * 쉼표로 구분된 태그 문자열을 파싱하고 매칭
 * @param tagString "tag1, tag2, tag3" 형태의 문자열
 * @returns 매칭 결과 배열
 */
export function parseAndMatchTags(tagString: string): TagMatchResult[] {
    const tags = tagString
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

    return matchTags(tags)
}

/**
 * 태그 검색 (자동완성용)
 * @param query 검색어
 * @param limit 최대 결과 수
 */
export function searchTags(query: string, limit: number = 10): Tag[] {
    const normalizedQuery = query.trim().toLowerCase()

    if (normalizedQuery.length < 2) return []

    const results = fuse.search(normalizedQuery, { limit })
    return results.map(r => r.item)
}
