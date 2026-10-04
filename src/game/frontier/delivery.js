/**
 * @file delivery.js
 * @description Frontier Delivery Economy Foundation — Configuration, Availability, Time, and Utility (Phase 8A).
 *
 * Mathematical Foundations:
 * 1. Dine-In Consumer Utility for Segment k:
 *    U_ij,D^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij
 *
 * 2. Delivery Consumer Utility for Segment k:
 *    U_ij,L^(k) = V_k - beta_k * (P_j + F_j) + gamma_k * Q_j - alpha_k * T_ij - delta_k * tau_ij
 *
 * 3. Delivery Duration / Time:
 *    tau_ij = baseTime_j + timePerDistance_j * T_ij
 *    (deterministic linear function of spatial travel cost; at T_ij = 0, tau_ij = baseTime_j)
 *
 * 4. Delivery Availability:
 *    Delivery from restaurant j to consumer zone i is available if and only if:
 *      deliveryConfig_j.enabled === true
 *      AND T_ij < Infinity (zone is reachable)
 *      AND T_ij <= deliveryConfig_j.radius (inclusive radius boundary)
 *
 * Parameters:
 *   k                = consumer segment identifier
 *   V_k              = baseline reservation valuation (>= 0)
 *   beta_k           = price sensitivity (>= 0)
 *   P_j              = restaurant menu price (>= 0)
 *   F_j              = consumer-facing delivery fee (>= 0)
 *   gamma_k          = quality sensitivity (>= 0)
 *   Q_j              = restaurant quality level (within configured quality scale)
 *   alpha_k          = travel / spatial friction sensitivity (>= 0)
 *   T_ij             = spatial travel cost between consumer zone i and restaurant j (Euclidean or Road)
 *   delta_k          = delivery-time sensitivity (>= 0)
 *   baseTime_j       = baseline order preparation and handover time (>= 0)
 *   timePerDistance_j= additional delivery time per unit of travel cost (>= 0)
 *   radius_j         = maximum delivery radius measured in travel cost units (>= 0)
 *
 * Economic & System Principles:
 * - Consumer-Facing Delivery Fee: F_j directly reduces consumer utility via price sensitivity beta_k.
 * - Delivery Time: tau_ij directly reduces consumer utility via delivery-time sensitivity delta_k.
 * - Firm Profit Separation (Phase 8A Hard Boundary):
 *     Delivery fee is strictly a consumer-facing utility component in Phase 8A.
 *     It is NOT yet added to restaurant revenue or deducted from restaurant profit.
 * - Aggregator Economics Deferred:
 *     Swiggy/Zomato-style platform commissions, listings, and exposure belong to Phase 8C.
 * - Delivery is Non-Strategic:
 *     Delivery configuration parameters are simulation/economic attributes, NOT firm decision variables.
 *     Strategy spaces, pure Nash equilibria, and best-response dynamics remain strictly (location, price, quality).
 * - Optionality & Backward Compatibility:
 *     When delivery is disabled (enabled: false), consumers only evaluate dine-in, preserving existing Frontier behavior.
 */

import { DEFAULT_PARAMS } from '../types.js';
import {
  DEFAULT_QUALITY,
  DEFAULT_GAMMA,
  DEFAULT_QUALITY_SCALE,
  validateFrontierQuality,
} from './quality.js';
import { DEFAULT_BETA, DEFAULT_DELTA } from './consumerSegments.js';

/**
 * Default delivery configuration with delivery disabled (inactive by default).
 */
export const DEFAULT_DELIVERY_CONFIG = Object.freeze({
  enabled: false,
  radius: 4,
  fee: 40,
  baseTime: 10,
  timePerDistance: 4,
});

/**
 * Canonical active delivery configuration preset with delivery enabled.
 */
export const CANONICAL_DELIVERY_CONFIG = Object.freeze({
  enabled: true,
  radius: 4,
  fee: 40,
  baseTime: 10,
  timePerDistance: 4,
});

/**
 * Validates a delivery configuration object.
 * Throws TypeError or RangeError on invalid input.
 *
 * @param {unknown} config - Delivery configuration candidate
 * @returns {boolean} True if the configuration is structurally and mathematically valid
 */
export function validateDeliveryConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Delivery configuration must be a valid non-null object.');
  }

  const { enabled, radius, fee, baseTime, timePerDistance } = config;

  if (typeof enabled !== 'boolean') {
    throw new TypeError('Delivery configuration "enabled" must be a boolean.');
  }

  if (typeof radius !== 'number' || !Number.isFinite(radius)) {
    throw new TypeError('Delivery configuration "radius" must be a finite number.');
  }

  if (radius < 0) {
    throw new RangeError(`Delivery configuration "radius" must be non-negative, received ${radius}.`);
  }

  if (typeof fee !== 'number' || !Number.isFinite(fee)) {
    throw new TypeError('Delivery configuration "fee" must be a finite number.');
  }

  if (fee < 0) {
    throw new RangeError(`Delivery configuration "fee" must be non-negative, received ${fee}.`);
  }

  if (typeof baseTime !== 'number' || !Number.isFinite(baseTime)) {
    throw new TypeError('Delivery configuration "baseTime" must be a finite number.');
  }

  if (baseTime < 0) {
    throw new RangeError(`Delivery configuration "baseTime" must be non-negative, received ${baseTime}.`);
  }

  if (typeof timePerDistance !== 'number' || !Number.isFinite(timePerDistance)) {
    throw new TypeError('Delivery configuration "timePerDistance" must be a finite number.');
  }

  if (timePerDistance < 0) {
    throw new RangeError(
      `Delivery configuration "timePerDistance" must be non-negative, received ${timePerDistance}.`
    );
  }

  return true;
}

/**
 * Creates and normalizes an immutable delivery configuration object.
 *
 * @param {Object} [config={}]
 * @param {boolean} [config.enabled=true] - Whether delivery is enabled
 * @param {number} [config.radius=4] - Delivery radius in travel-cost units
 * @param {number} [config.fee=40] - Consumer delivery fee
 * @param {number} [config.baseTime=10] - Baseline order preparation/dispatch time
 * @param {number} [config.timePerDistance=4] - Delivery time per unit of travel cost
 * @returns {Readonly<{
 *   enabled: boolean,
 *   radius: number,
 *   fee: number,
 *   baseTime: number,
 *   timePerDistance: number
 * }>}
 */
export function createDeliveryConfig(config = {}) {
  const candidate = {
    enabled: config.enabled !== undefined ? config.enabled : true,
    radius: config.radius !== undefined ? config.radius : CANONICAL_DELIVERY_CONFIG.radius,
    fee: config.fee !== undefined ? config.fee : CANONICAL_DELIVERY_CONFIG.fee,
    baseTime: config.baseTime !== undefined ? config.baseTime : CANONICAL_DELIVERY_CONFIG.baseTime,
    timePerDistance:
      config.timePerDistance !== undefined
        ? config.timePerDistance
        : CANONICAL_DELIVERY_CONFIG.timePerDistance,
  };

  validateDeliveryConfig(candidate);

  return Object.freeze({
    enabled: candidate.enabled,
    radius: candidate.radius,
    fee: candidate.fee,
    baseTime: candidate.baseTime,
    timePerDistance: candidate.timePerDistance,
  });
}

/**
 * Determines whether delivery service is available from a restaurant to a consumer zone.
 *
 * Rules:
 * 1. If delivery is disabled (enabled === false): unavailable.
 * 2. If travel cost is unreachable (travelCost === Infinity or not finite): unavailable.
 * 3. If travelCost <= radius: available (inclusive boundary).
 * 4. If travelCost > radius: unavailable.
 *
 * @param {Object} params
 * @param {number} params.travelCost - Spatial travel cost T_ij
 * @param {Object} params.deliveryConfig - Delivery configuration
 * @returns {boolean} True if delivery is available
 */
export function isDeliveryAvailable({ travelCost, deliveryConfig }) {
  if (typeof travelCost !== 'number' || Number.isNaN(travelCost)) {
    throw new TypeError('isDeliveryAvailable requires a numeric travelCost.');
  }

  if (travelCost < 0) {
    throw new RangeError(`isDeliveryAvailable travelCost must be non-negative, received ${travelCost}.`);
  }

  if (!deliveryConfig || typeof deliveryConfig !== 'object') {
    throw new TypeError('isDeliveryAvailable requires a valid deliveryConfig object.');
  }

  validateDeliveryConfig(deliveryConfig);

  if (!deliveryConfig.enabled) {
    return false;
  }

  if (travelCost === Infinity || !Number.isFinite(travelCost)) {
    return false;
  }

  return travelCost <= deliveryConfig.radius;
}

/**
 * Computes deterministic delivery duration / time:
 *   tau_ij = baseTime_j + timePerDistance_j * T_ij
 *
 * Throws RangeError if travel cost is unreachable (Infinity).
 *
 * @param {Object} params
 * @param {number} params.travelCost - Reachable spatial travel cost T_ij
 * @param {Object} params.deliveryConfig - Delivery configuration
 * @returns {number} Calculated delivery time in duration units
 */
export function calculateDeliveryTime({ travelCost, deliveryConfig }) {
  if (typeof travelCost !== 'number' || Number.isNaN(travelCost)) {
    throw new TypeError('calculateDeliveryTime requires a numeric travelCost.');
  }

  if (travelCost < 0) {
    throw new RangeError(`calculateDeliveryTime travelCost must be non-negative, received ${travelCost}.`);
  }

  if (travelCost === Infinity || !Number.isFinite(travelCost)) {
    throw new RangeError('Cannot calculate delivery time for unreachable destination.');
  }

  if (!deliveryConfig || typeof deliveryConfig !== 'object') {
    throw new TypeError('calculateDeliveryTime requires a valid deliveryConfig object.');
  }

  validateDeliveryConfig(deliveryConfig);

  return deliveryConfig.baseTime + deliveryConfig.timePerDistance * travelCost;
}

/**
 * Computes consumer utility for the delivery option U_ij,L^(k):
 *   U_ij,L^(k) = V_k - beta_k * (P_j + F_j) + gamma_k * Q_j - alpha_k * T_ij - delta_k * tau_ij
 *
 * Returns -Infinity if travel cost is unreachable or if delivery is unavailable.
 *
 * @param {Object} params
 * @param {number} params.travelCost - Spatial travel cost T_ij
 * @param {number} params.price - Restaurant price P_j
 * @param {number} [params.quality=DEFAULT_QUALITY] - Restaurant quality level Q_j
 * @param {Object} params.deliveryConfig - Restaurant delivery configuration
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Baseline reservation valuation
 * @param {number} [params.beta=DEFAULT_BETA] - Price sensitivity
 * @param {number} [params.gamma=DEFAULT_GAMMA] - Quality sensitivity
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity
 * @param {number} [params.delta=DEFAULT_DELTA] - Delivery-time sensitivity
 * @param {Object} [params.qualityScale=DEFAULT_QUALITY_SCALE] - Configured quality scale bounds
 * @returns {number} Calculated delivery utility (or -Infinity if unavailable)
 */
export function calculateDeliveryUtility({
  travelCost,
  price,
  quality = DEFAULT_QUALITY,
  deliveryConfig,
  V = DEFAULT_PARAMS.V,
  beta = DEFAULT_BETA,
  gamma = DEFAULT_GAMMA,
  alpha = DEFAULT_PARAMS.alpha,
  delta = DEFAULT_DELTA,
  qualityScale = DEFAULT_QUALITY_SCALE,
}) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('calculateDeliveryUtility requires a finite price.');
  }

  if (price < 0) {
    throw new RangeError(`calculateDeliveryUtility price must be non-negative, received ${price}.`);
  }

  if (typeof travelCost !== 'number' || Number.isNaN(travelCost)) {
    throw new TypeError('calculateDeliveryUtility requires a numeric travelCost.');
  }

  if (travelCost < 0) {
    throw new RangeError(`calculateDeliveryUtility travelCost must be non-negative, received ${travelCost}.`);
  }

  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    throw new TypeError('calculateDeliveryUtility requires a finite quality.');
  }

  const scale = qualityScale ?? DEFAULT_QUALITY_SCALE;
  if (!validateFrontierQuality(quality, scale)) {
    throw new RangeError(
      `calculateDeliveryUtility quality ${quality} is outside allowed scale [${scale.min}, ${scale.max}].`
    );
  }

  if (
    typeof V !== 'number' ||
    !Number.isFinite(V) ||
    typeof alpha !== 'number' ||
    !Number.isFinite(alpha) ||
    typeof gamma !== 'number' ||
    !Number.isFinite(gamma)
  ) {
    throw new TypeError('calculateDeliveryUtility requires finite V, alpha, and gamma values.');
  }

  if (typeof beta !== 'number' || !Number.isFinite(beta)) {
    throw new TypeError('calculateDeliveryUtility requires a finite beta value.');
  }

  if (beta < 0) {
    throw new RangeError(`calculateDeliveryUtility beta must be non-negative, received ${beta}.`);
  }

  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new TypeError('calculateDeliveryUtility requires a finite delta value.');
  }

  if (delta < 0) {
    throw new RangeError(`calculateDeliveryUtility delta must be non-negative, received ${delta}.`);
  }

  if (!deliveryConfig || typeof deliveryConfig !== 'object') {
    throw new TypeError('calculateDeliveryUtility requires a valid deliveryConfig object.');
  }

  validateDeliveryConfig(deliveryConfig);

  // Availability check
  if (!isDeliveryAvailable({ travelCost, deliveryConfig })) {
    return -Infinity;
  }

  const deliveryTime = calculateDeliveryTime({ travelCost, deliveryConfig });

  return (
    V -
    beta * (price + deliveryConfig.fee) +
    gamma * quality -
    alpha * travelCost -
    delta * deliveryTime
  );
}
