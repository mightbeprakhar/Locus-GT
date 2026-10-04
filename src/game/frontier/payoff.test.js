/**
 * @file payoff.test.js
 * @description Comprehensive unit and mathematical validation tests for Frontier payoff engine.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateFrontierProfit,
  calculateFrontierPayoff,
  calculateFrontierProfilePayoffs,
} from './payoff.js';
import { createFrontierCity, SCENARIO_IDS, getFrontierCityStats } from './frontierCity.js';
import { createRoadNetwork, ROAD_SCENARIO_IDS } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';

describe('LOCUS Frontier Engine — Phase 6E: Payoff Engine', () => {
  const cityBalanced = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
  const cityBalancedStats = getFrontierCityStats(cityBalanced);
  const roadGrid = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

  describe('calculateFrontierProfit', () => {
    it('applies the standard economic profit equation: (P - C) * D - F', () => {
      // P = 200, C = 100, D = 50, F = 0 => (200 - 100) * 50 = 5000
      const profit = calculateFrontierProfit({ price: 200 }, 50);
      expect(profit).toBe(5000);
    });

    it('uses default variableCost = 100 and fixedCost = 0', () => {
      const profit = calculateFrontierProfit({ price: 250 }, 100);
      expect(profit).toBe((250 - 100) * 100 - 0); // 15000
    });

    it('allows custom variableCost and fixedCost from restaurant object or overrides', () => {
      const r = { price: 300, variableCost: 120, fixedCost: 500 };
      expect(calculateFrontierProfit(r, 10)).toBe((300 - 120) * 10 - 500); // 1800 - 500 = 1300

      // Overrides
      expect(calculateFrontierProfit(r, 10, 200, 150)).toBe((300 - 150) * 10 - 200); // 1500 - 200 = 1300
    });

    it('allows negative profit when price is below cost or fixed costs dominate', () => {
      // Variable cost 150 > price 120
      const negativeProfit = calculateFrontierProfit({ price: 120, variableCost: 150 }, 10);
      expect(negativeProfit).toBe(-300);

      // Fixed cost dominance
      const fixedLoss = calculateFrontierProfit({ price: 200, variableCost: 100, fixedCost: 10000 }, 10);
      expect(fixedLoss).toBe((200 - 100) * 10 - 10000); // 1000 - 10000 = -9000
    });

    it('throws on invalid inputs', () => {
      expect(() => calculateFrontierProfit(null, 10)).toThrow(TypeError);
      expect(() => calculateFrontierProfit({ price: NaN }, 10)).toThrow(TypeError);
      expect(() => calculateFrontierProfit({ price: 200 }, NaN)).toThrow(TypeError);
    });
  });

  describe('calculateFrontierPayoff', () => {
    it('computes payoffs, demand, and market share for symmetric restaurants under Euclidean mode', () => {
      const rA = { id: 'A', location: { x: 2, y: 5 }, price: 200 };
      const rB = { id: 'B', location: { x: 7, y: 5 }, price: 200 };

      const outcome = calculateFrontierPayoff({
        city: cityBalanced,
        restaurantA: rA,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(outcome.restaurantA.demand).toBeGreaterThan(0);
      expect(outcome.restaurantB.demand).toBeGreaterThan(0);
      expect(outcome.restaurantA.demand + outcome.restaurantB.demand).toBeCloseTo(outcome.totalPopulation, 5);

      // Profit = (200 - 100) * demand
      expect(outcome.restaurantA.profit).toBeCloseTo(100 * outcome.restaurantA.demand, 5);
      expect(outcome.restaurantB.profit).toBeCloseTo(100 * outcome.restaurantB.demand, 5);

      expect(outcome.restaurantA.marketShare + outcome.restaurantB.marketShare).toBeCloseTo(1.0, 5);
      expect(outcome.totalPopulation).toBe(cityBalancedStats.totalPopulation);
      expect(outcome.reachablePopulation).toBe(cityBalancedStats.totalPopulation);
      expect(outcome.unreachablePopulation).toBe(0);
      expect(outcome.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
    });

    it('supports strategic profile inputs via strategyA and strategyB', () => {
      const strategyA = { location: { x: 0, y: 0 }, price: 250 };
      const strategyB = { location: { x: 9, y: 9 }, price: 300 };

      const outcome = calculateFrontierProfilePayoffs({
        city: cityBalanced,
        strategyA,
        strategyB,
      });

      expect(outcome.restaurantA.id).toBe('A');
      expect(outcome.restaurantB.id).toBe('B');
      expect(outcome.restaurantA.profit).toBeCloseTo((250 - 100) * outcome.restaurantA.demand, 5);
      expect(outcome.restaurantB.profit).toBeCloseTo((300 - 100) * outcome.restaurantB.demand, 5);
    });

    it('computes payoffs with road network travel cost mode', () => {
      const rA = { id: 'A', location: { x: 4, y: 4 }, price: 200 };
      const rB = { id: 'B', location: { x: 5, y: 5 }, price: 200 };

      const outcome = calculateFrontierPayoff({
        city: cityBalanced,
        restaurantA: rA,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: roadGrid,
      });

      expect(outcome.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(outcome.restaurantA.demand).toBeGreaterThan(0);
      expect(outcome.restaurantB.demand).toBeGreaterThan(0);
      expect(outcome.restaurantA.profit).toBeCloseTo((200 - 100) * outcome.restaurantA.demand, 5);
    });

    it('price differentiation affects demand and profit', () => {
      // Co-located restaurants: cheaper restaurant captures entire market
      const rA = { id: 'A', location: { x: 5, y: 5 }, price: 200 };
      const rB = { id: 'B', location: { x: 5, y: 5 }, price: 250 };

      const outcome = calculateFrontierPayoff({
        city: cityBalanced,
        restaurantA: rA,
        restaurantB: rB,
      });

      expect(outcome.restaurantA.demand).toBe(outcome.totalPopulation);
      expect(outcome.restaurantB.demand).toBe(0);
      expect(outcome.restaurantA.profit).toBeCloseTo((200 - 100) * outcome.totalPopulation, 5);
      expect(outcome.restaurantB.profit).toBe(0);
    });

    it('rejects road mode without a road network', () => {
      expect(() => {
        calculateFrontierPayoff({
          city: cityBalanced,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: 200 },
          restaurantB: { id: 'B', location: { x: 9, y: 9 }, price: 200 },
          mode: TRAVEL_COST_MODES.ROAD,
        });
      }).toThrow(TypeError);
    });

    it('rejects invalid travel modes', () => {
      expect(() => {
        calculateFrontierPayoff({
          city: cityBalanced,
          restaurantA: { id: 'A', location: { x: 0, y: 0 }, price: 200 },
          restaurantB: { id: 'B', location: { x: 9, y: 9 }, price: 200 },
          mode: 'teleportation',
        });
      }).toThrow(RangeError);
    });

    it('preserves immutability of returned outcome', () => {
      const outcome = calculateFrontierPayoff({
        city: cityBalanced,
        restaurantA: { id: 'A', location: { x: 1, y: 1 }, price: 200 },
        restaurantB: { id: 'B', location: { x: 8, y: 8 }, price: 200 },
      });

      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Object.isFrozen(outcome.restaurantA)).toBe(true);
      expect(Object.isFrozen(outcome.restaurantB)).toBe(true);
    });
  });
});
