/**
 * @file anchors.js
 * @description Urban anchors model for LOCUS Frontier.
 * Defines urban generators (e.g. shopping malls, business districts)
 * that attract footfall and amplify effective population densities.
 */

import { DEFAULT_GRID } from '../types.js';

/**
 * Valid anchor types in Frontier.
 */
export const ANCHOR_TYPES = Object.freeze({
  MALL: 'mall',
  BUSINESS_DISTRICT: 'business-district',
});

/**
 * Validates an anchor object.
 *
 * @param {Object} anchor
 * @param {Object} [gridConfig]
 * @throws {TypeError|RangeError} if anchor is invalid
 */
export function validateAnchor(anchor, gridConfig = DEFAULT_GRID) {
  if (!anchor || typeof anchor !== 'object') {
    throw new TypeError('Anchor must be an object.');
  }

  const { id, type, location, strength } = anchor;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new TypeError('Anchor id must be a non-empty string.');
  }

  const validTypes = Object.values(ANCHOR_TYPES);
  if (!validTypes.includes(type)) {
    throw new TypeError(`Invalid anchor type "${type}". Allowed: ${validTypes.join(', ')}`);
  }

  if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') {
    throw new TypeError('Anchor location must contain numeric {x, y} coordinates.');
  }

  const width = gridConfig?.width ?? DEFAULT_GRID.width;
  const height = gridConfig?.height ?? DEFAULT_GRID.height;

  if (location.x < 0 || location.x >= width || location.y < 0 || location.y >= height) {
    throw new RangeError(
      `Anchor coordinates (${location.x}, ${location.y}) are outside the grid dimensions (${width}x${height}).`
    );
  }

  if (typeof strength !== 'number' || strength < 0 || !Number.isFinite(strength)) {
    throw new RangeError('Anchor strength must be a non-negative finite number.');
  }
}

/**
 * Creates an urban anchor.
 *
 * @param {Object} params
 * @param {string} params.id - Unique anchor identifier
 * @param {'mall'|'business-district'} params.type - Categorical anchor classification
 * @param {{x: number, y: number}} params.location - Coordinate location on grid
 * @param {number} params.strength - Relative multiplier strength (lambda_a >= 0)
 * @param {string} [params.name] - Human-readable name
 * @param {string} [params.description] - Descriptive notes
 * @returns {Readonly<{
 *   id: string,
 *   type: 'mall'|'business-district',
 *   location: {x: number, y: number},
 *   strength: number,
 *   name: string,
 *   description: string
 * }>}
 */
export function createAnchor({
  id,
  type,
  location,
  strength,
  name,
  description = '',
}) {
  const anchor = {
    id,
    type,
    location: { x: location.x, y: location.y },
    strength,
    name: name ?? (type === ANCHOR_TYPES.MALL ? 'Commercial Mall' : 'Business Center'),
    description,
  };

  validateAnchor(anchor);

  return Object.freeze({
    ...anchor,
    location: Object.freeze({ ...anchor.location }),
  });
}
