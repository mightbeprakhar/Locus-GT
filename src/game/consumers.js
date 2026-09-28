/**
 * @file consumers.js
 * @description Consumer choice logic, tie-breaking rules, and aggregate market demand calculations.
 */

import { calculateUtility } from './utility.js';
import { DEFAULT_PARAMS, FLOAT_EPSILON } from './types.js';

/**
 * Determines the choice of a customer zone between two competing restaurants.
 *
 * Decision Rule:
 * 1. Calculate U_A and U_B.
 * 2. If U_A > U_B: Zone chooses Restaurant A (shareA = 1, shareB = 0).
 * 3. If U_B > U_A: Zone chooses Restaurant B (shareA = 0, shareB = 1).
 * 4. If U_A === U_B (within float tolerance): Population splits 50/50 (shareA = 0.5, shareB = 0.5).
 *
 * @param {{x: number, y: number}} consumer - Customer zone coordinates
 * @param {{x: number, y: number, price: number}} restaurantA - Restaurant A state
 * @param {{x: number, y: number, price: number}} restaurantB - Restaurant B state
 * @param {{V?: number, alpha?: number}} [config=DEFAULT_PARAMS] - Economic parameters
 * @returns {{
 *   choice: 'A' | 'B' | 'TIE',
 *   shareA: number,
 *   shareB: number,
 *   utilityA: number,
 *   utilityB: number
 * }} Consumer choice outcome
 */
export function chooseRestaurant(consumer, restaurantA, restaurantB, config = DEFAULT_PARAMS) {
  const uA = calculateUtility(consumer, restaurantA, config);
  const uB = calculateUtility(consumer, restaurantB, config);

  const diff = uA - uB;

  if (Math.abs(diff) <= FLOAT_EPSILON) {
    return {
      choice: 'TIE',
      shareA: 0.5,
      shareB: 0.5,
      utilityA: uA,
      utilityB: uB,
    };
  }

  if (diff > 0) {
    return {
      choice: 'A',
      shareA: 1.0,
      shareB: 0.0,
      utilityA: uA,
      utilityB: uB,
    };
  }

  return {
    choice: 'B',
    shareA: 0.0,
    shareB: 1.0,
    utilityA: uA,
    utilityB: uB,
  };
}

/**
 * Calculates aggregate market demand for both restaurants over an entire city.
 *
 * Each customer zone allocates its population according to `chooseRestaurant`.
 * Sum of demand across all zones guarantees:
 * demandA + demandB === totalPopulation
 *
 * @param {Array<{x: number, y: number, population: number}>|{cells: Array<{x: number, y: number, population: number}>}} city
 * @param {{x: number, y: number, price: number}} restaurantA
 * @param {{x: number, y: number, price: number}} restaurantB
 * @param {{V?: number, alpha?: number}} [config=DEFAULT_PARAMS]
 * @returns {{
 *   demandA: number,
 *   demandB: number,
 *   totalPopulation: number,
 *   allocations: Array<{
 *     x: number,
 *     y: number,
 *     population: number,
 *     choice: 'A' | 'B' | 'TIE',
 *     demandA: number,
 *     demandB: number
 *   }>
 * }}
 */
export function calculateDemand(city, restaurantA, restaurantB, config = DEFAULT_PARAMS) {
  const cells = Array.isArray(city) ? city : (city?.cells ?? []);

  if (!cells || cells.length === 0) {
    throw new Error('Invalid city: must provide a non-empty array of cells or an object with cells array.');
  }

  let demandA = 0;
  let demandB = 0;
  let totalPopulation = 0;
  const allocations = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const pop = cell.population ?? 0;
    totalPopulation += pop;

    const outcome = chooseRestaurant(cell, restaurantA, restaurantB, config);
    const cellDemandA = pop * outcome.shareA;
    const cellDemandB = pop * outcome.shareB;

    demandA += cellDemandA;
    demandB += cellDemandB;

    allocations.push({
      x: cell.x,
      y: cell.y,
      population: pop,
      choice: outcome.choice,
      demandA: cellDemandA,
      demandB: cellDemandB,
    });
  }

  return {
    demandA,
    demandB,
    totalPopulation,
    allocations,
  };
}
