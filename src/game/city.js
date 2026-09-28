/**
 * @file city.js
 * @description City grid representations, customer zone definitions, and deterministic city generation.
 */

import { DEFAULT_GRID } from './types.js';

/**
 * Creates an individual customer zone cell.
 *
 * @param {number} x - Horizontal grid coordinate (0 <= x < width)
 * @param {number} y - Vertical grid coordinate (0 <= y < height)
 * @param {number} population - Number of consumers living in this zone
 * @returns {{x: number, y: number, population: number}}
 */
export function createCell(x, y, population) {
  if (typeof x !== 'number' || typeof y !== 'number' || typeof population !== 'number') {
    throw new TypeError('Cell coordinates and population must be numbers.');
  }
  if (population < 0) {
    throw new RangeError('Population cannot be negative.');
  }
  return { x, y, population };
}

/**
 * Calculates the total aggregate population of a city.
 *
 * @param {Array<{population: number}>|{cells: Array<{population: number}>}} city
 * @returns {number}
 */
export function getTotalPopulation(city) {
  const cells = Array.isArray(city) ? city : (city?.cells ?? []);
  return cells.reduce((sum, cell) => sum + (cell.population ?? 0), 0);
}

/**
 * Creates a city grid of specified dimensions with customer zones.
 *
 * @param {number} [width=DEFAULT_GRID.width] - Number of columns
 * @param {number} [height=DEFAULT_GRID.height] - Number of rows
 * @param {number|((x: number, y: number) => number)} [populationSource=100] - Constant population or deterministic generator function
 * @returns {{
 *   width: number,
 *   height: number,
 *   cells: Array<{x: number, y: number, population: number}>,
 *   totalPopulation: number
 * }}
 */
export function createCity(
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  populationSource = 100
) {
  const cells = [];
  const getPop =
    typeof populationSource === 'function'
      ? populationSource
      : () => populationSource;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pop = getPop(x, y);
      cells.push(createCell(x, y, pop));
    }
  }

  return {
    width,
    height,
    cells,
    totalPopulation: getTotalPopulation(cells),
  };
}

/**
 * Creates a deterministic 10x10 example city with non-uniform population density.
 *
 * Density Model:
 * Higher density near the city center (x=4.5, y=4.5), tapering toward the periphery.
 * Formula:
 * dist = sqrt((x - 4.5)^2 + (y - 4.5)^2)
 * maxDist = sqrt(4.5^2 + 4.5^2) ~= 6.364
 * pop(x, y) = 100 + round(100 * (1 - dist / maxDist))
 * Center zones: ~200 pop, Corner zones: ~100 pop.
 *
 * Completely deterministic without random numbers.
 *
 * @returns {{
 *   width: number,
 *   height: number,
 *   cells: Array<{x: number, y: number, population: number}>,
 *   totalPopulation: number
 * }}
 */
export function createDefaultCity() {
  const width = DEFAULT_GRID.width;
  const height = DEFAULT_GRID.height;
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const maxDist = Math.hypot(centerX, centerY);

  return createCity(width, height, (x, y) => {
    const dist = Math.hypot(x - centerX, y - centerY);
    const bonus = Math.round(100 * (1 - dist / maxDist));
    return 100 + bonus;
  });
}

/**
 * Creates a uniform city grid where every cell has identical population.
 * Useful for symmetric baseline benchmarks and theoretical tests.
 *
 * @param {number} [width=DEFAULT_GRID.width]
 * @param {number} [height=DEFAULT_GRID.height]
 * @param {number} [populationPerCell=100]
 * @returns {{
 *   width: number,
 *   height: number,
 *   cells: Array<{x: number, y: number, population: number}>,
 *   totalPopulation: number
 * }}
 */
export function createUniformCity(
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
  populationPerCell = 100
) {
  return createCity(width, height, populationPerCell);
}
