/**
 * @file consumerChoice.js
 * @description Frontier consumer-choice and demand allocation engine (Phase 6D).
 *
 * Architecture:
 *   Frontier City (Urban Geography & Effective Population)
 *        ↓
 *   Road Network & Travel Cost (Euclidean / Dijkstra Shortest Path)
 *        ↓
 *   Consumer Utility & Zone Choice (Deterministic Utility Comparison)
 *        ↓
 *   Restaurant Demand & Market Share
 *
 * Mathematical Model:
 * For consumer zone i and restaurant j:
 *   U_ij = V - P_j - alpha * T_ij
 *
 * Decision Rule:
 *   utilityA > utilityB  => shareA = 1, shareB = 0
 *   utilityB > utilityA  => shareA = 0, shareB = 1
 *   utilityA === utilityB (within float tolerance) => shareA = 0.5, shareB = 0.5
 *
 * Disconnected Topology / Unreachable Zones:
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

/**
 * Validates and normalizes an input restaurant object.
 *
 * @param {Object} r - Raw restaurant input
 * @param {string} label - Identifier for error reporting ('A' or 'B')
 * @param {number} width - Grid width
 * @param {number} height - Grid height
 * @returns {Readonly<{ id: string, location: { x: number, y: number }, price: number }>}
 */
function validateRestaurant(r, label, width = DEFAULT_GRID.width, height = DEFAULT_GRID.height) {
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

  return Object.freeze({
    id: r.id.trim(),
    location: Object.freeze({ x, y }),
    price: r.price,
  });
}

/**
 * Extracts and validates exactly two restaurants from caller options.
 *
 * @param {Object} options
 * @param {number} width
 * @param {number} height
 * @returns {[Readonly<Object>, Readonly<Object>]}
 */
function extractRestaurants(options, width, height) {
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

  const validA = validateRestaurant(rA, 'A', width, height);
  const validB = validateRestaurant(rB, 'B', width, height);

  if (validA.id === validB.id) {
    throw new RangeError(`Duplicate restaurant ID "${validA.id}". Restaurant IDs must be unique.`);
  }

  return [validA, validB];
}

/**
 * Calculates consumer utility U_ij for a given travel distance and price.
 *
 *   U_ij = V - P_j - alpha * T_ij
 *
 * @param {Object} params
 * @param {number} params.travelCost - Travel distance / friction (T_ij)
 * @param {number} params.price - Restaurant price (P_j)
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Baseline consumer valuation
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity factor
 * @returns {number} Calculated utility (or -Infinity if unreachable)
 */
export function calculateFrontierUtility({
  travelCost,
  price,
  V = DEFAULT_PARAMS.V,
  alpha = DEFAULT_PARAMS.alpha,
}) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('calculateFrontierUtility requires a finite price.');
  }
  if (typeof travelCost !== 'number') {
    throw new TypeError('calculateFrontierUtility requires a numeric travelCost.');
  }
  if (
    typeof V !== 'number' ||
    !Number.isFinite(V) ||
    typeof alpha !== 'number' ||
    !Number.isFinite(alpha)
  ) {
    throw new TypeError('calculateFrontierUtility requires finite V and alpha values.');
  }

  if (travelCost === Infinity) {
    return -Infinity;
  }

  return V - price - alpha * travelCost;
}

/**
 * Determines zone-level consumer choice shares between two competing restaurants.
 *
 * @param {Object} params
 * @param {number} params.travelCostA - Travel cost to restaurant A
 * @param {number} params.travelCostB - Travel cost to restaurant B
 * @param {number} params.priceA - Price of restaurant A
 * @param {number} params.priceB - Price of restaurant B
 * @param {number} [params.V=DEFAULT_PARAMS.V] - Reservation valuation
 * @param {number} [params.alpha=DEFAULT_PARAMS.alpha] - Travel sensitivity
 * @param {number} [params.tolerance=FLOAT_EPSILON] - Numerical tie tolerance
 * @returns {Readonly<{
 *   choice: 'A'|'B'|'TIE'|'NONE',
 *   shareA: number,
 *   shareB: number,
 *   utilityA: number,
 *   utilityB: number,
 *   travelCostA: number,
 *   travelCostB: number,
 *   isReachable: boolean
 * }>}
 */
export function calculateZoneChoice({
  travelCostA,
  travelCostB,
  priceA,
  priceB,
  V = DEFAULT_PARAMS.V,
  alpha = DEFAULT_PARAMS.alpha,
  tolerance = FLOAT_EPSILON,
}) {
  const utilityA = calculateFrontierUtility({ travelCost: travelCostA, price: priceA, V, alpha });
  const utilityB = calculateFrontierUtility({ travelCost: travelCostB, price: priceB, V, alpha });

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
    isReachable: true,
  });
}

/**
 * Computes travel costs, utilities, shares, and demand allocation for a single population zone.
 *
 * @param {Object} params
 * @param {{x: number, y: number, zoneType?: string}} params.zone - Zone location coordinates
 * @param {number} [params.population] - Zone effective population (defaults to zone.population)
 * @param {Object} params.restaurantA - Restaurant A definition
 * @param {Object} params.restaurantB - Restaurant B definition
 * @param {'euclidean'|'road'} [params.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [params.roadNetwork] - Required when mode is 'road'
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS]
 * @param {number} [params.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   zone: { x: number, y: number },
 *   population: number,
 *   travelCostA: number,
 *   travelCostB: number,
 *   utilityA: number,
 *   utilityB: number,
 *   shareA: number,
 *   shareB: number,
 *   demandA: number,
 *   demandB: number,
 *   choice: 'A'|'B'|'TIE'|'NONE',
 *   isReachable: boolean,
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
  tolerance = FLOAT_EPSILON,
}) {
  if (!zone || typeof zone !== 'object') {
    throw new TypeError('allocateFrontierDemand requires a valid zone object.');
  }

  const effectivePop = population !== undefined ? population : zone.population;
  if (typeof effectivePop !== 'number' || !Number.isFinite(effectivePop) || effectivePop < 0) {
    throw new TypeError('allocateFrontierDemand requires a non-negative numeric population.');
  }

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

  const choiceResult = calculateZoneChoice({
    travelCostA,
    travelCostB,
    priceA: restaurantA.price,
    priceB: restaurantB.price,
    V: config?.V ?? DEFAULT_PARAMS.V,
    alpha: config?.alpha ?? DEFAULT_PARAMS.alpha,
    tolerance,
  });

  const demandA = effectivePop * choiceResult.shareA;
  const demandB = effectivePop * choiceResult.shareB;

  return Object.freeze({
    zone: Object.freeze({ x: zone.x, y: zone.y }),
    population: effectivePop,
    travelCostA,
    travelCostB,
    utilityA: choiceResult.utilityA,
    utilityB: choiceResult.utilityB,
    shareA: choiceResult.shareA,
    shareB: choiceResult.shareB,
    demandA,
    demandB,
    choice: choiceResult.choice,
    isReachable: choiceResult.isReachable,
    ...(zone.zoneType ? { zoneType: zone.zoneType } : {}),
  });
}

/**
 * Evaluates the full Frontier market demand and zone allocations for two competing restaurants.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object containing `cells` array
 * @param {Object} [options.restaurantA] - First restaurant state (or pass options.restaurants)
 * @param {Object} [options.restaurantB] - Second restaurant state (or pass options.restaurants)
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {{V?: number, alpha?: number}} [options.config=DEFAULT_PARAMS]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantDemand: Record<string, number>,
 *   marketShares: Record<string, number>,
 *   reachableMarketShares: Record<string, number>,
 *   zoneAllocations: Array<Object>,
 *   totalPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   travelCostMode: string,
 *   config: { V: number, alpha: number },
 *   restaurants: Array<{ id: string, location: { x: number, y: number }, price: number }>
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

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;

  const [restaurantA, restaurantB] = extractRestaurants(options, width, height);

  const V = config?.V ?? DEFAULT_PARAMS.V;
  const alpha = config?.alpha ?? DEFAULT_PARAMS.alpha;

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

    const allocation = allocateFrontierDemand({
      zone: cell,
      population: pop,
      restaurantA,
      restaurantB,
      mode,
      roadNetwork,
      config: { V, alpha },
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
  }

  const idA = restaurantA.id;
  const idB = restaurantB.id;

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

  return Object.freeze({
    restaurantDemand: Object.freeze(restaurantDemand),
    marketShares: Object.freeze(marketShares),
    reachableMarketShares: Object.freeze(reachableMarketShares),
    zoneAllocations: Object.freeze(zoneAllocations),
    totalPopulation,
    reachablePopulation,
    unreachablePopulation,
    travelCostMode: mode,
    config: Object.freeze({ V, alpha }),
    restaurants: Object.freeze([
      Object.freeze({ ...restaurantA }),
      Object.freeze({ ...restaurantB }),
    ]),
  });
}
