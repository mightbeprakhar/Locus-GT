/**
 * @file platformEconomics.test.js
 * @description Comprehensive unit and integration tests for Frontier Aggregator / Platform Economics Engine (Phase 8C).
 *
 * Verifies:
 * - Restaurant profit accounting: baseProfit, deliveryOperatingCost, platformCommission, finalProfit
 * - Required Tests:
 *   - TEST E: Dine-in demand is not commissioned (commission = m * P * deliveryDemand, not totalDemand)
 *   - TEST F: Consumer delivery fee is not commissioned
 *   - TEST G: Platform commission impact on profit (finalProfit = profitBeforePlatformCommission - commission)
 *   - TEST K: Phase 8B backward compatibility when platform is disabled
 *   - TEST L: Full integration across Phase 8A, Phase 8B, and Phase 8C
 *   - TEST M: Road network integration without second distance calculation
 *   - Important Experimental Property: Identical firms with asymmetric commission rates
 *   - Strategic quality compatibility with K(Q) = kappa * Q^2
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRestaurantProfitWithPlatform,
  calculateFrontierPlatformPayoff,
} from './platformEconomics.js';
import { calculateRestaurantProfitWithDelivery } from './deliveryEconomics.js';
import { createDeliveryConfig } from './delivery.js';
import { createFrontierCity, SCENARIO_IDS } from './frontierCity.js';
import { createRoadNetwork, ROAD_SCENARIO_IDS } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import { calculateQualityInvestmentCost } from './strategicQuality.js';

describe('LOCUS Frontier Engine — Phase 8C: Platform Economics', () => {
  const city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });

  describe('1. Profit Accounting & Breakdown (TEST E, F, G)', () => {
    // TEST E — DINE-IN IS NOT COMMISSIONED
    it('TEST E: charges platform commission strictly on delivery demand, never on dine-in demand', () => {
      const restaurant = {
        id: 'A',
        price: 200,
        variableCost: 100,
        fixedCost: 500,
      };

      const dineInDemand = 400;
      const deliveryDemand = 100;
      const totalDemand = 500;
      const commissionRate = 0.2;

      const report = calculateRestaurantProfitWithPlatform({
        restaurant,
        dineInDemand,
        deliveryDemand,
        totalDemand,
        deliveryTravelCost: 250,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate },
      });

      // Commission must be: 0.20 * 200 * 100 = 4,000
      expect(report.platformCommission).toBe(4000);

      // Must NOT be based on total demand (0.20 * 200 * 500 = 20,000)
      expect(report.platformCommission).not.toBe(commissionRate * restaurant.price * totalDemand);

      // Verify demands
      expect(report.dineInDemand).toBe(400);
      expect(report.deliveryDemand).toBe(100);
      expect(report.totalDemand).toBe(500);

      // deliveryOperatingCost = 20(100) + 5(250) = 3,250
      expect(report.deliveryOperatingCost).toBe(3250);

      // baseProfit = (200 - 100) * 500 - 500 = 49,500
      expect(report.baseProfit).toBe(49500);

      // profitBeforePlatformCommission = 49,500 - 3,250 = 46,250
      expect(report.profitBeforePlatformCommission).toBe(46250);

      // finalProfit = 46,250 - 4,000 = 42,250
      expect(report.finalProfit).toBe(42250);
      expect(report.finalProfit).toBe(
        report.profitBeforePlatformCommission - report.platformCommission
      );
    });

    // TEST F — DELIVERY FEE IS NOT COMMISSIONED
    it('TEST F: consumer delivery fee does not alter the commission formula', () => {
      const restaurant = {
        id: 'A',
        price: 200,
        variableCost: 100,
        fixedCost: 0,
      };

      // Even if consumer delivery fee varies, platform commission on 100 delivery orders remains 0.20 * 200 * 100 = 4,000
      const report = calculateRestaurantProfitWithPlatform({
        restaurant,
        dineInDemand: 0,
        deliveryDemand: 100,
        deliveryTravelCost: 100,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate: 0.2 },
      });

      expect(report.platformCommission).toBe(4000);
      // Not commissioned on (P + F)
      const fee = 40;
      expect(report.platformCommission).not.toBe(0.2 * (restaurant.price + fee) * 100);
    });

    // TEST G — COMMISSION IMPACT ON PROFIT
    it('TEST G: final profit is exactly profitBeforePlatformCommission - platformCommission', () => {
      const restaurant = {
        id: 'A',
        price: 200,
        variableCost: 100,
        fixedCost: 0,
      };

      const report = calculateRestaurantProfitWithPlatform({
        restaurant,
        dineInDemand: 400,
        deliveryDemand: 100,
        deliveryTravelCost: 0,
        deliveryEconomics: { baseCostPerDelivery: 0, distanceCostPerUnit: 0 },
        platform: { enabled: true, commissionRate: 0.2 },
      });

      // baseProfit = (200 - 100) * 500 = 50,000
      expect(report.baseProfit).toBe(50000);
      expect(report.profitBeforePlatformCommission).toBe(50000);
      expect(report.platformCommission).toBe(4000);
      expect(report.finalProfit).toBe(46000);
      expect(report.finalProfit).toBe(
        report.profitBeforePlatformCommission - report.platformCommission
      );
    });

    it('rejects invalid restaurant input in calculateRestaurantProfitWithPlatform', () => {
      expect(() => calculateRestaurantProfitWithPlatform(null)).toThrow(TypeError);
      expect(() =>
        calculateRestaurantProfitWithPlatform({
          restaurant: 'invalid',
        })
      ).toThrow(TypeError);
    });
  });

  describe('2. Backward Compatibility with Phase 8B (TEST K)', () => {
    // TEST K — PHASE 8B COMPATIBILITY
    it('TEST K: Phase 8C final profit equals Phase 8B final profit when platform is disabled', () => {
      const restaurant = {
        id: 'A',
        price: 250,
        quality: 6,
        variableCost: 100,
        fixedCost: 400,
      };

      const params = {
        restaurant,
        dineInDemand: 300,
        deliveryDemand: 100,
        deliveryTravelCost: 200,
        deliveryEconomics: { baseCostPerDelivery: 25, distanceCostPerUnit: 6 },
      };

      const profit8B = calculateRestaurantProfitWithDelivery(params);
      const profit8C_disabled = calculateRestaurantProfitWithPlatform({
        ...params,
        platform: { enabled: false, commissionRate: 0.25 },
      });

      expect(profit8C_disabled.platformCommission).toBe(0);
      expect(profit8C_disabled.profitBeforePlatformCommission).toBe(profit8B.finalProfit);
      expect(profit8C_disabled.finalProfit).toBe(profit8B.finalProfit);
    });

    it('defaults to platform disabled when platform config is omitted', () => {
      const restaurant = {
        id: 'A',
        price: 200,
        variableCost: 100,
        fixedCost: 300,
      };

      const profit8B = calculateRestaurantProfitWithDelivery({
        restaurant,
        dineInDemand: 200,
        deliveryDemand: 50,
        deliveryTravelCost: 100,
      });

      const profit8C_default = calculateRestaurantProfitWithPlatform({
        restaurant,
        dineInDemand: 200,
        deliveryDemand: 50,
        deliveryTravelCost: 100,
      });

      expect(profit8C_default.platformCommission).toBe(0);
      expect(profit8C_default.finalProfit).toBe(profit8B.finalProfit);
    });
  });

  describe('3. Market Integration (TEST L, M, and Asymmetric Commission Property)', () => {
    const restaurantA_base = {
      id: 'A',
      location: { x: 2, y: 2 },
      price: 200,
      quality: 6,
      variableCost: 100,
      fixedCost: 500,
      delivery: createDeliveryConfig({
        enabled: true,
        radius: 6,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      }),
    };

    const restaurantB_base = {
      id: 'B',
      location: { x: 7, y: 7 },
      price: 200,
      quality: 6,
      variableCost: 100,
      fixedCost: 500,
      delivery: createDeliveryConfig({
        enabled: true,
        radius: 6,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      }),
    };

    // TEST L — FULL INTEGRATION
    it('TEST L: executes full pipeline (Phase 8A Choice -> Phase 8B Delivery Cost -> Phase 8C Platform Commission -> Payoff)', () => {
      const payoff = calculateFrontierPlatformPayoff({
        city,
        restaurantA: restaurantA_base,
        restaurantB: restaurantB_base,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate: 0.15 },
      });

      const rA = payoff.restaurantA;
      expect(rA.deliveryDemand).toBeGreaterThan(0);
      expect(rA.deliveryOperatingCost).toBeGreaterThan(0);
      expect(rA.platformCommission).toBeCloseTo(0.15 * restaurantA_base.price * rA.deliveryDemand, 9);
      expect(rA.profitBeforePlatformCommission).toBeCloseTo(rA.baseProfit - rA.deliveryOperatingCost, 9);
      expect(rA.finalProfit).toBeCloseTo(
        rA.baseProfit - rA.deliveryOperatingCost - rA.platformCommission,
        9
      );
      expect(rA.profit).toBe(rA.finalProfit);

      const rB = payoff.restaurantB;
      expect(rB.deliveryDemand).toBeGreaterThan(0);
      expect(rB.deliveryOperatingCost).toBeGreaterThan(0);
      expect(rB.platformCommission).toBeCloseTo(0.15 * restaurantB_base.price * rB.deliveryDemand, 9);
      expect(rB.profitBeforePlatformCommission).toBeCloseTo(rB.baseProfit - rB.deliveryOperatingCost, 9);
      expect(rB.finalProfit).toBeCloseTo(
        rB.baseProfit - rB.deliveryOperatingCost - rB.platformCommission,
        9
      );
      expect(rB.profit).toBe(rB.finalProfit);
    });

    // TEST M — ROAD NETWORK
    it('TEST M: reuses Phase 8A road network delivery demands and travel costs without recomputing distance', () => {
      const roadNetwork = createRoadNetwork({
        city,
        scenario: ROAD_SCENARIO_IDS.GRID_WITH_HIGHWAYS,
      });

      const payoff = calculateFrontierPlatformPayoff({
        city,
        restaurantA: restaurantA_base,
        restaurantB: restaurantB_base,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate: 0.2 },
      });

      expect(payoff.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(payoff.restaurantA.deliveryDemand).toBeGreaterThan(0);
      expect(payoff.restaurantA.deliveryDistanceSum).toBeGreaterThan(0);
      expect(payoff.restaurantA.platformCommission).toBeCloseTo(
        0.2 * restaurantA_base.price * payoff.restaurantA.deliveryDemand,
        9
      );
    });

    // IMPORTANT EXPERIMENTAL PROPERTY
    it('IMPORTANT EXPERIMENTAL PROPERTY: identical firms with higher commission rate earn strictly lower final profit', () => {
      // Identical locations and identical configurations
      const rA = { ...restaurantA_base, location: { x: 5, y: 5 } };
      const rB = { ...restaurantB_base, location: { x: 5, y: 5 } };

      // Player A pays 10% commission, Player B pays 25% commission
      const payoff = calculateFrontierPlatformPayoff({
        city,
        restaurantA: rA,
        restaurantB: rB,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platformA: { enabled: true, commissionRate: 0.1 },
        platformB: { enabled: true, commissionRate: 0.25 },
      });

      // Because firm attributes and customer utility are identical, demands are symmetric
      expect(payoff.restaurantA.deliveryDemand).toBeCloseTo(payoff.restaurantB.deliveryDemand, 4);
      expect(payoff.restaurantA.deliveryOperatingCost).toBeCloseTo(
        payoff.restaurantB.deliveryOperatingCost,
        4
      );

      // But Firm B pays higher commission
      expect(payoff.restaurantB.platformCommission).toBeGreaterThan(
        payoff.restaurantA.platformCommission
      );

      // Therefore Firm B earns strictly lower final profit
      expect(payoff.restaurantA.finalProfit).toBeGreaterThan(payoff.restaurantB.finalProfit);
    });
  });

  describe('4. Strategic Quality Compatibility (Phase 7C)', () => {
    it('incorporates K(Q) = kappa * Q^2 alongside delivery and platform economics', () => {
      const quality = 8;
      const kappa = 25;
      const expectedInvCost = calculateQualityInvestmentCost(quality, kappa); // 1600

      const restaurant = {
        id: 'A',
        price: 300,
        quality,
        kappa,
        variableCost: 100,
        fixedCost: 500,
      };

      const report = calculateRestaurantProfitWithPlatform({
        restaurant,
        dineInDemand: 200,
        deliveryDemand: 100,
        totalDemand: 300,
        deliveryTravelCost: 150,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate: 0.2 },
      });

      // Quality investment cost
      expect(report.qualityInvestmentCost).toBe(expectedInvCost);

      // baseProfit = (300 - 100) * 300 - 500 - 1600 = 60,000 - 2100 = 57,900
      expect(report.baseProfit).toBe(57900);

      // deliveryOperatingCost = 20(100) + 5(150) = 2,750
      expect(report.deliveryOperatingCost).toBe(2750);

      // profitBeforePlatformCommission = 57,900 - 2,750 = 55,150
      expect(report.profitBeforePlatformCommission).toBe(55150);

      // platformCommission = 0.20 * 300 * 100 = 6,000
      expect(report.platformCommission).toBe(6000);

      // finalProfit = 55,150 - 6,000 = 49,150
      expect(report.finalProfit).toBe(49150);
      expect(report.finalProfit).toBe(
        (300 - 100) * 300 - 500 - expectedInvCost - 2750 - 6000
      );
    });
  });
});
