/**
 * @file consumerChoice.test.js
 * @description Unit and mathematical validation tests for LOCUS Frontier:
 * Consumer Choice & Demand Allocation Engine (Phase 6D).
 */

import { describe, it, expect } from 'vitest';
import {
  createFrontierCity,
  SCENARIO_IDS,
  createRoadNetwork,
  ROAD_SCENARIO_IDS,
  TRAVEL_COST_MODES,
  calculateFrontierUtility,
  calculateZoneChoice,
  allocateFrontierDemand,
  calculateFrontierMarket,
  createConsumerSegment,
  DEFAULT_CONSUMER_SEGMENT,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 6D: Consumer Choice & Demand Allocation', () => {
  const balancedCity = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
  const gridNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
  const barrierNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });
  const bridgeNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BRIDGE });
  const bottleneckNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BOTTLENECK });

  describe('1. Basic Spatial Choice', () => {
    it('allocates the zone entirely to restaurant A when A is closer and prices are equal', () => {
      const restaurantA = { id: 'A', location: { x: 2, y: 2 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 8, y: 8 }, price: 250 };

      // Zone at (2, 2) is at distance 0 from A and ~8.48 from B
      const allocation = allocateFrontierDemand({
        zone: { x: 2, y: 2, population: 200 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(allocation.travelCostA).toBe(0);
      expect(allocation.travelCostB).toBeGreaterThan(8);
      expect(allocation.utilityA).toBeGreaterThan(allocation.utilityB);
      expect(allocation.choice).toBe('A');
      expect(allocation.shareA).toBe(1.0);
      expect(allocation.shareB).toBe(0.0);
      expect(allocation.demandA).toBe(200);
      expect(allocation.demandB).toBe(0);
    });

    it('allocates the zone entirely to restaurant B when B is closer and prices are equal', () => {
      const restaurantA = { id: 'A', location: { x: 1, y: 1 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 7, y: 7 }, price: 250 };

      // Zone at (7, 7) is at distance 0 from B
      const allocation = allocateFrontierDemand({
        zone: { x: 7, y: 7, population: 150 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(allocation.travelCostB).toBe(0);
      expect(allocation.travelCostA).toBeGreaterThan(8);
      expect(allocation.utilityB).toBeGreaterThan(allocation.utilityA);
      expect(allocation.choice).toBe('B');
      expect(allocation.shareA).toBe(0.0);
      expect(allocation.shareB).toBe(1.0);
      expect(allocation.demandA).toBe(0);
      expect(allocation.demandB).toBe(150);
    });
  });

  describe('2. Price Differentiation', () => {
    it('grants market advantage to the cheaper restaurant holding travel cost constant', () => {
      // Co-located restaurants: travel costs to any zone are identical
      const restaurantA = { id: 'A', location: { x: 5, y: 5 }, price: 200 };
      const restaurantB = { id: 'B', location: { x: 5, y: 5 }, price: 300 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      // Restaurant A is ₹100 cheaper everywhere, so U_A = U_B + 100
      expect(market.restaurantDemand.A).toBe(market.totalPopulation);
      expect(market.restaurantDemand.B).toBe(0);
      expect(market.marketShares.A).toBe(1.0);
      expect(market.marketShares.B).toBe(0.0);

      // Verify every zone chose A
      for (const alloc of market.zoneAllocations) {
        expect(alloc.choice).toBe('A');
        expect(alloc.shareA).toBe(1.0);
        expect(alloc.shareB).toBe(0.0);
        expect(alloc.utilityA).toBeCloseTo(alloc.utilityB + 100, 8);
      }
    });
  });

  describe('3. Exact Utility Tie', () => {
    it('splits population 50/50 when utilities are exactly equal', () => {
      // Co-located restaurants with identical prices
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 250 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(market.restaurantDemand.A).toBe(market.totalPopulation * 0.5);
      expect(market.restaurantDemand.B).toBe(market.totalPopulation * 0.5);
      expect(market.marketShares.A).toBe(0.5);
      expect(market.marketShares.B).toBe(0.5);

      for (const alloc of market.zoneAllocations) {
        expect(alloc.choice).toBe('TIE');
        expect(alloc.shareA).toBe(0.5);
        expect(alloc.shareB).toBe(0.5);
        expect(alloc.utilityA).toBe(alloc.utilityB);
        expect(alloc.demandA).toBe(alloc.population * 0.5);
        expect(alloc.demandB).toBe(alloc.population * 0.5);
      }
    });

    it('calculateZoneChoice returns TIE when utility difference is within tolerance', () => {
      const choice = calculateZoneChoice({
        travelCostA: 2.0,
        travelCostB: 2.0,
        priceA: 250,
        priceB: 250,
      });

      expect(choice.choice).toBe('TIE');
      expect(choice.shareA).toBe(0.5);
      expect(choice.shareB).toBe(0.5);
    });
  });

  describe('4. Euclidean Travel Cost', () => {
    it('accurately uses standard geometric Euclidean distance', () => {
      const restaurantA = { id: 'A', location: { x: 0, y: 0 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 9, y: 9 }, price: 250 };

      // Zone at (3, 4) has Euclidean distance 5 to A (3-4-5 right triangle)
      const alloc = allocateFrontierDemand({
        zone: { x: 3, y: 4, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(alloc.travelCostA).toBe(5);
      // Utility = 500 - 250 + 10 * 5 - 10 * 5 = 250
      expect(alloc.utilityA).toBe(250);
    });
  });

  describe('5. Road Travel Cost vs Euclidean', () => {
    it('uses road network shortest paths and differentiates from Euclidean distance', () => {
      const restaurantA = { id: 'A', location: { x: 0, y: 0 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 9, y: 9 }, price: 250 };

      // On GRID network: (0,0) to (3,4) has Manhattan distance 3 + 4 = 7
      const allocRoad = allocateFrontierDemand({
        zone: { x: 3, y: 4, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: gridNetwork,
      });

      const allocEuclid = allocateFrontierDemand({
        zone: { x: 3, y: 4, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(allocEuclid.travelCostA).toBe(5);
      expect(allocRoad.travelCostA).toBe(7);
      expect(allocRoad.travelCostA).not.toBe(allocEuclid.travelCostA);

      // Utility in road mode: 500 - 250 + 10 * 5 - 10 * 7 = 230
      expect(allocRoad.utilityA).toBe(230);
      expect(allocEuclid.utilityA).toBe(250);
    });
  });

  describe('6. Barrier Scenario Detour & Choice Flip', () => {
    it('barrier detour alters road travel costs and shifts consumer choice across the river', () => {
      // In BARRIER scenario, midline between x=4 and x=5 is blocked for y != 4
      // Direct crossing at row 0 between (4,0) and (5,0) is blocked, requiring detour via (4,4)
      const restaurantA = { id: 'A', location: { x: 4, y: 0 }, price: 200 }; // Cheaper
      const restaurantB = { id: 'B', location: { x: 5, y: 0 }, price: 250 }; // Closer to (5,0)

      // Test zone at (5, 0)
      const zoneAt50 = { x: 5, y: 0, population: 100 };

      // In Euclidean mode:
      // Distance to A(4,0) is 1, Distance to B(5,0) is 0
      // Utility A = 500 - 200 - 10 * 1 = 290
      // Utility B = 500 - 250 - 10 * 0 = 250
      // A wins by 40 utility points!
      const allocEuclid = allocateFrontierDemand({
        zone: zoneAt50,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });
      expect(allocEuclid.travelCostA).toBe(1);
      expect(allocEuclid.travelCostB).toBe(0);
      expect(allocEuclid.choice).toBe('A');

      // In Road mode on BARRIER:
      // Distance to B(5,0) is 0
      // Distance to A(4,0) is 9 (must detour to row 4 crossing)
      // Utility A = 500 - 200 - 10 * 9 = 210
      // Utility B = 500 - 250 - 10 * 0 = 250
      // B wins by 40 utility points!
      const allocRoad = allocateFrontierDemand({
        zone: zoneAt50,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: barrierNetwork,
      });
      expect(allocRoad.travelCostA).toBe(9);
      expect(allocRoad.travelCostB).toBe(0);
      expect(allocRoad.choice).toBe('B');
      expect(allocRoad.shareB).toBe(1.0);
      expect(allocRoad.shareA).toBe(0.0);
    });
  });

  describe('7. Bridge Scenario Accessibility', () => {
    it('restores cross-region accessibility allowing consumers to patronize cross-river restaurants', () => {
      // In BRIDGE scenario: North (y <= 4) and South (y >= 5) connected via bridges at cols 2 and 7
      const restaurantA = { id: 'A', location: { x: 2, y: 2 }, price: 250 }; // North
      const restaurantB = { id: 'B', location: { x: 2, y: 7 }, price: 250 }; // South

      // Zone in North at (2, 3)
      const allocBridge = allocateFrontierDemand({
        zone: { x: 2, y: 3, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bridgeNetwork,
      });

      expect(allocBridge.travelCostA).toBe(1); // (2,3) to (2,2)
      expect(allocBridge.travelCostB).toBe(4); // (2,3) -> (2,4) -> bridge (2,5) -> (2,6) -> (2,7) [4 steps]
      expect(allocBridge.isReachable).toBe(true);
      expect(allocBridge.utilityA).toBe(500 - 250 + 50 - 10);
      expect(allocBridge.utilityB).toBe(500 - 250 + 50 - 40);
      expect(allocBridge.choice).toBe('A');

      // Now consider if bridges are blocked/absent: South is unreachable from North
      const noBridgesNetwork = {
        width: 10,
        height: 10,
        adjacency: new Map(
          [...bridgeNetwork.adjacency.entries()].map(([id, neighbors]) => [
            id,
            neighbors.filter((n) => !n.isBridge),
          ])
        ),
      };

      const allocNoBridge = allocateFrontierDemand({
        zone: { x: 2, y: 3, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: noBridgesNetwork,
      });

      expect(allocNoBridge.travelCostA).toBe(1);
      expect(allocNoBridge.travelCostB).toBe(Infinity);
      expect(allocNoBridge.utilityB).toBe(-Infinity);
      expect(allocNoBridge.choice).toBe('A');
    });
  });

  describe('8. Bottleneck Scenario Travel Cost Impact', () => {
    it('channels cross-corridor traffic through designated central passes', () => {
      // BOTTLENECK network: crossings only at cols 4 and 5
      const restaurantA = { id: 'A', location: { x: 1, y: 1 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 1, y: 8 }, price: 250 };

      const alloc = allocateFrontierDemand({
        zone: { x: 1, y: 1, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bottleneckNetwork,
      });

      expect(alloc.travelCostA).toBe(0);
      // To B(1, 8), route must funnel from x=1 to x=4, cross to (4,5), then return to x=1
      // (1,1) -> (4,4) [6 steps] + (4,4)->(4,5) [1 step] + (4,5)->(1,8) [6 steps] = 13 steps
      expect(alloc.travelCostB).toBe(13);
      expect(alloc.choice).toBe('A');
    });
  });

  describe('9. Demand Conservation', () => {
    it('guarantees demandA + demandB === totalPopulation for fully reachable markets', () => {
      const restaurantA = { id: 'A', location: { x: 2, y: 3 }, price: 200 };
      const restaurantB = { id: 'B', location: { x: 7, y: 6 }, price: 250 };

      // Test across multiple city types and modes
      const testCases = [
        { city: balancedCity, mode: TRAVEL_COST_MODES.EUCLIDEAN },
        { city: balancedCity, mode: TRAVEL_COST_MODES.ROAD, roadNetwork: gridNetwork },
        { city: balancedCity, mode: TRAVEL_COST_MODES.ROAD, roadNetwork: barrierNetwork },
        { city: balancedCity, mode: TRAVEL_COST_MODES.ROAD, roadNetwork: bridgeNetwork },
      ];

      for (const { city, mode, roadNetwork } of testCases) {
        const market = calculateFrontierMarket({
          city,
          restaurantA,
          restaurantB,
          mode,
          roadNetwork,
        });

        const totalDemand = market.restaurantDemand.A + market.restaurantDemand.B;
        expect(Math.abs(totalDemand - market.totalPopulation)).toBeLessThan(1e-6);
        expect(market.unreachablePopulation).toBe(0);
        expect(market.reachablePopulation).toBe(market.totalPopulation);

        // Zone-by-zone sum check
        const sumZoneDemandA = market.zoneAllocations.reduce((acc, z) => acc + z.demandA, 0);
        const sumZoneDemandB = market.zoneAllocations.reduce((acc, z) => acc + z.demandB, 0);
        expect(Math.abs(sumZoneDemandA - market.restaurantDemand.A)).toBeLessThan(1e-6);
        expect(Math.abs(sumZoneDemandB - market.restaurantDemand.B)).toBeLessThan(1e-6);
      }
    });
  });

  describe('10. Market-Share Conservation', () => {
    it('guarantees shareA + shareB === 1.0 for full coverage markets', () => {
      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA: { id: 'A', location: { x: 3, y: 5 }, price: 250 },
        restaurantB: { id: 'B', location: { x: 6, y: 5 }, price: 250 },
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      const totalShare = market.marketShares.A + market.marketShares.B;
      expect(Math.abs(totalShare - 1.0)).toBeLessThan(1e-9);
    });
  });

  describe('11. Unreachable Population Handling', () => {
    it('isolates unreachable consumers without assigning them to any restaurant', () => {
      // Disconnected network where node (9,9) has no road links
      const disconnectedNetwork = {
        width: 10,
        height: 10,
        adjacency: new Map([
          ...gridNetwork.adjacency.entries(),
          ['9,9', []], // Isolated from graph
        ]),
      };

      const restaurantA = { id: 'A', location: { x: 0, y: 0 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 1, y: 1 }, price: 250 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: disconnectedNetwork,
      });

      const isolatedZone = market.zoneAllocations.find((z) => z.zone.x === 9 && z.zone.y === 9);
      expect(isolatedZone).toBeDefined();
      expect(isolatedZone.isReachable).toBe(false);
      expect(isolatedZone.choice).toBe('NONE');
      expect(isolatedZone.shareA).toBe(0);
      expect(isolatedZone.shareB).toBe(0);
      expect(isolatedZone.demandA).toBe(0);
      expect(isolatedZone.demandB).toBe(0);

      // Verify market-level unreachable aggregation
      expect(market.unreachablePopulation).toBe(isolatedZone.population);
      expect(market.unreachablePopulation).toBeGreaterThan(0);
      expect(market.reachablePopulation).toBe(market.totalPopulation - market.unreachablePopulation);

      // Verify population conservation: demandA + demandB + unreachable === totalPopulation
      const totalAllocated =
        market.restaurantDemand.A + market.restaurantDemand.B + market.unreachablePopulation;
      expect(Math.abs(totalAllocated - market.totalPopulation)).toBeLessThan(1e-6);

      // Reachable market shares still sum to 1.0
      expect(
        Math.abs(market.reachableMarketShares.A + market.reachableMarketShares.B - 1.0)
      ).toBeLessThan(1e-9);
    });
  });

  describe('12. Determinism', () => {
    it('produces identical output on repeated runs with identical inputs', () => {
      const input = {
        city: balancedCity,
        restaurantA: { id: 'A', location: { x: 2, y: 4 }, price: 220 },
        restaurantB: { id: 'B', location: { x: 7, y: 5 }, price: 280 },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: barrierNetwork,
      };

      const run1 = calculateFrontierMarket(input);
      const run2 = calculateFrontierMarket(input);

      expect(run1.restaurantDemand).toEqual(run2.restaurantDemand);
      expect(run1.marketShares).toEqual(run2.marketShares);
      expect(run1.totalPopulation).toBe(run2.totalPopulation);
      expect(run1.reachablePopulation).toBe(run2.reachablePopulation);
      expect(run1.unreachablePopulation).toBe(run2.unreachablePopulation);
      expect(run1.zoneAllocations).toEqual(run2.zoneAllocations);
    });
  });

  describe('13. Input Immutability', () => {
    it('does not mutate input city, restaurants, roadNetwork, or configuration', () => {
      const city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
      const initialCellsSnapshot = JSON.stringify(city.cells);
      const initialAnchorsSnapshot = JSON.stringify(city.anchors);

      const restaurantA = { id: 'A', location: { x: 3, y: 3 }, price: 250 };
      const restaurantB = { id: 'B', location: { x: 6, y: 6 }, price: 250 };
      const rASnapshot = JSON.stringify(restaurantA);
      const rBSnapshot = JSON.stringify(restaurantB);

      const config = { V: 500, alpha: 10 };
      const configSnapshot = JSON.stringify(config);

      const market = calculateFrontierMarket({
        city,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: gridNetwork,
        config,
      });

      // Verify input state is unchanged
      expect(JSON.stringify(city.cells)).toBe(initialCellsSnapshot);
      expect(JSON.stringify(city.anchors)).toBe(initialAnchorsSnapshot);
      expect(JSON.stringify(restaurantA)).toBe(rASnapshot);
      expect(JSON.stringify(restaurantB)).toBe(rBSnapshot);
      expect(JSON.stringify(config)).toBe(configSnapshot);

      // Verify returned objects are frozen
      expect(Object.isFrozen(market)).toBe(true);
      expect(Object.isFrozen(market.restaurantDemand)).toBe(true);
      expect(Object.isFrozen(market.marketShares)).toBe(true);
      expect(Object.isFrozen(market.zoneAllocations)).toBe(true);
      expect(Object.isFrozen(market.zoneAllocations[0])).toBe(true);
    });
  });

  describe('14. Invalid Inputs', () => {
    const validR1 = { id: 'A', location: { x: 0, y: 0 }, price: 250 };
    const validR2 = { id: 'B', location: { x: 5, y: 5 }, price: 250 };

    it('throws TypeError for missing or invalid city', () => {
      expect(() =>
        calculateFrontierMarket({
          city: null,
          restaurantA: validR1,
          restaurantB: validR2,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateFrontierMarket({
          city: {},
          restaurantA: validR1,
          restaurantB: validR2,
        })
      ).toThrow(TypeError);
    });

    it('throws TypeError when road mode is requested without a valid roadNetwork', () => {
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: validR1,
          restaurantB: validR2,
          mode: TRAVEL_COST_MODES.ROAD,
          roadNetwork: null,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: validR1,
          restaurantB: validR2,
          mode: TRAVEL_COST_MODES.ROAD,
          roadNetwork: {},
        })
      ).toThrow(TypeError);
    });

    it('throws RangeError for invalid travel mode', () => {
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: validR1,
          restaurantB: validR2,
          mode: 'teleport',
        })
      ).toThrow(RangeError);
    });

    it('throws RangeError for wrong number of restaurants', () => {
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurants: [validR1], // Only 1
        })
      ).toThrow(RangeError);

      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurants: [validR1, validR2, { id: 'C', location: { x: 1, y: 1 }, price: 200 }], // 3
        })
      ).toThrow(RangeError);
    });

    it('throws RangeError for duplicate restaurant IDs', () => {
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: 250 },
          restaurantB: { id: 'A', location: { x: 5, y: 5 }, price: 250 }, // Same ID 'A'
        })
      ).toThrow(RangeError);
    });

    it('throws TypeError or RangeError for invalid restaurant coordinates', () => {
      // Out of bounds
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: -1, y: 0 }, price: 250 },
          restaurantB: validR2,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 10, y: 0 }, price: 250 },
          restaurantB: validR2,
        })
      ).toThrow(RangeError);

      // Non-integer coordinates
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 1.5, y: 2 }, price: 250 },
          restaurantB: validR2,
        })
      ).toThrow(TypeError);
    });

    it('throws TypeError or RangeError for non-finite or negative prices', () => {
      // Negative price
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: -100 },
          restaurantB: validR2,
        })
      ).toThrow(RangeError);

      // Non-numeric price
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: '250' },
          restaurantB: validR2,
        })
      ).toThrow(TypeError);

      // NaN price
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: NaN },
          restaurantB: validR2,
        })
      ).toThrow(TypeError);
    });

    it('throws TypeError for malformed restaurant objects', () => {
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: null,
          restaurantB: validR2,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', price: 250 }, // Missing location
          restaurantB: validR2,
        })
      ).toThrow(TypeError);

      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { location: { x: 0, y: 0 }, price: 250 }, // Missing ID
          restaurantB: validR2,
        })
      ).toThrow(TypeError);
    });
  });

  describe('Pure Function Unit Tests', () => {
    it('calculateFrontierUtility computes expected values and returns -Infinity on unreachable', () => {
      // Baseline utility with default quality = 5 (gamma = 10 -> +50)
      const u = calculateFrontierUtility({ travelCost: 5, price: 200, V: 500, alpha: 10 });
      expect(u).toBe(500 - 200 + 10 * 5 - 10 * 5); // 300

      // Explicit quality = 0
      const u0 = calculateFrontierUtility({ travelCost: 5, price: 200, quality: 0, V: 500, alpha: 10 });
      expect(u0).toBe(500 - 200 - 10 * 5); // 250

      // Unreachable travelCost
      const uInf = calculateFrontierUtility({ travelCost: Infinity, price: 200, V: 500, alpha: 10 });
      expect(uInf).toBe(-Infinity);
    });

    it('allocateFrontierDemand works with custom config parameters', () => {
      const restaurantA = { id: 'A', location: { x: 0, y: 0 }, price: 200 };
      const restaurantB = { id: 'B', location: { x: 5, y: 5 }, price: 200 };

      // High travel sensitivity: alpha = 100
      const alloc = allocateFrontierDemand({
        zone: { x: 1, y: 1, population: 50 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        config: { V: 1000, alpha: 100 },
      });

      expect(alloc.demandA).toBe(50);
      expect(alloc.demandB).toBe(0);
    });
  });

  describe('15. Phase 7A: Quality Differentiation', () => {
    it('captures entire market when quality is higher at identical location and price', () => {
      // Co-located restaurants at (4, 4), price = 200
      // Restaurant A: quality = 8
      // Restaurant B: quality = 5
      // gamma = 10 -> Delta U = 10 * (8 - 5) = +30 utility advantage for A
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 8 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 200, quality: 5 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
      });

      // A has strictly higher utility everywhere, capturing 100% of demand
      expect(market.restaurantDemand.A).toBe(market.totalPopulation);
      expect(market.restaurantDemand.B).toBe(0);
      expect(market.marketShares.A).toBe(1.0);
      expect(market.marketShares.B).toBe(0.0);

      for (const alloc of market.zoneAllocations) {
        expect(alloc.choice).toBe('A');
        expect(alloc.shareA).toBe(1.0);
        expect(alloc.shareB).toBe(0.0);
        expect(alloc.qualityA).toBe(8);
        expect(alloc.qualityB).toBe(5);
        expect(alloc.utilityA - alloc.utilityB).toBeCloseTo(30, 8);
      }
    });

    it('verifies exact quality / price tradeoff: higher quality offsets higher price into exact 50/50 tie', () => {
      // Co-located restaurants at (4, 4)
      // Restaurant A: price = 250, quality = 10
      // Restaurant B: price = 200, quality = 5
      // With gamma = 10:
      // A quality advantage: +10 * (10 - 5) = +50 utility
      // A price disadvantage: -(250 - 200) = -50 utility
      // Net difference = 0 -> exact tie everywhere
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 250, quality: 10 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 200, quality: 5 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
      });

      expect(market.restaurantDemand.A).toBeCloseTo(market.totalPopulation / 2, 5);
      expect(market.restaurantDemand.B).toBeCloseTo(market.totalPopulation / 2, 5);
      expect(market.marketShares.A).toBeCloseTo(0.5, 5);
      expect(market.marketShares.B).toBeCloseTo(0.5, 5);

      for (const alloc of market.zoneAllocations) {
        expect(alloc.choice).toBe('TIE');
        expect(alloc.shareA).toBe(0.5);
        expect(alloc.shareB).toBe(0.5);
        expect(alloc.utilityA).toBeCloseTo(alloc.utilityB, 8);
      }
    });

    it('offsets spatial travel disadvantage with sufficient quality advantage', () => {
      // Consumer zone at (2, 0)
      // Restaurant A at (4, 0): travelCost = 2, price = 200, quality = 10
      // Restaurant B at (1, 0): travelCost = 1, price = 200, quality = 5
      // alpha = 10, gamma = 10:
      // Utility A = 500 - 200 + 10 * 10 - 10 * 2 = 500 - 200 + 100 - 20 = 380
      // Utility B = 500 - 200 + 10 * 5  - 10 * 1 = 500 - 200 + 50  - 10 = 340
      // A is farther away (distance 2 vs 1), but quality advantage (+50) > spatial friction (+10) -> A wins
      const restaurantA = { id: 'A', location: { x: 4, y: 0 }, price: 200, quality: 10 };
      const restaurantB = { id: 'B', location: { x: 1, y: 0 }, price: 200, quality: 5 };

      const alloc = allocateFrontierDemand({
        zone: { x: 2, y: 0, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(alloc.choice).toBe('A');
      expect(alloc.shareA).toBe(1.0);
      expect(alloc.shareB).toBe(0.0);
      expect(alloc.utilityA).toBe(380);
      expect(alloc.utilityB).toBe(340);

      // Now reverse: reduce A's quality to 6 (quality advantage = +10, spatial disadvantage = -10)
      // With equal net utility (utility A = 340, utility B = 340) -> exact tie
      const restaurantA_lower = { id: 'A', location: { x: 4, y: 0 }, price: 200, quality: 6 };
      const allocTie = allocateFrontierDemand({
        zone: { x: 2, y: 0, population: 100 },
        restaurantA: restaurantA_lower,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(allocTie.choice).toBe('TIE');
      expect(allocTie.shareA).toBe(0.5);
      expect(allocTie.shareB).toBe(0.5);

      // Now reduce A's quality to 5 (quality advantage = 0, spatial disadvantage = -10) -> B wins
      const restaurantA_equalQ = { id: 'A', location: { x: 4, y: 0 }, price: 200, quality: 5 };
      const allocB_wins = allocateFrontierDemand({
        zone: { x: 2, y: 0, population: 100 },
        restaurantA: restaurantA_equalQ,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(allocB_wins.choice).toBe('B');
      expect(allocB_wins.shareB).toBe(1.0);
      expect(allocB_wins.shareA).toBe(0.0);
    });

    it('ensures high quality does NOT override network inaccessibility', () => {
      // In unreachable scenario, even quality = 10 yields -Infinity utility
      const uUnreachable = calculateFrontierUtility({
        travelCost: Infinity,
        price: 150,
        quality: 10,
        gamma: 10,
      });
      expect(uUnreachable).toBe(-Infinity);

      // In zone choice, an unreachable high-quality restaurant loses to a reachable low-quality restaurant
      const choice = calculateZoneChoice({
        travelCostA: Infinity,
        travelCostB: 5,
        priceA: 150,
        priceB: 350,
        qualityA: 10,
        qualityB: 0,
      });

      expect(choice.choice).toBe('B');
      expect(choice.shareB).toBe(1.0);
      expect(choice.shareA).toBe(0.0);
      expect(choice.utilityA).toBe(-Infinity);
      expect(choice.utilityB).toBeGreaterThan(-Infinity);
    });

    it('supports configurable gamma parameter in market evaluations', () => {
      const restaurantA = { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 6 };
      const restaurantB = { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 5 };

      // With gamma = 0, quality difference has zero impact -> tie
      const marketGamma0 = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        config: { gamma: 0 },
      });

      expect(marketGamma0.marketShares.A).toBeCloseTo(0.5, 5);
      expect(marketGamma0.marketShares.B).toBeCloseTo(0.5, 5);

      // With gamma = 25, quality difference gives 25 utility advantage -> A wins entirely
      const marketGamma25 = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        config: { gamma: 25 },
      });

      expect(marketGamma25.marketShares.A).toBe(1.0);
      expect(marketGamma25.marketShares.B).toBe(0.0);
    });

    it('propagates quality into payoff engine demand and profit without direct quality bonus', () => {
      // Verify quality affects profit strictly via demand
      // Restaurant A (quality 8) vs Restaurant B (quality 5), price 200, marginal cost 100
      // Fixed cost = 0.
      const rA = { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 8, variableCost: 100 };
      const rB = { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 5, variableCost: 100 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA: rA,
        restaurantB: rB,
      });

      // Demand for A = total population, Demand for B = 0
      expect(market.restaurantDemand.A).toBe(market.totalPopulation);
      expect(market.restaurantDemand.B).toBe(0);

      // Profit formula: (P - C) * D - F
      const profitA = (rA.price - rA.variableCost) * market.restaurantDemand.A;
      const profitB = (rB.price - rB.variableCost) * market.restaurantDemand.B;

      expect(profitA).toBe(100 * market.totalPopulation);
      expect(profitB).toBe(0);
    });
  });

  describe('16. Configurable Quality Scale Propagation', () => {
    it('preserves default [0, 10] behavior and rejects quality > 10 when scale is not specified', () => {
      // Default scale accepts within [0, 10]
      const uValid = calculateFrontierUtility({
        travelCost: 0,
        price: 200,
        quality: 10,
        V: 500,
        alpha: 10,
        gamma: 10,
      });
      expect(uValid).toBe(500 - 200 + 10 * 10 - 0); // 400

      // Rejects quality > 10 on default scale in calculateFrontierUtility
      expect(() =>
        calculateFrontierUtility({
          travelCost: 0,
          price: 200,
          quality: 15,
        })
      ).toThrow(RangeError);

      // Rejects quality > 10 on default scale in calculateFrontierMarket
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 15 },
          restaurantB: { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 5 },
        })
      ).toThrow(RangeError);
    });

    it('accepts quality 15 under custom scale [0, 20] in calculateFrontierUtility, calculateZoneChoice, and allocateFrontierDemand', () => {
      const customScale = { min: 0, max: 20 };

      // calculateFrontierUtility
      const utility = calculateFrontierUtility({
        travelCost: 2,
        price: 200,
        quality: 15,
        V: 500,
        alpha: 10,
        gamma: 10,
        qualityScale: customScale,
      });
      // 500 - 200 + 10 * 15 - 10 * 2 = 300 + 150 - 20 = 430
      expect(utility).toBe(430);

      // calculateZoneChoice
      const choice = calculateZoneChoice({
        travelCostA: 2,
        travelCostB: 2,
        priceA: 200,
        priceB: 200,
        qualityA: 15,
        qualityB: 10,
        V: 500,
        alpha: 10,
        gamma: 10,
        qualityScale: customScale,
      });
      expect(choice.choice).toBe('A');
      expect(choice.utilityA).toBe(430);
      expect(choice.utilityB).toBe(380); // 500 - 200 + 10 * 10 - 20 = 380

      // allocateFrontierDemand
      const alloc = allocateFrontierDemand({
        zone: { x: 5, y: 5, population: 100 },
        restaurantA: { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 15 },
        restaurantB: { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 10 },
        config: { qualityScale: customScale, gamma: 10 },
      });
      expect(alloc.demandA).toBe(100);
      expect(alloc.demandB).toBe(0);
      expect(alloc.utilityA).toBe(450); // travelCost = 0: 500 - 200 + 150 = 450
      expect(alloc.utilityB).toBe(400); // 500 - 200 + 100 = 400
    });

    it('works with quality 15 through calculateFrontierMarket() and propagates qualityScale', () => {
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 15 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 200, quality: 8 };

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        config: {
          V: 600,
          alpha: 10,
          gamma: 12,
          qualityScale: { min: 0, max: 20 },
        },
      });

      expect(market.config.qualityScale).toEqual({ min: 0, max: 20 });
      expect(market.config.gamma).toBe(12);
      expect(market.restaurants[0].quality).toBe(15);
      expect(market.restaurants[1].quality).toBe(8);

      // Delta U = gamma * (QA - QB) = 12 * (15 - 8) = 12 * 7 = 84
      // Since locations and prices are identical, A captures the entire market
      expect(market.restaurantDemand.A).toBe(market.totalPopulation);
      expect(market.restaurantDemand.B).toBe(0);
      expect(market.marketShares.A).toBe(1.0);
      expect(market.marketShares.B).toBe(0.0);

      const sampleAlloc = market.zoneAllocations[0];
      expect(sampleAlloc.choice).toBe('A');
      expect(sampleAlloc.qualityA).toBe(15);
      expect(sampleAlloc.qualityB).toBe(8);
      expect(sampleAlloc.utilityA - sampleAlloc.utilityB).toBeCloseTo(84, 8);
    });

    it('rejects values outside custom qualityScale in calculateFrontierMarket and calculateFrontierUtility', () => {
      const customScale = { min: 5, max: 20 };

      // Value below custom min (4 < 5)
      expect(() =>
        calculateFrontierUtility({
          travelCost: 0,
          price: 200,
          quality: 4,
          qualityScale: customScale,
        })
      ).toThrow(RangeError);

      // Value above custom max (25 > 20)
      expect(() =>
        calculateFrontierUtility({
          travelCost: 0,
          price: 200,
          quality: 25,
          qualityScale: customScale,
        })
      ).toThrow(RangeError);

      // In calculateFrontierMarket with quality 25
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 25 },
          restaurantB: { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 10 },
          config: { qualityScale: customScale },
        })
      ).toThrow(RangeError);

      // In calculateFrontierMarket with quality 2 (below min 5)
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 5, y: 5 }, price: 200, quality: 2 },
          restaurantB: { id: 'B', location: { x: 5, y: 5 }, price: 200, quality: 10 },
          config: { qualityScale: customScale },
        })
      ).toThrow(RangeError);
    });

    it('verifies utility calculation strictly uses gamma * quality with custom scale', () => {
      // V = 500, price = 250, gamma = 15, quality = 16, alpha = 8, travelCost = 3
      // U = 500 - 250 + 15 * 16 - 8 * 3 = 250 + 240 - 24 = 466
      const customScale = { min: 0, max: 25 };
      const utility = calculateFrontierUtility({
        travelCost: 3,
        price: 250,
        quality: 16,
        V: 500,
        alpha: 8,
        gamma: 15,
        qualityScale: customScale,
      });

      expect(utility).toBe(466);
    });
  });

  describe('17. Phase 7B: Heterogeneous Consumers & Segments', () => {
    it('directly validates the segment utility formula: U_ij^(k) = V_k - beta_k * P_j + gamma_k * Q_j - alpha_k * T_ij', () => {
      // Numerical example:
      // V = 600, beta = 1.5, price = 200, gamma = 12, quality = 8, alpha = 15, travelCost = 3
      // Expected U = 600 - 1.5 * 200 + 12 * 8 - 15 * 3 = 600 - 300 + 96 - 45 = 351
      const utility = calculateFrontierUtility({
        travelCost: 3,
        price: 200,
        quality: 8,
        V: 600,
        beta: 1.5,
        gamma: 12,
        alpha: 15,
      });

      expect(utility).toBe(351);

      // Travel cost = Infinity strictly yields -Infinity
      const unreachableUtility = calculateFrontierUtility({
        travelCost: Infinity,
        price: 200,
        quality: 8,
        V: 600,
        beta: 1.5,
        gamma: 12,
        alpha: 15,
      });
      expect(unreachableUtility).toBe(-Infinity);

      // Rejects negative beta or non-numeric beta
      expect(() =>
        calculateFrontierUtility({
          travelCost: 0,
          price: 200,
          beta: -0.5,
        })
      ).toThrow(RangeError);

      expect(() =>
        calculateFrontierUtility({
          travelCost: 0,
          price: 200,
          beta: '1.5',
        })
      ).toThrow(TypeError);
    });

    it('proves behavioral sensitivity: increasing beta, gamma, alpha increases respective sensitivity', () => {
      // 1. Beta sensitivity (price):
      // Restaurant 1 price 200 vs Restaurant 2 price 250 (gap = 50)
      const uLowBeta1 = calculateFrontierUtility({ travelCost: 0, price: 200, beta: 1 });
      const uLowBeta2 = calculateFrontierUtility({ travelCost: 0, price: 250, beta: 1 });
      const gapLowBeta = uLowBeta1 - uLowBeta2; // 50

      const uHighBeta1 = calculateFrontierUtility({ travelCost: 0, price: 200, beta: 3 });
      const uHighBeta2 = calculateFrontierUtility({ travelCost: 0, price: 250, beta: 3 });
      const gapHighBeta = uHighBeta1 - uHighBeta2; // 150

      expect(gapHighBeta).toBeGreaterThan(gapLowBeta);
      expect(gapHighBeta).toBe(150);

      // 2. Gamma sensitivity (quality):
      // Quality 4 vs Quality 8 (gap = 4)
      const uLowGamma1 = calculateFrontierUtility({ travelCost: 0, price: 200, quality: 4, gamma: 5 });
      const uLowGamma2 = calculateFrontierUtility({ travelCost: 0, price: 200, quality: 8, gamma: 5 });
      const gapLowGamma = uLowGamma2 - uLowGamma1; // 20

      const uHighGamma1 = calculateFrontierUtility({ travelCost: 0, price: 200, quality: 4, gamma: 25 });
      const uHighGamma2 = calculateFrontierUtility({ travelCost: 0, price: 200, quality: 8, gamma: 25 });
      const gapHighGamma = uHighGamma2 - uHighGamma1; // 100

      expect(gapHighGamma).toBeGreaterThan(gapLowGamma);
      expect(gapHighGamma).toBe(100);

      // 3. Alpha sensitivity (travel friction):
      // Distance 1 vs Distance 5 (gap = 4)
      const uLowAlpha1 = calculateFrontierUtility({ travelCost: 1, price: 200, alpha: 5 });
      const uLowAlpha2 = calculateFrontierUtility({ travelCost: 5, price: 200, alpha: 5 });
      const gapLowAlpha = uLowAlpha1 - uLowAlpha2; // 20

      const uHighAlpha1 = calculateFrontierUtility({ travelCost: 1, price: 200, alpha: 25 });
      const uHighAlpha2 = calculateFrontierUtility({ travelCost: 5, price: 200, alpha: 25 });
      const gapHighAlpha = uHighAlpha1 - uHighAlpha2; // 100

      expect(gapHighAlpha).toBeGreaterThan(gapLowAlpha);
      expect(gapHighAlpha).toBe(100);
    });

    it('preserves exact backward compatibility when no segments are supplied', () => {
      const restaurantA = { id: 'A', location: { x: 3, y: 3 }, price: 200, quality: 7 };
      const restaurantB = { id: 'B', location: { x: 7, y: 7 }, price: 250, quality: 9 };

      // Implicit default segments
      const defaultMarket = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
      });

      // Explicit single default segment
      const explicitMarket = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        segments: [DEFAULT_CONSUMER_SEGMENT],
      });

      expect(defaultMarket.restaurantDemand).toEqual(explicitMarket.restaurantDemand);
      expect(defaultMarket.marketShares).toEqual(explicitMarket.marketShares);
      expect(defaultMarket.reachableMarketShares).toEqual(explicitMarket.reachableMarketShares);
      expect(defaultMarket.totalPopulation).toBe(explicitMarket.totalPopulation);
      expect(defaultMarket.reachablePopulation).toBe(explicitMarket.reachablePopulation);
      expect(defaultMarket.unreachablePopulation).toBe(explicitMarket.unreachablePopulation);

      // Verify segments metadata on market output
      expect(defaultMarket.segments).toHaveLength(1);
      expect(defaultMarket.segments[0].id).toBe('general');
      expect(defaultMarket.segmentDemand.general).toEqual(defaultMarket.restaurantDemand);
      expect(defaultMarket.segmentResults.general.population).toBe(defaultMarket.totalPopulation);
    });

    it('rejects invalid segment definitions through calculateFrontierMarket', () => {
      const rA = { id: 'A', location: { x: 0, y: 0 }, price: 200 };
      const rB = { id: 'B', location: { x: 5, y: 5 }, price: 200 };

      // Empty segments array
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: rA,
          restaurantB: rB,
          segments: [],
        })
      ).toThrow(RangeError);

      // Non-array segments
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: rA,
          restaurantB: rB,
          segments: { notAnArray: true },
        })
      ).toThrow(TypeError);

      // Duplicate segment IDs
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: rA,
          restaurantB: rB,
          segments: [
            createConsumerSegment({ id: 'dupe', populationShare: 0.5 }),
            createConsumerSegment({ id: 'dupe', populationShare: 0.5 }),
          ],
        })
      ).toThrow(RangeError);

      // Population shares not summing to 1.0
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: rA,
          restaurantB: rB,
          segments: [
            createConsumerSegment({ id: 's1', populationShare: 0.3 }),
            createConsumerSegment({ id: 's2', populationShare: 0.3 }),
          ],
        })
      ).toThrow(RangeError);

      // Negative preference parameter in segment
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: rA,
          restaurantB: rB,
          segments: [
            { id: 's1', name: 'S1', populationShare: 1.0, V: 500, beta: -1, gamma: 10, alpha: 10 },
          ],
        })
      ).toThrow(RangeError);
    });

    it('proves core requirement: different consumer segments make different choices in the same zone', () => {
      // Co-located restaurants at (4, 4)
      // Restaurant A: Budget option (price = 150, quality = 3)
      // Restaurant B: Premium option (price = 300, quality = 10)
      // Difference in price: PA - PB = -150 (A is cheaper by 150)
      // Difference in quality: QA - QB = -7 (B is higher quality by 7)
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 150, quality: 3 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 300, quality: 10 };

      // Segment 1: Budget Seekers (beta = 2.0, gamma = 5)
      // UA - UB = -2(150 - 300) + 5(3 - 10) = +300 - 35 = +265 -> prefers A
      const budgetSegment = createConsumerSegment({
        id: 'budget',
        name: 'Budget Seekers',
        populationShare: 0.6,
        V: 500,
        beta: 2.0,
        gamma: 5,
        alpha: 10,
      });

      // Segment 2: Quality Seekers (beta = 0.5, gamma = 25)
      // UA - UB = -0.5(150 - 300) + 25(3 - 10) = +75 - 175 = -100 -> prefers B
      const qualitySegment = createConsumerSegment({
        id: 'quality',
        name: 'Quality Seekers',
        populationShare: 0.4,
        V: 500,
        beta: 0.5,
        gamma: 25,
        alpha: 10,
      });

      const zoneAllocation = allocateFrontierDemand({
        zone: { x: 4, y: 4, population: 100 },
        restaurantA,
        restaurantB,
        segments: [budgetSegment, qualitySegment],
      });

      // Verify overall zone split
      // Budget segment (60 pop) chooses A -> demandA = 60
      // Quality segment (40 pop) chooses B -> demandB = 40
      expect(zoneAllocation.population).toBe(100);
      expect(zoneAllocation.demandA).toBe(60);
      expect(zoneAllocation.demandB).toBe(40);
      expect(zoneAllocation.shareA).toBeCloseTo(0.6, 5);
      expect(zoneAllocation.shareB).toBeCloseTo(0.4, 5);
      expect(zoneAllocation.choice).toBe('A'); // plurality winner

      // Verify individual segment decisions within the zone
      expect(zoneAllocation.segments).toHaveLength(2);

      const [allocBudget, allocQuality] = zoneAllocation.segments;
      expect(allocBudget.segmentId).toBe('budget');
      expect(allocBudget.choice).toBe('A');
      expect(allocBudget.demandA).toBe(60);
      expect(allocBudget.demandB).toBe(0);
      expect(allocBudget.shareA).toBe(1.0);
      expect(allocBudget.shareB).toBe(0.0);
      expect(allocBudget.utilityA).toBe(500 - 2 * 150 + 5 * 3); // 215
      expect(allocBudget.utilityB).toBe(500 - 2 * 300 + 5 * 10); // -50

      expect(allocQuality.segmentId).toBe('quality');
      expect(allocQuality.choice).toBe('B');
      expect(allocQuality.demandA).toBe(0);
      expect(allocQuality.demandB).toBe(40);
      expect(allocQuality.shareA).toBe(0.0);
      expect(allocQuality.shareB).toBe(1.0);
      expect(allocQuality.utilityA).toBe(500 - 0.5 * 150 + 25 * 3); // 500
      expect(allocQuality.utilityB).toBe(500 - 0.5 * 300 + 25 * 10); // 600
    });

    it('proves convenience-sensitive consumers choose the closer restaurant despite lower quality and higher price', () => {
      // Zone at (1, 1)
      // Restaurant A at (1, 1): Distance = 0, Price = 250, Quality = 4
      // Restaurant B at (7, 7): Distance = sqrt(72) ~ 8.485, Price = 200, Quality = 8
      const restaurantA = { id: 'A', location: { x: 1, y: 1 }, price: 250, quality: 4 };
      const restaurantB = { id: 'B', location: { x: 7, y: 7 }, price: 200, quality: 8 };

      // Convenience seekers: high alpha = 40, beta = 1, gamma = 5
      // UA = 500 - 250 + 5*4 - 40*0 = 270
      // UB = 500 - 200 + 5*8 - 40*8.485 = 340 - 339.41 = 0.59 -> chooses A
      const convenienceSegment = createConsumerSegment({
        id: 'convenience',
        name: 'Convenience Seekers',
        populationShare: 0.5,
        alpha: 40,
        beta: 1.0,
        gamma: 5,
      });

      // Quality seekers: alpha = 2, beta = 1, gamma = 20
      // UA = 500 - 250 + 20*4 - 2*0 = 330
      // UB = 500 - 200 + 20*8 - 2*8.485 = 460 - 16.97 = 443.03 -> chooses B
      const qualitySegment = createConsumerSegment({
        id: 'quality',
        name: 'Quality Seekers',
        populationShare: 0.5,
        alpha: 2,
        beta: 1.0,
        gamma: 20,
      });

      const alloc = allocateFrontierDemand({
        zone: { x: 1, y: 1, population: 200 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        segments: [convenienceSegment, qualitySegment],
      });

      expect(alloc.segments[0].choice).toBe('A');
      expect(alloc.segments[0].demandA).toBe(100);
      expect(alloc.segments[1].choice).toBe('B');
      expect(alloc.segments[1].demandB).toBe(100);
      expect(alloc.demandA).toBe(100);
      expect(alloc.demandB).toBe(100);
      expect(alloc.choice).toBe('TIE');
    });

    it('allocates 50/50 within a segment when utility is exactly tied, while another segment chooses decisively', () => {
      // Co-located at (3, 3)
      // Restaurant A: Price = 200, Quality = 10
      // Restaurant B: Price = 150, Quality = 5
      // Difference: PA - PB = 50, QA - QB = 5
      const restaurantA = { id: 'A', location: { x: 3, y: 3 }, price: 200, quality: 10 };
      const restaurantB = { id: 'B', location: { x: 3, y: 3 }, price: 150, quality: 5 };

      // Segment 1 (Balanced): beta = 1, gamma = 10
      // Delta U = -1*(50) + 10*(5) = -50 + 50 = 0 -> exact tie!
      const balancedSeg = createConsumerSegment({
        id: 'balanced',
        populationShare: 0.5,
        beta: 1,
        gamma: 10,
      });

      // Segment 2 (Budget): beta = 2, gamma = 5
      // Delta U = -2*(50) + 5*(5) = -100 + 25 = -75 -> strictly prefers B
      const budgetSeg = createConsumerSegment({
        id: 'budget',
        populationShare: 0.5,
        beta: 2,
        gamma: 5,
      });

      const alloc = allocateFrontierDemand({
        zone: { x: 3, y: 3, population: 100 },
        restaurantA,
        restaurantB,
        segments: [balancedSeg, budgetSeg],
      });

      // Balanced: 50 pop splits 25 to A, 25 to B
      expect(alloc.segments[0].choice).toBe('TIE');
      expect(alloc.segments[0].demandA).toBe(25);
      expect(alloc.segments[0].demandB).toBe(25);

      // Budget: 50 pop all to B
      expect(alloc.segments[1].choice).toBe('B');
      expect(alloc.segments[1].demandA).toBe(0);
      expect(alloc.segments[1].demandB).toBe(50);

      // Total zone demand
      expect(alloc.demandA).toBe(25);
      expect(alloc.demandB).toBe(75);
    });

    it('handles unreachable restaurant topology correctly for all segments', () => {
      const restaurantA = { id: 'A', location: { x: 0, y: 0 }, price: 200, quality: 5 };
      const restaurantB = { id: 'B', location: { x: 9, y: 9 }, price: 200, quality: 10 };

      const segments = [
        createConsumerSegment({ id: 's1', populationShare: 0.4, beta: 2 }),
        createConsumerSegment({ id: 's2', populationShare: 0.6, gamma: 25 }),
      ];

      // Disconnected: Only A reachable when travelCostB = Infinity
      const choiceOnlyA = calculateZoneChoice({
        travelCostA: 2,
        travelCostB: Infinity,
        priceA: restaurantA.price,
        priceB: restaurantB.price,
        qualityA: restaurantA.quality,
        qualityB: restaurantB.quality,
      });
      expect(choiceOnlyA.choice).toBe('A');
      expect(choiceOnlyA.shareA).toBe(1.0);
      expect(choiceOnlyA.shareB).toBe(0.0);
      expect(choiceOnlyA.utilityB).toBe(-Infinity);

      // Verify allocateFrontierDemand with segments
      const allocReachable = allocateFrontierDemand({
        zone: { x: 5, y: 5, population: 100 },
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        segments,
      });
      expect(allocReachable.isReachable).toBe(true);
      expect(allocReachable.demandA + allocReachable.demandB).toBe(100);

      // Both unreachable
      const choiceNeither = calculateZoneChoice({
        travelCostA: Infinity,
        travelCostB: Infinity,
        priceA: restaurantA.price,
        priceB: restaurantB.price,
      });
      expect(choiceNeither.choice).toBe('NONE');
      expect(choiceNeither.shareA).toBe(0);
      expect(choiceNeither.shareB).toBe(0);
      expect(choiceNeither.isReachable).toBe(false);
    });

    it('strictly satisfies all conservation laws: zone, market, segment population, and demand conservation', () => {
      const restaurantA = { id: 'A', location: { x: 2, y: 2 }, price: 200, quality: 7 };
      const restaurantB = { id: 'B', location: { x: 7, y: 7 }, price: 250, quality: 9 };

      const segments = [
        createConsumerSegment({ id: 'budget', populationShare: 0.35, beta: 2.0, gamma: 5 }),
        createConsumerSegment({ id: 'quality', populationShare: 0.40, beta: 0.8, gamma: 20 }),
        createConsumerSegment({ id: 'convenience', populationShare: 0.25, alpha: 25 }),
      ];

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: barrierNetwork,
        segments,
      });

      // 1. Zone population conservation: Sum of segment populations equals cell population
      // 2. Zone demand conservation: demandA + demandB equals reachable cell population
      let sumZoneDemandsA = 0;
      let sumZoneDemandsB = 0;

      for (const alloc of market.zoneAllocations) {
        let segPopSum = 0;
        let segDemandSum = 0;
        for (const seg of alloc.segments) {
          segPopSum += seg.population;
          segDemandSum += seg.demandA + seg.demandB;
        }
        expect(segPopSum).toBeCloseTo(alloc.population, 5);

        if (alloc.isReachable) {
          expect(alloc.demandA + alloc.demandB).toBeCloseTo(alloc.population, 5);
          expect(segDemandSum).toBeCloseTo(alloc.population, 5);
        } else {
          expect(alloc.demandA).toBe(0);
          expect(alloc.demandB).toBe(0);
          expect(segDemandSum).toBe(0);
        }

        sumZoneDemandsA += alloc.demandA;
        sumZoneDemandsB += alloc.demandB;
      }

      // 3. Market demand conservation: restaurantDemandA + restaurantDemandB equals reachablePopulation
      expect(market.restaurantDemand.A).toBeCloseTo(sumZoneDemandsA, 5);
      expect(market.restaurantDemand.B).toBeCloseTo(sumZoneDemandsB, 5);
      expect(market.restaurantDemand.A + market.restaurantDemand.B).toBeCloseTo(
        market.reachablePopulation,
        5
      );

      // 4. Segment population conservation: Sum of segment populations equals totalPopulation
      let totalSegPop = 0;
      for (const segId of ['budget', 'quality', 'convenience']) {
        totalSegPop += market.segmentResults[segId].population;
      }
      expect(totalSegPop).toBeCloseTo(market.totalPopulation, 5);

      // 5. Segment demand conservation: Across segments and restaurants, total allocated equals reachable
      let totalSegAllocated = 0;
      for (const segId of ['budget', 'quality', 'convenience']) {
        totalSegAllocated +=
          market.segmentDemand[segId].A + market.segmentDemand[segId].B;
      }
      expect(totalSegAllocated).toBeCloseTo(market.reachablePopulation, 5);
    });

    it('works across different road network topologies and Euclidean mode', () => {
      const restaurantA = { id: 'A', location: { x: 1, y: 5 }, price: 200, quality: 6 };
      const restaurantB = { id: 'B', location: { x: 8, y: 5 }, price: 200, quality: 6 };

      const segments = [
        createConsumerSegment({ id: 's1', populationShare: 0.5, alpha: 5 }),
        createConsumerSegment({ id: 's2', populationShare: 0.5, alpha: 25 }),
      ];

      // Euclidean mode
      const euclideanMarket = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        segments,
      });
      expect(euclideanMarket.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
      expect(euclideanMarket.restaurantDemand.A).toBeGreaterThan(0);
      expect(euclideanMarket.restaurantDemand.B).toBeGreaterThan(0);

      // Bridge network
      const bridgeMarket = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bridgeNetwork,
        segments,
      });
      expect(bridgeMarket.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(bridgeMarket.reachablePopulation).toBe(bridgeMarket.totalPopulation);

      // Bottleneck network
      const bottleneckMarket = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bottleneckNetwork,
        segments,
      });
      expect(bottleneckMarket.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(bottleneckMarket.restaurantDemand.A).toBeGreaterThan(0);
    });

    it('preserves determinism and immutability across repeated calculations', () => {
      const restaurantA = { id: 'A', location: { x: 3, y: 3 }, price: 200, quality: 6 };
      const restaurantB = { id: 'B', location: { x: 7, y: 7 }, price: 220, quality: 8 };

      const segments = [
        createConsumerSegment({ id: 'budget', populationShare: 0.5, beta: 2 }),
        createConsumerSegment({ id: 'quality', populationShare: 0.5, gamma: 20 }),
      ];

      const input = {
        city: balancedCity,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: gridNetwork,
        segments,
      };

      const citySnapshot = JSON.stringify(balancedCity.cells);
      const rASnapshot = JSON.stringify(restaurantA);
      const segSnapshot = JSON.stringify(segments);

      const run1 = calculateFrontierMarket(input);
      const run2 = calculateFrontierMarket(input);

      // Inputs not mutated
      expect(JSON.stringify(balancedCity.cells)).toBe(citySnapshot);
      expect(JSON.stringify(restaurantA)).toBe(rASnapshot);
      expect(JSON.stringify(segments)).toBe(segSnapshot);

      // Output determinism
      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));

      // Immutability of returned objects
      expect(Object.isFrozen(run1)).toBe(true);
      expect(Object.isFrozen(run1.segmentDemand)).toBe(true);
      expect(Object.isFrozen(run1.segmentResults)).toBe(true);
      expect(Object.isFrozen(run1.segmentResults.budget)).toBe(true);
      expect(Object.isFrozen(run1.zoneAllocations[0].segments)).toBe(true);
      expect(Object.isFrozen(run1.zoneAllocations[0].segments[0])).toBe(true);
    });

    it('maintains compatibility with Phase 7A custom quality scale', () => {
      const restaurantA = { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 18 };
      const restaurantB = { id: 'B', location: { x: 4, y: 4 }, price: 200, quality: 12 };

      const segments = [
        createConsumerSegment({ id: 'q-high', populationShare: 0.5, gamma: 20 }),
        createConsumerSegment({ id: 'q-low', populationShare: 0.5, gamma: 5 }),
      ];

      const market = calculateFrontierMarket({
        city: balancedCity,
        restaurantA,
        restaurantB,
        config: { qualityScale: { min: 0, max: 20 } },
        segments,
      });

      expect(market.config.qualityScale).toEqual({ min: 0, max: 20 });
      expect(market.restaurants[0].quality).toBe(18);
      expect(market.restaurants[1].quality).toBe(12);
      expect(market.restaurantDemand.A).toBe(market.totalPopulation);
      expect(market.restaurantDemand.B).toBe(0);

      // Value exceeding custom scale still rejected
      expect(() =>
        calculateFrontierMarket({
          city: balancedCity,
          restaurantA: { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 25 },
          restaurantB,
          config: { qualityScale: { min: 0, max: 20 } },
          segments,
        })
      ).toThrow(RangeError);
    });

    it('rejects invalid frozen segment arrays in allocateFrontierDemand (validation boundary fix)', () => {
      const restaurantA = { id: 'A', location: { x: 2, y: 2 }, price: 200, quality: 5 };
      const restaurantB = { id: 'B', location: { x: 8, y: 8 }, price: 250, quality: 8 };
      const zone = { x: 4, y: 4, population: 100 };

      // 1. Frozen array containing invalid populationShare
      expect(() => {
        const invalidShareSegments = Object.freeze([
          {
            id: 'invalid-share',
            name: 'Invalid Share',
            populationShare: 2,
            V: 500,
            beta: 1,
            gamma: 10,
            alpha: 10,
          },
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: invalidShareSegments,
        });
      }).toThrow(RangeError);

      // Verify createConsumerSegment rejects populationShare: 2
      expect(() =>
        createConsumerSegment({
          id: 'invalid',
          populationShare: 2,
        })
      ).toThrow(RangeError);

      // Frozen array with shares not summing to 1.0
      expect(() => {
        const notSummingToOne = Object.freeze([
          createConsumerSegment({ id: 's1', populationShare: 0.3 }),
          createConsumerSegment({ id: 's2', populationShare: 0.3 }),
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: notSummingToOne,
        });
      }).toThrow(RangeError);

      // 2. Frozen array containing invalid preference parameters (e.g. beta: -1)
      expect(() => {
        const negativeBetaSegments = Object.freeze([
          {
            id: 'bad-beta',
            name: 'Bad Beta',
            populationShare: 1.0,
            V: 500,
            beta: -1,
            gamma: 10,
            alpha: 10,
          },
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: negativeBetaSegments,
        });
      }).toThrow(RangeError);

      // e.g. V: NaN or negative
      expect(() => {
        const badVSegments = Object.freeze([
          {
            id: 'bad-v',
            name: 'Bad V',
            populationShare: 1.0,
            V: NaN,
            beta: 1,
            gamma: 10,
            alpha: 10,
          },
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: badVSegments,
        });
      }).toThrow(TypeError);

      // e.g. gamma: 'invalid'
      expect(() => {
        const badGammaSegments = Object.freeze([
          {
            id: 'bad-gamma',
            name: 'Bad Gamma',
            populationShare: 1.0,
            V: 500,
            beta: 1,
            gamma: 'invalid',
            alpha: 10,
          },
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: badGammaSegments,
        });
      }).toThrow(TypeError);

      // e.g. alpha: Infinity
      expect(() => {
        const badAlphaSegments = Object.freeze([
          {
            id: 'bad-alpha',
            name: 'Bad Alpha',
            populationShare: 1.0,
            V: 500,
            beta: 1,
            gamma: 10,
            alpha: Infinity,
          },
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: badAlphaSegments,
        });
      }).toThrow(TypeError);

      // 3. Frozen array with duplicate IDs
      expect(() => {
        const duplicateIdSegments = Object.freeze([
          createConsumerSegment({
            id: 'segment-a',
            populationShare: 0.5,
          }),
          createConsumerSegment({
            id: 'segment-a',
            populationShare: 0.5,
          }),
        ]);
        allocateFrontierDemand({
          zone,
          restaurantA,
          restaurantB,
          segments: duplicateIdSegments,
        });
      }).toThrow(RangeError);

      // 4. Frozen valid segment array still works
      const validFrozenSegments = Object.freeze([
        createConsumerSegment({
          id: 'seg-budget',
          name: 'Budget',
          populationShare: 0.6,
          beta: 2.0,
          gamma: 5,
        }),
        createConsumerSegment({
          id: 'seg-quality',
          name: 'Quality',
          populationShare: 0.4,
          beta: 0.5,
          gamma: 25,
        }),
      ]);

      const validAllocation = allocateFrontierDemand({
        zone,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        segments: validFrozenSegments,
      });

      expect(validAllocation.population).toBe(100);
      expect(validAllocation.demandA + validAllocation.demandB).toBeCloseTo(100, 5);
      expect(validAllocation.segments).toHaveLength(2);
      expect(validAllocation.segments[0].segmentId).toBe('seg-budget');
      expect(validAllocation.segments[1].segmentId).toBe('seg-quality');
      expect(validAllocation.segments[0].population).toBeCloseTo(60, 5);
      expect(validAllocation.segments[1].population).toBeCloseTo(40, 5);

      // Also verify passing valid frozen segments via config.segments
      const configAllocation = allocateFrontierDemand({
        zone,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        config: { segments: validFrozenSegments },
      });
      expect(configAllocation.demandA).toBe(validAllocation.demandA);
      expect(configAllocation.demandB).toBe(validAllocation.demandB);
    });
  });
});



