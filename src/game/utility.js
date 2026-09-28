/**
 * @file utility.js
 * @description Mathematical functions for spatial distance and consumer utility calculations.
 */

import { DEFAULT_PARAMS } from './types.js';

/**
 * Computes the Euclidean distance between two points in 2D space.
 * Accepts points as {x, y}, objects with .location {x, y}, or four numbers (x1, y1, x2, y2).
 *
 * distance(i, j) = sqrt((x_i - x_j)^2 + (y_i - y_j)^2)
 *
 * @param {Object|number} p1 - First point {x, y}, {location: {x, y}}, or x1 coordinate
 * @param {Object|number} p2 - Second point {x, y}, {location: {x, y}}, or y1 coordinate
 * @param {number} [x2] - x2 coordinate if called with 4 numbers
 * @param {number} [y2] - y2 coordinate if called with 4 numbers
 * @returns {number} The Euclidean distance
 */
export function distance(p1, p2, x2, y2) {
  let xA, yA, xB, yB;

  if (typeof p1 === 'object' && p1 !== null && typeof p2 === 'object' && p2 !== null) {
    const loc1 = p1.location ?? p1;
    const loc2 = p2.location ?? p2;
    xA = loc1.x;
    yA = loc1.y;
    xB = loc2.x;
    yB = loc2.y;
  } else if (
    typeof p1 === 'number' &&
    typeof p2 === 'number' &&
    typeof x2 === 'number' &&
    typeof y2 === 'number'
  ) {
    xA = p1;
    yA = p2;
    xB = x2;
    yB = y2;
  } else {
    throw new TypeError(
      'Invalid arguments to distance(): provide two {x, y} point objects or four numbers (x1, y1, x2, y2).'
    );
  }

  const dx = xA - xB;
  const dy = yA - yB;
  return Math.hypot(dx, dy);
}

/**
 * Calculates the consumer utility U_ij of a customer zone for a given restaurant.
 *
 * Equation:
 * U_ij = V - P_j - (alpha * T_ij)
 *
 * where:
 * - V: baseline consumer reservation value
 * - P_j: restaurant price
 * - T_ij: Euclidean travel distance between customer zone i and restaurant j
 * - alpha: travel sensitivity parameter
 *
 * @param {{x: number, y: number}|{location: {x: number, y: number}}} consumer - Customer zone coordinates
 * @param {{x: number, y: number, price: number}|{location: {x: number, y: number}, price: number}} restaurant - Restaurant coordinates and price
 * @param {{V?: number, alpha?: number}} [config=DEFAULT_PARAMS] - Economic parameters (V, alpha)
 * @returns {number} Computed utility U_ij
 */
export function calculateUtility(consumer, restaurant, config = DEFAULT_PARAMS) {
  const consumerLoc = consumer?.location ?? consumer;
  const restaurantLoc = restaurant?.location ?? restaurant;

  if (!consumerLoc || typeof consumerLoc.x !== 'number' || typeof consumerLoc.y !== 'number') {
    throw new TypeError('Invalid consumer: must contain numeric coordinates.');
  }
  if (
    !restaurant ||
    typeof restaurantLoc.x !== 'number' ||
    typeof restaurantLoc.y !== 'number' ||
    typeof restaurant.price !== 'number'
  ) {
    throw new TypeError('Invalid restaurant: must contain numeric coordinates and price.');
  }

  const V = config.V ?? DEFAULT_PARAMS.V;
  const alpha = config.alpha ?? DEFAULT_PARAMS.alpha;

  const travelDistance = distance(consumerLoc, restaurantLoc);
  return V - restaurant.price - (alpha * travelDistance);
}
