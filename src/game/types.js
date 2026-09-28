/**
 * @file types.js
 * @description Central configuration, constants, and type definitions for LOCUS Game Theory Engine.
 */

/**
 * Default discrete grid dimensions (10 x 10).
 */
export const DEFAULT_GRID = Object.freeze({
  width: 10,
  height: 10,
});

/**
 * Standard allowed discrete prices for restaurants.
 */
export const DEFAULT_ALLOWED_PRICES = Object.freeze([150, 200, 250, 300, 350]);

/**
 * Default economic and consumer behavior parameters.
 * V: Baseline consumer valuation / reservation price.
 * alpha: Travel sensitivity factor (disutility per unit of Euclidean distance).
 */
export const DEFAULT_PARAMS = Object.freeze({
  V: 500,
  alpha: 10,
});

/**
 * Default variable cost per unit.
 */
export const DEFAULT_VARIABLE_COST = 100;

/**
 * Default fixed cost (rent/overheads), defaults to 0 for Phase 1.
 */
export const DEFAULT_FIXED_COST = 0;

/**
 * Numerical tolerance for floating-point comparisons (e.g. utility tie-breaking).
 */
export const FLOAT_EPSILON = 1e-9;
