/**
 * @file strategicQuality.js
 * @description Frontier Strategic Quality Choice Engine (Phase 7C).
 *
 * Game Theory & Economic Foundations:
 * In Phase 7C, restaurant quality transitions from an exogenous parameter to an endogenous strategic decision:
 *   s_j = (location, price, quality) = ({x, y}, P_j, Q_j)
 *
 * Strategy Space:
 *   Location: W x H discrete grid cells (default: 10 x 10 = 100 locations)
 *   Price: 5 discrete prices [150, 200, 250, 300, 350]
 *   Quality: 5 discrete quality levels Q in {2, 4, 6, 8, 10}
 *   Strategy space per player: |S_j| = 100 x 5 x 5 = 2,500 pure strategies.
 *   Joint profile space: |S_A x S_B| = 2,500 x 2,500 = 6,250,000 pure strategy profiles.
 *
 * Consumer Utility Model (Phase 7B / 7C):
 * For consumer zone i, restaurant j, and consumer segment k:
 *   U_ij^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij
 *
 * Quality Investment Cost:
 * High-quality provision requires upfront, capital-intensive investments:
 *   K(Q_j) = kappa * Q_j^2
 * Default kappa = 25.
 * Quality cost is a restaurant-level fixed strategic investment cost, NOT a per-customer variable cost.
 * It is NOT multiplied by demand and does NOT enter consumer utility directly.
 *
 * Restaurant Profit:
 *   pi_j = (P_j - C_j) * D_j - F_j - K(Q_j)
 *        = (P_j - C_j) * D_j - F_j - kappa * Q_j^2
 *
 * Strategic Trade-Off:
 * Higher quality Q_j increases consumer utility (+gamma_k * Q_j) and potentially expands customer demand D_j,
 * but simultaneously increases investment cost (-kappa * Q_j^2).
 * Rational firms therefore optimize quality endogenously against their location, price, and competitive environment.
 */

import {
  DEFAULT_GRID,
  DEFAULT_PARAMS,
  DEFAULT_ALLOWED_PRICES,
  DEFAULT_VARIABLE_COST,
  DEFAULT_FIXED_COST,
  FLOAT_EPSILON,
} from '../types.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { validateFrontierLocation, validateFrontierPrice } from './strategies.js';
import { DEFAULT_GAMMA } from './quality.js';
import { buildFrontierTravelCostMatrix } from './equilibrium.js';
import { calculateFrontierMarket } from './consumerChoice.js';
import { getDefaultConsumerSegments, validateConsumerSegments } from './consumerSegments.js';

/**
 * Allowed discrete strategic quality levels Q = {2, 4, 6, 8, 10}.
 */
export const STRATEGIC_QUALITY_LEVELS = Object.freeze([2, 4, 6, 8, 10]);

/**
 * Default quadratic quality cost coefficient (kappa).
 * K(Q) = kappa * Q^2.
 */
export const DEFAULT_QUALITY_COST_KAPPA = 25;

/**
 * Validates whether a given value is one of the allowed discrete strategic quality levels.
 *
 * @param {unknown} quality - Value to validate
 * @returns {boolean} True if quality is in STRATEGIC_QUALITY_LEVELS
 */
export function validateStrategicQuality(quality) {
  if (typeof quality !== 'number' || !Number.isFinite(quality)) {
    return false;
  }
  return STRATEGIC_QUALITY_LEVELS.includes(quality);
}

/**
 * Calculates the capital investment cost of establishing a strategic quality level:
 *   K(Q) = kappa * Q^2
 *
 * @param {number} quality - Quality level in STRATEGIC_QUALITY_LEVELS
 * @param {number} [kappa=DEFAULT_QUALITY_COST_KAPPA] - Quadratic cost coefficient (>= 0)
 * @returns {number} Investment cost
 */
export function calculateQualityInvestmentCost(quality, kappa = DEFAULT_QUALITY_COST_KAPPA) {
  if (!validateStrategicQuality(quality)) {
    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      throw new TypeError(
        `Strategic quality must be a finite number, received ${typeof quality === 'symbol' ? 'symbol' : quality}.`
      );
    }
    throw new RangeError(
      `Invalid strategic quality level ${quality}. Allowed levels: ${STRATEGIC_QUALITY_LEVELS.join(', ')}.`
    );
  }

  if (typeof kappa !== 'number' || !Number.isFinite(kappa)) {
    throw new TypeError(`Quality cost parameter kappa must be a finite number, received ${kappa}.`);
  }

  if (kappa < 0) {
    throw new RangeError(`Quality cost parameter kappa must be non-negative, received ${kappa}.`);
  }

  return kappa * quality * quality;
}

/**
 * Validates and normalizes quality cost configuration parameters.
 *
 * @param {Object} [config={}]
 * @param {number} [config.kappa=DEFAULT_QUALITY_COST_KAPPA]
 * @returns {Readonly<{ kappa: number }>}
 */
export function validateQualityCostConfig(config = {}) {
  if (config === null || typeof config !== 'object') {
    throw new TypeError('validateQualityCostConfig requires an options object.');
  }

  const kappa = config?.kappa ?? DEFAULT_QUALITY_COST_KAPPA;
  if (typeof kappa !== 'number' || !Number.isFinite(kappa)) {
    throw new TypeError(`Quality cost parameter kappa must be a finite number, received ${kappa}.`);
  }

  if (kappa < 0) {
    throw new RangeError(`Quality cost parameter kappa must be non-negative, received ${kappa}.`);
  }

  return Object.freeze({ kappa });
}

/**
 * Validates whether an object is a valid canonical Frontier strategic-quality strategy:
 * {
 *   location: { x: integer, y: integer },
 *   price: number,
 *   quality: number
 * }
 *
 * Rejects legacy top-level x/y coordinates and invalid dimension values.
 *
 * @param {Object} strategy
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @param {readonly number[]} [options.allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @param {readonly number[]} [options.qualityLevels=STRATEGIC_QUALITY_LEVELS]
 * @returns {boolean}
 */
export function validateStrategicQualityStrategy(strategy, options = {}) {
  if (!strategy || typeof strategy !== 'object') {
    return false;
  }

  // Reject top-level conflicting coordinates
  if ('x' in strategy || 'y' in strategy) {
    return false;
  }

  if (!strategy.location || typeof strategy.location !== 'object') {
    return false;
  }

  const width = options?.width ?? DEFAULT_GRID.width;
  const height = options?.height ?? DEFAULT_GRID.height;
  const prices = options?.allowedPrices ?? DEFAULT_ALLOWED_PRICES;
  const qualities = options?.qualityLevels ?? STRATEGIC_QUALITY_LEVELS;

  if (!validateFrontierLocation(strategy.location, { width, height })) {
    return false;
  }

  if (!validateFrontierPrice(strategy.price, prices)) {
    return false;
  }

  if (typeof strategy.quality !== 'number' || !Number.isFinite(strategy.quality)) {
    return false;
  }

  return qualities.includes(strategy.quality);
}

/**
 * Creates an immutable, canonical Frontier strategic-quality strategy object.
 *
 * @param {{x: number, y: number}|{location: {x: number, y: number}, price: number, quality: number}} locationOrStrategy
 * @param {number} [maybePrice]
 * @param {number} [maybeQuality]
 * @returns {Readonly<{ location: Readonly<{ x: number, y: number }>, price: number, quality: number }>}
 */
export function createStrategicQualityStrategy(locationOrStrategy, maybePrice, maybeQuality) {
  let loc;
  let price;
  let quality;

  if (
    locationOrStrategy &&
    typeof locationOrStrategy === 'object' &&
    'location' in locationOrStrategy
  ) {
    loc = locationOrStrategy.location;
    price = maybePrice !== undefined ? maybePrice : locationOrStrategy.price;
    quality = maybeQuality !== undefined ? maybeQuality : locationOrStrategy.quality;
  } else {
    loc = locationOrStrategy;
    price = maybePrice;
    quality = maybeQuality;
  }

  if (!validateFrontierLocation(loc)) {
    throw new TypeError(
      'Invalid location for Strategic Quality strategy: expected valid {x, y} integer coordinates within grid bounds.'
    );
  }

  if (!validateFrontierPrice(price)) {
    throw new RangeError(
      `Invalid price ${price} for Strategic Quality strategy. Allowed prices: ${DEFAULT_ALLOWED_PRICES.join(', ')}.`
    );
  }

  if (!validateStrategicQuality(quality)) {
    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      throw new TypeError(
        `Strategic quality must be a finite number, received ${typeof quality === 'symbol' ? 'symbol' : quality}.`
      );
    }
    throw new RangeError(
      `Invalid strategic quality level ${quality}. Allowed levels: ${STRATEGIC_QUALITY_LEVELS.join(', ')}.`
    );
  }

  return Object.freeze({
    location: Object.freeze({ x: loc.x, y: loc.y }),
    price,
    quality,
  });
}

/**
 * Generates the full discrete strategic-quality strategy space S for a single restaurant.
 *
 * Ordering is strictly deterministic:
 *   outer loop: y ascending (0 to height - 1)
 *   middle loop: x ascending (0 to width - 1)
 *   inner loop 1: price ascending
 *   inner loop 2: quality ascending
 *
 * For a 10x10 city, 5 prices, and 5 quality levels:
 *   |S| = 10 * 10 * 5 * 5 = 2,500 strategies.
 *
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @param {readonly number[]} [options.allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @param {readonly number[]} [options.qualityLevels=STRATEGIC_QUALITY_LEVELS]
 * @returns {ReadonlyArray<Readonly<{ location: Readonly<{ x: number, y: number }>, price: number, quality: number }>>}
 */
export function getStrategicQualityStrategies(options = {}) {
  const width = options?.width ?? DEFAULT_GRID.width;
  const height = options?.height ?? DEFAULT_GRID.height;
  const prices = options?.allowedPrices ?? DEFAULT_ALLOWED_PRICES;
  const qualities = options?.qualityLevels ?? STRATEGIC_QUALITY_LEVELS;

  const strategies = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let p = 0; p < prices.length; p++) {
        for (let q = 0; q < qualities.length; q++) {
          strategies.push(
            Object.freeze({
              location: Object.freeze({ x, y }),
              price: prices[p],
              quality: qualities[q],
            })
          );
        }
      }
    }
  }

  return Object.freeze(strategies);
}

/**
 * Creates a canonical string key for a single strategic-quality strategy: "x,y,price,quality".
 *
 * @param {Object} strategy
 * @returns {string}
 */
export function createStrategicQualityStrategyKey(strategy) {
  if (!strategy?.location) {
    throw new TypeError('createStrategicQualityStrategyKey requires a valid strategy object with location.');
  }
  return `${strategy.location.x},${strategy.location.y},${strategy.price},${strategy.quality}`;
}

/**
 * Creates a unique string representation of a joint strategic-quality profile:
 * "x_A,y_A,p_A,q_A|x_B,y_B,p_B,q_B".
 *
 * @param {Object} strategyA
 * @param {Object} strategyB
 * @returns {string}
 */
export function createStrategicQualityProfileKey(strategyA, strategyB) {
  if (!strategyA?.location || !strategyB?.location) {
    throw new TypeError(
      'createStrategicQualityProfileKey: both strategies must be valid objects with a location.'
    );
  }
  return `${createStrategicQualityStrategyKey(strategyA)}|${createStrategicQualityStrategyKey(strategyB)}`;
}

/**
 * Formats a strategic-quality profile as a human-readable state label:
 * "A(x,y,p,q)|B(x,y,p,q)".
 *
 * @param {Object} strategyA
 * @param {Object} strategyB
 * @returns {string}
 */
export function formatStrategicQualityProfile(strategyA, strategyB) {
  if (!strategyA?.location || !strategyB?.location) {
    throw new TypeError('formatStrategicQualityProfile requires valid strategy objects with location.');
  }
  return `A(${strategyA.location.x},${strategyA.location.y},${strategyA.price},${strategyA.quality})|B(${strategyB.location.x},${strategyB.location.y},${strategyB.price},${strategyB.quality})`;
}

/**
 * Calculates net economic profit for a restaurant under strategic quality choice:
 *   pi_j = (P_j - C_j) * D_j - F_j - K(Q_j)
 *        = (P_j - C_j) * D_j - F_j - kappa * Q_j^2
 *
 * Quality has NO direct revenue bonus. It affects profit strictly via demand D_j and investment cost K(Q_j).
 *
 * @param {{ price: number, quality: number, variableCost?: number, fixedCost?: number, kappa?: number }} restaurant
 * @param {number} demand - Demand served by the restaurant
 * @param {number} [fixedCostOverride]
 * @param {number} [variableCostOverride]
 * @param {number} [kappaOverride]
 * @returns {number} Economic profit
 */
export function calculateStrategicQualityProfit(
  restaurant,
  demand,
  fixedCostOverride,
  variableCostOverride,
  kappaOverride
) {
  if (!restaurant || typeof restaurant !== 'object') {
    throw new TypeError('calculateStrategicQualityProfit requires a valid restaurant object.');
  }

  const price = restaurant.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('Restaurant must have a finite numeric price.');
  }

  const quality = restaurant.quality;
  if (!validateStrategicQuality(quality)) {
    if (typeof quality !== 'number' || !Number.isFinite(quality)) {
      throw new TypeError(`Restaurant must have a finite numeric quality, received ${quality}.`);
    }
    throw new RangeError(
      `Invalid strategic quality ${quality}. Allowed levels: ${STRATEGIC_QUALITY_LEVELS.join(', ')}.`
    );
  }

  const variableCost =
    variableCostOverride ?? restaurant.variableCost ?? DEFAULT_VARIABLE_COST;
  if (typeof variableCost !== 'number' || !Number.isFinite(variableCost)) {
    throw new TypeError('Variable cost must be a finite number.');
  }

  const fixedCost = fixedCostOverride ?? restaurant.fixedCost ?? DEFAULT_FIXED_COST;
  if (typeof fixedCost !== 'number' || !Number.isFinite(fixedCost)) {
    throw new TypeError('Fixed cost must be a finite number.');
  }

  const kappa = kappaOverride ?? restaurant.kappa ?? DEFAULT_QUALITY_COST_KAPPA;
  const investmentCost = calculateQualityInvestmentCost(quality, kappa);

  if (typeof demand !== 'number' || !Number.isFinite(demand)) {
    throw new TypeError('Demand must be a finite number.');
  }

  return (price - variableCost) * demand - fixedCost - investmentCost;
}

/**
 * Normalizes input restaurant / strategy definitions into canonical strategic-quality objects.
 *
 * @private
 * @param {Object} options
 * @returns {{ rA: Object, rB: Object }}
 */
function normalizeStrategicRestaurants(options) {
  let rA, rB;

  if (options.restaurants !== undefined) {
    if (!Array.isArray(options.restaurants) || options.restaurants.length !== 2) {
      throw new RangeError('Strategic quality payoff engine requires exactly two restaurants.');
    }
    rA = options.restaurants[0];
    rB = options.restaurants[1];
  } else if (options.restaurantA !== undefined || options.restaurantB !== undefined) {
    if (!options.restaurantA || !options.restaurantB) {
      throw new TypeError('Both restaurantA and restaurantB must be provided.');
    }
    rA = options.restaurantA;
    rB = options.restaurantB;
  } else if (options.strategyA !== undefined || options.strategyB !== undefined) {
    if (!options.strategyA || !options.strategyB) {
      throw new TypeError('Both strategyA and strategyB must be provided.');
    }
    rA = options.strategyA;
    rB = options.strategyB;
  } else {
    throw new TypeError(
      'Restaurants or strategies must be provided via options.restaurants, options.restaurantA/B, or options.strategyA/B.'
    );
  }

  const locA = rA.location ?? (rA.x !== undefined && rA.y !== undefined ? { x: rA.x, y: rA.y } : undefined);
  const locB = rB.location ?? (rB.x !== undefined && rB.y !== undefined ? { x: rB.x, y: rB.y } : undefined);

  const normA = {
    id: rA.id ?? 'A',
    location: locA,
    price: rA.price,
    quality: rA.quality,
    variableCost: rA.variableCost,
    fixedCost: rA.fixedCost,
    kappa: rA.kappa,
  };

  const normB = {
    id: rB.id ?? 'B',
    location: locB,
    price: rB.price,
    quality: rB.quality,
    variableCost: rB.variableCost,
    fixedCost: rB.fixedCost,
    kappa: rB.kappa,
  };

  return { rA: normA, rB: normB };
}

/**
 * Computes strategic-quality payoff and market outcomes for two competing restaurants.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city model with cells array
 * @param {Object} [options.restaurantA] - First restaurant
 * @param {Object} [options.restaurantB] - Second restaurant
 * @param {Object} [options.strategyA] - Alternative strategy input for player A
 * @param {Object} [options.strategyB] - Alternative strategy input for player B
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Road network model
 * @param {Object} [options.config=DEFAULT_PARAMS] - Economic parameters
 * @param {Array<Object>} [options.segments] - Consumer segments override
 * @param {number} [options.kappa=DEFAULT_QUALITY_COST_KAPPA] - Default quality cost kappa
 * @param {number} [options.kappaA] - Quality cost kappa for restaurant A
 * @param {number} [options.kappaB] - Quality cost kappa for restaurant B
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantA: { id: string, demand: number, marketShare: number, profit: number, quality: number, qualityInvestmentCost: number },
 *   restaurantB: { id: string, demand: number, marketShare: number, profit: number, quality: number, qualityInvestmentCost: number },
 *   totalPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   travelCostMode: string,
 *   config: Object
 * }>}
 */
export function calculateStrategicQualityPayoff(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateStrategicQualityPayoff requires an options object.');
  }

  const {
    city,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  const { rA, rB } = normalizeStrategicRestaurants(options);

  // Validate quality values
  if (!validateStrategicQuality(rA.quality)) {
    throw new RangeError(`Restaurant A has invalid strategic quality ${rA.quality}.`);
  }
  if (!validateStrategicQuality(rB.quality)) {
    throw new RangeError(`Restaurant B has invalid strategic quality ${rB.quality}.`);
  }

  const market = calculateFrontierMarket({
    city,
    restaurantA: rA,
    restaurantB: rB,
    mode,
    roadNetwork,
    config,
    segments,
    tolerance,
  });

  const idA = rA.id;
  const idB = rB.id;

  const demandA = market.restaurantDemand[idA] ?? 0;
  const demandB = market.restaurantDemand[idB] ?? 0;

  const costA_var = variableCostA ?? rA.variableCost ?? variableCost;
  const costB_var = variableCostB ?? rB.variableCost ?? variableCost;
  const costA_fix = fixedCostA ?? rA.fixedCost ?? fixedCost;
  const costB_fix = fixedCostB ?? rB.fixedCost ?? fixedCost;
  const kA = kappaA ?? rA.kappa ?? kappa;
  const kB = kappaB ?? rB.kappa ?? kappa;

  const profitA = calculateStrategicQualityProfit(rA, demandA, costA_fix, costA_var, kA);
  const profitB = calculateStrategicQualityProfit(rB, demandB, costB_fix, costB_var, kB);

  const invA = calculateQualityInvestmentCost(rA.quality, kA);
  const invB = calculateQualityInvestmentCost(rB.quality, kB);

  return Object.freeze({
    restaurantA: Object.freeze({
      id: idA,
      location: Object.freeze({ x: rA.location.x, y: rA.location.y }),
      price: rA.price,
      quality: rA.quality,
      demand: demandA,
      marketShare: market.marketShares[idA] ?? 0,
      profit: profitA,
      qualityInvestmentCost: invA,
    }),
    restaurantB: Object.freeze({
      id: idB,
      location: Object.freeze({ x: rB.location.x, y: rB.location.y }),
      price: rB.price,
      quality: rB.quality,
      demand: demandB,
      marketShare: market.marketShares[idB] ?? 0,
      profit: profitB,
      qualityInvestmentCost: invB,
    }),
    totalPopulation: market.totalPopulation,
    reachablePopulation: market.reachablePopulation,
    unreachablePopulation: market.unreachablePopulation,
    travelCostMode: market.travelCostMode,
    config: market.config,
  });
}

/**
 * Validates travel cost mode and ensures roadNetwork is present if road mode is requested.
 *
 * @private
 */
function validateModeAndNetwork(mode, roadNetwork) {
  if (typeof mode !== 'string') {
    throw new TypeError('Travel cost mode must be a string identifier.');
  }
  if (mode !== TRAVEL_COST_MODES.EUCLIDEAN && mode !== TRAVEL_COST_MODES.ROAD) {
    const allowed = Object.values(TRAVEL_COST_MODES).join(', ');
    throw new RangeError(`Invalid travel cost mode "${mode}". Allowed modes: ${allowed}.`);
  }
  if (mode === TRAVEL_COST_MODES.ROAD && (!roadNetwork || typeof roadNetwork !== 'object')) {
    throw new TypeError('Road travel cost mode requires a valid roadNetwork object.');
  }
}

/**
 * Evaluates candidate strategic-quality strategies for a responding player against a fixed opponent strategy.
 * Maximizes net economic profit (including quality investment cost deduction K(Q)).
 * Returns all tied best-response strategies in canonical order.
 *
 * @param {Object} options
 * @param {'A'|'B'} [options.player='A']
 * @param {Object} options.opponentStrategy - Fixed opponent strategy { location: {x,y}, price, quality }
 * @param {Array<Object>} [options.strategySpace] - Candidate strategies (defaults to getStrategicQualityStrategies())
 * @param {Object} options.city - Frontier city object
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN]
 * @param {Object} [options.roadNetwork]
 * @param {Object} [options.config=DEFAULT_PARAMS]
 * @param {Array<Object>} [options.segments]
 * @param {number} [options.kappa=DEFAULT_QUALITY_COST_KAPPA]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.kappaA]
 * @param {number} [options.kappaB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   player: 'A'|'B',
 *   opponentStrategy: Object,
 *   bestPayoff: number,
 *   strategies: Array<Object>,
 *   bestResponses: Array<Object>,
 *   evaluatedStrategies: Array<{ strategy: Object, payoff: number, demand: number, marketShare: number }>,
 *   travelCostMode: string
 * }>}
 */
export function findStrategicQualityBestResponses(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('findStrategicQualityBestResponses requires an options object.');
  }

  const {
    player = 'A',
    opponentStrategy,
    strategySpace,
    city,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments: rawSegments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!opponentStrategy || typeof opponentStrategy !== 'object') {
    throw new TypeError('findStrategicQualityBestResponses requires a valid opponentStrategy object.');
  }

  const oppLoc = opponentStrategy.location;
  if (!oppLoc || typeof oppLoc.x !== 'number' || typeof oppLoc.y !== 'number') {
    throw new TypeError('findStrategicQualityBestResponses: opponentStrategy must have a valid {x, y} location.');
  }
  if (typeof opponentStrategy.price !== 'number' || !Number.isFinite(opponentStrategy.price)) {
    throw new TypeError('findStrategicQualityBestResponses: opponentStrategy must have a finite numeric price.');
  }
  if (!validateStrategicQuality(opponentStrategy.quality)) {
    throw new RangeError(`findStrategicQualityBestResponses: opponentStrategy has invalid quality ${opponentStrategy.quality}.`);
  }

  if (!city || typeof city !== 'object' || !Array.isArray(city.cells)) {
    throw new TypeError('findStrategicQualityBestResponses requires a valid Frontier city with cells.');
  }

  validateModeAndNetwork(mode, roadNetwork);

  const isPlayerA = player.toUpperCase() === 'A';
  const space = strategySpace ?? getStrategicQualityStrategies();
  if (!Array.isArray(space) || space.length === 0) {
    throw new RangeError('Strategy space must be a non-empty array of strategies.');
  }

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;
  const totalNodes = width * height;

  const distMatrix = buildFrontierTravelCostMatrix({
    width,
    height,
    mode,
    roadNetwork,
  });

  const cells = city.cells;
  const cellPops = new Float64Array(totalNodes);
  let totalPop = 0;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const idx = cell.y * width + cell.x;
    cellPops[idx] = cell.population;
    totalPop += cell.population;
  }

  const segments = rawSegments !== undefined
    ? validateConsumerSegments(rawSegments)
    : getDefaultConsumerSegments(config);

  const K = segments.length;
  const segShares = new Float64Array(K);
  const segBetas = new Float64Array(K);
  const segGammas = new Float64Array(K);
  const segAlphas = new Float64Array(K);

  for (let k = 0; k < K; k++) {
    segShares[k] = segments[k].populationShare;
    segBetas[k] = segments[k].beta;
    segGammas[k] = segments[k].gamma;
    segAlphas[k] = segments[k].alpha;
  }

  const costVar = isPlayerA ? (variableCostA ?? variableCost) : (variableCostB ?? variableCost);
  const costFix = isPlayerA ? (fixedCostA ?? fixedCost) : (fixedCostB ?? fixedCost);
  const costKappa = isPlayerA ? (kappaA ?? kappa) : (kappaB ?? kappa);

  const oppLocIdx = oppLoc.y * width + oppLoc.x;
  const oppPrice = opponentStrategy.price;
  const oppQuality = opponentStrategy.quality;
  const oppOffset = oppLocIdx * totalNodes;

  let bestPayoff = -Infinity;
  const bestResponses = [];
  const evaluatedStrategies = [];

  for (let s = 0; s < space.length; s++) {
    const candidate = space[s];
    const candLoc = candidate.location;
    const candPrice = candidate.price;
    const candQuality = candidate.quality;
    const candLocIdx = candLoc.y * width + candLoc.x;
    const candOffset = candLocIdx * totalNodes;

    const pA = isPlayerA ? candPrice : oppPrice;
    const pB = isPlayerA ? oppPrice : candPrice;
    const qA = isPlayerA ? candQuality : oppQuality;
    const qB = isPlayerA ? oppQuality : candQuality;
    const offsetA = isPlayerA ? candOffset : oppOffset;
    const offsetB = isPlayerA ? oppOffset : candOffset;

    let demandCand = 0;

    for (let c = 0; c < totalNodes; c++) {
      const pop = cellPops[c];
      if (pop <= 0) continue;

      const tcA = distMatrix[offsetA + c];
      const tcB = distMatrix[offsetB + c];

      if (tcA === Infinity && tcB === Infinity) {
        continue;
      } else if (tcA < Infinity && tcB === Infinity) {
        if (isPlayerA) demandCand += pop;
      } else if (tcA === Infinity && tcB < Infinity) {
        if (!isPlayerA) demandCand += pop;
      } else {
        const deltaT = tcA - tcB;
        const deltaP = pA - pB;
        const deltaQ = qA - qB;

        for (let k = 0; k < K; k++) {
          const segPop = pop * segShares[k];
          const diff = -segBetas[k] * deltaP + segGammas[k] * deltaQ - segAlphas[k] * deltaT;

          if (Math.abs(diff) <= tolerance) {
            demandCand += segPop * 0.5;
          } else if (diff > 0) {
            if (isPlayerA) demandCand += segPop;
          } else {
            if (!isPlayerA) demandCand += segPop;
          }
        }
      }
    }

    const investmentCost = calculateQualityInvestmentCost(candQuality, costKappa);
    const payoff = (candPrice - costVar) * demandCand - costFix - investmentCost;
    const marketShare = totalPop > 0 ? demandCand / totalPop : 0;

    evaluatedStrategies.push({
      strategy: candidate,
      payoff,
      demand: demandCand,
      marketShare,
    });

    if (payoff > bestPayoff + tolerance) {
      bestPayoff = payoff;
      bestResponses.length = 0;
      bestResponses.push(candidate);
    } else if (Math.abs(payoff - bestPayoff) <= tolerance) {
      bestResponses.push(candidate);
    }
  }

  return Object.freeze({
    player: isPlayerA ? 'A' : 'B',
    opponentStrategy: Object.freeze({
      location: Object.freeze({ x: oppLoc.x, y: oppLoc.y }),
      price: oppPrice,
      quality: oppQuality,
    }),
    bestPayoff,
    strategies: Object.freeze([...bestResponses]),
    bestResponses: Object.freeze([...bestResponses]),
    evaluatedStrategies: Object.freeze(evaluatedStrategies),
    travelCostMode: mode,
  });
}

/**
 * Checks whether a candidate strategic-quality profile (strategyA, strategyB)
 * constitutes a pure-strategy Nash equilibrium.
 *
 * @param {Object} options
 * @returns {Readonly<Object>}
 */
export function checkStrategicQualityPureNashEquilibrium(options = {}) {
  const {
    strategyA,
    strategyB,
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    city,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!strategyA || !strategyB) {
    throw new TypeError('checkStrategicQualityPureNashEquilibrium requires both strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getStrategicQualityStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const currentPayoffResult = calculateStrategicQualityPayoff({
    city,
    strategyA,
    strategyB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const currentPayoffA = currentPayoffResult.restaurantA.profit;
  const currentPayoffB = currentPayoffResult.restaurantB.profit;

  const brA = findStrategicQualityBestResponses({
    player: 'A',
    opponentStrategy: strategyB,
    strategySpace: spaceA,
    city,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const brB = findStrategicQualityBestResponses({
    player: 'B',
    opponentStrategy: strategyA,
    strategySpace: spaceB,
    city,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const hasProfitableDeviationA = brA.bestPayoff > currentPayoffA + tolerance;
  const hasProfitableDeviationB = brB.bestPayoff > currentPayoffB + tolerance;

  const isNash = !hasProfitableDeviationA && !hasProfitableDeviationB;

  return Object.freeze({
    isNash,
    strategyA: Object.freeze({
      location: Object.freeze({ x: strategyA.location.x, y: strategyA.location.y }),
      price: strategyA.price,
      quality: strategyA.quality,
    }),
    strategyB: Object.freeze({
      location: Object.freeze({ x: strategyB.location.x, y: strategyB.location.y }),
      price: strategyB.price,
      quality: strategyB.quality,
    }),
    payoffA: currentPayoffA,
    payoffB: currentPayoffB,
    demandA: currentPayoffResult.restaurantA.demand,
    demandB: currentPayoffResult.restaurantB.demand,
    playerA: Object.freeze({
      currentPayoff: currentPayoffA,
      bestPayoff: brA.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationA,
      bestResponses: brA.bestResponses,
    }),
    playerB: Object.freeze({
      currentPayoff: currentPayoffB,
      bestPayoff: brB.bestPayoff,
      hasProfitableDeviation: hasProfitableDeviationB,
      bestResponses: brB.bestResponses,
    }),
    travelCostMode: mode,
  });
}

/**
 * Searches the pure strategy space (default: 2500 x 2500 = 6,250,000 profiles)
 * for all pure-strategy Nash equilibria in the strategic-quality Frontier game.
 *
 * Employs precomputed travel-cost distance matrices, flattened typed arrays, and optimized nested loops for high performance.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object
 * @param {Array<Object>} [options.strategySpace] - Shared strategy space (default: 2,500)
 * @param {Array<Object>} [options.strategySpaceA] - Space for Player A
 * @param {Array<Object>} [options.strategySpaceB] - Space for Player B
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN]
 * @param {Object} [options.roadNetwork]
 * @param {Object} [options.config=DEFAULT_PARAMS]
 * @param {Array<Object>} [options.segments]
 * @param {number} [options.kappa=DEFAULT_QUALITY_COST_KAPPA]
 * @param {number} [options.kappaA]
 * @param {number} [options.kappaB]
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST]
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST]
 * @param {number} [options.variableCostA]
 * @param {number} [options.variableCostB]
 * @param {number} [options.fixedCostA]
 * @param {number} [options.fixedCostB]
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   equilibria: Array<Object>,
 *   count: number,
 *   evaluatedProfiles: number,
 *   hasPureEquilibrium: boolean,
 *   message: string,
 *   config: Object,
 *   travelCostMode: string
 * }>}
 */
export function findStrategicQualityPureNashEquilibria(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('findStrategicQualityPureNashEquilibria requires an options object.');
  }

  const {
    city,
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments: rawSegments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!city || typeof city !== 'object' || !Array.isArray(city.cells)) {
    throw new TypeError('findStrategicQualityPureNashEquilibria requires a valid Frontier city with cells.');
  }

  validateModeAndNetwork(mode, roadNetwork);

  const spaceA = strategySpaceA ?? strategySpace ?? getStrategicQualityStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const M = spaceA.length;
  const N = spaceB.length;
  const totalProfiles = M * N;

  const width = city.width ?? DEFAULT_GRID.width;
  const height = city.height ?? DEFAULT_GRID.height;
  const totalNodes = width * height;

  const distMatrix = buildFrontierTravelCostMatrix({
    width,
    height,
    mode,
    roadNetwork,
  });

  const cells = city.cells;
  const cellPops = new Float64Array(totalNodes);
  let totalPop = 0;
  for (let c = 0; c < cells.length; c++) {
    const cell = cells[c];
    const idx = cell.y * width + cell.x;
    cellPops[idx] = cell.population;
    totalPop += cell.population;
  }

  const segments = rawSegments !== undefined
    ? validateConsumerSegments(rawSegments)
    : getDefaultConsumerSegments(config);

  const K = segments.length;
  const isSingleSegment = K === 1;

  const segShares = new Float64Array(K);
  const segBetas = new Float64Array(K);
  const segGammas = new Float64Array(K);
  const segAlphas = new Float64Array(K);

  for (let k = 0; k < K; k++) {
    segShares[k] = segments[k].populationShare;
    segBetas[k] = segments[k].beta;
    segGammas[k] = segments[k].gamma;
    segAlphas[k] = segments[k].alpha;
  }

  const beta0 = segBetas[0];
  const gamma0 = segGammas[0];
  const alpha0 = segAlphas[0];

  const costA_var = variableCostA ?? variableCost;
  const costB_var = variableCostB ?? variableCost;
  const costA_fix = fixedCostA ?? fixedCost;
  const costB_fix = fixedCostB ?? fixedCost;
  const kA = kappaA ?? kappa;
  const kB = kappaB ?? kappa;

  // Pre-unpack strategy fields for fast inner loops
  const locIndexA = new Int32Array(M);
  const priceA = new Float64Array(M);
  const qualA = new Float64Array(M);
  const invA = new Float64Array(M);

  for (let i = 0; i < M; i++) {
    const s = spaceA[i];
    locIndexA[i] = s.location.y * width + s.location.x;
    priceA[i] = s.price;
    qualA[i] = s.quality;
    invA[i] = calculateQualityInvestmentCost(s.quality, kA);
  }

  const locIndexB = new Int32Array(N);
  const priceB = new Float64Array(N);
  const qualB = new Float64Array(N);
  const invB = new Float64Array(N);

  for (let j = 0; j < N; j++) {
    const s = spaceB[j];
    locIndexB[j] = s.location.y * width + s.location.x;
    priceB[j] = s.price;
    qualB[j] = s.quality;
    invB[j] = calculateQualityInvestmentCost(s.quality, kB);
  }

  const payoffsA = new Float64Array(totalProfiles);
  const payoffsB = new Float64Array(totalProfiles);
  const maxPayoffA = new Float64Array(N).fill(-Infinity);
  const maxPayoffB = new Float64Array(M).fill(-Infinity);

  // Profile evaluation loop
  for (let i = 0; i < M; i++) {
    const lA = locIndexA[i];
    const prA = priceA[i];
    const qA = qualA[i];
    const investA = invA[i];
    const offsetA = lA * totalNodes;
    const marginA = prA - costA_var;
    const rowOffset = i * N;

    for (let j = 0; j < N; j++) {
      const lB = locIndexB[j];
      const prB = priceB[j];
      const qB = qualB[j];
      const investB = invB[j];
      const offsetB = lB * totalNodes;
      const marginB = prB - costB_var;

      const deltaP = prA - prB;
      const deltaQ = qA - qB;

      let demA = 0;
      let demB = 0;

      if (isSingleSegment) {
        // Fast-path for single homogeneous consumer segment
        const baseDiff = -beta0 * deltaP + gamma0 * deltaQ;

        for (let c = 0; c < totalNodes; c++) {
          const pop = cellPops[c];
          if (pop <= 0) continue;

          const tcA = distMatrix[offsetA + c];
          const tcB = distMatrix[offsetB + c];

          if (tcA === Infinity && tcB === Infinity) {
            continue;
          } else if (tcA < Infinity && tcB === Infinity) {
            demA += pop;
          } else if (tcA === Infinity && tcB < Infinity) {
            demB += pop;
          } else {
            const diff = baseDiff - alpha0 * (tcA - tcB);
            if (Math.abs(diff) <= tolerance) {
              demA += pop * 0.5;
              demB += pop * 0.5;
            } else if (diff > 0) {
              demA += pop;
            } else {
              demB += pop;
            }
          }
        }
      } else {
        // Multi-segment heterogeneous consumer path
        for (let c = 0; c < totalNodes; c++) {
          const pop = cellPops[c];
          if (pop <= 0) continue;

          const tcA = distMatrix[offsetA + c];
          const tcB = distMatrix[offsetB + c];

          if (tcA === Infinity && tcB === Infinity) {
            continue;
          } else if (tcA < Infinity && tcB === Infinity) {
            demA += pop;
          } else if (tcA === Infinity && tcB < Infinity) {
            demB += pop;
          } else {
            const deltaT = tcA - tcB;
            for (let k = 0; k < K; k++) {
              const segPop = pop * segShares[k];
              const diff = -segBetas[k] * deltaP + segGammas[k] * deltaQ - segAlphas[k] * deltaT;

              if (Math.abs(diff) <= tolerance) {
                demA += segPop * 0.5;
                demB += segPop * 0.5;
              } else if (diff > 0) {
                demA += segPop;
              } else {
                demB += segPop;
              }
            }
          }
        }
      }

      const profA = marginA * demA - costA_fix - investA;
      const profB = marginB * demB - costB_fix - investB;

      const profileIdx = rowOffset + j;
      payoffsA[profileIdx] = profA;
      payoffsB[profileIdx] = profB;

      if (profA > maxPayoffA[j]) maxPayoffA[j] = profA;
      if (profB > maxPayoffB[i]) maxPayoffB[i] = profB;
    }
  }

  // Mutual best-response search
  const equilibria = [];

  for (let i = 0; i < M; i++) {
    const bestPayoffB = maxPayoffB[i];
    const rowOffset = i * N;

    for (let j = 0; j < N; j++) {
      const profileIdx = rowOffset + j;
      const profA = payoffsA[profileIdx];
      const bestPayoffA = maxPayoffA[j];

      if (profA >= bestPayoffA - tolerance) {
        const profB = payoffsB[profileIdx];
        if (profB >= bestPayoffB - tolerance) {
          const stratA = spaceA[i];
          const stratB = spaceB[j];

          // Compute exact demand for this equilibrium profile
          const lA = locIndexA[i];
          const lB = locIndexB[j];
          const offsetA = lA * totalNodes;
          const offsetB = lB * totalNodes;
          const deltaP = priceA[i] - priceB[j];
          const deltaQ = qualA[i] - qualB[j];

          let demA = 0;
          let demB = 0;

          for (let c = 0; c < totalNodes; c++) {
            const pop = cellPops[c];
            if (pop <= 0) continue;
            const tcA = distMatrix[offsetA + c];
            const tcB = distMatrix[offsetB + c];

            if (tcA === Infinity && tcB === Infinity) continue;
            if (tcA < Infinity && tcB === Infinity) { demA += pop; continue; }
            if (tcA === Infinity && tcB < Infinity) { demB += pop; continue; }

            const deltaT = tcA - tcB;
            for (let k = 0; k < K; k++) {
              const segPop = pop * segShares[k];
              const diff = -segBetas[k] * deltaP + segGammas[k] * deltaQ - segAlphas[k] * deltaT;
              if (Math.abs(diff) <= tolerance) {
                demA += segPop * 0.5;
                demB += segPop * 0.5;
              } else if (diff > 0) {
                demA += segPop;
              } else {
                demB += segPop;
              }
            }
          }

          equilibria.push(
            Object.freeze({
              restaurantA: Object.freeze({
                location: Object.freeze({ x: stratA.location.x, y: stratA.location.y }),
                price: stratA.price,
                quality: stratA.quality,
              }),
              restaurantB: Object.freeze({
                location: Object.freeze({ x: stratB.location.x, y: stratB.location.y }),
                price: stratB.price,
                quality: stratB.quality,
              }),
              strategyA: Object.freeze({
                location: Object.freeze({ x: stratA.location.x, y: stratA.location.y }),
                price: stratA.price,
                quality: stratA.quality,
              }),
              strategyB: Object.freeze({
                location: Object.freeze({ x: stratB.location.x, y: stratB.location.y }),
                price: stratB.price,
                quality: stratB.quality,
              }),
              payoffA: profA,
              payoffB: profB,
              demandA: demA,
              demandB: demB,
              marketShareA: totalPop > 0 ? demA / totalPop : 0,
              marketShareB: totalPop > 0 ? demB / totalPop : 0,
              qualityInvestmentCostA: invA[i],
              qualityInvestmentCostB: invB[j],
            })
          );
        }
      }
    }
  }

  const count = equilibria.length;
  const hasPureEquilibrium = count > 0;
  const message = hasPureEquilibrium
    ? `Found ${count} pure-strategy Nash equilibria in the strategic-quality space.`
    : 'No pure-strategy Nash equilibrium found in the specified discrete strategy space.';

  return Object.freeze({
    equilibria: Object.freeze(equilibria),
    count,
    evaluatedProfiles: totalProfiles,
    hasPureEquilibrium,
    message,
    config: Object.freeze({
      V: config?.V ?? DEFAULT_PARAMS.V,
      alpha: config?.alpha ?? DEFAULT_PARAMS.alpha,
      gamma: config?.gamma ?? DEFAULT_GAMMA,
      kappa,
    }),
    travelCostMode: mode,
  });
}

/**
 * Deep clones a strategic-quality strategy object defensively.
 *
 * @private
 */
function cloneStrategicStrategy(s) {
  return {
    location: { x: s.location.x, y: s.location.y },
    price: s.price,
    quality: s.quality,
  };
}

/**
 * Checks equality between two strategic-quality strategies.
 *
 * @param {Object} s1
 * @param {Object} s2
 * @returns {boolean}
 */
export function areStrategicQualityStrategiesEqual(s1, s2) {
  if (!s1 || !s2) return false;
  return (
    s1.location.x === s2.location.x &&
    s1.location.y === s2.location.y &&
    s1.price === s2.price &&
    s1.quality === s2.quality
  );
}

/**
 * Executes a single unilateral best-response step in strategic-quality dynamics with deterministic inertia:
 * If the current strategy is among the tied best responses (within tolerance), the player retains it;
 * otherwise, the player switches to the first strategy in the canonical ordering of best responses.
 *
 * @param {Object} options
 * @returns {Readonly<Object>}
 */
export function stepStrategicQualityBestResponseDynamics(options = {}) {
  const {
    city,
    strategyA,
    strategyB,
    actingPlayer = 'A',
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!strategyA || !strategyB) {
    throw new TypeError('stepStrategicQualityBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getStrategicQualityStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  const prevA = cloneStrategicStrategy(strategyA);
  const prevB = cloneStrategicStrategy(strategyB);

  const isPlayerA = actingPlayer.toUpperCase() === 'A';
  const player = isPlayerA ? 'A' : 'B';
  const nextActingPlayer = isPlayerA ? 'B' : 'A';

  let nextA;
  let nextB;
  let deviationOccurred = false;
  let brResult;

  if (isPlayerA) {
    brResult = findStrategicQualityBestResponses({
      player: 'A',
      opponentStrategy: prevB,
      strategySpace: spaceA,
      city,
      mode,
      roadNetwork,
      config,
      segments,
      kappa,
      kappaA,
      kappaB,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    const isCurrentInBR = brResult.bestResponses.some((s) =>
      areStrategicQualityStrategiesEqual(s, prevA)
    );

    if (isCurrentInBR) {
      nextA = prevA;
    } else {
      nextA = cloneStrategicStrategy(brResult.bestResponses[0]);
      deviationOccurred = true;
    }
    nextB = prevB;
  } else {
    brResult = findStrategicQualityBestResponses({
      player: 'B',
      opponentStrategy: prevA,
      strategySpace: spaceB,
      city,
      mode,
      roadNetwork,
      config,
      segments,
      kappa,
      kappaA,
      kappaB,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    const isCurrentInBR = brResult.bestResponses.some((s) =>
      areStrategicQualityStrategiesEqual(s, prevB)
    );

    if (isCurrentInBR) {
      nextB = prevB;
    } else {
      nextB = cloneStrategicStrategy(brResult.bestResponses[0]);
      deviationOccurred = true;
    }
    nextA = prevA;
  }

  const payoffResult = calculateStrategicQualityPayoff({
    city,
    strategyA: nextA,
    strategyB: nextB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const nashCheck = checkStrategicQualityPureNashEquilibrium({
    city,
    strategyA: nextA,
    strategyB: nextB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  return Object.freeze({
    actingPlayer: player,
    nextActingPlayer,
    strategyA: Object.freeze(nextA),
    strategyB: Object.freeze(nextB),
    previousStrategyA: Object.freeze(prevA),
    previousStrategyB: Object.freeze(prevB),
    deviationOccurred,
    isNash: nashCheck.isNash,
    payoffA: payoffResult.restaurantA.profit,
    payoffB: payoffResult.restaurantB.profit,
    demandA: payoffResult.restaurantA.demand,
    demandB: payoffResult.restaurantB.demand,
    marketShareA: payoffResult.restaurantA.marketShare,
    marketShareB: payoffResult.restaurantB.marketShare,
    tiedCount: brResult.bestResponses.length,
    bestResponses: brResult.bestResponses,
    stateKey: createStrategicQualityProfileKey(nextA, nextB),
    formattedState: formatStrategicQualityProfile(nextA, nextB),
    travelCostMode: mode,
  });
}

/**
 * Runs sequential best-response dynamics for the strategic-quality game until:
 * 1. Convergence to a pure-strategy Nash equilibrium.
 * 2. Detection of a cycle of repeated states.
 * 3. Max iterations reached.
 *
 * Trajectory states track quality explicitly: e.g. A(4,4,250,6)|B(4,4,200,4).
 *
 * @param {Object} options
 * @returns {Readonly<{
 *   status: 'converged' | 'cycle' | 'max-iterations',
 *   iterations: number,
 *   iterationCount: number,
 *   trajectory: Array<Object>,
 *   history: Array<Object>,
 *   finalProfile: { restaurantA: Object, restaurantB: Object, strategyA: Object, strategyB: Object },
 *   finalPayoffs: { payoffA: number, payoffB: number },
 *   converged: boolean,
 *   cycleDetected: boolean,
 *   cycleStart: number | null,
 *   cycleStartIndex: number | null,
 *   cycleLength: number | null,
 *   message: string,
 *   travelCostMode: string
 * }>}
 */
export function runStrategicQualityBestResponseDynamics(options = {}) {
  const {
    city,
    strategyA,
    strategyB,
    startingPlayer = 'A',
    maxIterations = 50,
    strategySpace,
    strategySpaceA,
    strategySpaceB,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments,
    kappa = DEFAULT_QUALITY_COST_KAPPA,
    kappaA,
    kappaB,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  if (!strategyA || !strategyB) {
    throw new TypeError('runStrategicQualityBestResponseDynamics requires valid strategyA and strategyB.');
  }

  const spaceA = strategySpaceA ?? strategySpace ?? getStrategicQualityStrategies();
  const spaceB = strategySpaceB ?? strategySpace ?? spaceA;

  let currentA = cloneStrategicStrategy(strategyA);
  let currentB = cloneStrategicStrategy(strategyB);
  let currentActor = startingPlayer.toUpperCase() === 'B' ? 'B' : 'A';

  const initialPayoff = calculateStrategicQualityPayoff({
    city,
    strategyA: currentA,
    strategyB: currentB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const initialNashCheck = checkStrategicQualityPureNashEquilibrium({
    city,
    strategyA: currentA,
    strategyB: currentB,
    strategySpaceA: spaceA,
    strategySpaceB: spaceB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const trajectory = [];
  const history = [];
  const seenStates = new Map();

  const initialStateKey = createStrategicQualityProfileKey(currentA, currentB);
  const initialFormatted = formatStrategicQualityProfile(currentA, currentB);

  const initialRecord = Object.freeze({
    iteration: 0,
    actingPlayer: null,
    strategyA: Object.freeze(cloneStrategicStrategy(currentA)),
    strategyB: Object.freeze(cloneStrategicStrategy(currentB)),
    payoffA: initialPayoff.restaurantA.profit,
    payoffB: initialPayoff.restaurantB.profit,
    demandA: initialPayoff.restaurantA.demand,
    demandB: initialPayoff.restaurantB.demand,
    marketShareA: initialPayoff.restaurantA.marketShare,
    marketShareB: initialPayoff.restaurantB.marketShare,
    deviationOccurred: false,
    isNash: initialNashCheck.isNash,
    stateKey: initialStateKey,
    formattedState: initialFormatted,
  });

  trajectory.push(initialRecord);
  history.push(initialRecord);
  seenStates.set(initialStateKey, 0);

  if (initialNashCheck.isNash) {
    return Object.freeze({
      status: 'converged',
      iterations: 0,
      iterationCount: 0,
      trajectory: Object.freeze(trajectory),
      history: Object.freeze(history),
      finalProfile: Object.freeze({
        restaurantA: initialPayoff.restaurantA,
        restaurantB: initialPayoff.restaurantB,
        strategyA: Object.freeze(cloneStrategicStrategy(currentA)),
        strategyB: Object.freeze(cloneStrategicStrategy(currentB)),
      }),
      finalPayoffs: Object.freeze({
        payoffA: initialPayoff.restaurantA.profit,
        payoffB: initialPayoff.restaurantB.profit,
      }),
      converged: true,
      cycleDetected: false,
      cycleStart: null,
      cycleStartIndex: null,
      cycleLength: null,
      message: 'Initial profile is already a pure-strategy Nash equilibrium.',
      travelCostMode: mode,
    });
  }

  let status = 'max-iterations';
  let cycleStart = null;
  let cycleLength = null;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    const stepResult = stepStrategicQualityBestResponseDynamics({
      city,
      strategyA: currentA,
      strategyB: currentB,
      actingPlayer: currentActor,
      strategySpaceA: spaceA,
      strategySpaceB: spaceB,
      mode,
      roadNetwork,
      config,
      segments,
      kappa,
      kappaA,
      kappaB,
      variableCost,
      fixedCost,
      variableCostA,
      variableCostB,
      fixedCostA,
      fixedCostB,
      tolerance,
    });

    currentA = cloneStrategicStrategy(stepResult.strategyA);
    currentB = cloneStrategicStrategy(stepResult.strategyB);
    currentActor = stepResult.nextActingPlayer;

    const record = Object.freeze({
      iteration,
      actingPlayer: stepResult.actingPlayer,
      strategyA: Object.freeze(cloneStrategicStrategy(currentA)),
      strategyB: Object.freeze(cloneStrategicStrategy(currentB)),
      payoffA: stepResult.payoffA,
      payoffB: stepResult.payoffB,
      demandA: stepResult.demandA,
      demandB: stepResult.demandB,
      marketShareA: stepResult.marketShareA,
      marketShareB: stepResult.marketShareB,
      deviationOccurred: stepResult.deviationOccurred,
      isNash: stepResult.isNash,
      stateKey: stepResult.stateKey,
      formattedState: stepResult.formattedState,
    });

    trajectory.push(record);
    history.push(record);

    if (stepResult.isNash) {
      status = 'converged';
      break;
    }

    if (seenStates.has(stepResult.stateKey)) {
      status = 'cycle';
      cycleStart = seenStates.get(stepResult.stateKey);
      cycleLength = iteration - cycleStart;
      break;
    }

    seenStates.set(stepResult.stateKey, iteration);
  }

  const finalA = currentA;
  const finalB = currentB;

  const finalPayoff = calculateStrategicQualityPayoff({
    city,
    strategyA: finalA,
    strategyB: finalB,
    mode,
    roadNetwork,
    config,
    segments,
    kappa,
    kappaA,
    kappaB,
    variableCost,
    fixedCost,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance,
  });

  const converged = status === 'converged';
  const cycleDetected = status === 'cycle';

  let message;
  if (converged) {
    message = `Dynamics converged to a pure-strategy Nash equilibrium at iteration ${iteration}.`;
  } else if (cycleDetected) {
    message = `Dynamics entered a cycle of period ${cycleLength} starting at iteration ${cycleStart}.`;
  } else {
    message = `Dynamics reached maximum allowed iterations (${maxIterations}) without convergence or cycle.`;
  }

  return Object.freeze({
    status,
    iterations: iteration,
    iterationCount: iteration,
    trajectory: Object.freeze(trajectory),
    history: Object.freeze(history),
    finalProfile: Object.freeze({
      restaurantA: finalPayoff.restaurantA,
      restaurantB: finalPayoff.restaurantB,
      strategyA: Object.freeze(cloneStrategicStrategy(finalA)),
      strategyB: Object.freeze(cloneStrategicStrategy(finalB)),
    }),
    finalPayoffs: Object.freeze({
      payoffA: finalPayoff.restaurantA.profit,
      payoffB: finalPayoff.restaurantB.profit,
    }),
    converged,
    cycleDetected,
    cycleStart,
    cycleStartIndex: cycleStart,
    cycleLength,
    message,
    travelCostMode: mode,
  });
}
