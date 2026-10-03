/**
 * @file travelCost.test.js
 * @description Unit and mathematical validation tests for LOCUS Frontier:
 * Travel-Cost Abstraction Layer (Phase 6B.4).
 */

import { describe, it, expect } from 'vitest';
import {
  TRAVEL_COST_MODES,
  getEuclideanTravelCost,
  getRoadTravelCost,
  getTravelCost,
  normalizeTravelPoint,
  createRoadNetwork,
  ROAD_SCENARIO_IDS,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 6B.4: Travel-Cost Abstraction', () => {
  const gridNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
  const arterialNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.ARTERIAL });

  describe('TRAVEL_COST_MODES Constants', () => {
    it('defines frozen travel cost modes', () => {
      expect(TRAVEL_COST_MODES).toEqual({
        EUCLIDEAN: 'euclidean',
        ROAD: 'road',
      });
      expect(Object.isFrozen(TRAVEL_COST_MODES)).toBe(true);
    });
  });

  describe('Point Normalization & Validation', () => {
    it('accepts valid {x, y} coordinate objects', () => {
      expect(normalizeTravelPoint({ x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
    });

    it('accepts valid {location: {x, y}} structures', () => {
      expect(normalizeTravelPoint({ location: { x: 3, y: 4 } })).toEqual({ x: 3, y: 4 });
    });

    it('accepts valid "x,y" canonical string node IDs', () => {
      expect(normalizeTravelPoint('3,4')).toEqual({ x: 3, y: 4 });
    });

    it('throws TypeError for null, undefined, or non-object/non-string inputs', () => {
      expect(() => normalizeTravelPoint(null, 'from')).toThrow(TypeError);
      expect(() => normalizeTravelPoint(undefined, 'to')).toThrow(TypeError);
      expect(() => normalizeTravelPoint(123, 'from')).toThrow(TypeError);
      expect(() => normalizeTravelPoint(true, 'to')).toThrow(TypeError);
    });

    it('throws TypeError for non-integer or non-numeric coordinates', () => {
      expect(() => normalizeTravelPoint({ x: '3', y: 4 }, 'from')).toThrow(TypeError);
      expect(() => normalizeTravelPoint({ x: 3, y: 4.5 }, 'to')).toThrow(TypeError);
      expect(() => normalizeTravelPoint({ x: NaN, y: 4 }, 'from')).toThrow(TypeError);
      expect(() => normalizeTravelPoint({ x: 3, y: Infinity }, 'to')).toThrow(TypeError);
    });

    it('throws RangeError for coordinates outside grid bounds', () => {
      expect(() => normalizeTravelPoint({ x: -1, y: 5 }, 'from')).toThrow(RangeError);
      expect(() => normalizeTravelPoint({ x: 5, y: -1 }, 'to')).toThrow(RangeError);
      expect(() => normalizeTravelPoint({ x: 10, y: 5 }, 'from')).toThrow(RangeError);
      expect(() => normalizeTravelPoint({ x: 5, y: 10 }, 'to')).toThrow(RangeError);
    });
  });

  describe('Euclidean Travel Cost', () => {
    it('computes same-point distance as exactly 0', () => {
      expect(getEuclideanTravelCost({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
      expect(getEuclideanTravelCost({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
      expect(getEuclideanTravelCost({ x: 9, y: 9 }, { x: 9, y: 9 })).toBe(0);

      expect(
        getTravelCost({
          mode: TRAVEL_COST_MODES.EUCLIDEAN,
          from: { x: 4, y: 4 },
          to: { x: 4, y: 4 },
        })
      ).toBe(0);
    });

    it('computes known Euclidean distances accurately (e.g. (0,0) -> (3,4) = 5)', () => {
      // 3-4-5 right triangle from origin
      const dist1 = getEuclideanTravelCost({ x: 0, y: 0 }, { x: 3, y: 4 });
      expect(dist1).toBe(5);

      // 3-4-5 translated
      const dist2 = getEuclideanTravelCost({ x: 2, y: 1 }, { x: 5, y: 5 });
      expect(dist2).toBe(5);

      // Horizontal collinear segment
      const distH = getEuclideanTravelCost({ x: 1, y: 3 }, { x: 7, y: 3 });
      expect(distH).toBe(6);

      // Vertical collinear segment
      const distV = getEuclideanTravelCost({ x: 4, y: 2 }, { x: 4, y: 9 });
      expect(distV).toBe(7);

      // Corner-to-corner diagonal (sqrt(9^2 + 9^2) = sqrt(162) = 9*sqrt(2))
      const distDiag = getEuclideanTravelCost({ x: 0, y: 0 }, { x: 9, y: 9 });
      expect(distDiag).toBeCloseTo(9 * Math.SQRT2, 9);
    });

    it('preserves Euclidean symmetry: T(i, j) === T(j, i)', () => {
      const testPairs = [
        [{ x: 0, y: 0 }, { x: 3, y: 4 }],
        [{ x: 1, y: 8 }, { x: 7, y: 2 }],
        [{ x: 4, y: 5 }, { x: 9, y: 0 }],
      ];

      for (const [p1, p2] of testPairs) {
        expect(getEuclideanTravelCost(p1, p2)).toBe(getEuclideanTravelCost(p2, p1));
        expect(
          getTravelCost({ mode: TRAVEL_COST_MODES.EUCLIDEAN, from: p1, to: p2 })
        ).toBe(
          getTravelCost({ mode: TRAVEL_COST_MODES.EUCLIDEAN, from: p2, to: p1 })
        );
      }
    });

    it('supports alternative point formats in Euclidean mode', () => {
      expect(
        getEuclideanTravelCost({ location: { x: 0, y: 0 } }, { location: { x: 3, y: 4 } })
      ).toBe(5);
      expect(getEuclideanTravelCost('0,0', '3,4')).toBe(5);
    });
  });

  describe('Road Shortest-Path Travel Cost', () => {
    it('delegates correctly to GRID road network with Manhattan distance', () => {
      // (0,0) to (3,4) on GRID network has Manhattan distance 3 + 4 = 7
      const gridDist = getRoadTravelCost(gridNetwork, { x: 0, y: 0 }, { x: 3, y: 4 });
      expect(gridDist).toBe(7);

      // Dispatcher with mode = 'road'
      const dispatchDist = getTravelCost({
        mode: TRAVEL_COST_MODES.ROAD,
        from: { x: 0, y: 0 },
        to: { x: 3, y: 4 },
        roadNetwork: gridNetwork,
      });
      expect(dispatchDist).toBe(7);
    });

    it('road distance for identical points is 0', () => {
      expect(getRoadTravelCost(gridNetwork, { x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
      expect(
        getTravelCost({
          mode: TRAVEL_COST_MODES.ROAD,
          from: { x: 2, y: 7 },
          to: { x: 2, y: 7 },
          roadNetwork: gridNetwork,
        })
      ).toBe(0);
    });

    it('produces different travel costs between GRID and ARTERIAL scenarios where appropriate', () => {
      // Local residential trip away from central boulevards:
      // (0,0) to (1,1):
      // On GRID: weight 1 for every link => 1 + 1 = 2
      // On ARTERIAL: rows/cols 0-1 are local roads with weight 2 => 2 + 2 = 4
      const gridCost = getRoadTravelCost(gridNetwork, { x: 0, y: 0 }, { x: 1, y: 1 });
      const arterialCost = getRoadTravelCost(arterialNetwork, { x: 0, y: 0 }, { x: 1, y: 1 });

      expect(gridCost).toBe(2);
      expect(arterialCost).toBe(4);
      expect(arterialCost).not.toBe(gridCost);
    });

    it('requires a valid road network object', () => {
      expect(() => getRoadTravelCost(null, { x: 0, y: 0 }, { x: 1, y: 1 })).toThrow(TypeError);
      expect(() => getRoadTravelCost(undefined, { x: 0, y: 0 }, { x: 1, y: 1 })).toThrow(TypeError);
      expect(() => getRoadTravelCost({}, { x: 0, y: 0 }, { x: 1, y: 1 })).toThrow(TypeError);

      // getTravelCost dispatcher road mode requires roadNetwork
      expect(() =>
        getTravelCost({
          mode: TRAVEL_COST_MODES.ROAD,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        })
      ).toThrow(TypeError);

      expect(() =>
        getTravelCost({
          mode: TRAVEL_COST_MODES.ROAD,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
          roadNetwork: null,
        })
      ).toThrow(TypeError);
    });

    it('returns Infinity consistently when destination is unreachable on road network', () => {
      // Construct an isolated road graph where destination node has no reachable path
      const disconnectedNetwork = {
        width: 10,
        height: 10,
        adjacency: new Map([
          ['0,0', []],
          ['9,9', []],
        ]),
      };

      const roadCost = getRoadTravelCost(disconnectedNetwork, { x: 0, y: 0 }, { x: 9, y: 9 });
      expect(roadCost).toBe(Infinity);

      const dispatchCost = getTravelCost({
        mode: TRAVEL_COST_MODES.ROAD,
        from: { x: 0, y: 0 },
        to: { x: 9, y: 9 },
        roadNetwork: disconnectedNetwork,
      });
      expect(dispatchCost).toBe(Infinity);
    });
  });

  describe('getTravelCost Dispatcher & Validation', () => {
    it('defaults to EUCLIDEAN mode when mode is omitted', () => {
      const cost = getTravelCost({
        from: { x: 0, y: 0 },
        to: { x: 3, y: 4 },
      });
      expect(cost).toBe(5); // Euclidean 3-4-5
    });

    it('throws TypeError if options is not an object', () => {
      expect(() => getTravelCost(null)).toThrow(TypeError);
      expect(() => getTravelCost('invalid')).toThrow(TypeError);
      expect(() => getTravelCost(123)).toThrow(TypeError);
    });

    it('throws TypeError for non-string travel cost mode', () => {
      expect(() =>
        getTravelCost({
          mode: 123,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        })
      ).toThrow(TypeError);

      expect(() =>
        getTravelCost({
          mode: null,
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        })
      ).toThrow(TypeError);
    });

    it('throws RangeError for invalid mode string', () => {
      expect(() =>
        getTravelCost({
          mode: 'manhattan',
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        })
      ).toThrow(RangeError);

      expect(() =>
        getTravelCost({
          mode: 'fly',
          from: { x: 0, y: 0 },
          to: { x: 1, y: 1 },
        })
      ).toThrow(/Invalid travel cost mode "fly"/);
    });

    it('throws TypeError or RangeError on invalid coordinates', () => {
      // Missing / null point
      expect(() => getEuclideanTravelCost(null, { x: 1, y: 1 })).toThrow(TypeError);
      expect(() => getRoadTravelCost(gridNetwork, { x: 1, y: 1 }, null)).toThrow(TypeError);

      // Non-integer coordinates
      expect(() =>
        getTravelCost({
          from: { x: 1.5, y: 2 },
          to: { x: 3, y: 4 },
        })
      ).toThrow(TypeError);

      // Out of bounds coordinates
      expect(() =>
        getTravelCost({
          from: { x: -1, y: 0 },
          to: { x: 3, y: 4 },
        })
      ).toThrow(RangeError);

      expect(() =>
        getTravelCost({
          from: { x: 0, y: 0 },
          to: { x: 10, y: 10 },
        })
      ).toThrow(RangeError);
    });

    it('produces deterministic repeated results', () => {
      for (let i = 0; i < 5; i++) {
        expect(getEuclideanTravelCost({ x: 2, y: 3 }, { x: 8, y: 9 })).toBeCloseTo(
          Math.hypot(6, 6),
          12
        );
        expect(getRoadTravelCost(gridNetwork, { x: 1, y: 2 }, { x: 7, y: 8 })).toBe(12);
        expect(
          getTravelCost({
            mode: TRAVEL_COST_MODES.ROAD,
            from: { x: 0, y: 0 },
            to: { x: 9, y: 9 },
            roadNetwork: gridNetwork,
          })
        ).toBe(18);
      }
    });
  });
});
