/**
 * @file strategies.js
 * @description Strategy definition, validation, and strategy space generation.
 */

import { DEFAULT_GRID, DEFAULT_ALLOWED_PRICES } from './types.js';

/**
 * Validates whether a given location is within the defined city grid bounds.
 * Coordinates must be non-negative integers within [0, width) and [0, height).
 *
 * @param {{x: number, y: number}} location
 * @param {{width: number, height: number}} [gridConfig=DEFAULT_GRID]
 * @returns {boolean} True if location is valid
 */
export function validateLocation(location, gridConfig = DEFAULT_GRID) {
  if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') {
    return false;
  }

  const { x, y } = location;
  const width = gridConfig?.width ?? DEFAULT_GRID.width;
  const height = gridConfig?.height ?? DEFAULT_GRID.height;

  // Must be integers
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }

  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Validates whether a price is an element of the allowed discrete price set.
 *
 * @param {number} price
 * @param {readonly number[]|number[]} [allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {boolean} True if price is permissible
 */
export function validatePrice(price, allowedPrices = DEFAULT_ALLOWED_PRICES) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return false;
  }

  const prices = allowedPrices ?? DEFAULT_ALLOWED_PRICES;
  return prices.includes(price);
}

/**
 * Validates whether an object is a valid canonical strategy.
 *
 * Canonical representation:
 * {
 *   location: { x, y },
 *   price
 * }
 *
 * Duplicate or legacy top-level x/y representations (e.g. { x, y, price } or
 * { x, y, location: { x, y }, price }) are explicitly rejected.
 *
 * @param {{location: {x: number, y: number}, price: number}} strategy
 * @param {{width: number, height: number}} [gridConfig=DEFAULT_GRID]
 * @param {readonly number[]|number[]} [allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {boolean} True if the strategy is canonically valid
 */
export function validateStrategy(
  strategy,
  gridConfig = DEFAULT_GRID,
  allowedPrices = DEFAULT_ALLOWED_PRICES
) {
  if (!strategy || typeof strategy !== 'object') {
    return false;
  }

  // Reject duplicate, conflicting, or legacy top-level x / y coordinates
  if ('x' in strategy || 'y' in strategy) {
    return false;
  }

  // Must have a valid location object
  if (!strategy.location || typeof strategy.location !== 'object') {
    return false;
  }

  return (
    validateLocation(strategy.location, gridConfig) &&
    validatePrice(strategy.price, allowedPrices)
  );
}

/**
 * Generates the full discrete strategy space S for a single restaurant using the
 * canonical strategy representation: { location: { x, y }, price }.
 *
 * For a grid of dimensions (W x H) and a price set of size P:
 * |S| = W * H * P
 *
 * @param {{width: number, height: number}} [gridConfig=DEFAULT_GRID]
 * @param {readonly number[]|number[]} [allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {Array<{location: {x: number, y: number}, price: number}>}
 */
export function generateStrategySpace(
  gridConfig = DEFAULT_GRID,
  allowedPrices = DEFAULT_ALLOWED_PRICES
) {
  const width = gridConfig?.width ?? DEFAULT_GRID.width;
  const height = gridConfig?.height ?? DEFAULT_GRID.height;
  const prices = allowedPrices ?? DEFAULT_ALLOWED_PRICES;

  const strategies = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let p = 0; p < prices.length; p++) {
        const price = prices[p];
        strategies.push({
          location: { x, y },
          price,
        });
      }
    }
  }

  return strategies;
}
