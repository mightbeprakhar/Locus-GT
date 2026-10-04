/**
 * @file payoff.js
 * @description Frontier payoff and profit calculation engine for LOCUS Game Theory Engine.
 *
 * Implements the economic payoff function for restaurants operating on a Frontier city:
 *   pi_j = (P_j - C_j) * D_j - F_j
 *
 * where:
 *   P_j = restaurant price
 *   C_j = constant marginal / variable cost per customer served (default: 100)
 *   D_j = aggregate customer demand determined by the Frontier consumer-choice engine
 *   F_j = fixed operational cost (default: 0)
 *
 * The Frontier consumer-choice engine (calculateFrontierMarket) remains the sole authority for demand.
 */

import { DEFAULT_PARAMS, DEFAULT_VARIABLE_COST, DEFAULT_FIXED_COST, FLOAT_EPSILON } from '../types.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { calculateFrontierMarket } from './consumerChoice.js';

/**
 * Calculates net economic profit for a restaurant given its price, cost structure, and demand.
 *
 *   pi_j = (P_j - C_j) * D_j - F_j
 *
 * Note: Negative profits are mathematically valid and are NOT clamped to zero.
 *
 * @param {{ price: number, variableCost?: number, fixedCost?: number }} restaurant
 * @param {number} demand - Demand served by the restaurant
 * @param {number} [fixedCostOverride] - Explicit fixed cost override
 * @param {number} [variableCostOverride] - Explicit variable cost override
 * @returns {number} Economic profit
 */
export function calculateFrontierProfit(restaurant, demand, fixedCostOverride, variableCostOverride) {
  if (!restaurant || typeof restaurant !== 'object') {
    throw new TypeError('calculateFrontierProfit requires a valid restaurant object.');
  }

  const price = restaurant.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('Restaurant must have a finite numeric price.');
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

  if (typeof demand !== 'number' || !Number.isFinite(demand)) {
    throw new TypeError('Demand must be a finite number.');
  }

  return (price - variableCost) * demand - fixedCost;
}

/**
 * Normalizes input restaurant / strategy definitions into canonical restaurant objects with IDs.
 *
 * @param {Object} options
 * @returns {{ rA: Object, rB: Object }}
 */
function normalizeFrontierRestaurants(options) {
  let rA, rB;

  if (options.restaurants !== undefined) {
    if (!Array.isArray(options.restaurants) || options.restaurants.length !== 2) {
      throw new RangeError('Frontier payoff engine requires exactly two restaurants.');
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

  // Ensure canonical { id, location, price, quality } shape
  const normA = {
    id: rA.id ?? 'A',
    location: rA.location ?? (rA.x !== undefined && rA.y !== undefined ? { x: rA.x, y: rA.y } : undefined),
    price: rA.price,
    quality: rA.quality,
    variableCost: rA.variableCost,
    fixedCost: rA.fixedCost,
  };

  const normB = {
    id: rB.id ?? 'B',
    location: rB.location ?? (rB.x !== undefined && rB.y !== undefined ? { x: rB.x, y: rB.y } : undefined),
    price: rB.price,
    quality: rB.quality,
    variableCost: rB.variableCost,
    fixedCost: rB.fixedCost,
  };

  return { rA: normA, rB: normB };
}

/**
 * Computes Frontier payoff and market outcomes for two competing restaurants.
 *
 * Invokes calculateFrontierMarket to determine demand and market share,
 * then evaluates economic profit for both players.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city model with cells array
 * @param {Object} [options.restaurantA] - First restaurant
 * @param {Object} [options.restaurantB] - Second restaurant
 * @param {Object} [options.strategyA] - Alternative strategy input for player A
 * @param {Object} [options.strategyB] - Alternative strategy input for player B
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Road network model (required when mode is 'road')
 * @param {{ V?: number, alpha?: number }} [options.config=DEFAULT_PARAMS] - Economic parameters
 * @param {number} [options.variableCost=DEFAULT_VARIABLE_COST] - Default marginal cost (100)
 * @param {number} [options.fixedCost=DEFAULT_FIXED_COST] - Default fixed cost (0)
 * @param {number} [options.variableCostA] - Specific marginal cost for restaurant A
 * @param {number} [options.variableCostB] - Specific marginal cost for restaurant B
 * @param {number} [options.fixedCostA] - Specific fixed cost for restaurant A
 * @param {number} [options.fixedCostB] - Specific fixed cost for restaurant B
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantA: { id: string, demand: number, marketShare: number, profit: number },
 *   restaurantB: { id: string, demand: number, marketShare: number, profit: number },
 *   totalPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   travelCostMode: string
 * }>}
 */
export function calculateFrontierPayoff(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateFrontierPayoff requires an options object.');
  }

  const {
    city,
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    roadNetwork,
    config = DEFAULT_PARAMS,
    segments,
    variableCost = DEFAULT_VARIABLE_COST,
    fixedCost = DEFAULT_FIXED_COST,
    variableCostA,
    variableCostB,
    fixedCostA,
    fixedCostB,
    tolerance = FLOAT_EPSILON,
  } = options;

  const { rA, rB } = normalizeFrontierRestaurants(options);

  // Compute market demand via Frontier consumer choice engine
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

  const profitA = calculateFrontierProfit(rA, demandA, costA_fix, costA_var);
  const profitB = calculateFrontierProfit(rB, demandB, costB_fix, costB_var);

  const marketShareA = market.marketShares[idA] ?? 0;
  const marketShareB = market.marketShares[idB] ?? 0;

  return Object.freeze({
    restaurantA: Object.freeze({
      id: idA,
      demand: demandA,
      marketShare: marketShareA,
      profit: profitA,
      quality: market.restaurants[0].quality,
    }),
    restaurantB: Object.freeze({
      id: idB,
      demand: demandB,
      marketShare: marketShareB,
      profit: profitB,
      quality: market.restaurants[1].quality,
    }),
    totalPopulation: market.totalPopulation,
    reachablePopulation: market.reachablePopulation,
    unreachablePopulation: market.unreachablePopulation,
    travelCostMode: market.travelCostMode,
  });
}

/**
 * Evaluates payoff for a pure strategy profile (strategyA, strategyB).
 * Alias that emphasizes game-theoretic strategy profile evaluation.
 *
 * @param {Object} options
 * @returns {ReturnType<typeof calculateFrontierPayoff>}
 */
export function calculateFrontierProfilePayoffs(options = {}) {
  return calculateFrontierPayoff(options);
}
