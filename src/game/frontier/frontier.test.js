/**
 * @file frontier.test.js
 * @description Unit and mathematical integration tests for LOCUS Frontier:
 * Urban Geography & Population (Phase 6A).
 */

import { describe, it, expect } from 'vitest';
import {
  createAnchor,
  validateAnchor,
  ANCHOR_TYPES,
  distanceDecay,
  calculateAnchorMultiplier,
  calculateEffectivePopulation,
  getPopulationTier,
  POPULATION_TIERS,
  createFrontierCity,
  getFrontierCityStats,
  SCENARIO_IDS,
  ZONE_TYPES,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 6A: Urban Geography & Population', () => {
  describe('Urban Anchors', () => {
    it('creates and validates valid mall and business-district anchors', () => {
      const mall = createAnchor({
        id: 'mall-1',
        type: ANCHOR_TYPES.MALL,
        location: { x: 7, y: 3 },
        strength: 2.5,
        name: 'Grand Galleria',
      });

      expect(mall.id).toBe('mall-1');
      expect(mall.type).toBe('mall');
      expect(mall.location).toEqual({ x: 7, y: 3 });
      expect(mall.strength).toBe(2.5);
      expect(mall.name).toBe('Grand Galleria');

      const cbd = createAnchor({
        id: 'cbd-1',
        type: ANCHOR_TYPES.BUSINESS_DISTRICT,
        location: { x: 4, y: 5 },
        strength: 3.0,
      });

      expect(cbd.id).toBe('cbd-1');
      expect(cbd.type).toBe('business-district');
      expect(cbd.strength).toBe(3.0);
    });

    it('throws error for invalid coordinates or negative strength', () => {
      expect(() =>
        validateAnchor({
          id: 'bad-1',
          type: 'mall',
          location: { x: -1, y: 5 },
          strength: 1,
        })
      ).toThrow(RangeError);

      expect(() =>
        validateAnchor({
          id: 'bad-2',
          type: 'mall',
          location: { x: 10, y: 5 },
          strength: 1,
        })
      ).toThrow(RangeError);

      expect(() =>
        validateAnchor({
          id: 'bad-3',
          type: 'mall',
          location: { x: 5, y: 5 },
          strength: -0.5,
        })
      ).toThrow(RangeError);

      expect(() =>
        validateAnchor({
          id: 'bad-4',
          type: 'invalid-type',
          location: { x: 5, y: 5 },
          strength: 1,
        })
      ).toThrow(TypeError);
    });
  });

  describe('Population Distance-Decay Model', () => {
    it('f(d) = 1 / (1 + d) is bounded in (0, 1] and strictly decreases with distance', () => {
      expect(distanceDecay(0)).toBe(1);
      expect(distanceDecay(1)).toBe(0.5);
      expect(distanceDecay(3)).toBe(0.25);
      expect(distanceDecay(9)).toBe(0.1);

      // Monotonic decay
      const d1 = 2;
      const d2 = 5;
      expect(distanceDecay(d1)).toBeGreaterThan(distanceDecay(d2));

      expect(() => distanceDecay(-1)).toThrow(RangeError);
    });

    it('anchor influence decreases monotonically with Euclidean distance', () => {
      const anchor = createAnchor({
        id: 'cbd',
        type: ANCHOR_TYPES.BUSINESS_DISTRICT,
        location: { x: 4, y: 5 },
        strength: 2.0,
      });

      const epicenter = { x: 4, y: 5 }; // d = 0
      const near = { x: 5, y: 5 }; // d = 1
      const far = { x: 9, y: 9 }; // d ~ 6.4

      const multEpicenter = calculateAnchorMultiplier(epicenter, [anchor]);
      const multNear = calculateAnchorMultiplier(near, [anchor]);
      const multFar = calculateAnchorMultiplier(far, [anchor]);

      // At epicenter, decay = 1, influence = 2 * 1 = 2, multiplier = 3
      expect(multEpicenter.multiplier).toBe(3);
      expect(multEpicenter.anchorInfluence).toBe(2);

      // At d = 1, decay = 0.5, influence = 2 * 0.5 = 1, multiplier = 2
      expect(multNear.multiplier).toBe(2);
      expect(multNear.anchorInfluence).toBe(1);

      expect(multEpicenter.multiplier).toBeGreaterThan(multNear.multiplier);
      expect(multNear.multiplier).toBeGreaterThan(multFar.multiplier);
    });

    it('computes effective population with deterministic rounding', () => {
      const anchor = createAnchor({
        id: 'mall',
        type: ANCHOR_TYPES.MALL,
        location: { x: 0, y: 0 },
        strength: 1.5,
      });

      // Cell at (0, 0), base pop 100
      // multiplier = 1 + 1.5 * 1 = 2.5 -> effective = 250
      const resAtOrigin = calculateEffectivePopulation(100, { x: 0, y: 0 }, [anchor]);
      expect(resAtOrigin.population).toBe(250);
      expect(resAtOrigin.rawPopulation).toBe(250);

      // Cell at (3, 4), dist = 5, decay = 1/6 ~ 0.166667
      // multiplier = 1 + 1.5/6 = 1.25 -> effective = 125
      const resAtDist5 = calculateEffectivePopulation(100, { x: 3, y: 4 }, [anchor]);
      expect(resAtDist5.population).toBe(125);
    });

    it('classifies density tiers accurately across absolute population thresholds', () => {
      // Low: < 150
      expect(getPopulationTier(0)).toBe(POPULATION_TIERS.LOW);
      expect(getPopulationTier(100)).toBe(POPULATION_TIERS.LOW);
      expect(getPopulationTier(149)).toBe(POPULATION_TIERS.LOW);

      // Medium: 150 - 249
      expect(getPopulationTier(150)).toBe(POPULATION_TIERS.MEDIUM);
      expect(getPopulationTier(200)).toBe(POPULATION_TIERS.MEDIUM);
      expect(getPopulationTier(249)).toBe(POPULATION_TIERS.MEDIUM);

      // High: 250 - 379
      expect(getPopulationTier(250)).toBe(POPULATION_TIERS.HIGH);
      expect(getPopulationTier(300)).toBe(POPULATION_TIERS.HIGH);
      expect(getPopulationTier(379)).toBe(POPULATION_TIERS.HIGH);

      // Very High: >= 380
      expect(getPopulationTier(380)).toBe(POPULATION_TIERS.VERY_HIGH);
      expect(getPopulationTier(450)).toBe(POPULATION_TIERS.VERY_HIGH);

      // Optional dynamic range capability is preserved for future modes
      const customRange = { min: 100, max: 200 };
      expect(getPopulationTier(110, customRange)).toBe(POPULATION_TIERS.LOW); // ratio 0.1 < 0.25
      expect(getPopulationTier(140, customRange)).toBe(POPULATION_TIERS.MEDIUM); // ratio 0.4 in [0.25, 0.55)
      expect(getPopulationTier(170, customRange)).toBe(POPULATION_TIERS.HIGH); // ratio 0.7 in [0.55, 0.82)
      expect(getPopulationTier(195, customRange)).toBe(POPULATION_TIERS.VERY_HIGH); // ratio 0.95 >= 0.82
    });
  });

  describe('Frontier City Generation & Scenarios', () => {
    it('produces a valid 10x10 grid with 100 unique zones and non-negative populations', () => {
      const city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });

      expect(city.width).toBe(10);
      expect(city.height).toBe(10);
      expect(city.cells).toHaveLength(100);

      const seenCoords = new Set();
      for (const cell of city.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(10);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeLessThan(10);

        const key = `${cell.x},${cell.y}`;
        expect(seenCoords.has(key)).toBe(false);
        seenCoords.add(key);

        expect(cell.basePopulation).toBeGreaterThan(0);
        expect(cell.population).toBeGreaterThanOrEqual(cell.basePopulation);
        expect(Object.values(ZONE_TYPES)).toContain(cell.zoneType);
      }
      expect(seenCoords.size).toBe(100);
    });

    it('generates strictly deterministic output for the same scenario', () => {
      const city1 = createFrontierCity({ scenario: SCENARIO_IDS.URBAN_CORE });
      const city2 = createFrontierCity({ scenario: SCENARIO_IDS.URBAN_CORE });

      expect(city1.cells).toEqual(city2.cells);
      expect(city1.stats).toEqual(city2.stats);
      expect(city1.anchors).toEqual(city2.anchors);
    });

    it('generates distinctly different population distributions across scenarios', () => {
      const balanced = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
      const urbanCore = createFrontierCity({ scenario: SCENARIO_IDS.URBAN_CORE });
      const retailHub = createFrontierCity({ scenario: SCENARIO_IDS.RETAIL_HUB });
      const polycentric = createFrontierCity({ scenario: SCENARIO_IDS.POLYCENTRIC });

      // Peak populations and locations differ
      expect(urbanCore.stats.peakDensityZone).not.toEqual(balanced.stats.peakDensityZone);
      expect(retailHub.stats.peakDensityZone).not.toEqual(urbanCore.stats.peakDensityZone);
      expect(polycentric.stats.anchorCount).toBe(2);

      // Total population differs across scenario forms
      const pops = [
        balanced.stats.totalPopulation,
        urbanCore.stats.totalPopulation,
        retailHub.stats.totalPopulation,
        polycentric.stats.totalPopulation,
      ];
      const uniquePops = new Set(pops);
      expect(uniquePops.size).toBeGreaterThan(1);
    });

    it('places urban anchors in expected coordinates and with appropriate types', () => {
      const urbanCore = createFrontierCity({ scenario: SCENARIO_IDS.URBAN_CORE });
      expect(urbanCore.anchors).toHaveLength(1);
      expect(urbanCore.anchors[0].type).toBe(ANCHOR_TYPES.BUSINESS_DISTRICT);
      expect(urbanCore.anchors[0].location).toEqual({ x: 4, y: 5 });

      const retailHub = createFrontierCity({ scenario: SCENARIO_IDS.RETAIL_HUB });
      expect(retailHub.anchors).toHaveLength(1);
      expect(retailHub.anchors[0].type).toBe(ANCHOR_TYPES.MALL);
      expect(retailHub.anchors[0].location).toEqual({ x: 7, y: 3 });

      const polycentric = createFrontierCity({ scenario: SCENARIO_IDS.POLYCENTRIC });
      expect(polycentric.anchors).toHaveLength(2);
      expect(polycentric.anchors[0].location).toEqual({ x: 2, y: 2 });
      expect(polycentric.anchors[1].location).toEqual({ x: 7, y: 7 });
    });

    it('Urban Core has greater concentration near its anchor than Balanced City', () => {
      const urbanCore = createFrontierCity({ scenario: SCENARIO_IDS.URBAN_CORE });
      const balanced = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });

      const coreZone = urbanCore.cells.find((c) => c.x === 4 && c.y === 5);
      const balancedSameZone = balanced.cells.find((c) => c.x === 4 && c.y === 5);

      expect(coreZone).toBeDefined();
      expect(balancedSameZone).toBeDefined();

      // Urban Core peak density at CBD epicenter should be significantly higher
      expect(coreZone.population).toBeGreaterThan(balancedSameZone.population * 2);
      expect(urbanCore.stats.peakDensityZone.x).toBe(4);
      expect(urbanCore.stats.peakDensityZone.y).toBe(5);
    });

    it('Polycentric City produces multiple meaningful population centers', () => {
      const polycentric = createFrontierCity({ scenario: SCENARIO_IDS.POLYCENTRIC });

      const centerNorth = polycentric.cells.find((c) => c.x === 2 && c.y === 2);
      const centerSouth = polycentric.cells.find((c) => c.x === 7 && c.y === 7);
      const intermediateZone = polycentric.cells.find((c) => c.x === 4 && c.y === 4);

      expect(centerNorth.population).toBeGreaterThan(intermediateZone.population);
      expect(centerSouth.population).toBeGreaterThan(intermediateZone.population);

      // Both centers are substantial local peaks
      expect(centerNorth.population).toBeGreaterThan(250);
      expect(centerSouth.population).toBeGreaterThan(250);
    });

    it('computes accurate city statistics (populated zones, average pop, total)', () => {
      const city = createFrontierCity({ scenario: SCENARIO_IDS.RETAIL_HUB });
      const stats = getFrontierCityStats(city);

      expect(stats.populatedZonesCount).toBe(100);
      expect(stats.anchorCount).toBe(1);
      expect(stats.totalPopulation).toBeGreaterThan(10000);
      expect(stats.averagePopulation).toBeCloseTo(stats.totalPopulation / 100, 1);
      expect(stats.peakDensityZone.population).toBe(stats.maxPopulation);
    });
  });
});
