/**
 * @file consumerSegments.js
 * @description Frontier heterogeneous consumer segment preferences and validation (Phase 7B & Phase 8A).
 *
 * Mathematical Foundations:
 * Extended Frontier Consumer Utility for Segment k:
 *   Dine-In:
 *     U_ij,D^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij
 *   Delivery (Phase 8A):
 *     U_ij,L^(k) = V_k - beta_k * (P_j + F_j) + gamma_k * Q_j - alpha_k * T_ij - delta_k * tau_ij
 *
 * where:
 *   k        = consumer segment identifier
 *   V_k      = segment baseline consumer reservation valuation (>= 0)
 *   beta_k   = segment price sensitivity (>= 0)
 *   P_j      = restaurant price
 *   F_j      = restaurant delivery fee (>= 0)
 *   gamma_k  = segment quality sensitivity (>= 0)
 *   Q_j      = restaurant quality level
 *   alpha_k  = segment travel / spatial friction sensitivity (>= 0)
 *   T_ij     = spatial travel cost between consumer zone i and restaurant j
 *   delta_k  = segment delivery-time sensitivity (>= 0)
 *   tau_ij   = delivery duration = baseTime_j + timePerDistance_j * T_ij
 *
 * Economic Principles:
 * - Heterogeneous preferences allow different consumer groups to make different choices
 *   between the exact same pair of restaurants and service modes (dine-in vs delivery).
 * - Fractional deterministic population allocation:
 *     segmentPopulation_ik = zonePopulation_i * populationShare_k
 * - No random sampling or Monte Carlo simulation: all allocations are strictly deterministic.
 * - Quality, price, fees, and delivery time affect firm profit strictly indirectly through consumer utility and demand.
 * - Spatial inaccessibility strictly dominates: if T_ij = Infinity, U_ij = -Infinity.
 */

import { DEFAULT_PARAMS } from '../types.js';
import { DEFAULT_GAMMA } from './quality.js';

/**
 * Default price sensitivity parameter (beta).
 * -1 price dollar yields -1 utility unit in canonical Hotelling models.
 */
export const DEFAULT_BETA = 1;

/**
 * Default delivery-time sensitivity parameter (delta) (Phase 8A).
 * Sensitivity to delivery duration tau_ij in consumer delivery utility.
 */
export const DEFAULT_DELTA = 1;

/**
 * Numerical tolerance for population share summation validation.
 */
export const SHARE_SUM_EPSILON = 1e-6;

/**
 * Canonical default homogeneous consumer segment reproducing Phase 7A behavior.
 */
export const DEFAULT_CONSUMER_SEGMENT = Object.freeze({
  id: 'general',
  name: 'General Consumers',
  populationShare: 1.0,
  V: DEFAULT_PARAMS.V,
  beta: DEFAULT_BETA,
  gamma: DEFAULT_GAMMA,
  alpha: DEFAULT_PARAMS.alpha,
  delta: DEFAULT_DELTA,
});

/**
 * Canonical default segments collection (single homogeneous segment).
 */
export const DEFAULT_CONSUMER_SEGMENTS = Object.freeze([DEFAULT_CONSUMER_SEGMENT]);

/**
 * Built-in preset identifiers for consumer preference experimentation.
 */
export const CONSUMER_SEGMENT_PRESET_IDS = Object.freeze({
  BUDGET_SEEKERS: 'budget-seekers',
  QUALITY_SEEKERS: 'quality-seekers',
  CONVENIENCE_SEEKERS: 'convenience-seekers',
  BALANCED: 'balanced',
});

/**
 * Built-in preset segment definitions.
 * Each preset represents a distinctive consumer persona with normalized populationShare = 1.0.
 */
export const CONSUMER_SEGMENT_PRESETS = Object.freeze({
  [CONSUMER_SEGMENT_PRESET_IDS.BUDGET_SEEKERS]: Object.freeze({
    id: CONSUMER_SEGMENT_PRESET_IDS.BUDGET_SEEKERS,
    name: 'Budget Seekers',
    populationShare: 1.0,
    V: DEFAULT_PARAMS.V,
    beta: 2.0,
    gamma: 5,
    alpha: 10,
    delta: 1.0,
  }),
  [CONSUMER_SEGMENT_PRESET_IDS.QUALITY_SEEKERS]: Object.freeze({
    id: CONSUMER_SEGMENT_PRESET_IDS.QUALITY_SEEKERS,
    name: 'Quality Seekers',
    populationShare: 1.0,
    V: DEFAULT_PARAMS.V,
    beta: 0.8,
    gamma: 25,
    alpha: 10,
    delta: 1.0,
  }),
  [CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS]: Object.freeze({
    id: CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS,
    name: 'Convenience Seekers',
    populationShare: 1.0,
    V: DEFAULT_PARAMS.V,
    beta: 1.0,
    gamma: 10,
    alpha: 25,
    delta: 2.5,
  }),
  [CONSUMER_SEGMENT_PRESET_IDS.BALANCED]: Object.freeze({
    id: CONSUMER_SEGMENT_PRESET_IDS.BALANCED,
    name: 'Balanced Consumers',
    populationShare: 1.0,
    V: DEFAULT_PARAMS.V,
    beta: 1.0,
    gamma: 10,
    alpha: 10,
    delta: 1.0,
  }),
});

/**
 * Validates a single consumer segment definition.
 * Throws TypeError or RangeError on invalid input.
 *
 * @param {unknown} segment - Candidate segment object
 * @returns {boolean} True if the segment is structurally and mathematically valid
 */
export function validateConsumerSegment(segment) {
  if (!segment || typeof segment !== 'object') {
    throw new TypeError('Consumer segment must be a valid non-null object.');
  }

  const { id, name, populationShare, V, beta, gamma, alpha } = segment;
  const delta = segment.delta !== undefined ? segment.delta : DEFAULT_DELTA;

  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('Consumer segment must define a non-empty string "id".');
  }

  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError(`Consumer segment "${id}" must define a non-empty string "name".`);
  }

  if (typeof populationShare !== 'number' || !Number.isFinite(populationShare)) {
    throw new TypeError(`Consumer segment "${id}" populationShare must be a finite number.`);
  }

  if (populationShare <= 0 || populationShare > 1) {
    throw new RangeError(
      `Consumer segment "${id}" populationShare must be in range (0, 1], received ${populationShare}.`
    );
  }

  if (typeof V !== 'number' || !Number.isFinite(V)) {
    throw new TypeError(`Consumer segment "${id}" valuation (V) must be a finite number.`);
  }

  if (V < 0) {
    throw new RangeError(`Consumer segment "${id}" valuation (V) must be non-negative, received ${V}.`);
  }

  if (typeof beta !== 'number' || !Number.isFinite(beta)) {
    throw new TypeError(`Consumer segment "${id}" price sensitivity (beta) must be a finite number.`);
  }

  if (beta < 0) {
    throw new RangeError(
      `Consumer segment "${id}" price sensitivity (beta) must be non-negative, received ${beta}.`
    );
  }

  if (typeof gamma !== 'number' || !Number.isFinite(gamma)) {
    throw new TypeError(`Consumer segment "${id}" quality sensitivity (gamma) must be a finite number.`);
  }

  if (gamma < 0) {
    throw new RangeError(
      `Consumer segment "${id}" quality sensitivity (gamma) must be non-negative, received ${gamma}.`
    );
  }

  if (typeof alpha !== 'number' || !Number.isFinite(alpha)) {
    throw new TypeError(`Consumer segment "${id}" travel sensitivity (alpha) must be a finite number.`);
  }

  if (alpha < 0) {
    throw new RangeError(
      `Consumer segment "${id}" travel sensitivity (alpha) must be non-negative, received ${alpha}.`
    );
  }

  if (typeof delta !== 'number' || !Number.isFinite(delta)) {
    throw new TypeError(`Consumer segment "${id}" delivery-time sensitivity (delta) must be a finite number.`);
  }

  if (delta < 0) {
    throw new RangeError(
      `Consumer segment "${id}" delivery-time sensitivity (delta) must be non-negative, received ${delta}.`
    );
  }

  return true;
}

/**
 * Creates and normalizes an immutable consumer segment object.
 *
 * @param {Object} params
 * @param {string} params.id - Unique segment identifier
 * @param {string} [params.name] - Human-readable segment name (defaults to id)
 * @param {number} [params.populationShare=1.0] - Population share in (0, 1]
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Baseline reservation valuation
 * @param {number} [params.beta=DEFAULT_BETA] - Price sensitivity
 * @param {number} [params.gamma=DEFAULT_GAMMA] - Quality sensitivity
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity
 * @param {number} [params.delta=DEFAULT_DELTA] - Delivery-time sensitivity
 * @returns {Readonly<{
 *   id: string,
 *   name: string,
 *   populationShare: number,
 *   V: number,
 *   beta: number,
 *   gamma: number,
 *   alpha: number,
 *   delta: number
 * }>}
 */
export function createConsumerSegment({
  id,
  name,
  populationShare = 1.0,
  V = DEFAULT_PARAMS.V,
  beta = DEFAULT_BETA,
  gamma = DEFAULT_GAMMA,
  alpha = DEFAULT_PARAMS.alpha,
  delta = DEFAULT_DELTA,
}) {
  const candidate = {
    id,
    name: name !== undefined ? name : id,
    populationShare,
    V,
    beta,
    gamma,
    alpha,
    delta,
  };

  validateConsumerSegment(candidate);

  return Object.freeze({
    id: candidate.id.trim(),
    name: candidate.name.trim(),
    populationShare: candidate.populationShare,
    V: candidate.V,
    beta: candidate.beta,
    gamma: candidate.gamma,
    alpha: candidate.alpha,
    delta: candidate.delta,
  });
}

/**
 * Creates the canonical default consumer segment, optionally inheriting parameter
 * overrides from a market configuration object (e.g. { V, alpha, gamma, beta, delta }).
 *
 * @param {Object} [config={}]
 * @returns {Readonly<{
 *   id: string,
 *   name: string,
 *   populationShare: number,
 *   V: number,
 *   beta: number,
 *   gamma: number,
 *   alpha: number,
 *   delta: number
 * }>}
 */
export function createDefaultConsumerSegment(config = {}) {
  const V = config?.V ?? DEFAULT_PARAMS.V;
  const beta = config?.beta ?? DEFAULT_BETA;
  const gamma = config?.gamma ?? DEFAULT_GAMMA;
  const alpha = config?.alpha ?? DEFAULT_PARAMS.alpha;
  const delta = config?.delta ?? DEFAULT_DELTA;

  return createConsumerSegment({
    id: 'general',
    name: 'General Consumers',
    populationShare: 1.0,
    V,
    beta,
    gamma,
    alpha,
    delta,
  });
}

/**
 * Returns a frozen array containing the default single consumer segment,
 * configured with any caller-supplied market parameters.
 *
 * @param {Object} [config={}]
 * @returns {ReadonlyArray<Readonly<Object>>}
 */
export function getDefaultConsumerSegments(config = {}) {
  return Object.freeze([createDefaultConsumerSegment(config)]);
}

/**
 * Validates and normalizes an array of consumer segments.
 *
 * Requirements:
 * - Must be a non-empty Array.
 * - Each segment must be valid per validateConsumerSegment.
 * - Segment IDs must be unique.
 * - The sum of all population shares must equal 1.0 within SHARE_SUM_EPSILON.
 *
 * @param {Array<Object>} segments - Array of raw or created segment objects
 * @returns {ReadonlyArray<Readonly<{
 *   id: string,
 *   name: string,
 *   populationShare: number,
 *   V: number,
 *   beta: number,
 *   gamma: number,
 *   alpha: number,
 *   delta: number
 * }>>} Frozen array of frozen normalized segments
 */
export function validateConsumerSegments(segments) {
  if (!Array.isArray(segments)) {
    throw new TypeError('Consumer segments must be provided as an array.');
  }

  if (segments.length === 0) {
    throw new RangeError('Consumer segments array must not be empty.');
  }

  const seenIds = new Set();
  let totalShare = 0;
  const normalized = [];

  for (let i = 0; i < segments.length; i++) {
    const raw = segments[i];
    validateConsumerSegment(raw);

    const id = raw.id.trim();
    if (seenIds.has(id)) {
      throw new RangeError(`Duplicate consumer segment ID "${id}". Segment IDs must be unique.`);
    }
    seenIds.add(id);

    totalShare += raw.populationShare;

    normalized.push(
      Object.isFrozen(raw) && raw.delta !== undefined
        ? raw
        : Object.freeze({
            id,
            name: raw.name.trim(),
            populationShare: raw.populationShare,
            V: raw.V,
            beta: raw.beta,
            gamma: raw.gamma,
            alpha: raw.alpha,
            delta: raw.delta !== undefined ? raw.delta : DEFAULT_DELTA,
          })
    );
  }

  if (Math.abs(totalShare - 1.0) > SHARE_SUM_EPSILON) {
    throw new RangeError(
      `Consumer segment population shares must sum to 1.0 (received ${totalShare.toFixed(6)}).`
    );
  }

  return Object.freeze(normalized);
}

/**
 * Returns the built-in segment presets.
 *
 * @returns {Readonly<Record<string, Readonly<Object>>>}
 */
export function getConsumerSegmentPresets() {
  return CONSUMER_SEGMENT_PRESETS;
}
