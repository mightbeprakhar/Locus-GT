/**
 * @file quality.js
 * @description Frontier restaurant quality model, validation, and utility contributions (Phase 7A).
 *
 * Mathematical Foundations:
 * Extended Frontier Consumer Utility:
 *   U_ij = V - P_j + gamma * Q_j - alpha * T_ij
 *
 * where:
 *   V     = baseline consumer reservation valuation (default: 500)
 *   P_j   = restaurant price
 *   Q_j   = restaurant quality level (bounded: [0, 10], default: 5)
 *   gamma = consumer sensitivity to quality (default: 10)
 *   alpha = travel friction sensitivity (default: 10)
 *   T_ij  = spatial travel cost between consumer zone i and restaurant j
 *
 * Economic Principles:
 * - Quality creates genuine economic value (+gamma * Q_j utility units) rather than cosmetic scoring.
 * - Quality affects firm profit strictly indirectly through expanded customer demand D_j.
 * - Quality does NOT enter the profit equation directly; profit remains:
 *     pi_j = (P_j - C_j) * D_j - F_j
 * - Network inaccessibility strictly dominates quality: if T_ij = Infinity, U_ij = -Infinity.
 */

/**
 * Default restaurant quality value when omitted (backwards compatibility).
 */
export const DEFAULT_QUALITY = 5;

/**
 * Default marginal consumer valuation sensitivity to quality (gamma).
 * +1 quality point yields +10 utility units.
 */
export const DEFAULT_GAMMA = 10;

/**
 * Bounded canonical quality scale [min, max].
 */
export const DEFAULT_QUALITY_SCALE = Object.freeze({
  min: 0,
  max: 10,
});

/**
 * Validates whether a value is a valid numeric quality within a configured scale.
 *
 * @param {unknown} quality - Value to validate
 * @param {Object} [scale=DEFAULT_QUALITY_SCALE] - Configured min and max bounds
 * @param {number} [scale.min=0]
 * @param {number} [scale.max=10]
 * @returns {boolean} True if quality is a finite number within [min, max]
 */
export function validateFrontierQuality(quality, scale = DEFAULT_QUALITY_SCALE) {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    return false;
  }

  const min = scale?.min ?? DEFAULT_QUALITY_SCALE.min;
  const max = scale?.max ?? DEFAULT_QUALITY_SCALE.max;

  return quality >= min && quality <= max;
}

/**
 * Validates and normalizes an input quality value, returning a valid numeric quality.
 * Throws TypeError or RangeError on invalid input.
 *
 * @param {number} [quality=DEFAULT_QUALITY]
 * @param {Object} [scale=DEFAULT_QUALITY_SCALE]
 * @returns {number} Validated quality value
 */
export function createFrontierQuality(quality = DEFAULT_QUALITY, scale = DEFAULT_QUALITY_SCALE) {
  if (quality === undefined) {
    return DEFAULT_QUALITY;
  }

  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    throw new TypeError(
      `Frontier quality must be a finite number, received ${typeof quality === 'symbol' ? 'symbol' : quality}.`
    );
  }

  const min = scale?.min ?? DEFAULT_QUALITY_SCALE.min;
  const max = scale?.max ?? DEFAULT_QUALITY_SCALE.max;

  if (quality < min || quality > max) {
    throw new RangeError(
      `Frontier quality ${quality} is outside allowed range [${min}, ${max}].`
    );
  }

  return quality;
}

/**
 * Calculates the gross utility contribution of a restaurant's quality:
 *   Delta U = gamma * Q
 *
 * @param {number} quality - Restaurant quality
 * @param {number} [gamma=DEFAULT_GAMMA] - Quality sensitivity factor
 * @param {Object} [scale=DEFAULT_QUALITY_SCALE] - Optional quality scale
 * @returns {number} Utility contribution
 */
export function calculateQualityUtilityContribution(
  quality,
  gamma = DEFAULT_GAMMA,
  scale = DEFAULT_QUALITY_SCALE
) {
  if (!validateFrontierQuality(quality, scale)) {
    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      throw new TypeError(`Quality must be a finite number, received ${quality}.`);
    }
    const min = scale?.min ?? DEFAULT_QUALITY_SCALE.min;
    const max = scale?.max ?? DEFAULT_QUALITY_SCALE.max;
    throw new RangeError(`Quality ${quality} is outside allowed scale [${min}, ${max}].`);
  }

  if (typeof gamma !== 'number' || !Number.isFinite(gamma)) {
    throw new TypeError(`Gamma sensitivity parameter must be a finite number, received ${gamma}.`);
  }

  return gamma * quality;
}

/**
 * Validates and normalizes quality configuration parameters.
 *
 * @param {Object} [config={}]
 * @param {number} [config.gamma=DEFAULT_GAMMA]
 * @param {{ min?: number, max?: number }} [config.qualityScale=DEFAULT_QUALITY_SCALE]
 * @returns {Readonly<{ gamma: number, qualityScale: { min: number, max: number } }>}
 */
export function validateQualityConfig(config = {}) {
  if (config === null || typeof config !== 'object') {
    throw new TypeError('validateQualityConfig requires an options object.');
  }

  const gamma = config.gamma ?? DEFAULT_GAMMA;
  if (typeof gamma !== 'number' || !Number.isFinite(gamma)) {
    throw new TypeError(`Quality sensitivity factor (gamma) must be a finite number, received ${gamma}.`);
  }

  const rawScale = config.qualityScale ?? DEFAULT_QUALITY_SCALE;
  const min = rawScale.min ?? DEFAULT_QUALITY_SCALE.min;
  const max = rawScale.max ?? DEFAULT_QUALITY_SCALE.max;

  if (typeof min !== 'number' || !Number.isFinite(min) || typeof max !== 'number' || !Number.isFinite(max)) {
    throw new TypeError('Quality scale min and max must be finite numbers.');
  }

  if (min > max) {
    throw new RangeError(`Invalid quality scale: min (${min}) cannot exceed max (${max}).`);
  }

  return Object.freeze({
    gamma,
    qualityScale: Object.freeze({ min, max }),
  });
}
