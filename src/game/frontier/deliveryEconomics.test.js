/**
 * @file deliveryEconomics.test.js
 * @description Comprehensive unit and integration tests for Frontier Delivery Economics Engine (Phase 8B).
 *
 * Verifies:
 * - Configuration validation and defaults (baseCostPerDelivery, distanceCostPerUnit)
 * - Pure delivery operating cost calculation (C_delivery = c_base * D + c_distance * sum(D * T))
 * - Edge cases: zero delivery demand, zero travel distance, zero base cost, zero distance cost, fractional demand
 * - Zone-level delivery metrics extraction and accounting invariants
 * - Restaurant profit accounting (totalDemand, dineInDemand, deliveryDemand, deliveryOperatingCost, baseProfit, finalProfit)
 * - Required Integration Tests A through G (cost zero when unused, demand scaling, distance scaling, fee vs operating cost, road network)
 * - Backward compatibility with Phase 7B / 7C when delivery is disabled or unused
 * - Strategic quality compatibility (K(Q) = kappa * Q^2 preserved in profit accounting)
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DELIVERY_BASE_COST,
  DEFAULT_DELIVERY_DISTANCE_COST,
  DEFAULT_DELIVERY_ECONOMICS_CONFIG,
  validateDeliveryEconomicsConfig,
  createDeliveryEconomicsConfig,
  calculateDeliveryOperatingCost,
  extractZoneDeliveryMetrics,
  calculateRestaurantProfitWithDelivery,
  calculateFrontierDeliveryPayoff,
} from './deliveryEconomics.js';
import { createDeliveryConfig } from './delivery.js';
import { calculateFrontierDeliveryMarket } from './deliveryChoice.js';
import { calculateFrontierPayoff } from './payoff.js';
import { createFrontierCity, SCENARIO_IDS } from './frontierCity.js';
import { createRoadNetwork, ROAD_SCENARIO_IDS } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { calculateQualityInvestmentCost } from './strategicQuality.js';

describe('LOCUS Frontier Engine — Phase 8B: Delivery Economics', () => {
  const city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });

  describe('1. Configuration & Validation', () => {
    it('defines canonical default constants', () => {
      expect(DEFAULT_DELIVERY_BASE_COST).toBe(20);
      expect(DEFAULT_DELIVERY_DISTANCE_COST).toBe(5);
      expect(DEFAULT_DELIVERY_ECONOMICS_CONFIG).toEqual({
        baseCostPerDelivery: 20,
        distanceCostPerUnit: 5,
      });
      expect(Object.isFrozen(DEFAULT_DELIVERY_ECONOMICS_CONFIG)).toBe(true);
    });

    it('validates valid configuration objects', () => {
      expect(
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 25,
          distanceCostPerUnit: 10,
        })
      ).toBe(true);

      expect(
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 0,
          distanceCostPerUnit: 0,
        })
      ).toBe(true);
    });

    it('rejects non-object configurations', () => {
      expect(() => validateDeliveryEconomicsConfig(null)).toThrow(TypeError);
      expect(() => validateDeliveryEconomicsConfig(undefined)).toThrow(TypeError);
      expect(() => validateDeliveryEconomicsConfig('invalid')).toThrow(TypeError);
      expect(() => validateDeliveryEconomicsConfig(42)).toThrow(TypeError);
    });

    it('rejects invalid baseCostPerDelivery values', () => {
      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: -1,
          distanceCostPerUnit: 5,
        })
      ).toThrow(RangeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: NaN,
          distanceCostPerUnit: 5,
        })
      ).toThrow(TypeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: Infinity,
          distanceCostPerUnit: 5,
        })
      ).toThrow(TypeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: '20',
          distanceCostPerUnit: 5,
        })
      ).toThrow(TypeError);
    });

    it('rejects invalid distanceCostPerUnit values', () => {
      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 20,
          distanceCostPerUnit: -0.5,
        })
      ).toThrow(RangeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 20,
          distanceCostPerUnit: NaN,
        })
      ).toThrow(TypeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 20,
          distanceCostPerUnit: Infinity,
        })
      ).toThrow(TypeError);

      expect(() =>
        validateDeliveryEconomicsConfig({
          baseCostPerDelivery: 20,
          distanceCostPerUnit: null,
        })
      ).toThrow(TypeError);
    });

    it('creates immutable delivery economics config with defaults and overrides', () => {
      const def = createDeliveryEconomicsConfig();
      expect(def).toEqual({
        baseCostPerDelivery: 20,
        distanceCostPerUnit: 5,
      });
      expect(Object.isFrozen(def)).toBe(true);

      const custom = createDeliveryEconomicsConfig({
        baseCostPerDelivery: 30,
        distanceCostPerUnit: 8,
      });
      expect(custom).toEqual({
        baseCostPerDelivery: 30,
        distanceCostPerUnit: 8,
      });
      expect(Object.isFrozen(custom)).toBe(true);

      const partial = createDeliveryEconomicsConfig({ baseCostPerDelivery: 15 });
      expect(partial).toEqual({
        baseCostPerDelivery: 15,
        distanceCostPerUnit: 5,
      });
    });

    it('rejects invalid overrides in createDeliveryEconomicsConfig', () => {
      expect(() => createDeliveryEconomicsConfig(null)).toThrow(TypeError);
      expect(() => createDeliveryEconomicsConfig({ baseCostPerDelivery: -10 })).toThrow(
        RangeError
      );
    });
  });

  describe('2. Pure Delivery Operating Cost Calculation', () => {
    it('matches the prompt canonical example', () => {
      // Prompt example:
      // Dine-in = 400, Delivery = 100, Distance sum = 250
      // baseCostPerDelivery = 20, distanceCostPerUnit = 5
      // Delivery operating cost = 20(100) + 5(250) = 2,000 + 1,250 = 3,250
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 100,
        deliveryTravelCost: 250,
        config: {
          baseCostPerDelivery: 20,
          distanceCostPerUnit: 5,
        },
      });

      expect(cost).toBe(3250);
    });

    it('returns zero cost when delivery demand is zero (Edge Case 1)', () => {
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 0,
        deliveryTravelCost: 150,
      });
      expect(cost).toBe(0);
    });

    it('calculates cost when travel distance is zero (Edge Case 5)', () => {
      // At zero distance, only base delivery cost applies
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 50,
        deliveryTravelCost: 0,
        config: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
      });
      expect(cost).toBe(50 * 20);
    });

    it('calculates cost when base cost is zero (Edge Case 7)', () => {
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 50,
        deliveryTravelCost: 100,
        config: { baseCostPerDelivery: 0, distanceCostPerUnit: 5 },
      });
      expect(cost).toBe(5 * 100);
    });

    it('calculates cost when distance cost is zero (Edge Case 8)', () => {
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 50,
        deliveryTravelCost: 100,
        config: { baseCostPerDelivery: 20, distanceCostPerUnit: 0 },
      });
      expect(cost).toBe(50 * 20);
    });

    it('preserves fractional demand deterministically (Edge Case 10)', () => {
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 12.5,
        deliveryTravelCost: 37.25,
        config: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
      });
      // 20 * 12.5 = 250
      // 5 * 37.25 = 186.25
      // 250 + 186.25 = 436.25
      expect(cost).toBeCloseTo(436.25, 9);
    });

    it('supports deliveryDistanceSum alias', () => {
      const cost = calculateDeliveryOperatingCost({
        deliveryDemand: 10,
        deliveryDistanceSum: 30,
        config: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
      });
      expect(cost).toBe(20 * 10 + 5 * 30);
    });

    it('rejects invalid inputs to calculateDeliveryOperatingCost (Edge Case 11)', () => {
      expect(() => calculateDeliveryOperatingCost(null)).toThrow(TypeError);
      expect(() =>
        calculateDeliveryOperatingCost({ deliveryDemand: -5, deliveryTravelCost: 10 })
      ).toThrow(RangeError);
      expect(() =>
        calculateDeliveryOperatingCost({ deliveryDemand: NaN, deliveryTravelCost: 10 })
      ).toThrow(TypeError);
      expect(() =>
        calculateDeliveryOperatingCost({ deliveryDemand: 10, deliveryTravelCost: -2 })
      ).toThrow(RangeError);
      expect(() =>
        calculateDeliveryOperatingCost({ deliveryDemand: 10, deliveryTravelCost: Infinity })
      ).toThrow(TypeError);
    });
  });

  describe('3. Metrics Extraction & Data Contract', () => {
    it('extracts metrics from zone-level records { zone, deliveryDemand, travelCost }', () => {
      const records = [
        { zone: { x: 0, y: 0 }, deliveryDemand: 20, travelCost: 1.5, dineInDemand: 80 },
        { zone: { x: 1, y: 1 }, deliveryDemand: 30, travelCost: 2.0, dineInDemand: 70 },
      ];

      const metrics = extractZoneDeliveryMetrics({
        marketResult: records,
      });

      expect(metrics.dineInDemand).toBe(150);
      expect(metrics.deliveryDemand).toBe(50);
      expect(metrics.totalDemand).toBe(200);
      // Distance sum = 20 * 1.5 + 30 * 2.0 = 30 + 60 = 90
      expect(metrics.deliveryDistanceSum).toBe(90);
    });

    it('ignores unreachable zones with zero delivery demand (Edge Case 9)', () => {
      const records = [
        { zone: { x: 0, y: 0 }, deliveryDemand: 10, travelCost: 2.0, dineInDemand: 40 },
        { zone: { x: 9, y: 9 }, deliveryDemand: 0, travelCost: Infinity, dineInDemand: 0 },
      ];

      const metrics = extractZoneDeliveryMetrics({
        marketResult: records,
      });

      expect(metrics.deliveryDemand).toBe(10);
      expect(metrics.deliveryDistanceSum).toBe(20);
    });

    it('throws RangeError if a zone has positive delivery demand but non-finite travel cost', () => {
      const records = [
        { zone: { x: 9, y: 9 }, deliveryDemand: 10, travelCost: Infinity, dineInDemand: 0 },
      ];

      expect(() =>
        extractZoneDeliveryMetrics({
          marketResult: records,
        })
      ).toThrow(RangeError);
    });
  });

  describe('4. Restaurant Profit Accounting & Breakdown', () => {
    it('correctly accounts totalDemand, dineInDemand, deliveryDemand, baseProfit, and finalProfit', () => {
      const restaurant = {
        id: 'A',
        price: 200,
        variableCost: 100,
        fixedCost: 500,
      };

      const result = calculateRestaurantProfitWithDelivery({
        restaurant,
        dineInDemand: 400,
        deliveryDemand: 100,
        deliveryTravelCost: 250,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
      });

      expect(result.restaurantId).toBe('A');
      expect(result.totalDemand).toBe(500);
      expect(result.dineInDemand).toBe(400);
      expect(result.deliveryDemand).toBe(100);
      expect(result.deliveryDistanceSum).toBe(250);

      // baseProfit = (200 - 100) * 500 - 500 = 50,000 - 500 = 49,500
      expect(result.baseProfit).toBe(49500);

      // deliveryOperatingCost = 20(100) + 5(250) = 3,250
      expect(result.deliveryOperatingCost).toBe(3250);

      // finalProfit = 49,500 - 3,250 = 46,250
      expect(result.finalProfit).toBe(46250);
      expect(result.finalProfit).toBe(result.baseProfit - result.deliveryOperatingCost);
    });

    it('rejects invalid restaurant in calculateRestaurantProfitWithDelivery', () => {
      expect(() => calculateRestaurantProfitWithDelivery(null)).toThrow(TypeError);
      expect(() =>
        calculateRestaurantProfitWithDelivery({
          restaurant: { price: 'invalid' },
        })
      ).toThrow(TypeError);
    });
  });

  describe('5. Integration Tests (Tests A through G)', () => {
    const restaurantA_base = {
      id: 'A',
      location: { x: 2, y: 2 },
      price: 200,
      quality: 6,
      variableCost: 100,
      fixedCost: 500,
    };

    const restaurantB_base = {
      id: 'B',
      location: { x: 7, y: 7 },
      price: 200,
      quality: 6,
      variableCost: 100,
      fixedCost: 500,
    };

    // TEST A — DELIVERY COST ZERO WHEN UNUSED
    it('TEST A: delivery operating cost is zero when delivery is unused or disabled', () => {
      // In this setup, delivery is disabled for both restaurants
      const rA = {
        ...restaurantA_base,
        delivery: createDeliveryConfig({ enabled: false }),
      };
      const rB = {
        ...restaurantB_base,
        delivery: createDeliveryConfig({ enabled: false }),
      };

      const payoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
      });

      expect(payoff.restaurantA.deliveryDemand).toBe(0);
      expect(payoff.restaurantA.deliveryOperatingCost).toBe(0);
      expect(payoff.restaurantA.finalProfit).toBe(payoff.restaurantA.baseProfit);

      expect(payoff.restaurantB.deliveryDemand).toBe(0);
      expect(payoff.restaurantB.deliveryOperatingCost).toBe(0);
      expect(payoff.restaurantB.finalProfit).toBe(payoff.restaurantB.baseProfit);
    });

    // TEST B — DELIVERY CREATES COST
    it('TEST B: delivery creates positive operating cost when customers choose delivery', () => {
      const rA = {
        ...restaurantA_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 6,
          fee: 0,
          baseTime: 0,
          timePerDistance: 0,
        }),
      };
      const rB = {
        ...restaurantB_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 6,
          fee: 0,
          baseTime: 0,
          timePerDistance: 0,
        }),
      };

      const payoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
      });

      expect(payoff.restaurantA.deliveryDemand).toBeGreaterThan(0);
      expect(payoff.restaurantA.deliveryOperatingCost).toBeGreaterThan(0);
      expect(payoff.restaurantA.finalProfit).toBe(
        payoff.restaurantA.baseProfit - payoff.restaurantA.deliveryOperatingCost
      );
    });

    // TEST C — MORE DELIVERY DEMAND MEANS MORE BASE COST
    it('TEST C: greater delivery demand increases operating cost by deltaD * baseCost', () => {
      const econ = { baseCostPerDelivery: 20, distanceCostPerUnit: 5 };

      // Case 1: 10 delivery orders at travel cost 3 each
      const cost10 = calculateDeliveryOperatingCost({
        deliveryDemand: 10,
        deliveryTravelCost: 10 * 3, // sum(D * T) = 30
        config: econ,
      });

      // Case 2: 20 delivery orders at same average travel cost 3 each
      const cost20 = calculateDeliveryOperatingCost({
        deliveryDemand: 20,
        deliveryTravelCost: 20 * 3, // sum(D * T) = 60
        config: econ,
      });

      // Difference should be 10 * baseCost + 30 * distanceCost
      const deltaDemand = 20 - 10;
      const expectedDiff = deltaDemand * econ.baseCostPerDelivery + 30 * econ.distanceCostPerUnit;
      expect(cost20 - cost10).toBe(expectedDiff);
    });

    // TEST D — DISTANCE MATTERS
    it('TEST D: greater aggregate delivery travel distance produces greater delivery operating cost', () => {
      const econ = { baseCostPerDelivery: 20, distanceCostPerUnit: 5 };
      const deliveryDemand = 50;

      // Scenario 1: Short distance deliveries (sum = 50)
      const costNear = calculateDeliveryOperatingCost({
        deliveryDemand,
        deliveryTravelCost: 50,
        config: econ,
      });

      // Scenario 2: Far distance deliveries (sum = 200)
      const costFar = calculateDeliveryOperatingCost({
        deliveryDemand,
        deliveryTravelCost: 200,
        config: econ,
      });

      expect(costFar).toBeGreaterThan(costNear);
      expect(costFar - costNear).toBe((200 - 50) * econ.distanceCostPerUnit);
    });

    // TEST E — PROFIT IMPACT
    it('TEST E: finalProfit strictly equals baseProfit - deliveryOperatingCost', () => {
      const rA = {
        ...restaurantA_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 20,
          baseTime: 10,
          timePerDistance: 2,
        }),
      };
      const rB = {
        ...restaurantB_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 20,
          baseTime: 10,
          timePerDistance: 2,
        }),
      };

      const payoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
        deliveryEconomics: { baseCostPerDelivery: 25, distanceCostPerUnit: 6 },
      });

      const reportA = payoff.restaurantA;
      expect(reportA.finalProfit).toBe(reportA.baseProfit - reportA.deliveryOperatingCost);
      expect(reportA.demand).toBe(reportA.dineInDemand + reportA.deliveryDemand);

      const reportB = payoff.restaurantB;
      expect(reportB.finalProfit).toBe(reportB.baseProfit - reportB.deliveryOperatingCost);
      expect(reportB.demand).toBe(reportB.dineInDemand + reportB.deliveryDemand);
    });

    // TEST F — CONSUMER FEE IS NOT RESTAURANT OPERATING COST
    it('TEST F: changing consumer delivery fee changes consumer choice but preserves cost formula', () => {
      const rA_lowFee = {
        ...restaurantA_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 0, // Free delivery -> ties with dine-in -> captures delivery demand
          baseTime: 0,
          timePerDistance: 0,
        }),
      };

      const rA_highFee = {
        ...restaurantA_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 100, // High fee -> lower delivery utility
          baseTime: 10,
          timePerDistance: 2,
        }),
      };

      const rB = {
        ...restaurantB_base,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 20,
          baseTime: 10,
          timePerDistance: 2,
        }),
      };

      const payoffLow = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA_lowFee,
        restaurantB: rB,
      });

      const payoffHigh = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA_highFee,
        restaurantB: rB,
      });

      // Consumer demand responds to consumer-facing fee
      expect(payoffLow.restaurantA.deliveryDemand).toBeGreaterThan(
        payoffHigh.restaurantA.deliveryDemand
      );

      // But for any hypothetical given demand and distance, the cost formula parameters are identical
      const testDemand = 40;
      const testDist = 80;
      const costLowFormula = calculateDeliveryOperatingCost({
        deliveryDemand: testDemand,
        deliveryTravelCost: testDist,
        config: DEFAULT_DELIVERY_ECONOMICS_CONFIG,
      });
      const costHighFormula = calculateDeliveryOperatingCost({
        deliveryDemand: testDemand,
        deliveryTravelCost: testDist,
        config: DEFAULT_DELIVERY_ECONOMICS_CONFIG,
      });
      expect(costLowFormula).toBe(costHighFormula);
      expect(costLowFormula).toBe(20 * 40 + 5 * 80);
    });

    // TEST G — ROAD NETWORK INTEGRATION
    it('TEST G: uses road-network travel costs from Phase 8A without second distance calculation', () => {
      const roadNetwork = createRoadNetwork({
        city,
        scenario: ROAD_SCENARIO_IDS.GRID_WITH_HIGHWAYS,
      });

      const rA = {
        ...restaurantA_base,
        location: { x: 0, y: 0 },
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 10,
          fee: 20,
          baseTime: 5,
          timePerDistance: 1,
        }),
      };

      const rB = {
        ...restaurantB_base,
        location: { x: 9, y: 9 },
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 10,
          fee: 20,
          baseTime: 5,
          timePerDistance: 1,
        }),
      };

      // 1. Run Phase 8A market on road network directly
      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA: rA,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork,
      });

      // 2. Compute manually from Phase 8A zoneAllocations
      let manualDistanceSumA = 0;
      for (const alloc of market.zoneAllocations) {
        if (alloc.deliveryDemandA > 0) {
          manualDistanceSumA += alloc.deliveryDemandA * alloc.travelCostA;
        }
      }

      // 3. Run Phase 8B delivery payoff engine
      const payoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork,
      });

      expect(payoff.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(payoff.restaurantA.deliveryDistanceSum).toBeCloseTo(manualDistanceSumA, 9);
      expect(payoff.restaurantA.deliveryOperatingCost).toBeCloseTo(
        20 * payoff.restaurantA.deliveryDemand + 5 * manualDistanceSumA,
        9
      );
    });
  });

  describe('6. Strategic Quality Compatibility (Phase 7C)', () => {
    it('includes quality investment cost K(Q) = kappa * Q^2 in profit accounting', () => {
      const quality = 8;
      const kappa = 25;
      const expectedInvestmentCost = calculateQualityInvestmentCost(quality, kappa); // 25 * 64 = 1600

      const restaurant = {
        id: 'A',
        price: 250,
        quality,
        kappa,
        variableCost: 100,
        fixedCost: 200,
      };

      const report = calculateRestaurantProfitWithDelivery({
        restaurant,
        dineInDemand: 300,
        deliveryDemand: 100,
        deliveryTravelCost: 150,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
      });

      expect(report.qualityInvestmentCost).toBe(expectedInvestmentCost);

      // baseProfit = (P - C) * D - F - K(Q)
      // = (250 - 100) * 400 - 200 - 1600 = 60,000 - 200 - 1600 = 58,200
      expect(report.baseProfit).toBe(58200);

      // deliveryOperatingCost = 20(100) + 5(150) = 2,000 + 750 = 2,750
      expect(report.deliveryOperatingCost).toBe(2750);

      // finalProfit = 58,200 - 2,750 = 55,450
      expect(report.finalProfit).toBe(55450);
      expect(report.finalProfit).toBe(
        (250 - 100) * 400 - 200 - expectedInvestmentCost - report.deliveryOperatingCost
      );
    });

    it('works with calculateFrontierDeliveryPayoff for strategic quality restaurants', () => {
      const rA = {
        id: 'A',
        location: { x: 2, y: 2 },
        price: 250,
        quality: 6,
        kappa: 25,
        delivery: createDeliveryConfig({ enabled: true, radius: 5, fee: 30 }),
      };

      const rB = {
        id: 'B',
        location: { x: 7, y: 7 },
        price: 250,
        quality: 4,
        kappa: 25,
        delivery: createDeliveryConfig({ enabled: true, radius: 5, fee: 30 }),
      };

      const payoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
        kappa: 25,
      });

      expect(payoff.restaurantA.qualityInvestmentCost).toBe(25 * 36); // 900
      expect(payoff.restaurantB.qualityInvestmentCost).toBe(25 * 16); // 400

      expect(payoff.restaurantA.finalProfit).toBe(
        payoff.restaurantA.baseProfit - payoff.restaurantA.deliveryOperatingCost
      );
      expect(payoff.restaurantB.finalProfit).toBe(
        payoff.restaurantB.baseProfit - payoff.restaurantB.deliveryOperatingCost
      );
    });
  });

  describe('7. Backward Compatibility with Phase 7B / 7C', () => {
    it('reduces exactly to calculateFrontierPayoff when delivery is disabled', () => {
      const rA = {
        id: 'A',
        location: { x: 1, y: 1 },
        price: 200,
        quality: 6,
        variableCost: 100,
        fixedCost: 300,
        delivery: createDeliveryConfig({ enabled: false }),
      };

      const rB = {
        id: 'B',
        location: { x: 6, y: 6 },
        price: 220,
        quality: 8,
        variableCost: 100,
        fixedCost: 300,
        delivery: createDeliveryConfig({ enabled: false }),
      };

      // Frontier standard payoff (Phase 7B baseline)
      const standardPayoff = calculateFrontierPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
      });

      // Frontier delivery payoff with delivery disabled
      const deliveryPayoff = calculateFrontierDeliveryPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
      });

      expect(deliveryPayoff.restaurantA.deliveryDemand).toBe(0);
      expect(deliveryPayoff.restaurantA.deliveryOperatingCost).toBe(0);
      expect(deliveryPayoff.restaurantA.demand).toBeCloseTo(standardPayoff.restaurantA.demand, 9);
      expect(deliveryPayoff.restaurantA.finalProfit).toBeCloseTo(
        standardPayoff.restaurantA.profit,
        9
      );

      expect(deliveryPayoff.restaurantB.deliveryDemand).toBe(0);
      expect(deliveryPayoff.restaurantB.deliveryOperatingCost).toBe(0);
      expect(deliveryPayoff.restaurantB.demand).toBeCloseTo(standardPayoff.restaurantB.demand, 9);
      expect(deliveryPayoff.restaurantB.finalProfit).toBeCloseTo(
        standardPayoff.restaurantB.profit,
        9
      );
    });
  });
});
