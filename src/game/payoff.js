/**
 * @file payoff.js
 * @description Profit and payoff calculations for competing restaurants.
 */

import { calculateDemand } from './consumers.js';
import { DEFAULT_PARAMS, DEFAULT_FIXED_COST } from './types.js';

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
 *   allocations: Array<Object>
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
