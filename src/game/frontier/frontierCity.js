/**
 * @file frontierCity.js
 * @description Frontier urban geography city generator and scenario presets.
 * Produces deterministic 10x10 spatial grids with heterogeneous zoning,
 * urban anchors, and distance-decay amplified population densities.
 */

import { DEFAULT_GRID } from '../types.js';
import { ANCHOR_TYPES, createAnchor } from './anchors.js';
import { calculateEffectivePopulation } from './population.js';

/**
 * Valid customer zone classifications in Frontier.
 */
export const ZONE_TYPES = Object.freeze({
  RESIDENTIAL: 'residential',
  COMMERCIAL: 'commercial',
  RETAIL: 'retail',
});

/**
 * Scenario identifiers supported in Phase 6A.
 */
export const SCENARIO_IDS = Object.freeze({
  BALANCED: 'balanced',
  URBAN_CORE: 'urban-core',
  RETAIL_HUB: 'retail-hub',
  POLYCENTRIC: 'polycentric',
});

/**
 * Scenario metadata specifications.
 */
export const FRONTIER_SCENARIOS = Object.freeze({
  [SCENARIO_IDS.BALANCED]: Object.freeze({
    id: SCENARIO_IDS.BALANCED,
    name: 'Balanced City',
    tagline: 'Distributed spatial density without dominant urban attractors.',
    description:
      'A uniform urban grid where residential neighborhoods and neighborhood retail are evenly dispersed. Serves as the control baseline for spatial variance.',
    anchorCount: 0,
  }),
  [SCENARIO_IDS.URBAN_CORE]: Object.freeze({
    id: SCENARIO_IDS.URBAN_CORE,
    name: 'Urban Core',
    tagline: 'High-density monocentric core with a central Financial District.',
    description:
      'A monocentric metropolis featuring a central Business District at (4, 5). Strong commercial zoning and commercial footfall amplify core density.',
    anchorCount: 1,
  }),
  [SCENARIO_IDS.RETAIL_HUB]: Object.freeze({
    id: SCENARIO_IDS.RETAIL_HUB,
    name: 'Retail Hub',
    tagline: 'Commercial shopping hub driven by an East-Side Mega Mall.',
    description:
      'A commercial destination dominated by an expansive regional shopping mall at (7, 3), drawing consumer traffic from peripheral residential zones.',
    anchorCount: 1,
  }),
  [SCENARIO_IDS.POLYCENTRIC]: Object.freeze({
    id: SCENARIO_IDS.POLYCENTRIC,
    name: 'Polycentric City',
    tagline: 'Twin metropolitan poles with dual business and retail clusters.',
    description:
      'A multi-polar city featuring a North Tech District at (2, 2) and a South Commercial Mall at (7, 7), creating competing spatial density peaks.',
    anchorCount: 2,
  }),
});

/**
 * Deterministic scenario configuration definitions.
 */
function getScenarioConfig(scenarioId) {
  switch (scenarioId) {
    case SCENARIO_IDS.URBAN_CORE: {
      const anchors = [
        createAnchor({
          id: 'cbd-central',
          type: ANCHOR_TYPES.BUSINESS_DISTRICT,
          location: { x: 4, y: 5 },
          strength: 2.8,
          name: 'Central Business District',
          description: 'High-rise corporate towers and financial services epicenter.',
        }),
      ];

      return {
        anchors,
        getBasePopulation: (x, y) => {
          // Centered gentle base hill
          const distToCenter = Math.hypot(x - 4.5, y - 4.5);
          return Math.round(110 + 40 * Math.max(0, 1 - distToCenter / 6.5));
        },
        getZoneType: (x, y) => {
          const distToCBD = Math.hypot(x - 4, y - 5);
          if (distToCBD <= 1.5) return ZONE_TYPES.COMMERCIAL;
          if (distToCBD <= 2.8) return ZONE_TYPES.RETAIL;
          return ZONE_TYPES.RESIDENTIAL;
        },
      };
    }

    case SCENARIO_IDS.RETAIL_HUB: {
      const anchors = [
        createAnchor({
          id: 'mall-east',
          type: ANCHOR_TYPES.MALL,
          location: { x: 7, y: 3 },
          strength: 3.2,
          name: 'Metro Grand Mall',
          description: 'Regional destination retail center with dining and entertainment.',
        }),
      ];

      return {
        anchors,
        getBasePopulation: (x) => {
          // Moderate baseline with slight eastern tilt
          return Math.round(100 + 20 * (x / 9));
        },
        getZoneType: (x, y) => {
          const distToMall = Math.hypot(x - 7, y - 3);
          if (distToMall <= 1.5) return ZONE_TYPES.RETAIL;
          if (distToMall <= 3.2 && y <= 5) return ZONE_TYPES.COMMERCIAL;
          return ZONE_TYPES.RESIDENTIAL;
        },
      };
    }

    case SCENARIO_IDS.POLYCENTRIC: {
      const anchors = [
        createAnchor({
          id: 'tech-north',
          type: ANCHOR_TYPES.BUSINESS_DISTRICT,
          location: { x: 2, y: 2 },
          strength: 2.4,
          name: 'North Innovation District',
          description: 'Technology campus and professional office park.',
        }),
        createAnchor({
          id: 'mall-south',
          type: ANCHOR_TYPES.MALL,
          location: { x: 7, y: 7 },
          strength: 2.4,
          name: 'South Bay Retail Complex',
          description: 'High-volume commercial plaza and shopping hub.',
        }),
      ];

      return {
        anchors,
        getBasePopulation: () => 100,
        getZoneType: (x, y) => {
          const distNorth = Math.hypot(x - 2, y - 2);
          const distSouth = Math.hypot(x - 7, y - 7);
          if (distNorth <= 1.5) return ZONE_TYPES.COMMERCIAL;
          if (distSouth <= 1.5) return ZONE_TYPES.RETAIL;
          if (distNorth <= 2.5) return ZONE_TYPES.COMMERCIAL;
          if (distSouth <= 2.5) return ZONE_TYPES.RETAIL;
          return ZONE_TYPES.RESIDENTIAL;
        },
      };
    }

    case SCENARIO_IDS.BALANCED:
    default: {
      return {
        anchors: [],
        getBasePopulation: (x, y) => {
          // Slight deterministic variation based on coordinate mod to avoid total monotony
          return 100 + ((x + y * 3) % 25);
        },
        getZoneType: (x, y) => {
          // Deterministic mixed zoning grid
          if ((x === 4 || x === 5) && (y === 4 || y === 5)) {
            return ZONE_TYPES.COMMERCIAL;
          }
          if ((x + y) % 5 === 0) {
            return ZONE_TYPES.RETAIL;
          }
          return ZONE_TYPES.RESIDENTIAL;
        },
      };
    }
  }
}

/**
 * Computes summary analytical statistics for a Frontier city.
 *
 * @param {Object} city
 * @returns {{
 *   totalPopulation: number,
 *   totalBasePopulation: number,
 *   populatedZonesCount: number,
 *   anchorCount: number,
 *   peakDensityZone: { x: number, y: number, population: number, zoneType: string },
 *   lowestDensityZone: { x: number, y: number, population: number, zoneType: string },
 *   averagePopulation: number,
 *   minPopulation: number,
 *   maxPopulation: number
 * }}
 */
export function getFrontierCityStats(city) {
  const cells = city?.cells ?? [];
  let totalPop = 0;
  let totalBasePop = 0;
  let populatedCount = 0;

  let peakZone = cells[0] ?? { x: 0, y: 0, population: 0, zoneType: ZONE_TYPES.RESIDENTIAL };
  let lowestZone = cells[0] ?? { x: 0, y: 0, population: 0, zoneType: ZONE_TYPES.RESIDENTIAL };

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    totalPop += cell.population;
    totalBasePop += cell.basePopulation;
    if (cell.population > 0) populatedCount++;

    if (cell.population > peakZone.population) {
      peakZone = cell;
    }
    if (cell.population < lowestZone.population) {
      lowestZone = cell;
    }
  }

  const averagePopulation = cells.length > 0 ? Math.round((totalPop / cells.length) * 10) / 10 : 0;

  return {
    totalPopulation: totalPop,
    totalBasePopulation: totalBasePop,
    populatedZonesCount: populatedCount,
    anchorCount: city?.anchors?.length ?? 0,
    peakDensityZone: {
      x: peakZone.x,
      y: peakZone.y,
      population: peakZone.population,
      zoneType: peakZone.zoneType,
    },
    lowestDensityZone: {
      x: lowestZone.x,
      y: lowestZone.y,
      population: lowestZone.population,
      zoneType: lowestZone.zoneType,
    },
    averagePopulation,
    minPopulation: lowestZone.population,
    maxPopulation: peakZone.population,
  };
}

/**
 * Creates a Frontier City environment for a specified scenario.
 *
 * @param {Object} [options]
 * @param {'balanced'|'urban-core'|'retail-hub'|'polycentric'} [options.scenario='balanced']
 * @param {number} [options.width=10]
 * @param {number} [options.height=10]
 * @returns {Readonly<{
 *   width: number,
 *   height: number,
 *   scenario: string,
 *   scenarioName: string,
 *   scenarioDescription: string,
 *   anchors: Array<Object>,
 *   cells: Array<{
 *     x: number,
 *     y: number,
 *     basePopulation: number,
 *     population: number,
 *     zoneType: 'residential'|'commercial'|'retail',
 *     anchorInfluence: number
 *   }>,
 *   stats: Object
 * }>}
 */
export function createFrontierCity({
  scenario = SCENARIO_IDS.BALANCED,
  width = DEFAULT_GRID.width,
  height = DEFAULT_GRID.height,
} = {}) {
  const scenarioMeta = FRONTIER_SCENARIOS[scenario] ?? FRONTIER_SCENARIOS[SCENARIO_IDS.BALANCED];
  const { anchors, getBasePopulation, getZoneType } = getScenarioConfig(scenarioMeta.id);

  const cells = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const basePopulation = getBasePopulation(x, y);
      const zoneType = getZoneType(x, y);

      const { population, anchorInfluence } = calculateEffectivePopulation(
        basePopulation,
        { x, y },
        anchors
      );

      cells.push({
        x,
        y,
        basePopulation,
        population,
        zoneType,
        anchorInfluence,
      });
    }
  }

  const rawCity = {
    width,
    height,
    scenario: scenarioMeta.id,
    scenarioName: scenarioMeta.name,
    scenarioDescription: scenarioMeta.description,
    anchors,
    cells,
  };

  const stats = getFrontierCityStats(rawCity);

  return Object.freeze({
    ...rawCity,
    stats,
  });
}
