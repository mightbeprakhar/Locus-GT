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
        expect(alloc.utilityA).toBe(alloc.utilityB + 100);
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
      // Utility = 500 - 250 - 10 * 5 = 200
      expect(alloc.utilityA).toBe(200);
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

      // Utility in road mode: 500 - 250 - 10 * 7 = 180
      expect(allocRoad.utilityA).toBe(180);
      expect(allocEuclid.utilityA).toBe(200);
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
      expect(allocBridge.utilityA).toBe(500 - 250 - 10);
      expect(allocBridge.utilityB).toBe(500 - 250 - 40);
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
      // Baseline utility
      const u = calculateFrontierUtility({ travelCost: 5, price: 200, V: 500, alpha: 10 });
      expect(u).toBe(500 - 200 - 10 * 5); // 250

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
});
