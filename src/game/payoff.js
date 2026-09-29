/**
 * @file payoff.js
 * @description Profit and payoff calculations for competing restaurants.
 */

import { calculateDemand } from './consumers.js';
import { DEFAULT_PARAMS, DEFAULT_FIXED_COST, DEFAULT_VARIABLE_COST } from './types.js';

/**
 * Calculates the net economic profit for a restaurant given its demand.
 *
 * Equation:
 * pi_j = (P_j - C_j) * D_j - F_j
 *
 * where:
 * - P_j: restaurant price
 * - C_j: constant variable cost per customer served
 * - D_j: aggregate customer demand
 * - F_j: fixed cost (e.g. rent/overheads, defaults to 0 in Phase 1)
 *
 * IMPORTANT:
 * Negative profits are mathematically valid and must NOT be clamped to zero.
 *
 * @param {{price: number, variableCost: number, fixedCost?: number}} restaurant
 * @param {number} demand - Number of customers served
 * @param {number} [fixedCost] - Optional explicit fixed cost override
 * @returns {number} Economic profit
 */
export function calculateProfit(restaurant, demand, fixedCost) {
  if (!restaurant || typeof restaurant.price !== 'number' || typeof restaurant.variableCost !== 'number') {
    throw new TypeError('Invalid restaurant: must contain numeric price and variableCost.');
  }
  if (typeof demand !== 'number') {
    throw new TypeError('Invalid demand: must be a number.');
  }

  const effectiveFixedCost = fixedCost ?? restaurant.fixedCost ?? DEFAULT_FIXED_COST;
  return (restaurant.price - restaurant.variableCost) * demand - effectiveFixedCost;
}

/**
 * Computes full game outcomes (demands and payoffs) for both restaurants on a city grid.
 *
 * @param {Array<{x: number, y: number, population: number}>|{cells: Array<{x: number, y: number, population: number}>}} city
 * @param {{x: number, y: number, price: number, variableCost: number, fixedCost?: number}} restaurantA
 * @param {{x: number, y: number, price: number, variableCost: number, fixedCost?: number}} restaurantB
 * @param {{V?: number, alpha?: number}} [config=DEFAULT_PARAMS]
 * @returns {{
 *   demandA: number,
 *   demandB: number,
 *   profitA: number,
 *   profitB: number,
 *   totalPopulation: number,
 *   allocations?: Array<Object>
 * }}
 */
export function calculatePayoffs(city, restaurantA, restaurantB, config = DEFAULT_PARAMS) {
  const demandResult = calculateDemand(city, restaurantA, restaurantB, config);

  const profitA = calculateProfit(restaurantA, demandResult.demandA);
  const profitB = calculateProfit(restaurantB, demandResult.demandB);

  return {
    demandA: demandResult.demandA,
    demandB: demandResult.demandB,
    profitA,
    profitB,
    totalPopulation: demandResult.totalPopulation,
    allocations: demandResult.allocations,
  };
}

/**
 * Evaluates a strategy profile (strategyA, strategyB) on a city grid.
 * Decouples the strategic choices { location, price } from operational restaurant state.
 *
 * @param {Object} params
 * @param {Array<Object>|{cells: Array<Object>}} params.city - Customer zone grid
 * @param {{location: {x: number, y: number}, price: number}} params.strategyA - Player A strategic choice
 * @param {{location: {x: number, y: number}, price: number}} params.strategyB - Player B strategic choice
 * @param {{V?: number, alpha?: number}} [params.config=DEFAULT_PARAMS] - Economic parameters (V, alpha)
 * @param {number} [params.variableCost=DEFAULT_VARIABLE_COST] - Marginal cost per customer served
 * @param {number} [params.fixedCost=DEFAULT_FIXED_COST] - Fixed cost
 * @param {number} [params.variableCostA] - Specific marginal cost for A
 * @param {number} [params.variableCostB] - Specific marginal cost for B
 * @param {number} [params.fixedCostA] - Specific fixed cost for A
 * @param {number} [params.fixedCostB] - Specific fixed cost for B
 * @param {boolean} [params.includeAllocations=false] - Whether to return per-cell allocation details
 * @returns {{
 *   demandA: number,
 *   demandB: number,
 *   profitA: number,
 *   profitB: number,
 *   marketShareA: number,
 *   marketShareB: number,
 *   totalPopulation: number,
 *   strategyA: {location: {x: number, y: number}, price: number},
 *   strategyB: {location: {x: number, y: number}, price: number},
 *   allocations?: Array<Object>
 * }}
 */
export function evaluateProfile(params, ...rest) {
  let city, strategyA, strategyB, config, varCostA, varCostB, fixCostA, fixCostB, includeAllocations;

  if (params && typeof params === 'object' && ('strategyA' in params || 'strategyB' in params)) {
    city = params.city;
    strategyA = params.strategyA;
    strategyB = params.strategyB;
    config = params.config ?? DEFAULT_PARAMS;
    const commonVarCost = params.variableCost ?? DEFAULT_VARIABLE_COST;
    const commonFixCost = params.fixedCost ?? DEFAULT_FIXED_COST;
    varCostA = params.variableCostA ?? commonVarCost;
    varCostB = params.variableCostB ?? commonVarCost;
    fixCostA = params.fixedCostA ?? commonFixCost;
    fixCostB = params.fixedCostB ?? commonFixCost;
    includeAllocations = params.includeAllocations ?? false;
  } else {
    city = params;
    strategyA = rest[0];
    strategyB = rest[1];
    config = rest[2] ?? DEFAULT_PARAMS;
    const options = rest[3] ?? {};
    const commonVarCost = options.variableCost ?? DEFAULT_VARIABLE_COST;
    const commonFixCost = options.fixedCost ?? DEFAULT_FIXED_COST;
    varCostA = options.variableCostA ?? commonVarCost;
    varCostB = options.variableCostB ?? commonVarCost;
    fixCostA = options.fixedCostA ?? commonFixCost;
    fixCostB = options.fixedCostB ?? commonFixCost;
    includeAllocations = options.includeAllocations ?? false;
  }

  if (!strategyA || !strategyB) {
    throw new TypeError('evaluateProfile requires both strategyA and strategyB.');
  }

  const demandResult = calculateDemand(city, strategyA, strategyB, config, { includeAllocations });
  const totalPop = demandResult.totalPopulation;

  const profitA = calculateProfit({ price: strategyA.price, variableCost: varCostA, fixedCost: fixCostA }, demandResult.demandA);
  const profitB = calculateProfit({ price: strategyB.price, variableCost: varCostB, fixedCost: fixCostB }, demandResult.demandB);

  const marketShareA = totalPop > 0 ? demandResult.demandA / totalPop : 0;
  const marketShareB = totalPop > 0 ? demandResult.demandB / totalPop : 0;

  const result = {
    demandA: demandResult.demandA,
    demandB: demandResult.demandB,
    profitA,
    profitB,
    marketShareA,
    marketShareB,
    totalPopulation: totalPop,
    strategyA,
    strategyB,
  };

  if (includeAllocations && demandResult.allocations) {
    result.allocations = demandResult.allocations;
  }

  return result;
}

