/**
 * @file travelCost.js
 * @description Frontier travel-cost abstraction layer (Phase 6B.4).
 *
 * Mathematical Definition:
 *   T(i, j) =
 *     Euclidean distance, when mode = "euclidean"
 *     Road shortest-path distance, when mode = "road"
 *
 * Consumer Utility Context:
 * In downstream Frontier economic modeling, consumer utility will evaluate:
 *   U_ij = V - P_j - alpha * T(i, j)
 * where:
 * - V: Consumer reservation price
 * - P_j: Restaurant j price
 * - alpha: Travel sensitivity factor
 * - T(i, j): Travel-cost distance between consumer zone i and restaurant location j.
 *
 * Note: Consumer utility calculations and payoff integrations are deferred to
 * subsequent phases; this module strictly isolates and abstracts the spatial
 * travel-cost function T(i, j).
 */

import { DEFAULT_GRID } from '../types.js';
import { parseNodeId, isValidCoordinate } from './roadNetwork.js';
import { getRoadDistance } from './shortestPath.js';

/**
 * Supported travel-cost distance calculation modes.
 */
export const TRAVEL_COST_MODES = Object.freeze({
  EUCLIDEAN: 'euclidean',
  ROAD: 'road',
});

/**
 * Normalizes and validates a spatial point input for travel cost calculations.
 * Supports { x, y } objects, { location: { x, y } } structures, and "x,y" string IDs.
 *
 * @param {Object|string} pt - Point coordinate representation
 * @param {string} paramName - Name of the parameter for error reporting ('from' or 'to')
 * @param {number} [width=DEFAULT_GRID.width] - Grid width bound
 * @param {number} [height=DEFAULT_GRID.height] - Grid height bound
 * @returns {{ x: number, y: number }}
 */
export function normalizeTravelPoint(
  pt,
  paramName = 'point',
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height
) {
  if (pt === null || pt === undefined) {
    throw new TypeError(`Invalid ${paramName} point: must not be null or undefined.`);
  }

  let x, y;
  if (typeof pt === 'string') {
    const parsed = parseNodeId(pt);
    x = parsed.x;
    y = parsed.y;
  } else if (typeof pt === 'object') {
    const loc = pt.location ?? pt;
    if (typeof loc !== 'object' || loc === null) {
      throw new TypeError(`Invalid ${paramName} point: expected {x, y} coordinate object.`);
    }
    x = loc.x;
    y = loc.y;
  } else {
    throw new TypeError(`Invalid ${paramName} point: expected {x, y} object or "x,y" string.`);
  }

  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isInteger(x) ||
    !Number.isInteger(y)
  ) {
    throw new TypeError(`Invalid ${paramName} coordinates: {x, y} must be integers.`);
  }

  if (!isValidCoordinate(x, y, width, height)) {
    throw new RangeError(
      `Point ${paramName} (${x}, ${y}) is outside grid dimensions (${width}x${height}).`
    );
  }

  return { x, y };
}

/**
 * Computes Euclidean spatial travel cost between two points.
 *
 * T_euclidean(from, to) = sqrt((x2 - x1)^2 + (y2 - y1)^2)
 *
 * @param {Object|string} from - Origin location {x, y}, {location: {x, y}}, or "x,y"
 * @param {Object|string} to - Destination location {x, y}, {location: {x, y}}, or "x,y"
 * @param {Object} [options]
 * @param {number} [options.width=DEFAULT_GRID.width]
 * @param {number} [options.height=DEFAULT_GRID.height]
 * @returns {number} Euclidean distance (>= 0)
 */
export function getEuclideanTravelCost(from, to, options = {}) {
  const width = options?.width ?? DEFAULT_GRID.width;
  const height = options?.height ?? DEFAULT_GRID.height;

  const pFrom = normalizeTravelPoint(from, 'from', width, height);
  const pTo = normalizeTravelPoint(to, 'to', width, height);

  if (pFrom.x === pTo.x && pFrom.y === pTo.y) {
    return 0;
  }

  const dx = pTo.x - pFrom.x;
  const dy = pTo.y - pFrom.y;
  return Math.hypot(dx, dy);
}

/**
 * Computes road-network shortest-path travel cost between two points.
 * Delegates to the deterministic Dijkstra shortest-path engine.
 *
 * @param {Object} network - Validated road network graph
 * @param {Object|string} from - Origin location {x, y}, {location: {x, y}}, or "x,y"
 * @param {Object|string} to - Destination location {x, y}, {location: {x, y}}, or "x,y"
 * @returns {number} Minimum travel distance along road network, or Infinity if unreachable
 */
export function getRoadTravelCost(network, from, to) {
  if (!network || typeof network !== 'object' || !network.adjacency) {
    throw new TypeError('getRoadTravelCost requires a valid road network object.');
  }

  const width = network.width ?? DEFAULT_GRID.width;
  const height = network.height ?? DEFAULT_GRID.height;

  const pFrom = normalizeTravelPoint(from, 'from', width, height);
  const pTo = normalizeTravelPoint(to, 'to', width, height);

  return getRoadDistance(network, pFrom, pTo);
}

/**
 * Unified Frontier travel-cost dispatch function.
 * Evaluates T(from, to) based on requested travel mode ('euclidean' or 'road').
 *
 * @param {Object} options
 * @param {'euclidean'|'road'} [options.mode=TRAVEL_COST_MODES.EUCLIDEAN] - Calculation mode
 * @param {Object|string} options.from - Origin point
 * @param {Object|string} options.to - Destination point
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @returns {number} Computed travel cost T(from, to)
 */
export function getTravelCost(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('getTravelCost requires an options object.');
  }

  const {
    mode = TRAVEL_COST_MODES.EUCLIDEAN,
    from,
    to,
    roadNetwork,
  } = options;

  if (typeof mode !== 'string') {
    throw new TypeError(
      `Travel cost mode must be a string identifier, received ${typeof mode}.`
    );
  }

  if (mode !== TRAVEL_COST_MODES.EUCLIDEAN && mode !== TRAVEL_COST_MODES.ROAD) {
    const allowed = Object.values(TRAVEL_COST_MODES).join(', ');
    throw new RangeError(
      `Invalid travel cost mode "${mode}". Allowed modes: ${allowed}.`
    );
  }

  if (mode === TRAVEL_COST_MODES.EUCLIDEAN) {
    return getEuclideanTravelCost(from, to, {
      width: roadNetwork?.width,
      height: roadNetwork?.height,
    });
  }

  if (mode === TRAVEL_COST_MODES.ROAD) {
    if (!roadNetwork || typeof roadNetwork !== 'object') {
      throw new TypeError(
        'Road travel cost mode requires a valid roadNetwork object.'
      );
    }
    return getRoadTravelCost(roadNetwork, from, to);
  }
}
