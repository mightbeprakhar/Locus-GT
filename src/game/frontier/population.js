/**
 * @file population.js
 * @description Population density and spatial anchor footfall decay model for Frontier.
 * Implements deterministic distance-decay transformations:
 *
 *   N_i* = N_i * (1 + sum_a [ lambda_a * f(d_ia) ])
 *   f(d) = 1 / (1 + d)
 */

import { distance } from '../utility.js';

/**
 * Bounded distance-decay function: f(d) = 1 / (1 + d).
 *
 * Properties:
 * - f(0) = 1 (maximal anchor impact at anchor epicenter)
 * - Monotonically decreasing for d >= 0
 * - Bounded between 0 and 1
 * - Numerically stable for all non-negative Euclidean distances
 *
 * @param {number} d - Euclidean distance
 * @returns {number} Decay factor in (0, 1]
 */
export function distanceDecay(d) {
  if (typeof d !== 'number' || d < 0 || !Number.isFinite(d)) {
    throw new RangeError('Distance d must be a non-negative finite number.');
  }
  return 1 / (1 + d);
}

/**
 * Computes the aggregate anchor amplification multiplier for a specific cell coordinate:
 *
 *   multiplier = 1 + sum_a (lambda_a * f(d_ia))
 *
 * @param {{x: number, y: number}} cellLocation - Grid coordinates of the cell
 * @param {Array<{location: {x: number, y: number}, strength: number}>} anchors - Active urban anchors
 * @returns {{ multiplier: number, anchorInfluence: number }}
 */
export function calculateAnchorMultiplier(cellLocation, anchors = []) {
  if (!cellLocation || typeof cellLocation.x !== 'number' || typeof cellLocation.y !== 'number') {
    throw new TypeError('cellLocation must contain numeric {x, y} coordinates.');
  }

  let anchorInfluence = 0;

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const dist = distance(cellLocation, anchor.location);
    const decay = distanceDecay(dist);
    anchorInfluence += (anchor.strength ?? 0) * decay;
  }

  return {
    multiplier: 1 + anchorInfluence,
    anchorInfluence,
  };
}

/**
 * Calculates effective population for a cell given its base population and active anchors.
 *
 *   N_i* = round( N_i * (1 + sum_a [ lambda_a * f(d_ia) ]) )
 *
 * @param {number} basePopulation - Unmodified residential/base population of the zone
 * @param {{x: number, y: number}} cellLocation - Grid coordinates of the zone
 * @param {Array<Object>} [anchors=[]] - List of urban anchors
 * @returns {{ population: number, rawPopulation: number, anchorInfluence: number }}
 */
export function calculateEffectivePopulation(basePopulation, cellLocation, anchors = []) {
  if (typeof basePopulation !== 'number' || basePopulation < 0 || !Number.isFinite(basePopulation)) {
    throw new RangeError('basePopulation must be a non-negative finite number.');
  }

  const { multiplier, anchorInfluence } = calculateAnchorMultiplier(cellLocation, anchors);
  const rawPopulation = basePopulation * multiplier;
  const population = Math.round(rawPopulation);

  return {
    population,
    rawPopulation,
    anchorInfluence,
  };
}

/**
 * Population density classifications for visual heatmap rendering and telemetry.
 */
export const POPULATION_TIERS = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  VERY_HIGH: 'very-high',
});

/**
 * Classifies a population value into a discrete density tier.
 * Supports either dynamic range-based classification or standard baseline thresholds.
 *
 * @param {number} population - Effective population of the cell
 * @param {{ min?: number, max?: number }} [range] - Optional min and max of current city
 * @returns {'low'|'medium'|'high'|'very-high'}
 */
export function getPopulationTier(population, range) {
  if (typeof population !== 'number' || population < 0) {
    return POPULATION_TIERS.LOW;
  }

  // If city-specific min/max range is provided and has adequate variance
  if (range && typeof range.min === 'number' && typeof range.max === 'number' && range.max > range.min) {
    const delta = range.max - range.min;
    const ratio = (population - range.min) / delta;

    if (ratio < 0.25) return POPULATION_TIERS.LOW;
    if (ratio < 0.55) return POPULATION_TIERS.MEDIUM;
    if (ratio < 0.82) return POPULATION_TIERS.HIGH;
    return POPULATION_TIERS.VERY_HIGH;
  }

  // Standard absolute thresholds based on Frontier economic parameters
  if (population < 150) return POPULATION_TIERS.LOW;
  if (population < 250) return POPULATION_TIERS.MEDIUM;
  if (population < 380) return POPULATION_TIERS.HIGH;
  return POPULATION_TIERS.VERY_HIGH;
}
