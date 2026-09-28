/**
 * @file game.test.js
 * @description Comprehensive Vitest test suite for Phase 1 of LOCUS Game Theory Engine.
 */

import { describe, it, expect } from 'vitest';
import { distance, calculateUtility } from './utility.js';
import { chooseRestaurant, calculateDemand } from './consumers.js';
import { calculateProfit, calculatePayoffs } from './payoff.js';
import {
  createCell,
  createCity,
  createDefaultCity,
  createUniformCity,
  getTotalPopulation,
} from './city.js';
import {
  validateLocation,
  validatePrice,
  validateStrategy,
  generateStrategySpace,
} from './strategies.js';
import {
  DEFAULT_GRID,
  DEFAULT_ALLOWED_PRICES,
  DEFAULT_PARAMS,
} from './types.js';

describe('LOCUS Game Theory Engine — Phase 1 Test Suite', () => {
  // TEST 1 — Distance
  describe('TEST 1 — Distance', () => {
    it('computes Euclidean distance = 5 for points (0,0) and (3,4)', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      const d = distance(p1, p2);
      expect(d).toBe(5);

      // Also verify 4-number overload
      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    it('returns 0 for identical points', () => {
      expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    it('throws error for invalid coordinates', () => {
      expect(() => distance(null, { x: 1, y: 2 })).toThrow(TypeError);
    });
  });

  // TEST 2 — Same location
  describe('TEST 2 — Same location and same price', () => {
    it('results in equal utilities and a 50/50 customer split', () => {
      const consumer = { x: 2, y: 3, population: 100 };
      const restaurantA = { id: 'A', x: 5, y: 5, price: 200, variableCost: 100 };
      const restaurantB = { id: 'B', x: 5, y: 5, price: 200, variableCost: 100 };

      const uA = calculateUtility(consumer, restaurantA);
      const uB = calculateUtility(consumer, restaurantB);

      // Utilities must be equal
      expect(uA).toBe(uB);

      // Choice must be TIE and shares split equally
      const choice = chooseRestaurant(consumer, restaurantA, restaurantB);
      expect(choice.choice).toBe('TIE');
      expect(choice.shareA).toBe(0.5);
      expect(choice.shareB).toBe(0.5);

      // Across the city, demand must split equally
      const city = createUniformCity(10, 10, 100);
      const demandResult = calculateDemand(city, restaurantA, restaurantB);
      expect(demandResult.demandA).toBe(5000);
      expect(demandResult.demandB).toBe(5000);
      expect(demandResult.demandA + demandResult.demandB).toBe(demandResult.totalPopulation);
    });
  });

  // TEST 3 — Price difference
  describe('TEST 3 — Price difference', () => {
    it('favors cheaper restaurant A when location and travel distance are identical', () => {
      const consumer = { x: 4, y: 4, population: 100 };
      const restaurantA = { id: 'A', x: 5, y: 5, price: 150, variableCost: 100 };
      const restaurantB = { id: 'B', x: 5, y: 5, price: 250, variableCost: 100 };

      const uA = calculateUtility(consumer, restaurantA);
      const uB = calculateUtility(consumer, restaurantB);

      expect(uA).toBeGreaterThan(uB);
      expect(uA - uB).toBe(100); // Exact price difference

      const choice = chooseRestaurant(consumer, restaurantA, restaurantB);
      expect(choice.choice).toBe('A');
      expect(choice.shareA).toBe(1.0);
      expect(choice.shareB).toBe(0.0);
    });
  });

  // TEST 4 — Distance difference
  describe('TEST 4 — Distance difference', () => {
    it('favors closer restaurant A when prices are identical', () => {
      const consumer = { x: 0, y: 0, population: 100 };
      // A is at (0, 2), distance = 2
      const restaurantA = { id: 'A', x: 0, y: 2, price: 200, variableCost: 100 };
      // B is at (0, 6), distance = 6
      const restaurantB = { id: 'B', x: 0, y: 6, price: 200, variableCost: 100 };

      const uA = calculateUtility(consumer, restaurantA);
      const uB = calculateUtility(consumer, restaurantB);

      expect(uA).toBeGreaterThan(uB);

      const choice = chooseRestaurant(consumer, restaurantA, restaurantB);
      expect(choice.choice).toBe('A');
      expect(choice.shareA).toBe(1.0);
      expect(choice.shareB).toBe(0.0);
    });
  });

  // TEST 5 — Price vs distance
  describe('TEST 5 — Price vs distance', () => {
    it('strictly follows the utility equation when cheaper restaurant is farther away', () => {
      // Setup:
      // consumer at (0, 0), V = 500, alpha = 10
      // Restaurant A (closer, more expensive):
      //   loc = (0, 3) => distance = 3
      //   price = 250
      //   U_A = 500 - 250 - (10 * 3) = 500 - 250 - 30 = 220
      //
      // Restaurant B (farther, cheaper):
      //   loc = (0, 6) => distance = 6
      //   price = 200
      //   U_B = 500 - 200 - (10 * 6) = 500 - 200 - 60 = 240
      //
      // Here: U_B (240) > U_A (220), so Restaurant B wins despite being farther!
      const consumer = { x: 0, y: 0 };
      const config = { V: 500, alpha: 10 };

      const restaurantA = { id: 'A', x: 0, y: 3, price: 250, variableCost: 100 };
      const restaurantB = { id: 'B', x: 0, y: 6, price: 200, variableCost: 100 };

      const uA = calculateUtility(consumer, restaurantA, config);
      const uB = calculateUtility(consumer, restaurantB, config);

      expect(uA).toBe(220);
      expect(uB).toBe(240);
      expect(uB).toBeGreaterThan(uA);

      const choice1 = chooseRestaurant(consumer, restaurantA, restaurantB, config);
      expect(choice1.choice).toBe('B');

      // Now reverse the dominance by increasing travel sensitivity alpha to 20:
      // U_A = 500 - 250 - (20 * 3) = 190
      // U_B = 500 - 200 - (20 * 6) = 180
      // Here: U_A (190) > U_B (180), so Restaurant A wins because travel cost penalty is higher!
      const highAlphaConfig = { V: 500, alpha: 20 };
      const uA_high = calculateUtility(consumer, restaurantA, highAlphaConfig);
      const uB_high = calculateUtility(consumer, restaurantB, highAlphaConfig);

      expect(uA_high).toBe(190);
      expect(uB_high).toBe(180);
      expect(uA_high).toBeGreaterThan(uB_high);

      const choice2 = chooseRestaurant(consumer, restaurantA, restaurantB, highAlphaConfig);
      expect(choice2.choice).toBe('A');
    });
  });

  // TEST 6 — Demand conservation
  describe('TEST 6 — Demand conservation', () => {
    it('ensures demandA + demandB === totalPopulation for any valid configuration', () => {
      const cityUniform = createUniformCity(10, 10, 100);
      const cityNonUniform = createDefaultCity();

      const testConfigurations = [
        {
          A: { id: 'A', x: 0, y: 0, price: 150, variableCost: 100 },
          B: { id: 'B', x: 9, y: 9, price: 350, variableCost: 100 },
        },
        {
          A: { id: 'A', x: 4, y: 4, price: 200, variableCost: 100 },
          B: { id: 'B', x: 5, y: 5, price: 200, variableCost: 100 },
        },
        {
          A: { id: 'A', x: 2, y: 7, price: 300, variableCost: 100 },
          B: { id: 'B', x: 7, y: 2, price: 250, variableCost: 100 },
        },
      ];

      for (const city of [cityUniform, cityNonUniform]) {
        for (const config of testConfigurations) {
          const res = calculateDemand(city, config.A, config.B);
          expect(res.demandA + res.demandB).toBe(res.totalPopulation);
          expect(res.totalPopulation).toBe(city.totalPopulation);
        }
      }
    });
  });

  // TEST 7 — Profit
  describe('TEST 7 — Profit', () => {
    it('computes (250 - 100) * 200 = 30000', () => {
      const restaurant = { price: 250, variableCost: 100 };
      const demand = 200;
      const profit = calculateProfit(restaurant, demand);

      expect(profit).toBe(30000);
    });

    it('accounts for optional fixed cost without breaking Phase 1 default', () => {
      const restaurant = { price: 250, variableCost: 100, fixedCost: 5000 };
      const demand = 200;
      const profit = calculateProfit(restaurant, demand);

      expect(profit).toBe(25000);
    });
  });

  // TEST 8 — Negative profit
  describe('TEST 8 — Negative profit', () => {
    it('computes (80 - 100) * 200 = -4000 without clamping to zero', () => {
      const restaurant = { price: 80, variableCost: 100 };
      const demand = 200;
      const profit = calculateProfit(restaurant, demand);

      expect(profit).toBe(-4000);
      expect(profit).toBeLessThan(0);
    });
  });

  // TEST 9 — Invalid strategy
  describe('TEST 9 — Invalid strategy validation', () => {
    it('rejects invalid locations outside grid bounds', () => {
      expect(validateLocation({ x: -1, y: 0 })).toBe(false);
      expect(validateLocation({ x: 0, y: -1 })).toBe(false);
      expect(validateLocation({ x: 10, y: 0 })).toBe(false); // grid is 0..9
      expect(validateLocation({ x: 0, y: 10 })).toBe(false);
      expect(validateLocation({ x: 3.5, y: 4 })).toBe(false); // non-integer
      expect(validateLocation(null)).toBe(false);
      expect(validateLocation({ x: 0 })).toBe(false);

      // Valid boundary locations
      expect(validateLocation({ x: 0, y: 0 })).toBe(true);
      expect(validateLocation({ x: 9, y: 9 })).toBe(true);
    });

    it('rejects prices outside allowed discrete set [150, 200, 250, 300, 350]', () => {
      expect(validatePrice(100)).toBe(false);
      expect(validatePrice(175)).toBe(false);
      expect(validatePrice(400)).toBe(false);
      expect(validatePrice(NaN)).toBe(false);
      expect(validatePrice(null)).toBe(false);

      DEFAULT_ALLOWED_PRICES.forEach((price) => {
        expect(validatePrice(price)).toBe(true);
      });
    });

    it('validates canonical strategies containing only location and price', () => {
      expect(validateStrategy({ location: { x: 5, y: 5 }, price: 250 })).toBe(true);
      expect(validateStrategy({ location: { x: 0, y: 0 }, price: 150 })).toBe(true);
      expect(validateStrategy({ location: { x: 9, y: 9 }, price: 350 })).toBe(true);
    });

    it('rejects duplicate or inconsistent x/y + location representations', () => {
      // Inconsistent conflicting coordinates
      expect(
        validateStrategy({
          x: 2,
          y: 3,
          location: { x: 7, y: 8 },
          price: 250,
        })
      ).toBe(false);

      // Duplicate matching coordinates
      expect(
        validateStrategy({
          x: 5,
          y: 5,
          location: { x: 5, y: 5 },
          price: 250,
        })
      ).toBe(false);

      // Legacy flat x, y representation without location object
      expect(validateStrategy({ x: 5, y: 5, price: 250 })).toBe(false);
      expect(validateStrategy({ x: -1, y: 5, price: 200 })).toBe(false);
    });

    it('rejects invalid canonical strategies', () => {
      expect(validateStrategy({ location: { x: -1, y: 5 }, price: 200 })).toBe(false);
      expect(validateStrategy({ location: { x: 5, y: 5 }, price: 999 })).toBe(false);
      expect(validateStrategy({ location: null, price: 250 })).toBe(false);
      expect(validateStrategy({ location: { x: 5, y: 5 } })).toBe(false); // missing price
      expect(validateStrategy({ price: 250 })).toBe(false); // missing location
      expect(validateStrategy(null)).toBe(false);
      expect(validateStrategy('strategy')).toBe(false);
    });
  });

  // TEST 10 — Strategy space
  describe('TEST 10 — Strategy space cardinality, validity, and canonical representation', () => {
    it('generates exactly 100 * 5 = 500 valid strategies for 10x10 grid and 5 prices', () => {
      const space = generateStrategySpace(DEFAULT_GRID, DEFAULT_ALLOWED_PRICES);

      expect(space).toHaveLength(500);

      // Verify every strategy is valid
      for (const s of space) {
        expect(validateStrategy(s, DEFAULT_GRID, DEFAULT_ALLOWED_PRICES)).toBe(true);
      }

      // Verify uniqueness (no duplicate combinations of (x, y, price))
      const signatures = new Set(
        space.map((s) => `${s.location.x},${s.location.y},${s.price}`)
      );
      expect(signatures.size).toBe(500);
    });

    it('ensures every generated strategy conforms strictly to canonical representation', () => {
      const space = generateStrategySpace(DEFAULT_GRID, DEFAULT_ALLOWED_PRICES);

      for (const s of space) {
        // Must contain only 'location' and 'price' at the root level
        const rootKeys = Object.keys(s).sort();
        expect(rootKeys).toEqual(['location', 'price']);

        // No top-level x or y
        expect(s.x).toBeUndefined();
        expect(s.y).toBeUndefined();

        // Location must contain only 'x' and 'y'
        const locationKeys = Object.keys(s.location).sort();
        expect(locationKeys).toEqual(['x', 'y']);

        // Types
        expect(typeof s.location.x).toBe('number');
        expect(typeof s.location.y).toBe('number');
        expect(typeof s.price).toBe('number');
      }
    });
  });

  // Additional tests: city generation and payoffs
  describe('City Generation & Payoffs integration', () => {
    it('creates deterministic default city with non-uniform population', () => {
      const city = createDefaultCity();
      expect(city.width).toBe(10);
      expect(city.height).toBe(10);
      expect(city.cells).toHaveLength(100);

      // Center should have higher population than corner
      const centerCell = city.cells.find((c) => c.x === 5 && c.y === 5);
      const cornerCell = city.cells.find((c) => c.x === 0 && c.y === 0);
      expect(centerCell.population).toBeGreaterThan(cornerCell.population);

      // Total population must match sum of cells
      expect(city.totalPopulation).toBe(getTotalPopulation(city.cells));
    });

    it('creates individual cells with validation', () => {
      const cell = createCell(2, 3, 150);
      expect(cell).toEqual({ x: 2, y: 3, population: 150 });
      expect(() => createCell('a', 2, 100)).toThrow(TypeError);
      expect(() => createCell(2, 3, -10)).toThrow(RangeError);
    });

    it('creates customized city grids using createCity', () => {
      const customCity = createCity(5, 5, (x, y) => (x + y) * 10);
      expect(customCity.width).toBe(5);
      expect(customCity.height).toBe(5);
      expect(customCity.cells).toHaveLength(25);
      expect(customCity.totalPopulation).toBe(getTotalPopulation(customCity.cells));
    });

    it('verifies default economic parameters match specification', () => {
      expect(DEFAULT_PARAMS.V).toBe(500);
      expect(DEFAULT_PARAMS.alpha).toBe(10);
    });

    it('calculates full game payoffs correctly', () => {
      const city = createUniformCity(10, 10, 100); // 10,000 total pop
      const restaurantA = {
        id: 'A',
        x: 0,
        y: 0,
        price: 200,
        variableCost: 100,
      };
      const restaurantB = {
        id: 'B',
        x: 0,
        y: 0,
        price: 200,
        variableCost: 100,
      };

      const payoffs = calculatePayoffs(city, restaurantA, restaurantB);

      expect(payoffs.demandA).toBe(5000);
      expect(payoffs.demandB).toBe(5000);
      expect(payoffs.profitA).toBe((200 - 100) * 5000);
      expect(payoffs.profitB).toBe((200 - 100) * 5000);
      expect(payoffs.totalPopulation).toBe(10000);
    });
  });
});
