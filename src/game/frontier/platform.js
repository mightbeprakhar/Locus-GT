/**
 * @file platform.js
 * @description Frontier Aggregator / Platform Economics & Commission Model (Phase 8C).
 *
 * Mathematical Foundations:
 * 1. Platform Commission Model:
 *      C_platform,j = m_j * P_j * D_delivery,j
 *    where:
 *      m_j           = platform commission rate (fraction in [0, 1])
 *      P_j           = restaurant food menu price
 *      D_delivery,j  = actual delivery demand served by restaurant j
 *
 * 2. Revenue Interpretation & Hard Boundaries:
 *    - Commission applies ONLY to delivery demand (D_delivery).
 *    - Dine-in demand incurs ZERO platform commission.
 *    - Consumer delivery fee (F_j from Phase 8A) is NOT commissioned.
 *    - Delivery operating cost (C_delivery from Phase 8B) is NOT commissioned.
 *    - When platform is disabled (enabled === false), C_platform,j === 0.
 *
 * 3. Consumer Utility Separation:
 *    Platform commission is strictly a restaurant-side operational expense.
 *    It does NOT enter consumer utility U_delivery directly.
 *
 * 4. Non-Strategic Boundary:
 *    Platform commission is an exogenous model parameter in Phase 8C.
 *    Neither firms nor the platform strategically optimize m_j in this phase.
 */

/**
 * Default platform commission rate (20% of food price on delivery orders).
 */
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.2;

/**
 * Default immutable platform configuration (inactive / disabled by default).
 */
export const DEFAULT_PLATFORM_CONFIG = Object.freeze({
  enabled: false,
  commissionRate: DEFAULT_PLATFORM_COMMISSION_RATE,
});

/**
 * Canonical active platform configuration preset (enabled with default 20% commission).
 */
export const CANONICAL_PLATFORM_CONFIG = Object.freeze({
  enabled: true,
  commissionRate: DEFAULT_PLATFORM_COMMISSION_RATE,
});

/**
 * Validates a platform configuration object.
 * Throws TypeError or RangeError on invalid input.
 *
 * Requirements:
 * - config must be a valid non-null object
 * - enabled must be a boolean
 * - commissionRate must be a finite number in [0, 1]
 *
 * @param {unknown} config - Platform configuration candidate
 * @returns {boolean} True if structurally and mathematically valid
 */
export function validatePlatformConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Platform configuration must be a valid non-null object.');
  }

  const { enabled, commissionRate } = config;

  if (typeof enabled !== 'boolean') {
    throw new TypeError('Platform configuration "enabled" must be a boolean.');
  }

  if (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate)) {
    throw new TypeError(
      `Platform configuration "commissionRate" must be a finite number, received ${commissionRate}.`
    );
  }

  if (commissionRate < 0 || commissionRate > 1) {
    throw new RangeError(
      `Platform configuration "commissionRate" must be between 0 and 1, received ${commissionRate}.`
    );
  }

  return true;
}

/**
 * Creates and normalizes an immutable platform configuration object.
 *
 * @param {Object} [overrides={}]
 * @param {boolean} [overrides.enabled=false] - Whether platform aggregator commission is enabled
 * @param {number} [overrides.commissionRate=0.20] - Commission rate fraction in [0, 1]
 * @returns {Readonly<{
 *   enabled: boolean,
 *   commissionRate: number
 * }>}
 */
export function createPlatformConfig(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object') {
    throw new TypeError('createPlatformConfig overrides must be an object.');
  }

  const candidate = {
    enabled:
      overrides.enabled !== undefined
        ? overrides.enabled
        : DEFAULT_PLATFORM_CONFIG.enabled,
    commissionRate:
      overrides.commissionRate !== undefined
        ? overrides.commissionRate
        : DEFAULT_PLATFORM_COMMISSION_RATE,
  };

  validatePlatformConfig(candidate);

  return Object.freeze(candidate);
}

/**
 * Calculates platform commission charged to a restaurant on actual delivery demand:
 *   C_platform = enabled ? commissionRate * price * deliveryDemand : 0
 *
 * Critical Model Rules:
 * - Applies strictly to delivery orders (D_delivery).
 * - Dine-in orders are never commissioned.
 * - Consumer delivery fee is not commissioned.
 * - Returns 0 if platform is disabled, deliveryDemand is 0, commissionRate is 0, or price is 0.
 *
 * @param {Object} params
 * @param {number} params.price - Restaurant menu food price (>= 0)
 * @param {number} params.deliveryDemand - Actual delivery demand served (>= 0)
 * @param {Object} [params.config=DEFAULT_PLATFORM_CONFIG] - Platform configuration
 * @returns {number} Calculated platform commission (>= 0)
 */
export function calculatePlatformCommission(params = {}) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('calculatePlatformCommission requires a parameters object.');
  }

  const { price, deliveryDemand, config } = params;

  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError(`Restaurant price must be a finite number, received ${price}.`);
  }

  if (price < 0) {
    throw new RangeError(`Restaurant price must be non-negative, received ${price}.`);
  }

  if (typeof deliveryDemand !== 'number' || !Number.isFinite(deliveryDemand)) {
    throw new TypeError(`Delivery demand must be a finite number, received ${deliveryDemand}.`);
  }

  if (deliveryDemand < 0) {
    throw new RangeError(`Delivery demand must be non-negative, received ${deliveryDemand}.`);
  }

  const platformConfig =
    config !== undefined
      ? (validatePlatformConfig(config), config)
      : DEFAULT_PLATFORM_CONFIG;

  if (!platformConfig.enabled) {
    return 0;
  }

  if (deliveryDemand === 0 || platformConfig.commissionRate === 0 || price === 0) {
    return 0;
  }

  return platformConfig.commissionRate * price * deliveryDemand;
}
