/**
 * @file consumerChoice.js
 * @description Frontier consumer-choice and demand allocation engine with heterogeneous consumer preferences (Phase 7B).
 *
 * Architecture:
 *   Frontier City (Urban Geography & Effective Population)
 *        ↓
 *   Road Network & Travel Cost (Euclidean / Dijkstra Shortest Path)
 *        ↓
 *   Consumer Preferences & Segments (Heterogeneous Valuation, Price, Quality, Travel Sensitivities)
 *        ↓
 *   Segment-Specific Consumer Utility & Zone Choice (Deterministic Utility Comparison)
 *        ↓
 *   Segment Demand & Aggregate Restaurant Demand
 *        ↓
 *   Market Shares & Firm Payoffs
 *
 * Mathematical Model:
 * For consumer zone i, restaurant j, and consumer segment k:
 *   U_ij^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij
 *
 * Parameters:
 *   k        = consumer segment identifier
 *   V_k      = segment baseline consumer reservation valuation (>= 0)
 *   beta_k   = segment price sensitivity (>= 0)
 *   P_j      = price charged by restaurant j
 *   gamma_k  = segment quality sensitivity (>= 0)
 *   Q_j      = restaurant quality level
 *   alpha_k  = segment travel friction sensitivity (>= 0)
 *   T_ij     = spatial travel cost between consumer zone i and restaurant j
 *
 * Heterogeneous Preferences:
 *   Different consumer segments (e.g. Budget Seekers, Quality Seekers, Convenience Seekers)
 *   can make distinct choices between the same two competing restaurants in the same zone.
 *   For every zone i and segment k:
 *     segmentPopulation_ik = zonePopulation_i * populationShare_k
 *   Allocations are strictly deterministic; no random sampling or Monte Carlo simulation occurs.
 *
 * Decision Rule (per segment k):
 *   U_iA^(k) > U_iB^(k)  => shareA = 1, shareB = 0
 *   U_iB^(k) > U_iA^(k)  => shareA = 0, shareB = 1
 *   |U_iA^(k) - U_iB^(k)| <= tolerance => shareA = 0.5, shareB = 0.5
 *
 * Aggregate Zone Semantics vs. Segment-Level Decisions:
 *   With heterogeneous consumer segments, the authoritative behavioral decisions reside at
 *   the segment level (segment -> utility -> choice -> demand, recorded in zoneAllocation.segments).
 *   Aggregate zone-level fields provide summary metrics:
 *     - utilityA / utilityB: When the restaurant is reachable, utilityA / utilityB are population-weighted
 *       aggregate summary utilities across consumer segments. When a restaurant is unreachable,
 *       its aggregate utility is -Infinity, preserving the engine's explicit unreachable semantics.
 *     - choice: Aggregate zone demand outcome ('A', 'B', 'TIE', 'NONE') reflecting which
 *       restaurant captures the majority/plurality of demand from this zone. It must NOT be
 *       interpreted as unanimous consumer choice.
 *
 * Disconnected Topology / Unreachable Zones:
 *   Unreachable restaurants (T_ij = Infinity) strictly yield U_ij^(k) = -Infinity.
 *   Both restaurants unreachable (T_iA = Infinity, T_iB = Infinity)
 *     => shareA = 0, shareB = 0 (contributes to unreachablePopulation)
 *   Only A reachable (T_iA < Infinity, T_iB = Infinity)
 *     => shareA = 1, shareB = 0
 *   Only B reachable (T_iA = Infinity, T_iB < Infinity)
 *     => shareA = 0, shareB = 1
 */

import { DEFAULT_GRID, DEFAULT_PARAMS, FLOAT_EPSILON } from '../types.js';
import { isValidCoordinate } from './roadNetwork.js';
import { TRAVEL_COST_MODES, getTravelCost } from './travelCost.js';
import {
  DEFAULT_QUALITY,
  DEFAULT_GAMMA,
  DEFAULT_QUALITY_SCALE,
  validateFrontierQuality,
  validateQualityConfig,
} from './quality.js';
import {
  DEFAULT_BETA,
  getDefaultConsumerSegments,
  validateConsumerSegments,
} from './consumerSegments.js';

/**
 * Validates and normalizes an input restaurant object.
 *
 * @param {Object} r - Raw restaurant input
 * @param {string} label - Identifier for error reporting ('A' or 'B')
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @param {Object} [qualityScale=DEFAULT_QUALITY_SCALE] - Configured quality scale bounds
 * @returns {Readonly<{ id: string, location: { x: number, y: number }, price: number, quality: number }>}
 */
function validateRestaurant(
  r,
  label,
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  qualityScale = DEFAULT_QUALITY_SCALE
) {
  if (!r || typeof r !== 'object') {
    throw new TypeError(`Restaurant ${label} must be a valid object.`);
  }

  if (typeof r.id !== 'string' || r.id.trim() === '') {
    throw new TypeError(`Restaurant ${label} must have a non-empty string "id".`);
  }

  const loc = r.location ?? (r.x !== undefined && r.y !== undefined ? { x: r.x, y: r.y } : null);
  if (!loc || typeof loc !== 'object') {
    throw new TypeError(`Restaurant ${label} must define a {x, y} "location".`);
  }

  const { x, y } = loc;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isInteger(x) ||
    !Number.isInteger(y)
  ) {
    throw new TypeError(`Restaurant ${label} coordinates must be integers.`);
  }

  if (!isValidCoordinate(x, y, width, height)) {
    throw new RangeError(
      `Restaurant ${label} location (${x}, ${y}) is outside city bounds (${width}x${height}).`
    );
  }

  if (typeof r.price !== 'number' || !Number.isFinite(r.price)) {
    throw new TypeError(`Restaurant ${label} price must be a finite number.`);
  }

  if (r.price < 0) {
    throw new RangeError(`Restaurant ${label} price must be non-negative, received ${r.price}.`);
  }

  const scale = qualityScale ?? DEFAULT_QUALITY_SCALE;
  const quality = r.quality !== undefined ? r.quality : DEFAULT_QUALITY;
  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    throw new TypeError(`Restaurant ${label} quality must be a finite number.`);
  }

  if (!validateFrontierQuality(quality, scale)) {
    throw new RangeError(
      `Restaurant ${label} quality ${quality} is outside allowed scale [${scale.min}, ${scale.max}].`
    );
  }

  return Object.freeze({
    id: r.id.trim(),
    location: Object.freeze({ x, y }),
    price: r.price,
    quality,
  });
}

/**
 * Extracts and validates exactly two restaurants from caller options.
 *
 * @param {Object} options
 * @param {number} width
 * @param {number} height
 * @param {Object} [qualityScale=DEFAULT_QUALITY_SCALE]
 * @returns {[Readonly<Object>, Readonly<Object>]}
 */
function extractRestaurants(options, width, height, qualityScale = DEFAULT_QUALITY_SCALE) {
  let rA, rB;

  if (options.restaurants !== undefined) {
    if (!Array.isArray(options.restaurants) || options.restaurants.length !== 2) {
      throw new RangeError('Frontier consumer choice engine requires exactly two restaurants.');
    }
    rA = options.restaurants[0];
    rB = options.restaurants[1];
  } else if (options.restaurantA !== undefined || options.restaurantB !== undefined) {
    if (!options.restaurantA || !options.restaurantB) {
      throw new TypeError('Both restaurantA and restaurantB must be provided.');
    }
    rA = options.restaurantA;
    rB = options.restaurantB;
  } else {
    throw new TypeError(
      'Restaurants must be provided either as options.restaurants ([r1, r2]) or as options.restaurantA and options.restaurantB.'
    );
  }

  const validA = validateRestaurant(rA, 'A', width, height, qualityScale);
  const validB = validateRestaurant(rB, 'B', width, height, qualityScale);

  if (validA.id === validB.id) {
    throw new RangeError(`Duplicate restaurant ID "${validA.id}". Restaurant IDs must be unique.`);
  }

  return [validA, validB];
}

/**
 * Calculates consumer utility U_ij for a given travel distance, price, quality, and sensitivities.
 *
 *   U_ij = V - beta * P_j + gamma * Q_j - alpha * T_ij
 *
 * @param {Object} params
 * @param {number} params.travelCost - Travel distance / friction (T_ij)
 * @param {number} params.price - Restaurant price (P_j)
 * @param {number} [params.quality=DEFAULT_QUALITY] - Restaurant quality level (Q_j)
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Baseline consumer valuation
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity factor
 * @param {number} [params.gamma=DEFAULT_GAMMA] - Quality sensitivity factor
 * @param {number} [params.beta=DEFAULT_BETA] - Price sensitivity factor
 * @param {Object} [params.qualityScale=DEFAULT_QUALITY_SCALE] - Configured quality scale bounds
 * @returns {number} Calculated utility (or -Infinity if unreachable)
 */
export function calculateFrontierUtility({
  travelCost,
  price,
  quality = DEFAULT_QUALITY,
  V = DEFAULT_PARAMS.V,
  alpha = DEFAULT_PARAMS.alpha,
  gamma = DEFAULT_GAMMA,
  beta = DEFAULT_BETA,
  qualityScale = DEFAULT_QUALITY_SCALE,
}) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('calculateFrontierUtility requires a finite price.');
  }
  if (typeof travelCost !== 'number') {
    throw new TypeError('calculateFrontierUtility requires a numeric travelCost.');
  }
  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    throw new TypeError('calculateFrontierUtility requires a finite quality.');
  }
  const scale = qualityScale ?? DEFAULT_QUALITY_SCALE;
  if (!validateFrontierQuality(quality, scale)) {
    throw new RangeError(
      `calculateFrontierUtility quality ${quality} is outside allowed scale [${scale.min}, ${scale.max}].`
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
    throw new TypeError('calculateFrontierUtility requires finite V, alpha, and gamma values.');
  }
  if (typeof beta !== 'number' || !Number.isFinite(beta)) {
    throw new TypeError('calculateFrontierUtility requires a finite beta value.');
  }
  if (beta < 0) {
    throw new RangeError(`calculateFrontierUtility beta must be non-negative, received ${beta}.`);
  }

  if (travelCost === Infinity) {
    return -Infinity;
  }

  return V - beta * price + gamma * quality - alpha * travelCost;
}

/**
 * Determines zone-level consumer choice shares between two competing restaurants.
 *
 * @param {Object} params
 * @param {number} params.travelCostA - Travel cost to restaurant A
 * @param {number} params.travelCostB - Travel cost to restaurant B
 * @param {number} params.priceA - Price of restaurant A
 * @param {number} params.priceB - Price of restaurant B
 * @param {number} [params.qualityA=DEFAULT_QUALITY] - Quality of restaurant A
 * @param {number} [params.qualityB=DEFAULT_QUALITY] - Quality of restaurant B
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Reservation valuation
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity
 * @param {number} [params.gamma=DEFAULT_GAMMA] - Quality sensitivity factor
 * @param {number} [params.beta=DEFAULT_BETA] - Price sensitivity factor
 * @param {Object} [params.qualityScale=DEFAULT_QUALITY_SCALE] - Configured quality scale bounds
 * @param {number} [params.tolerance=FLOAT_EPSILON] - Numerical tie tolerance
 * @returns {Readonly<{
 *   choice: 'A'|'B'|'TIE'|'NONE',
 *   shareA: number,
 *   shareB: number,
 *   utilityA: number,
 *   utilityB: number,
 *   travelCostA: number,
 *   travelCostB: number,
 *   qualityA: number,
 *   qualityB: number,
 *   isReachable: boolean
 * }>}
 */
export function calculateZoneChoice({
  travelCostA,
  travelCostB,
  priceA,
  priceB,
  qualityA = DEFAULT_QUALITY,
  qualityB = DEFAULT_QUALITY,
  V = DEFAULT_PARAMS.V,
  alpha = DEFAULT_PARAMS.alpha,
  gamma = DEFAULT_GAMMA,
  beta = DEFAULT_BETA,
  qualityScale = DEFAULT_QUALITY_SCALE,
  tolerance = FLOAT_EPSILON,
}) {
  const utilityA = calculateFrontierUtility({
    travelCost: travelCostA,
    price: priceA,
    quality: qualityA,
    V,
    alpha,
    gamma,
    beta,
    qualityScale,
  });
  const utilityB = calculateFrontierUtility({
    travelCost: travelCostB,
    price: priceB,
    quality: qualityB,
    V,
    alpha,
    gamma,
    beta,
    qualityScale,
  });

  const aIsReachable = travelCostA < Infinity;
  const bIsReachable = travelCostB < Infinity;

  // Unreachable handling
  if (!aIsReachable && !bIsReachable) {
    return Object.freeze({
      choice: 'NONE',
      shareA: 0.0,
      shareB: 0.0,
      utilityA,
      utilityB,
      travelCostA,
      travelCostB,
      qualityA,
      qualityB,
      isReachable: false,
    });
  }

  if (aIsReachable && !bIsReachable) {
    return Object.freeze({
      choice: 'A',
      shareA: 1.0,
      shareB: 0.0,
      utilityA,
      utilityB,
      travelCostA,
      travelCostB,
      qualityA,
      qualityB,
      isReachable: true,
    });
  }

  if (!aIsReachable && bIsReachable) {
    return Object.freeze({
      choice: 'B',
      shareA: 0.0,
      shareB: 1.0,
      utilityA,
      utilityB,
      travelCostA,
      travelCostB,
      qualityA,
      qualityB,
      isReachable: true,
    });
  }

  // Both restaurants reachable: deterministic utility comparison
  const diff = utilityA - utilityB;

  if (Math.abs(diff) <= tolerance) {
    return Object.freeze({
      choice: 'TIE',
      shareA: 0.5,
      shareB: 0.5,
      utilityA,
      utilityB,
      travelCostA,
      travelCostB,
      qualityA,
      qualityB,
      isReachable: true,
    });
  }

  if (diff > 0) {
    return Object.freeze({
      choice: 'A',
      shareA: 1.0,
      shareB: 0.0,
      utilityA,
      utilityB,
      travelCostA,
      travelCostB,
      qualityA,
      qualityB,
      isReachable: true,
    });
  }

  return Object.freeze({
    choice: 'B',
    shareA: 0.0,
    shareB: 1.0,
    utilityA,
    utilityB,
    travelCostA,
    travelCostB,
    qualityA,
    qualityB,
    isReachable: true,
  });
}

/**
 * Internal allocation helper for computing zone-level demand across already-validated segments.
 *
 * @private
 * @param {Object} params
 * @param {{x: number, y: number, zoneType?: string, population?: number}} params.zone
 * @param {number} params.effectivePop
 * @param {Object} params.restaurantA
 * @param {Object} params.restaurantB
 * @param {'euclidean'|'road'} params.mode
 * @param {Object} [params.roadNetwork]
 * @param {Object} [params.qualityScale=DEFAULT_QUALITY_SCALE]
 * @param {ReadonlyArray<Object>} params.normalizedSegments
 * @param {number} [params.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   zone: { x: number, y: number },
 *   population: number,
 *   travelCostA: number,
 *   travelCostB: number,
 *   utilityA: number, // Population-weighted aggregate summary utility across segments when reachable, or -Infinity if unreachable
 *   utilityB: number, // Population-weighted aggregate summary utility across segments when reachable, or -Infinity if unreachable
 *   qualityA: number,
 *   qualityB: number,
 *   shareA: number,
 *   shareB: number,
 *   demandA: number,
 *   demandB: number,
 *   choice: 'A'|'B'|'TIE'|'NONE', // Aggregate demand outcome; not unanimous consumer choice
 *   isReachable: boolean,
 *   segments: Array<Object>, // Authoritative behavioral data: segment -> utility -> choice -> demand
 *   zoneType?: string
 * }>}
 */
function internalAllocateFrontierDemand({
  zone,
  effectivePop,
  restaurantA,
  restaurantB,
  mode,
  roadNetwork,
  qualityScale = DEFAULT_QUALITY_SCALE,
  normalizedSegments,
  tolerance = FLOAT_EPSILON,
}) {
  const fromPoint = { x: zone.x, y: zone.y };

  const travelCostA = getTravelCost({
    mode,
    from: fromPoint,
    to: restaurantA.location,
    roadNetwork,
  });

  const travelCostB = getTravelCost({
    mode,
    from: fromPoint,
    to: restaurantB.location,
    roadNetwork,
  });

  const qualityA = restaurantA.quality ?? DEFAULT_QUALITY;
  const qualityB = restaurantB.quality ?? DEFAULT_QUALITY;

  const aIsReachable = travelCostA < Infinity;
  const bIsReachable = travelCostB < Infinity;
  const isReachable = aIsReachable || bIsReachable;

  let totalDemandA = 0;
  let totalDemandB = 0;
  const segmentAllocations = [];

  for (let k = 0; k < normalizedSegments.length; k++) {
    const seg = normalizedSegments[k];
    const segPop = effectivePop * seg.populationShare;

    const segChoice = calculateZoneChoice({
      travelCostA,
      travelCostB,
      priceA: restaurantA.price,
      priceB: restaurantB.price,
      qualityA,
      qualityB,
      V: seg.V,
      alpha: seg.alpha,
      gamma: seg.gamma,
      beta: seg.beta,
      qualityScale,
      tolerance,
    });

    const segDemandA = segPop * segChoice.shareA;
    const segDemandB = segPop * segChoice.shareB;

    totalDemandA += segDemandA;
    totalDemandB += segDemandB;

    segmentAllocations.push(
      Object.freeze({
        segmentId: seg.id,
        segmentName: seg.name,
        population: segPop,
        travelCostA,
        travelCostB,
        travelCosts: Object.freeze({ A: travelCostA, B: travelCostB }),
        utilityA: segChoice.utilityA,
        utilityB: segChoice.utilityB,
        utilities: Object.freeze({ A: segChoice.utilityA, B: segChoice.utilityB }),
        shareA: segChoice.shareA,
        shareB: segChoice.shareB,
        shares: Object.freeze({ A: segChoice.shareA, B: segChoice.shareB }),
        demandA: segDemandA,
        demandB: segDemandB,
        demand: Object.freeze({ A: segDemandA, B: segDemandB }),
        choice: segChoice.choice,
        isReachable: segChoice.isReachable,
        reachable: segChoice.isReachable,
      })
    );
  }

  const shareA = effectivePop > 0 ? totalDemandA / effectivePop : 0;
  const shareB = effectivePop > 0 ? totalDemandB / effectivePop : 0;

  let choice;
  if (!isReachable) {
    choice = 'NONE';
  } else if (aIsReachable && !bIsReachable) {
    choice = 'A';
  } else if (!aIsReachable && bIsReachable) {
    choice = 'B';
  } else {
    const demandDiff = totalDemandA - totalDemandB;
    if (Math.abs(demandDiff) <= tolerance * (effectivePop > 0 ? effectivePop : 1)) {
      choice = 'TIE';
    } else if (demandDiff > 0) {
      choice = 'A';
    } else {
      choice = 'B';
    }
  }

  let utilityA;
  let utilityB;
  if (normalizedSegments.length === 1) {
    utilityA = segmentAllocations[0].utilityA;
    utilityB = segmentAllocations[0].utilityB;
  } else {
    utilityA = aIsReachable
      ? normalizedSegments.reduce((sum, seg, idx) => sum + seg.populationShare * segmentAllocations[idx].utilityA, 0)
      : -Infinity;
    utilityB = bIsReachable
      ? normalizedSegments.reduce((sum, seg, idx) => sum + seg.populationShare * segmentAllocations[idx].utilityB, 0)
      : -Infinity;
  }

  return Object.freeze({
    zone: Object.freeze({ x: zone.x, y: zone.y }),
    population: effectivePop,
    travelCostA,
    travelCostB,
    utilityA,
    utilityB,
    qualityA,
    qualityB,
    shareA,
    shareB,
    demandA: totalDemandA,
    demandB: totalDemandB,
    choice,
    isReachable,
    segments: Object.freeze(segmentAllocations),
    ...(zone.zoneType ? { zoneType: zone.zoneType } : {}),
  });
}

/**
 * Computes travel costs, utilities, shares, and demand allocation for a single population zone
 * across one or more heterogeneous consumer segments.
 *
 * NOTE ON AGGREGATE ZONE SEMANTICS:
 * With heterogeneous consumer segments, authoritative behavioral decisions reside at the
 * segment level (recorded in the `segments` array: segment -> utility -> choice -> demand).
 * Aggregate zone-level fields provide summary metrics:
 *   - `utilityA` / `utilityB`: When the restaurant is reachable, utilityA / utilityB are population-weighted
 *     aggregate summary utilities across consumer segments. When a restaurant is unreachable,
 *     its aggregate utility is -Infinity, preserving the engine's explicit unreachable semantics.
 *   - `choice`: Aggregate zone demand outcome ('A', 'B', 'TIE', 'NONE') reflecting which
 *     restaurant captures the majority/plurality of demand from this zone. It must NOT be
 *     interpreted as unanimous consumer choice.
 *
 * Mathematical Model:
 * For segment k:
 *   U_ij^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij
 *
 * @param {Object} params
 * @param {{x: number, y: number, zoneType?: string, population?: number}} params.zone - Zone location coordinates
 * @param {number} [params.population] - Zone effective population (defaults to zone.population)
 * @param {Object} params.restaurantA - Restaurant A definition
 * @param {Object} params.restaurantB - Restaurant B definition
 * @param {'euclidean'|'road'} [params.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [params.roadNetwork] - Required when mode is 'road'
 * @param {{V?: number, alpha?: number, gamma?: number, qualityScale?: { min?: number, max?: number }, segments?: Array<Object>}} [params.config=DEFAULT_PARAMS]
 * @param {Array<Object>} [params.segments] - Optional consumer segments override
 * @param {number} [params.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   zone: { x: number, y: number },
 *   population: number,
 *   travelCostA: number,
 *   travelCostB: number,
 *   utilityA: number, // Population-weighted aggregate summary utility across segments when reachable, or -Infinity if unreachable
 *   utilityB: number, // Population-weighted aggregate summary utility across segments when reachable, or -Infinity if unreachable
 *   qualityA: number,
 *   qualityB: number,
 *   shareA: number,
 *   shareB: number,
 *   demandA: number,
 *   demandB: number,
 *   choice: 'A'|'B'|'TIE'|'NONE', // Aggregate demand outcome; not unanimous consumer choice
 *   isReachable: boolean,
 *   segments: Array<Object>, // Authoritative behavioral data: segment -> utility -> choice -> demand
 *   zoneType?: string
 * }>}
 */
export function allocateFrontierDemand({
  zone,
  population,
  restaurantA,
  restaurantB,
  mode = TRAVEL_COST_MODES.EUCLIDEAN,
  roadNetwork,
  config = DEFAULT_PARAMS,
  segments,
  tolerance = FLOAT_EPSILON,
}) {
  if (!zone || typeof zone !== 'object') {
    throw new TypeError('allocateFrontierDemand requires a valid zone object.');
  }

  const effectivePop = population !== undefined ? population : zone.population;
  if (typeof effectivePop !== 'number' || !Number.isFinite(effectivePop) || effectivePop < 0) {
    throw new TypeError('allocateFrontierDemand requires a non-negative numeric population.');
  }

  const rawSegments = segments ?? config?.segments;
  const normalizedSegments = rawSegments !== undefined
    ? validateConsumerSegments(rawSegments)
    : getDefaultConsumerSegments(config);

  const qualityScale = config?.qualityScale ?? DEFAULT_QUALITY_SCALE;

  return internalAllocateFrontierDemand({
    zone,
    effectivePop,
    restaurantA,
    restaurantB,
    mode,
    roadNetwork,
    qualityScale,
    normalizedSegments,
    tolerance,
  });
}

/**
 * Evaluates the full Frontier market demand and zone allocations for two competing restaurants
 * under homogeneous or heterogeneous consumer preferences.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object containing `cells` array
 * @param {Object} [options.restaurantA] - First restaurant state (or pass options.restaurants)
 * @param {Object} [options.restaurantB] - Second restaurant state (or pass options.restaurants)
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {{V?: number, alpha?: number, gamma?: number, qualityScale?: { min?: number, max?: number }, segments?: Array<Object>}} [options.config=DEFAULT_PARAMS]
 * @param {Array<Object>} [options.segments] - Optional consumer segments override
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantDemand: Record<string, number>,
 *   marketShares: Record<string, number>,
 *   reachableMarketShares: Record<string, number>,
 *   zoneAllocations: Array<Object>, // Zone allocations containing aggregate summary utilities (population-weighted when reachable, -Infinity when unreachable), aggregate demand outcome choice, and authoritative segment breakdown
 *   totalPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   travelCostMode: string,
 *   config: Object,
 *   segments: Array<Object>,
 *   segmentDemand: Record<string, Record<string, number>>,
 *   segmentResults: Record<string, Object>,
 *   restaurants: Array<{ id: string, location: { x: number, y: number }, price: number, quality: number }>
 * }>}
 */
export function calculateFrontierMarket(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateFrontierMarket requires an options object.');
  }

  const {
    city,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!city || typeof city !== 'object' || !Array.isArray(city.cells)) {
    throw new TypeError(
      'calculateFrontierMarket requires a valid Frontier city with a cells array.'
    );
  }

  if (typeof mode !== 'string') {
    throw new TypeError('Travel cost mode must be a string identifier.');
  }

  if (mode !== TRAVEL_COST_MODES.EUCLIDEAN && mode !== TRAVEL_COST_MODES.ROAD) {
    const allowed = Object.values(TRAVEL_COST_MODES).join(', ');
    throw new RangeError(`Invalid travel cost mode "${mode}". Allowed modes: ${allowed}.`);
  }

  if (
    mode === TRAVEL_COST_MODES.ROAD &&
    (!roadNetwork || typeof roadNetwork !== 'object' || !roadNetwork.adjacency)
  ) {
    throw new TypeError('Road travel cost mode requires a valid roadNetwork object.');
  }

  const qualityConfig = validateQualityConfig({
    gamma: config?.gamma,
    qualityScale: config?.qualityScale,
  });
  const { gamma, qualityScale } = qualityConfig;

  const rawSegments = options.segments ?? config?.segments;
  const segments = rawSegments !== undefined
    ? validateConsumerSegments(rawSegments)
    : getDefaultConsumerSegments(config);

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;

  const [restaurantA, restaurantB] = extractRestaurants(options, width, height, qualityScale);

  const V = config?.V ?? DEFAULT_PARAMS.V;
  const alpha = config?.alpha ?? DEFAULT_PARAMS.alpha;

  const marketConfig = Object.freeze({
    V,
    alpha,
    gamma,
    qualityScale,
    segments,
  });

  const idA = restaurantA.id;
  const idB = restaurantB.id;

  const segmentDemandTotals = {};
  const segmentPopulationTotals = {};
  for (let k = 0; k < segments.length; k++) {
    const segId = segments[k].id;
    segmentDemandTotals[segId] = { [idA]: 0, [idB]: 0 };
    segmentPopulationTotals[segId] = 0;
  }

  const cells = city.cells;
  const zoneAllocations = [];
  let totalPopulation = 0;
  let reachablePopulation = 0;
  let unreachablePopulation = 0;
  let demandA = 0;
  let demandB = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const pop = cell.population;
    totalPopulation += pop;

    const allocation = internalAllocateFrontierDemand({
      zone: cell,
      effectivePop: pop,
      restaurantA,
      restaurantB,
      mode,
      roadNetwork,
      qualityScale,
      normalizedSegments: segments,
      tolerance,
    });

    zoneAllocations.push(allocation);

    if (allocation.isReachable) {
      reachablePopulation += pop;
    } else {
      unreachablePopulation += pop;
    }

    demandA += allocation.demandA;
    demandB += allocation.demandB;

    for (let k = 0; k < allocation.segments.length; k++) {
      const segAlloc = allocation.segments[k];
      const segId = segAlloc.segmentId;
      segmentPopulationTotals[segId] += segAlloc.population;
      segmentDemandTotals[segId][idA] += segAlloc.demandA;
      segmentDemandTotals[segId][idB] += segAlloc.demandB;
    }
  }

  const restaurantDemand = {
    [idA]: demandA,
    [idB]: demandB,
  };

  const marketShares = {
    [idA]: totalPopulation > 0 ? demandA / totalPopulation : 0,
    [idB]: totalPopulation > 0 ? demandB / totalPopulation : 0,
  };

  const reachableMarketShares = {
    [idA]: reachablePopulation > 0 ? demandA / reachablePopulation : 0,
    [idB]: reachablePopulation > 0 ? demandB / reachablePopulation : 0,
  };

  const frozenSegmentDemand = {};
  const frozenSegmentResults = {};
  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const segId = seg.id;
    const segPop = segmentPopulationTotals[segId];
    const demA = segmentDemandTotals[segId][idA];
    const demB = segmentDemandTotals[segId][idB];

    frozenSegmentDemand[segId] = Object.freeze({
      [idA]: demA,
      [idB]: demB,
    });

    frozenSegmentResults[segId] = Object.freeze({
      segmentId: segId,
      segmentName: seg.name,
      population: segPop,
      restaurantDemand: Object.freeze({
        [idA]: demA,
        [idB]: demB,
      }),
      marketShares: Object.freeze({
        [idA]: segPop > 0 ? demA / segPop : 0,
        [idB]: segPop > 0 ? demB / segPop : 0,
      }),
    });
  }

  return Object.freeze({
    restaurantDemand: Object.freeze(restaurantDemand),
    marketShares: Object.freeze(marketShares),
    reachableMarketShares: Object.freeze(reachableMarketShares),
    zoneAllocations: Object.freeze(zoneAllocations),
    totalPopulation,
    reachablePopulation,
    unreachablePopulation,
    travelCostMode: mode,
    config: marketConfig,
    segments,
    segmentDemand: Object.freeze(frozenSegmentDemand),
    segmentResults: Object.freeze(frozenSegmentResults),
    restaurants: Object.freeze([
      Object.freeze({ ...restaurantA }),
      Object.freeze({ ...restaurantB }),
    ]),
  });
}

