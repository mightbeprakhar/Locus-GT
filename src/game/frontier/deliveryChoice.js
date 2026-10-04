/**
 * @file deliveryChoice.js
 * @description Frontier Delivery Choice Engine — Dine-in vs Delivery Consumer Choice (Phase 8A).
 *
 * Mathematical Foundations:
 * A consumer zone i and consumer segment k choose among 4 discrete service options:
 *   1. Restaurant A — Dine-in:
 *        U_iA,D^(k) = V_k - beta_k * P_A + gamma_k * Q_A - alpha_k * T_iA
 *   2. Restaurant A — Delivery:
 *        U_iA,L^(k) = V_k - beta_k * (P_A + F_A) + gamma_k * Q_A - alpha_k * T_iA - delta_k * tau_iA
 *   3. Restaurant B — Dine-in:
 *        U_iB,D^(k) = V_k - beta_k * P_B + gamma_k * Q_B - alpha_k * T_iB
 *   4. Restaurant B — Delivery:
 *        U_iB,L^(k) = V_k - beta_k * (P_B + F_B) + gamma_k * Q_B - alpha_k * T_iB - delta_k * tau_iB
 *
 * Availability Rules:
 *   - Dine-in is available iff T_ij < Infinity.
 *   - Delivery is available iff deliveryConfig_j.enabled === true AND T_ij < Infinity AND T_ij <= deliveryConfig_j.radius.
 *   - Unavailable options are strictly excluded from the choice set.
 *
 * Consumer Choice & Tie-Breaking Rule:
 *   - If no options are available:
 *       100% of segment population from zone i is unserved.
 *   - If one or more options are available:
 *       maxUtility = max { U_opt | opt in availableOptions }
 *       winningOptions = { opt in availableOptions | |U_opt - maxUtility| <= tolerance }
 *       share(opt) = 1 / |winningOptions| for opt in winningOptions; 0 otherwise.
 *       unservedShare = 0.
 *
 * Demand Accounting:
 *   For each restaurant j in {A, B}:
 *     D_j = D_j,dine-in + D_j,delivery
 *   Across the entire market:
 *     totalPopulation = servedDemand + unservedDemand
 *     Population is strictly conserved at both segment level and zone level.
 *
 * Backward Compatibility (Mandatory Invariant):
 *   When delivery is disabled (delivery.enabled === false), delivery is unavailable everywhere.
 *   The available options reduce strictly to {A:dine-in, B:dine-in}, reproducing the exact
 *   Frontier Phase 7A/7B dine-in demand, market shares, zone allocations, and unreachable handling.
 */

import { DEFAULT_GRID, DEFAULT_PARAMS, FLOAT_EPSILON } from '../types.js';
import { isValidCoordinate } from './roadNetwork.js';
import { TRAVEL_COST_MODES, getTravelCost } from './travelCost.js';
import {
  DEFAULT_QUALITY,
  DEFAULT_QUALITY_SCALE,
  validateFrontierQuality,
  validateQualityConfig,
} from './quality.js';
import {
  DEFAULT_BETA,
  DEFAULT_DELTA,
  getDefaultConsumerSegments,
  validateConsumerSegments,
} from './consumerSegments.js';
import {
  DEFAULT_DELIVERY_CONFIG,
  createDeliveryConfig,
  isDeliveryAvailable,
  calculateDeliveryTime,
} from './delivery.js';

/**
 * Service modes supported by the delivery consumer choice engine.
 */
export const SERVICE_MODES = Object.freeze({
  DINE_IN: 'dine-in',
  DELIVERY: 'delivery',
});

/**
 * Validates and normalizes an input restaurant with delivery configuration.
 *
 * @private
 * @param {Object} r - Raw restaurant definition
 * @param {string} label - Identifier for error reporting ('A' or 'B')
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @param {Object} [qualityScale=DEFAULT_QUALITY_SCALE] - Configured quality scale bounds
 * @param {Object} [deliveryOverride] - Optional delivery config override
 * @returns {Readonly<{
 *   id: string,
 *   location: { x: number, y: number },
 *   price: number,
 *   quality: number,
 *   delivery: Readonly<Object>
 * }>}
 */
function validateDeliveryRestaurant(
  r,
  label,
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  qualityScale = DEFAULT_QUALITY_SCALE,
  deliveryOverride
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

  // Delivery configuration: priority is override -> r.delivery -> r.deliveryConfig -> disabled default
  const rawDelivery = deliveryOverride ?? r.delivery ?? r.deliveryConfig;
  const delivery = rawDelivery !== undefined
    ? createDeliveryConfig(rawDelivery)
    : DEFAULT_DELIVERY_CONFIG;

  return Object.freeze({
    id: r.id.trim(),
    location: Object.freeze({ x, y }),
    price: r.price,
    quality,
    delivery,
  });
}

/**
 * Extracts and validates exactly two restaurants from caller options.
 *
 * @private
 * @param {Object} options
 * @param {number} width
 * @param {number} height
 * @param {Object} [qualityScale=DEFAULT_QUALITY_SCALE]
 * @returns {[Readonly<Object>, Readonly<Object>]}
 */
function extractDeliveryRestaurants(
  options,
  width,
  height,
  qualityScale = DEFAULT_QUALITY_SCALE
) {
  let rA, rB;

  if (options.restaurants !== undefined) {
    if (!Array.isArray(options.restaurants) || options.restaurants.length !== 2) {
      throw new RangeError('Frontier delivery choice engine requires exactly two restaurants.');
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

  const validA = validateDeliveryRestaurant(
    rA,
    'A',
    width,
    height,
    qualityScale,
    options.deliveryA
  );
  const validB = validateDeliveryRestaurant(
    rB,
    'B',
    width,
    height,
    qualityScale,
    options.deliveryB
  );

  if (validA.id === validB.id) {
    throw new RangeError(`Duplicate restaurant ID "${validA.id}". Restaurant IDs must be unique.`);
  }

  return [validA, validB];
}

/**
 * Determines service mode choices and demand shares for a single consumer segment in a zone.
 *
 * Evaluates the 4 candidate service options:
 *   - A: dine-in
 *   - A: delivery
 *   - B: dine-in
 *   - B: delivery
 *
 * @param {Object} params
 * @param {number} params.travelCostA - Travel cost to restaurant A
 * @param {number} params.travelCostB - Travel cost to restaurant B
 * @param {Object} params.restaurantA - Normalized restaurant A (price, quality, delivery)
 * @param {Object} params.restaurantB - Normalized restaurant B (price, quality, delivery)
 * @param {Object} [params.segment] - Consumer segment preferences (V, beta, gamma, alpha, delta)
 * @param {number} [params.V=DEFAULT_PARAMS.V]
 * @param {number} [params.beta=DEFAULT_BETA]
 * @param {number} [params.gamma=DEFAULT_PARAMS.gamma]
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha]
 * @param {number} [params.delta=DEFAULT_DELTA]
 * @param {number} [params.tolerance=FLOAT_EPSILON] - Numerical tie tolerance
 * @returns {Readonly<{
 *   options: ReadonlyArray<Readonly<Object>>,
 *   chosenOptions: ReadonlyArray<Readonly<Object>>,
 *   shareA: number,
 *   shareB: number,
 *   dineInShareA: number,
 *   deliveryShareA: number,
 *   dineInShareB: number,
 *   deliveryShareB: number,
 *   unservedShare: number,
 *   choice: 'A'|'B'|'TIE'|'NONE',
 *   isReachable: boolean
 * }>}
 */
export function calculateZoneDeliveryChoice({
  travelCostA,
  travelCostB,
  restaurantA,
  restaurantB,
  segment,
  V = DEFAULT_PARAMS.V,
  beta = DEFAULT_BETA,
  gamma = DEFAULT_PARAMS.gamma ?? 10,
  alpha = DEFAULT_PARAMS.alpha,
  delta = DEFAULT_DELTA,
  tolerance = FLOAT_EPSILON,
}) {
  const segV = segment?.V ?? V;
  const segBeta = segment?.beta ?? beta;
  const segGamma = segment?.gamma ?? gamma;
  const segAlpha = segment?.alpha ?? alpha;
  const segDelta = segment?.delta ?? delta;

  const idA = restaurantA.id;
  const idB = restaurantB.id;

  const priceA = restaurantA.price;
  const priceB = restaurantB.price;
  const qualityA = restaurantA.quality;
  const qualityB = restaurantB.quality;
  const deliveryA = restaurantA.delivery;
  const deliveryB = restaurantB.delivery;

  const aIsReachable = travelCostA < Infinity;
  const bIsReachable = travelCostB < Infinity;

  const aDineInAvailable = aIsReachable;
  const bDineInAvailable = bIsReachable;

  // Option 1: Restaurant A Dine-in
  const uDineInA = aDineInAvailable
    ? segV - segBeta * priceA + segGamma * qualityA - segAlpha * travelCostA
    : -Infinity;

  // Option 2: Restaurant A Delivery
  const aDeliveryAvailable = isDeliveryAvailable({
    travelCost: travelCostA,
    deliveryConfig: deliveryA,
  });
  let tauA = null;
  let uDeliveryA = -Infinity;
  if (aDeliveryAvailable) {
    tauA = calculateDeliveryTime({ travelCost: travelCostA, deliveryConfig: deliveryA });
    uDeliveryA =
      segV -
      segBeta * (priceA + deliveryA.fee) +
      segGamma * qualityA -
      segAlpha * travelCostA -
      segDelta * tauA;
  }

  // Option 3: Restaurant B Dine-in
  const uDineInB = bDineInAvailable
    ? segV - segBeta * priceB + segGamma * qualityB - segAlpha * travelCostB
    : -Infinity;

  // Option 4: Restaurant B Delivery
  const bDeliveryAvailable = isDeliveryAvailable({
    travelCost: travelCostB,
    deliveryConfig: deliveryB,
  });
  let tauB = null;
  let uDeliveryB = -Infinity;
  if (bDeliveryAvailable) {
    tauB = calculateDeliveryTime({ travelCost: travelCostB, deliveryConfig: deliveryB });
    uDeliveryB =
      segV -
      segBeta * (priceB + deliveryB.fee) +
      segGamma * qualityB -
      segAlpha * travelCostB -
      segDelta * tauB;
  }

  const rawOptions = [
    {
      restaurantId: idA,
      mode: SERVICE_MODES.DINE_IN,
      utility: uDineInA,
      travelCost: travelCostA,
      deliveryTime: null,
      deliveryFee: 0,
      available: aDineInAvailable,
      share: 0,
    },
    {
      restaurantId: idA,
      mode: SERVICE_MODES.DELIVERY,
      utility: uDeliveryA,
      travelCost: travelCostA,
      deliveryTime: tauA,
      deliveryFee: deliveryA.fee,
      available: aDeliveryAvailable,
      share: 0,
    },
    {
      restaurantId: idB,
      mode: SERVICE_MODES.DINE_IN,
      utility: uDineInB,
      travelCost: travelCostB,
      deliveryTime: null,
      deliveryFee: 0,
      available: bDineInAvailable,
      share: 0,
    },
    {
      restaurantId: idB,
      mode: SERVICE_MODES.DELIVERY,
      utility: uDeliveryB,
      travelCost: travelCostB,
      deliveryTime: tauB,
      deliveryFee: deliveryB.fee,
      available: bDeliveryAvailable,
      share: 0,
    },
  ];

  const availableOptions = rawOptions.filter((opt) => opt.available);

  if (availableOptions.length === 0) {
    // Unreachable/unavailable -> 100% unserved
    return Object.freeze({
      options: Object.freeze(rawOptions.map((o) => Object.freeze(o))),
      chosenOptions: Object.freeze([]),
      shareA: 0.0,
      shareB: 0.0,
      dineInShareA: 0.0,
      deliveryShareA: 0.0,
      dineInShareB: 0.0,
      deliveryShareB: 0.0,
      unservedShare: 1.0,
      choice: 'NONE',
      isReachable: false,
    });
  }

  // Find maximum utility among available options
  let maxUtility = -Infinity;
  for (let i = 0; i < availableOptions.length; i++) {
    if (availableOptions[i].utility > maxUtility) {
      maxUtility = availableOptions[i].utility;
    }
  }

  // Find all tied winning options within floating-point tolerance
  const winningOptions = availableOptions.filter(
    (opt) => Math.abs(opt.utility - maxUtility) <= tolerance
  );
  const splitShare = 1.0 / winningOptions.length;

  let dineInShareA = 0.0;
  let deliveryShareA = 0.0;
  let dineInShareB = 0.0;
  let deliveryShareB = 0.0;

  const frozenOptions = rawOptions.map((opt) => {
    const isWinner = winningOptions.some(
      (w) => w.restaurantId === opt.restaurantId && w.mode === opt.mode
    );
    const share = isWinner ? splitShare : 0.0;

    if (opt.restaurantId === idA) {
      if (opt.mode === SERVICE_MODES.DINE_IN) dineInShareA = share;
      else deliveryShareA = share;
    } else {
      if (opt.mode === SERVICE_MODES.DINE_IN) dineInShareB = share;
      else deliveryShareB = share;
    }

    return Object.freeze({
      ...opt,
      share,
    });
  });

  const shareA = dineInShareA + deliveryShareA;
  const shareB = dineInShareB + deliveryShareB;

  let choice;
  const diff = shareA - shareB;
  if (Math.abs(diff) <= tolerance) {
    choice = 'TIE';
  } else if (diff > 0) {
    choice = 'A';
  } else {
    choice = 'B';
  }

  const chosenOptions = frozenOptions.filter((opt) => opt.share > 0);

  return Object.freeze({
    options: Object.freeze(frozenOptions),
    chosenOptions: Object.freeze(chosenOptions),
    shareA,
    shareB,
    dineInShareA,
    deliveryShareA,
    dineInShareB,
    deliveryShareB,
    unservedShare: 0.0,
    choice,
    isReachable: true,
  });
}

/**
 * Computes delivery-aware travel costs, utilities, shares, and demand allocation for a single zone
 * across heterogeneous consumer segments.
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
 *   demandA: number,
 *   demandB: number,
 *   dineInDemandA: number,
 *   deliveryDemandA: number,
 *   dineInDemandB: number,
 *   deliveryDemandB: number,
 *   unservedDemand: number,
 *   demand: Readonly<Record<string, number>>,
 *   dineInDemand: Readonly<Record<string, number>>,
 *   deliveryDemand: Readonly<Record<string, number>>,
 *   shareA: number,
 *   shareB: number,
 *   shares: Readonly<Record<string, number>>,
 *   modeShares: Readonly<{ dineIn: number, delivery: number }>,
 *   choice: 'A'|'B'|'TIE'|'NONE',
 *   isReachable: boolean,
 *   segments: ReadonlyArray<Readonly<Object>>,
 *   zoneType?: string
 * }>}
 */
export function allocateFrontierDeliveryDemand({
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
    throw new TypeError('allocateFrontierDeliveryDemand requires a valid zone object.');
  }

  const effectivePop = population !== undefined ? population : zone.population;
  if (typeof effectivePop !== 'number' || !Number.isFinite(effectivePop) || effectivePop < 0) {
    throw new TypeError('allocateFrontierDeliveryDemand requires a non-negative numeric population.');
  }

  const rawSegments = segments ?? config?.segments;
  const normalizedSegments =
    rawSegments !== undefined
      ? validateConsumerSegments(rawSegments)
      : getDefaultConsumerSegments(config);

  const qualityScale = config?.qualityScale ?? DEFAULT_QUALITY_SCALE;

  const validA = validateDeliveryRestaurant(
    restaurantA,
    'A',
    DEFAULT_GRID.width,
    DEFAULT_GRID.height,
    qualityScale
  );
  const validB = validateDeliveryRestaurant(
    restaurantB,
    'B',
    DEFAULT_GRID.width,
    DEFAULT_GRID.height,
    qualityScale
  );

  const idA = validA.id;
  const idB = validB.id;

  const fromPoint = { x: zone.x, y: zone.y };

  const travelCostA = getTravelCost({
    mode,
    from: fromPoint,
    to: validA.location,
    roadNetwork,
  });

  const travelCostB = getTravelCost({
    mode,
    from: fromPoint,
    to: validB.location,
    roadNetwork,
  });

  let totalDemandA = 0;
  let totalDemandB = 0;
  let totalDineInA = 0;
  let totalDeliveryA = 0;
  let totalDineInB = 0;
  let totalDeliveryB = 0;
  let totalUnserved = 0;

  const segmentAllocations = [];

  for (let k = 0; k < normalizedSegments.length; k++) {
    const seg = normalizedSegments[k];
    const segPop = effectivePop * seg.populationShare;

    const segChoice = calculateZoneDeliveryChoice({
      travelCostA,
      travelCostB,
      restaurantA: validA,
      restaurantB: validB,
      segment: seg,
      tolerance,
    });

    const segDineInA = segPop * segChoice.dineInShareA;
    const segDeliveryA = segPop * segChoice.deliveryShareA;
    const segDemandA = segDineInA + segDeliveryA;

    const segDineInB = segPop * segChoice.dineInShareB;
    const segDeliveryB = segPop * segChoice.deliveryShareB;
    const segDemandB = segDineInB + segDeliveryB;

    const segUnserved = segPop * segChoice.unservedShare;

    totalDemandA += segDemandA;
    totalDemandB += segDemandB;
    totalDineInA += segDineInA;
    totalDeliveryA += segDeliveryA;
    totalDineInB += segDineInB;
    totalDeliveryB += segDeliveryB;
    totalUnserved += segUnserved;

    segmentAllocations.push(
      Object.freeze({
        segmentId: seg.id,
        segmentName: seg.name,
        population: segPop,
        travelCostA,
        travelCostB,
        options: segChoice.options,
        chosenOptions: segChoice.chosenOptions,
        demandA: segDemandA,
        demandB: segDemandB,
        dineInDemandA: segDineInA,
        deliveryDemandA: segDeliveryA,
        dineInDemandB: segDineInB,
        deliveryDemandB: segDeliveryB,
        unservedDemand: segUnserved,
        shareA: segChoice.shareA,
        shareB: segChoice.shareB,
        dineInShareA: segChoice.dineInShareA,
        deliveryShareA: segChoice.deliveryShareA,
        dineInShareB: segChoice.dineInShareB,
        deliveryShareB: segChoice.deliveryShareB,
        choice: segChoice.choice,
        isReachable: segChoice.isReachable,
      })
    );
  }

  const isReachable = totalUnserved < effectivePop;
  const shareA = effectivePop > 0 ? totalDemandA / effectivePop : 0;
  const shareB = effectivePop > 0 ? totalDemandB / effectivePop : 0;

  let choice;
  if (!isReachable) {
    choice = 'NONE';
  } else {
    const diff = totalDemandA - totalDemandB;
    if (Math.abs(diff) <= tolerance * (effectivePop > 0 ? effectivePop : 1)) {
      choice = 'TIE';
    } else if (diff > 0) {
      choice = 'A';
    } else {
      choice = 'B';
    }
  }

  const modeDineIn = totalDineInA + totalDineInB;
  const modeDelivery = totalDeliveryA + totalDeliveryB;

  return Object.freeze({
    zone: Object.freeze({ x: zone.x, y: zone.y }),
    population: effectivePop,
    travelCostA,
    travelCostB,
    demandA: totalDemandA,
    demandB: totalDemandB,
    dineInDemandA: totalDineInA,
    deliveryDemandA: totalDeliveryA,
    dineInDemandB: totalDineInB,
    deliveryDemandB: totalDeliveryB,
    unservedDemand: totalUnserved,
    demand: Object.freeze({ [idA]: totalDemandA, [idB]: totalDemandB }),
    dineInDemand: Object.freeze({ [idA]: totalDineInA, [idB]: totalDineInB }),
    deliveryDemand: Object.freeze({ [idA]: totalDeliveryA, [idB]: totalDeliveryB }),
    shareA,
    shareB,
    shares: Object.freeze({ [idA]: shareA, [idB]: shareB }),
    modeShares: Object.freeze({
      dineIn: effectivePop > 0 ? modeDineIn / effectivePop : 0,
      delivery: effectivePop > 0 ? modeDelivery / effectivePop : 0,
    }),
    choice,
    isReachable,
    segments: Object.freeze(segmentAllocations),
    ...(zone.zoneType ? { zoneType: zone.zoneType } : {}),
  });
}

/**
 * Evaluates the full Frontier market demand and zone allocations for two competing restaurants
 * under heterogeneous consumer preferences and delivery options.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object containing `cells` array
 * @param {Object} [options.restaurantA] - First restaurant definition
 * @param {Object} [options.restaurantB] - Second restaurant definition
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {{V?: number, alpha?: number, gamma?: number, qualityScale?: { min?: number, max?: number }, segments?: Array<Object>}} [options.config=DEFAULT_PARAMS]
 * @param {Array<Object>} [options.segments] - Optional consumer segments override
 * @param {Object} [options.deliveryA] - Optional delivery config override for restaurant A
 * @param {Object} [options.deliveryB] - Optional delivery config override for restaurant B
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantDemand: Readonly<Record<string, number>>,
 *   dineInDemand: Readonly<Record<string, number>>,
 *   deliveryDemand: Readonly<Record<string, number>>,
 *   unservedDemand: number,
 *   restaurantShares: Readonly<Record<string, number>>,
 *   marketShares: Readonly<Record<string, number>>,
 *   modeShares: Readonly<{ dineIn: number, delivery: number }>,
 *   totalPopulation: number,
 *   servedPopulation: number,
 *   unservedPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   zoneAllocations: ReadonlyArray<Readonly<Object>>,
 *   segmentResults: ReadonlyArray<Readonly<Object>>,
 *   segmentDemand: Readonly<Record<string, Readonly<Record<string, number>>>>,
 *   travelCostMode: string,
 *   config: Readonly<Object>,
 *   segments: ReadonlyArray<Readonly<Object>>,
 *   restaurants: ReadonlyArray<Readonly<Object>>
 * }>}
 */
export function calculateFrontierDeliveryMarket(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateFrontierDeliveryMarket requires an options object.');
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
      'calculateFrontierDeliveryMarket requires a valid Frontier city with a cells array.'
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
  const segments =
    rawSegments !== undefined
      ? validateConsumerSegments(rawSegments)
      : getDefaultConsumerSegments(config);

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;

  const [restaurantA, restaurantB] = extractDeliveryRestaurants(
    options,
    width,
    height,
    qualityScale
  );

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
  const segmentDineInTotals = {};
  const segmentDeliveryTotals = {};
  const segmentUnservedTotals = {};
  const segmentPopulationTotals = {};

  for (let k = 0; k < segments.length; k++) {
    const segId = segments[k].id;
    segmentDemandTotals[segId] = { [idA]: 0, [idB]: 0 };
    segmentDineInTotals[segId] = { [idA]: 0, [idB]: 0 };
    segmentDeliveryTotals[segId] = { [idA]: 0, [idB]: 0 };
    segmentUnservedTotals[segId] = 0;
    segmentPopulationTotals[segId] = 0;
  }

  const cells = city.cells;
  const zoneAllocations = [];
  let totalPopulation = 0;
  let demandA = 0;
  let demandB = 0;
  let totalDineInA = 0;
  let totalDeliveryA = 0;
  let totalDineInB = 0;
  let totalDeliveryB = 0;
  let totalUnserved = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const pop = cell.population;
    totalPopulation += pop;

    const allocation = allocateFrontierDeliveryDemand({
      zone: cell,
      population: pop,
      restaurantA,
      restaurantB,
      mode,
      roadNetwork,
      config: marketConfig,
      segments,
      tolerance,
    });

    zoneAllocations.push(allocation);

    demandA += allocation.demandA;
    demandB += allocation.demandB;
    totalDineInA += allocation.dineInDemandA;
    totalDeliveryA += allocation.deliveryDemandA;
    totalDineInB += allocation.dineInDemandB;
    totalDeliveryB += allocation.deliveryDemandB;
    totalUnserved += allocation.unservedDemand;

    for (let k = 0; k < allocation.segments.length; k++) {
      const segAlloc = allocation.segments[k];
      const segId = segAlloc.segmentId;
      segmentPopulationTotals[segId] += segAlloc.population;
      segmentDemandTotals[segId][idA] += segAlloc.demandA;
      segmentDemandTotals[segId][idB] += segAlloc.demandB;
      segmentDineInTotals[segId][idA] += segAlloc.dineInDemandA;
      segmentDineInTotals[segId][idB] += segAlloc.dineInDemandB;
      segmentDeliveryTotals[segId][idA] += segAlloc.deliveryDemandA;
      segmentDeliveryTotals[segId][idB] += segAlloc.deliveryDemandB;
      segmentUnservedTotals[segId] += segAlloc.unservedDemand;
    }
  }

  const restaurantDemand = {
    [idA]: demandA,
    [idB]: demandB,
  };

  const dineInDemand = {
    [idA]: totalDineInA,
    [idB]: totalDineInB,
  };

  const deliveryDemand = {
    [idA]: totalDeliveryA,
    [idB]: totalDeliveryB,
  };

  const restaurantShares = {
    [idA]: totalPopulation > 0 ? demandA / totalPopulation : 0,
    [idB]: totalPopulation > 0 ? demandB / totalPopulation : 0,
  };

  const modeDineInTotal = totalDineInA + totalDineInB;
  const modeDeliveryTotal = totalDeliveryA + totalDeliveryB;

  const modeShares = {
    dineIn: totalPopulation > 0 ? modeDineInTotal / totalPopulation : 0,
    delivery: totalPopulation > 0 ? modeDeliveryTotal / totalPopulation : 0,
  };

  const frozenSegmentDemand = {};
  const segmentResultsArray = [];

  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const segId = seg.id;
    const segPop = segmentPopulationTotals[segId];
    const demA = segmentDemandTotals[segId][idA];
    const demB = segmentDemandTotals[segId][idB];
    const dineA = segmentDineInTotals[segId][idA];
    const delA = segmentDeliveryTotals[segId][idA];
    const dineB = segmentDineInTotals[segId][idB];
    const delB = segmentDeliveryTotals[segId][idB];
    const segUnserved = segmentUnservedTotals[segId];

    frozenSegmentDemand[segId] = Object.freeze({
      [idA]: demA,
      [idB]: demB,
    });

    const segResult = Object.freeze({
      segmentId: segId,
      segmentName: seg.name,
      population: segPop,
      restaurantDemand: Object.freeze({
        [idA]: demA,
        [idB]: demB,
      }),
      dineInDemand: Object.freeze({
        [idA]: dineA,
        [idB]: dineB,
      }),
      deliveryDemand: Object.freeze({
        [idA]: delA,
        [idB]: delB,
      }),
      unservedDemand: segUnserved,
      restaurantShares: Object.freeze({
        [idA]: segPop > 0 ? demA / segPop : 0,
        [idB]: segPop > 0 ? demB / segPop : 0,
      }),
      marketShares: Object.freeze({
        [idA]: segPop > 0 ? demA / segPop : 0,
        [idB]: segPop > 0 ? demB / segPop : 0,
      }),
      modeShares: Object.freeze({
        dineIn: segPop > 0 ? (dineA + dineB) / segPop : 0,
        delivery: segPop > 0 ? (delA + delB) / segPop : 0,
      }),
    });

    segmentResultsArray.push(segResult);
    // Also allow direct key access: segmentResults[segId]
    segmentResultsArray[segId] = segResult;
  }

  const servedPopulation = demandA + demandB;

  return Object.freeze({
    restaurantDemand: Object.freeze(restaurantDemand),
    dineInDemand: Object.freeze(dineInDemand),
    deliveryDemand: Object.freeze(deliveryDemand),
    unservedDemand: totalUnserved,
    restaurantShares: Object.freeze(restaurantShares),
    marketShares: Object.freeze(restaurantShares),
    modeShares: Object.freeze(modeShares),
    totalPopulation,
    servedPopulation,
    unservedPopulation: totalUnserved,
    reachablePopulation: servedPopulation,
    unreachablePopulation: totalUnserved,
    zoneAllocations: Object.freeze(zoneAllocations),
    segmentResults: Object.freeze(segmentResultsArray),
    segmentDemand: Object.freeze(frozenSegmentDemand),
    travelCostMode: mode,
    config: marketConfig,
    segments,
    restaurants: Object.freeze([restaurantA, restaurantB]),
  });
}
