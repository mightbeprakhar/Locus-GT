/**
 * @file strategies.js
 * @description Frontier strategy space generation and validation for the LOCUS Game Theory Engine.
 *
 * A strategy is defined as a canonical pair:
 *   {
 *     location: { x, y },
 *     price
 *   }
 *
 * For a discrete 10x10 city grid and 5 discrete prices [150, 200, 250, 300, 350],
 * the strategy space contains exactly 100 * 5 = 500 pure strategies.
 */

import { DEFAULT_GRID, DEFAULT_ALLOWED_PRICES } from '../types.js';

/**
 * Validates whether a spatial coordinate pair is within valid grid dimensions.
 *
 * @param {{x: number, y: number}} location
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @returns {boolean}
 */
export function validateFrontierLocation(location, options = {}) {
  if (!location || typeof location !== 'object') {
    return false;
  }

  const { x, y } = location;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
    return false;
  }

  const width = options?.width ?? DEFAULT_GRID.width;
  const height = options?.height ?? DEFAULT_GRID.height;

  return x >= 0 && x < width && y >= 0 && y < height;
}

/**
 * Validates whether a price is an element of the allowed discrete price set.
 *
 * @param {number} price
 * @param {readonly number[]|number[]} [allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {boolean}
 */
export function validateFrontierPrice(price, allowedPrices = DEFAULT_ALLOWED_PRICES) {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return false;
  }
  const prices = allowedPrices ?? DEFAULT_ALLOWED_PRICES;
  return prices.includes(price);
}

/**
 * Validates whether an object is a valid canonical Frontier strategy.
 *
 * Canonical schema:
 * {
 *   location: { x: integer, y: integer },
 *   price: number
 * }
 *
 * Rejects legacy or conflicting top-level x / y coordinates.
 *
 * @param {Object} strategy
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @param {readonly number[]} [options.allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {boolean}
 */
export function validateFrontierStrategy(strategy, options = {}) {
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

  return (
    validateFrontierLocation(strategy.location, { width, height }) &&
    validateFrontierPrice(strategy.price, prices)
  );
}

/**
 * Creates an immutable, canonical Frontier strategy object.
 *
 * @param {{x: number, y: number}|{location: {x: number, y: number}, price: number}} locationOrStrategy
 * @param {number} [maybePrice]
 * @returns {Readonly<{ location: Readonly<{ x: number, y: number }>, price: number }>}
 */
export function createFrontierStrategy(locationOrStrategy, maybePrice) {
  let loc;
  let price;

  if (locationOrStrategy && typeof locationOrStrategy === 'object' && 'location' in locationOrStrategy) {
    loc = locationOrStrategy.location;
    price = maybePrice !== undefined ? maybePrice : locationOrStrategy.price;
  } else {
    loc = locationOrStrategy;
    price = maybePrice;
  }

  if (!validateFrontierLocation(loc)) {
    throw new TypeError('Invalid location for Frontier strategy: expected valid {x, y} integer coordinates within grid bounds.');
  }

  if (!validateFrontierPrice(price)) {
    throw new RangeError(
      `Invalid price ${price} for Frontier strategy. Allowed prices: ${DEFAULT_ALLOWED_PRICES.join(', ')}.`
    );
  }

  return Object.freeze({
    location: Object.freeze({ x: loc.x, y: loc.y }),
    price,
  });
}

/**
 * Generates the full discrete strategy space S for a single restaurant in Frontier.
 *
 * For a W x H grid and |P| discrete prices:
 *   |S| = W * H * |P|
 * By default: 10 * 10 * 5 = 500 strategies.
 *
 * Strategies are ordered deterministically:
 *   outer loop: y ascending (0 to H-1)
 *   middle loop: x ascending (0 to W-1)
 *   inner loop: price ascending
 *
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @param {readonly number[]} [options.allowedPrices=DEFAULT_ALLOWED_PRICES]
 * @returns {ReadonlyArray<Readonly<{ location: Readonly<{ x: number, y: number }>, price: number }>>}
 */
export function getFrontierStrategies(options = {}) {
  const width = options?.width ?? DEFAULT_GRID.width;
  const height = options?.height ?? DEFAULT_GRID.height;
  const prices = options?.allowedPrices ?? DEFAULT_ALLOWED_PRICES;

  const strategies = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let p = 0; p < prices.length; p++) {
        strategies.push(
          Object.freeze({
            location: Object.freeze({ x, y }),
            price: prices[p],
          })
        );
      }
    }
  }

  return Object.freeze(strategies);
}
