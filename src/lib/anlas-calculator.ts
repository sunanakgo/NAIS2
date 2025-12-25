/**
 * NovelAI Anlas Cost Calculator
 * Based on official pricing structure
 */

// Free generation limit (Opus tier)
const FREE_PIXEL_LIMIT = 1024 * 1024  // 1 megapixel
const FREE_STEPS_LIMIT = 28

// Base cost for paid generations
const BASE_ANLAS_COST = 5

/**
 * Calculate Anlas cost for image generation
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param steps Number of generation steps
 * @param batchCount Number of images to generate
 * @param isOpus Whether user has Opus tier subscription
 * @returns Anlas cost (0 if free)
 */
export function calculateAnlasCost(
    width: number,
    height: number,
    steps: number,
    batchCount: number = 1,
    charCount: number = 0,
    vibeCount: number = 0,
    isOpus: boolean = true
): number {
    const totalPixels = width * height

    // Opus tier: Free if within limits and single generation
    if (isOpus && totalPixels <= FREE_PIXEL_LIMIT && steps <= FREE_STEPS_LIMIT && batchCount === 1) {
        return 0
    }

    // Calculate base cost
    let cost = BASE_ANLAS_COST

    // Higher resolution costs more
    if (totalPixels > FREE_PIXEL_LIMIT) {
        const pixelMultiplier = Math.ceil(totalPixels / FREE_PIXEL_LIMIT)
        cost = cost * pixelMultiplier
    }

    // More steps cost more
    if (steps > FREE_STEPS_LIMIT) {
        const stepsMultiplier = Math.ceil(steps / FREE_STEPS_LIMIT)
        cost = cost * stepsMultiplier
    }

    // Add extra costs for features (Fixed costs per generation)
    if (charCount > 0) {
        cost += 5 // Character Reference fixed cost
    }

    if (vibeCount > 0) {
        cost += (vibeCount * 2) // Vibe Transfer per image cost
    }

    // Batch generation does NOT multiply cost (User request: "Picking one by one")
    // Use cost as per-image cost. The loop in generation handles total cost deduction.
    // cost = cost * batchCount // REMOVED

    return cost
}

/**
 * Calculate ONLY the extra costs from features (Char Ref, Vibe Transfer)
 * Does not include base cost (Resolution/Steps) or Batch multiplier
 */
export function calculateExtraCost(charCount: number, vibeCount: number): number {
    let cost = 0
    if (charCount > 0) cost += 5
    if (vibeCount > 0) cost += (vibeCount * 2)
    return cost
}

/**
 * Check if generation is free (Opus tier)
 */
export function isFreeGeneration(
    width: number,
    height: number,
    steps: number,
    batchCount: number = 1
): boolean {
    const totalPixels = width * height
    return totalPixels <= FREE_PIXEL_LIMIT && steps <= FREE_STEPS_LIMIT && batchCount === 1
}

/**
 * Get pixel count category
 */
export function getPixelCategory(width: number, height: number): 'small' | 'normal' | 'large' {
    const totalPixels = width * height
    if (totalPixels < 512 * 512) return 'small'
    if (totalPixels <= FREE_PIXEL_LIMIT) return 'normal'
    return 'large'
}
