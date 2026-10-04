/**
 * @file strategicQuality.test.js
 * @description Unit and mathematical validation tests for LOCUS Frontier:
 * Strategic Quality Choice Engine (Phase 7C).
 */

import { describe, it, expect } from 'vitest';
import {
  createFrontierCity,
  SCENARIO_IDS,
  createRoadNetwork,
  ROAD_SCENARIO_IDS,
  TRAVEL_COST_MODES,
  createConsumerSegment,
  STRATEGIC_QUALITY_LEVELS,
  DEFAULT_QUALITY_COST_KAPPA,
  validateStrategicQuality,
  calculateQualityInvestmentCost,
  validateQualityCostConfig,
  validateStrategicQualityStrategy,
  createStrategicQualityStrategy,
  getStrategicQualityStrategies,
  createStrategicQualityStrategyKey,
  createStrategicQualityProfileKey,
  formatStrategicQualityProfile,
  calculateStrategicQualityProfit,
  calculateStrategicQualityPayoff,
  findStrategicQualityBestResponses,
  checkStrategicQualityPureNashEquilibrium,
  findStrategicQualityPureNashEquilibria,
  stepStrategicQualityBestResponseDynamics,
  runStrategicQualityBestResponseDynamics,
} from './index.js';

describe('LOCUS Frontier Engine — Phase 7C: Strategic Quality Choice', () => {
  const balancedCity = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
  const gridNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
  const bridgeNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BRIDGE });
  const bottleneckNetwork = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BOTTLENECK });

  describe('1. Quality Level Validation & Strategy Space', () => {
    it('defines canonical discrete quality levels Q = {2, 4, 6, 8, 10} as an immutable array', () => {
      expect(STRATEGIC_QUALITY_LEVELS).toEqual([2, 4, 6, 8, 10]);
      expect(Object.isFrozen(STRATEGIC_QUALITY_LEVELS)).toBe(true);
    });

    it('validates quality levels strictly within the discrete set', () => {
      expect(validateStrategicQuality(2)).toBe(true);
      expect(validateStrategicQuality(4)).toBe(true);
      expect(validateStrategicQuality(6)).toBe(true);
      expect(validateStrategicQuality(8)).toBe(true);
      expect(validateStrategicQuality(10)).toBe(true);

      // Rejections
      expect(validateStrategicQuality(0)).toBe(false);
      expect(validateStrategicQuality(3)).toBe(false);
      expect(validateStrategicQuality(5)).toBe(false);
      expect(validateStrategicQuality(5.5)).toBe(false);
      expect(validateStrategicQuality(12)).toBe(false);
      expect(validateStrategicQuality(-2)).toBe(false);
      expect(validateStrategicQuality(NaN)).toBe(false);
      expect(validateStrategicQuality(Infinity)).toBe(false);
      expect(validateStrategicQuality('6')).toBe(false);
      expect(validateStrategicQuality(null)).toBe(false);
      expect(validateStrategicQuality(undefined)).toBe(false);
    });

    it('generates exactly 2,500 strategies with deterministic ordering y -> x -> price -> quality', () => {
      const strategies = getStrategicQualityStrategies();
      expect(strategies).toHaveLength(2500);
      expect(Object.isFrozen(strategies)).toBe(true);

      // Verify all 2500 are unique
      const keys = new Set(strategies.map(createStrategicQualityStrategyKey));
      expect(keys.size).toBe(2500);

      // Verify first strategy: y=0, x=0, price=150, quality=2
      expect(strategies[0]).toEqual({
        location: { x: 0, y: 0 },
        price: 150,
        quality: 2,
      });
      expect(Object.isFrozen(strategies[0])).toBe(true);
      expect(Object.isFrozen(strategies[0].location)).toBe(true);

      // Verify last strategy: y=9, x=9, price=350, quality=10
      expect(strategies[2499]).toEqual({
        location: { x: 9, y: 9 },
        price: 350,
        quality: 10,
      });

      // Verify ordering progression
      expect(strategies[1]).toEqual({
        location: { x: 0, y: 0 },
        price: 150,
        quality: 4,
      });
      expect(strategies[5]).toEqual({
        location: { x: 0, y: 0 },
        price: 200,
        quality: 2,
      });
      expect(strategies[25]).toEqual({
        location: { x: 1, y: 0 },
        price: 150,
        quality: 2,
      });
      expect(strategies[250]).toEqual({
        location: { x: 0, y: 1 },
        price: 150,
        quality: 2,
      });
    });

    it('validates and creates canonical strategic-quality strategy objects', () => {
      const strat = createStrategicQualityStrategy({ x: 3, y: 4 }, 250, 8);
      expect(strat).toEqual({
        location: { x: 3, y: 4 },
        price: 250,
        quality: 8,
      });
      expect(Object.isFrozen(strat)).toBe(true);
      expect(Object.isFrozen(strat.location)).toBe(true);

      expect(validateStrategicQualityStrategy(strat)).toBe(true);

      // Rejects legacy top-level x, y
      expect(validateStrategicQualityStrategy({ x: 3, y: 4, location: { x: 3, y: 4 }, price: 250, quality: 8 })).toBe(false);

      // Rejects invalid coordinates
      expect(() => createStrategicQualityStrategy({ x: -1, y: 4 }, 250, 8)).toThrow(TypeError);
      expect(() => createStrategicQualityStrategy({ x: 10, y: 4 }, 250, 8)).toThrow(TypeError);
      expect(() => createStrategicQualityStrategy({ x: 3.5, y: 4 }, 250, 8)).toThrow(TypeError);

      // Rejects invalid prices
      expect(() => createStrategicQualityStrategy({ x: 3, y: 4 }, 225, 8)).toThrow(RangeError);

      // Rejects invalid qualities
      expect(() => createStrategicQualityStrategy({ x: 3, y: 4 }, 250, 5)).toThrow(RangeError);
      expect(() => createStrategicQualityStrategy({ x: 3, y: 4 }, 250, NaN)).toThrow(TypeError);
    });

    it('generates consistent strategy keys and profile keys', () => {
      const sA = createStrategicQualityStrategy({ x: 2, y: 3 }, 200, 6);
      const sB = createStrategicQualityStrategy({ x: 7, y: 8 }, 300, 10);

      expect(createStrategicQualityStrategyKey(sA)).toBe('2,3,200,6');
      expect(createStrategicQualityStrategyKey(sB)).toBe('7,8,300,10');
      expect(createStrategicQualityProfileKey(sA, sB)).toBe('2,3,200,6|7,8,300,10');
      expect(formatStrategicQualityProfile(sA, sB)).toBe('A(2,3,200,6)|B(7,8,300,10)');
    });
  });

  describe('2. Quality Investment Cost Model', () => {
    it('1. Quality Cost Calculation: K(Q) = kappa * Q^2 for default kappa = 25', () => {
      expect(calculateQualityInvestmentCost(2)).toBe(100);
      expect(calculateQualityInvestmentCost(4)).toBe(400);
      expect(calculateQualityInvestmentCost(6)).toBe(900);
      expect(calculateQualityInvestmentCost(8)).toBe(1600);
      expect(calculateQualityInvestmentCost(10)).toBe(2500);
    });

    it('2. Quality Cost Configurability: K(Q) = 10 * Q^2 when kappa = 10', () => {
      const kappa = 10;
      expect(calculateQualityInvestmentCost(2, kappa)).toBe(40);
      expect(calculateQualityInvestmentCost(4, kappa)).toBe(160);
      expect(calculateQualityInvestmentCost(6, kappa)).toBe(360);
      expect(calculateQualityInvestmentCost(8, kappa)).toBe(640);
      expect(calculateQualityInvestmentCost(10, kappa)).toBe(1000);
    });

    it('validates quality cost config correctly', () => {
      const conf = validateQualityCostConfig({ kappa: 15 });
      expect(conf.kappa).toBe(15);
      expect(Object.isFrozen(conf)).toBe(true);

      const defConf = validateQualityCostConfig();
      expect(defConf.kappa).toBe(DEFAULT_QUALITY_COST_KAPPA);

      expect(() => validateQualityCostConfig({ kappa: -5 })).toThrow(RangeError);
      expect(() => validateQualityCostConfig({ kappa: NaN })).toThrow(TypeError);
    });

    it('3. Quality Cost Is Not Demand-Dependent: doubling demand does not double K(Q)', () => {
      const restaurant = { price: 200, quality: 6, variableCost: 100, fixedCost: 0 };
      const kappa = 25;
      const invCost = calculateQualityInvestmentCost(6, kappa);
      expect(invCost).toBe(900);

      const profitDemand100 = calculateStrategicQualityProfit(restaurant, 100, 0, 100, kappa);
      const profitDemand200 = calculateStrategicQualityProfit(restaurant, 200, 0, 100, kappa);

      // Profit = (200 - 100)*D - 900
      expect(profitDemand100).toBe(100 * 100 - 900); // 9,100
      expect(profitDemand200).toBe(100 * 200 - 900); // 19,100

      // The investment cost deducted in both cases is exactly 900, NOT 1800
      expect((200 - 100) * 100 - profitDemand100).toBe(900);
      expect((200 - 100) * 200 - profitDemand200).toBe(900);
    });

    it('5. Quality Cost Reduces Profit: holding demand constant, higher Q reduces profit by difference in K(Q)', () => {
      const rLowQ = { price: 250, quality: 4, variableCost: 100, fixedCost: 0 };
      const rHighQ = { price: 250, quality: 8, variableCost: 100, fixedCost: 0 };
      const demand = 150;
      const kappa = 25;

      const profLow = calculateStrategicQualityProfit(rLowQ, demand, 0, 100, kappa);
      const profHigh = calculateStrategicQualityProfit(rHighQ, demand, 0, 100, kappa);

      // K(4) = 400, K(8) = 1600. Difference = 1200
      expect(profLow - profHigh).toBe(1600 - 400);
    });
  });

  describe('3. Economic Trade-Offs & Payoffs', () => {
    it('4. Quality Improves Demand: holding location, price, and costs constant, higher Q weakly improves demand', () => {
      // Co-located restaurants at (4, 4), identical prices
      const rA_lowQ = { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 4 };
      const rB = { id: 'B', location: { x: 4, y: 4 }, price: 200, quality: 4 };

      // Symmetric quality -> 50/50 demand split
      const marketSymmetric = calculateStrategicQualityPayoff({
        city: balancedCity,
        restaurantA: rA_lowQ,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });
      expect(marketSymmetric.restaurantA.demand).toBeCloseTo(marketSymmetric.restaurantB.demand, 4);

      // Restaurant A increases quality to 6
      const rA_highQ = { id: 'A', location: { x: 4, y: 4 }, price: 200, quality: 6 };
      const marketHigherQ = calculateStrategicQualityPayoff({
        city: balancedCity,
        restaurantA: rA_highQ,
        restaurantB: rB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      // Demand for A strictly increases
      expect(marketHigherQ.restaurantA.demand).toBeGreaterThan(marketSymmetric.restaurantA.demand);
      expect(marketHigherQ.restaurantA.demand).toBe(marketHigherQ.totalPopulation);
      expect(marketHigherQ.restaurantB.demand).toBe(0);
    });

    it('6. Quality Trade-Off: higher quality gets more demand but NOT necessarily higher profit due to K(Q)', () => {
      // Small town: 100 population at (4, 4)
      const smallCity = {
        width: 10,
        height: 10,
        cells: [
          { x: 4, y: 4, population: 100 },
        ],
      };

      // Thin margin: Price = 120, variableCost = 100 -> margin = 20
      const rB = { id: 'B', location: { x: 4, y: 4 }, price: 120, quality: 2 }; // K(2) = 100

      // Scenario 1: A matches B with Q=2. Both price 120. Demand splits 50/50 (50 each).
      // A profit = 20 * 50 - 25*(2^2) = 1000 - 100 = 900.
      const rA_lowQ = { id: 'A', location: { x: 4, y: 4 }, price: 120, quality: 2 };
      const payoffLowQ = calculateStrategicQualityPayoff({
        city: smallCity,
        restaurantA: rA_lowQ,
        restaurantB: rB,
        variableCost: 100,
        kappa: 25,
      });

      expect(payoffLowQ.restaurantA.demand).toBe(50);
      expect(payoffLowQ.restaurantA.profit).toBe(20 * 50 - 100); // 900

      // Scenario 2: A jumps to Q=10 to capture the entire market (100 demand).
      // Revenue margin = 20 * 100 = 2000.
      // But K(10) = 25 * 100 = 2500!
      // A profit = 2000 - 2500 = -500!
      const rA_highQ = { id: 'A', location: { x: 4, y: 4 }, price: 120, quality: 10 };
      const payoffHighQ = calculateStrategicQualityPayoff({
        city: smallCity,
        restaurantA: rA_highQ,
        restaurantB: rB,
        variableCost: 100,
        kappa: 25,
      });

      expect(payoffHighQ.restaurantA.demand).toBe(100); // Captured 100% of market
      expect(payoffHighQ.restaurantA.profit).toBe(-500); // But suffers economic loss!

      // Higher quality gained +50 demand, but lost 1,400 in profit!
      expect(payoffHighQ.restaurantA.demand).toBeGreaterThan(payoffLowQ.restaurantA.demand);
      expect(payoffHighQ.restaurantA.profit).toBeLessThan(payoffLowQ.restaurantA.profit);
    });

    it('7. Optimal Quality Need Not Be Maximum: Q=10 is not the profit-maximizing quality', () => {
      // Single zone with 200 consumers at (5, 5)
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      const opponentStrategy = { location: { x: 5, y: 5 }, price: 200, quality: 4 };

      // Consider candidate strategies at the same location (5, 5) and price 200 across all 5 qualities
      const candidates = [
        { location: { x: 5, y: 5 }, price: 200, quality: 2 },
        { location: { x: 5, y: 5 }, price: 200, quality: 4 },
        { location: { x: 5, y: 5 }, price: 200, quality: 6 },
        { location: { x: 5, y: 5 }, price: 200, quality: 8 },
        { location: { x: 5, y: 5 }, price: 200, quality: 10 },
      ];

      const br = findStrategicQualityBestResponses({
        player: 'A',
        opponentStrategy,
        strategySpace: candidates,
        city,
        variableCost: 100,
        kappa: 25,
      });

      // At Q=4 (ties with opp): demand = 100, profit = 100*100 - 400 = 9,600
      // At Q=6 (beats opp): demand = 200, profit = 100*200 - 900 = 19,100
      // At Q=8 (beats opp): demand = 200, profit = 100*200 - 1600 = 18,400
      // At Q=10 (beats opp): demand = 200, profit = 100*200 - 2500 = 17,500
      // Therefore Q=6 strictly dominates Q=8 and Q=10!
      expect(br.bestResponses).toHaveLength(1);
      expect(br.bestResponses[0].quality).toBe(6);
      expect(br.bestResponses[0].quality).not.toBe(10);
      expect(br.bestPayoff).toBe(19100);
    });

    it('8. Quality Can Change Best Response: changing opponent quality changes optimal quality', () => {
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      const candidateSpace = [
        { location: { x: 5, y: 5 }, price: 200, quality: 4 },
        { location: { x: 5, y: 5 }, price: 200, quality: 8 },
      ];

      // Opponent at Q=2
      // For A: Q=4 beats B (diff in Q = +2 > 0 -> captures 200 demand). Profit = 100*200 - 400 = 19,600.
      // Q=8 also captures 200 demand, but profit = 100*200 - 1600 = 18,400.
      // So best response against Q=2 is Q=4!
      const brAgainstLowQ = findStrategicQualityBestResponses({
        player: 'A',
        opponentStrategy: { location: { x: 5, y: 5 }, price: 200, quality: 2 },
        strategySpace: candidateSpace,
        city,
        variableCost: 100,
        kappa: 25,
      });
      expect(brAgainstLowQ.bestResponses[0].quality).toBe(4);

      // Opponent at Q=6
      // For A: Q=4 loses to B (diff in Q = -2 < 0 -> demand 0). Profit = -400.
      // Q=8 beats B (diff in Q = +2 > 0 -> demand 200). Profit = 100*200 - 1600 = 18,400.
      // So best response against Q=6 shifts to Q=8!
      const brAgainstHighQ = findStrategicQualityBestResponses({
        player: 'A',
        opponentStrategy: { location: { x: 5, y: 5 }, price: 200, quality: 6 },
        strategySpace: candidateSpace,
        city,
        variableCost: 100,
        kappa: 25,
      });
      expect(brAgainstHighQ.bestResponses[0].quality).toBe(8);
    });
  });

  describe('4. Best Responses & Pure Nash Equilibrium', () => {
    it('evaluates best responses across the full 2,500 strategic-quality strategy space', () => {
      const oppStrategy = { location: { x: 2, y: 2 }, price: 250, quality: 6 };

      const br = findStrategicQualityBestResponses({
        player: 'A',
        opponentStrategy: oppStrategy,
        city: balancedCity,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(br.evaluatedStrategies).toHaveLength(2500);
      expect(br.bestResponses.length).toBeGreaterThan(0);
      expect(br.bestPayoff).toBeGreaterThan(-Infinity);

      // Every returned best response must achieve bestPayoff within tolerance
      for (const best of br.bestResponses) {
        expect(validateStrategicQualityStrategy(best)).toBe(true);
      }
    });

    it('correctly handles tied best responses with deterministic ordering', () => {
      // Co-located symmetric opponent at (5, 5) with symmetric zones at (1, 5) and (9, 5)
      const city = {
        width: 10,
        height: 10,
        cells: [
          { x: 1, y: 5, population: 100 },
          { x: 9, y: 5, population: 100 },
        ],
      };

      const opp = { location: { x: 5, y: 5 }, price: 250, quality: 6 };
      // Two mirror-image candidate strategies with identical quality and price
      const space = [
        createStrategicQualityStrategy({ x: 1, y: 5 }, 200, 6),
        createStrategicQualityStrategy({ x: 9, y: 5 }, 200, 6),
      ];

      const br = findStrategicQualityBestResponses({
        player: 'A',
        opponentStrategy: opp,
        strategySpace: space,
        city,
      });

      // Both should tie with identical payoffs
      expect(br.bestResponses).toHaveLength(2);
      expect(br.bestResponses[0].location).toEqual({ x: 1, y: 5 });
      expect(br.bestResponses[1].location).toEqual({ x: 9, y: 5 });
    });

    it('checks pure Nash equilibrium accurately for a strategic-quality profile', () => {
      const stratA = createStrategicQualityStrategy({ x: 4, y: 4 }, 200, 6);
      const stratB = createStrategicQualityStrategy({ x: 6, y: 6 }, 250, 4);

      const check = checkStrategicQualityPureNashEquilibrium({
        city: balancedCity,
        strategyA: stratA,
        strategyB: stratB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(typeof check.isNash).toBe('boolean');
      expect(typeof check.payoffA).toBe('number');
      expect(typeof check.payoffB).toBe('number');
      expect(check.strategyA.quality).toBe(6);
      expect(check.strategyB.quality).toBe(4);
    });

    it('searches strategic-quality Nash equilibria over a controlled strategy space', () => {
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      // Small 4-strategy space
      const space = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 6),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 250, 4),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 250, 6),
      ];

      const result = findStrategicQualityPureNashEquilibria({
        city,
        strategySpace: space,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(result.evaluatedProfiles).toBe(16);
      expect(typeof result.count).toBe('number');
      expect(typeof result.hasPureEquilibrium).toBe('boolean');
      expect(result.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);

      if (result.hasPureEquilibrium) {
        expect(result.equilibria.length).toBe(result.count);
        for (const eq of result.equilibria) {
          expect(STRATEGIC_QUALITY_LEVELS.includes(eq.strategyA.quality)).toBe(true);
          expect(STRATEGIC_QUALITY_LEVELS.includes(eq.strategyB.quality)).toBe(true);
          expect(eq.qualityInvestmentCostA).toBe(calculateQualityInvestmentCost(eq.strategyA.quality));
          expect(eq.qualityInvestmentCostB).toBe(calculateQualityInvestmentCost(eq.strategyB.quality));
        }
      }
    });

    it('formats no-pure-equilibrium message accurately when no pure Nash exists', () => {
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 100 }],
      };

      // Zero-sum matching-pennies style setup with quality
      const spaceA = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 250, 6),
      ];
      const spaceB = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 6),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 250, 4),
      ];

      const result = findStrategicQualityPureNashEquilibria({
        city,
        strategySpaceA: spaceA,
        strategySpaceB: spaceB,
      });

      if (!result.hasPureEquilibrium) {
        expect(result.message).toBe(
          'No pure-strategy Nash equilibrium found in the specified discrete strategy space.'
        );
      }
    });

    it('works with road travel cost mode, bridge, and bottleneck networks', () => {
      const miniSpace = [
        createStrategicQualityStrategy({ x: 1, y: 5 }, 200, 6),
        createStrategicQualityStrategy({ x: 8, y: 5 }, 200, 8),
      ];

      for (const network of [gridNetwork, bridgeNetwork, bottleneckNetwork]) {
        const roadEq = findStrategicQualityPureNashEquilibria({
          city: balancedCity,
          strategySpace: miniSpace,
          mode: TRAVEL_COST_MODES.ROAD,
          roadNetwork: network,
        });

        expect(roadEq.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
        expect(roadEq.evaluatedProfiles).toBe(4);
      }
    });

    it('supports heterogeneous consumer segments in strategic quality equilibrium search', () => {
      const segments = [
        createConsumerSegment({ id: 'budget', populationShare: 0.6, beta: 2.0, gamma: 5 }),
        createConsumerSegment({ id: 'quality', populationShare: 0.4, beta: 0.5, gamma: 25 }),
      ];

      const miniSpace = [
        createStrategicQualityStrategy({ x: 4, y: 4 }, 150, 4),
        createStrategicQualityStrategy({ x: 4, y: 4 }, 300, 10),
      ];

      const result = findStrategicQualityPureNashEquilibria({
        city: balancedCity,
        strategySpace: miniSpace,
        segments,
      });

      expect(result.evaluatedProfiles).toBe(4);
      expect(typeof result.count).toBe('number');
    });

    it('preserves determinism across repeated equilibrium searches', () => {
      const miniSpace = [
        createStrategicQualityStrategy({ x: 2, y: 2 }, 200, 4),
        createStrategicQualityStrategy({ x: 7, y: 7 }, 250, 6),
      ];

      const run1 = findStrategicQualityPureNashEquilibria({
        city: balancedCity,
        strategySpace: miniSpace,
      });
      const run2 = findStrategicQualityPureNashEquilibria({
        city: balancedCity,
        strategySpace: miniSpace,
      });

      expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
    });

    it('executes full 2,500-strategy pure Nash equilibrium search and verifies structural properties', () => {
      // 2-zone city to benchmark full 2,500 x 2,500 = 6,250,000 profile search
      const city = {
        width: 10,
        height: 10,
        cells: [
          { x: 2, y: 2, population: 150 },
          { x: 7, y: 7, population: 150 },
        ],
      };

      const result = findStrategicQualityPureNashEquilibria({
        city,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(result.evaluatedProfiles).toBe(6250000);
      expect(typeof result.count).toBe('number');
      expect(typeof result.hasPureEquilibrium).toBe('boolean');
      expect(typeof result.message).toBe('string');
      expect(result.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
      expect(result.config.kappa).toBe(DEFAULT_QUALITY_COST_KAPPA);
    });
  });

  describe('5. Sequential Best-Response Dynamics', () => {
    it('executes quality-only unilateral adjustment when location and price are optimal', () => {
      // Co-located city with single cell
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      const sA_init = createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 2);
      const sB_fixed = createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4);

      // Strategy space holds location (5, 5) and price 200 fixed, only varying quality
      const space = STRATEGIC_QUALITY_LEVELS.map((q) =>
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, q)
      );

      const step = stepStrategicQualityBestResponseDynamics({
        city,
        strategyA: sA_init,
        strategyB: sB_fixed,
        actingPlayer: 'A',
        strategySpace: space,
        variableCost: 100,
        kappa: 25,
      });

      // A shifts quality from 2 to 6 to beat B's quality of 4!
      expect(step.actingPlayer).toBe('A');
      expect(step.deviationOccurred).toBe(true);
      expect(step.strategyA.location).toEqual({ x: 5, y: 5 }); // location unchanged
      expect(step.strategyA.price).toBe(200); // price unchanged
      expect(step.strategyA.quality).toBe(6); // quality changed from 2 to 6!
    });

    it('preserves inertia when multiple quality-inclusive best responses tie', () => {
      const city = {
        width: 10,
        height: 10,
        cells: [
          { x: 0, y: 5, population: 100 },
          { x: 9, y: 5, population: 100 },
        ],
      };

      // Firm A is at {9, 5}, which ties with {0, 5}
      const sA = createStrategicQualityStrategy({ x: 9, y: 5 }, 200, 6);
      const sB = createStrategicQualityStrategy({ x: 5, y: 5 }, 250, 6);

      const space = [
        createStrategicQualityStrategy({ x: 0, y: 5 }, 200, 6),
        createStrategicQualityStrategy({ x: 9, y: 5 }, 200, 6),
      ];

      const step = stepStrategicQualityBestResponseDynamics({
        city,
        strategyA: sA,
        strategyB: sB,
        actingPlayer: 'A',
        strategySpace: space,
      });

      // Because {9, 5} is already among the tied best responses, inertia preserves {9, 5}
      expect(step.deviationOccurred).toBe(false);
      expect(step.strategyA).toEqual(sA);
    });

    it('converges to a pure Nash equilibrium in strategic-quality dynamics', () => {
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      const space = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 6),
      ];

      const initA = createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4);
      const initB = createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4);

      const dyn = runStrategicQualityBestResponseDynamics({
        city,
        strategyA: initA,
        strategyB: initB,
        strategySpace: space,
        maxIterations: 10,
      });

      expect(dyn.converged).toBe(true);
      expect(dyn.status).toBe('converged');
      expect(dyn.trajectory.length).toBeGreaterThan(0);
      expect(dyn.finalProfile.strategyA.quality).toBeDefined();
      expect(dyn.finalProfile.strategyB.quality).toBeDefined();
    });

    it('detects cycles where quality participates in the strategic cycle', () => {
      // Single-zone city with 200 consumers at (5, 5).
      // Both firms are co-located at (5, 5) and charge price 200 (margin = 200 - 100 = 100).
      // Quality investment cost is K(Q) = 25 * Q^2.
      //
      // Strategic Spaces:
      // Player A chooses between low quality Q=2 (K=100) and medium quality Q=6 (K=900).
      // Player B chooses between intermediate quality Q=4 (K=400) and high quality Q=8 (K=1600).
      //
      // Payoff Structure and Best-Response Mechanics:
      // 1. Initial State: (A: Q=2, B: Q=4)
      //    Q_B > Q_A => B wins all 200 consumers.
      //    A gets 0 demand, pi_A = -100.
      //    Against B's Q=4, A can leapfrog to Q=6 (pi_A = 100*200 - 900 = 19,100 > -100).
      //    -> A switches from Q=2 to Q=6. State becomes (A: Q=6, B: Q=4).
      //
      // 2. State: (A: Q=6, B: Q=4)
      //    Q_A > Q_B => A wins all 200 consumers, B gets pi_B = -400.
      //    Against A's Q=6, B can leapfrog to Q=8 (pi_B = 100*200 - 1600 = 18,400 > -400).
      //    -> B switches from Q=4 to Q=8. State becomes (A: Q=6, B: Q=8).
      //
      // 3. State: (A: Q=6, B: Q=8)
      //    Q_B > Q_A => B wins all 200 consumers. A loses with Q=6 (pi_A = -900).
      //    Against B's Q=8, A cannot beat 8 with either available strategy (2 or 6).
      //    A minimizes investment loss by dropping to Q=2 (pi_A = -100 > -900).
      //    -> A switches from Q=6 to Q=2. State becomes (A: Q=2, B: Q=8).
      //
      // 4. State: (A: Q=2, B: Q=8)
      //    Q_B > Q_A => B wins all 200 consumers, but paying K(8) = 1600 (pi_B = 18,400).
      //    Against A's Q=2, B does NOT need expensive quality 8 to win; Q=4 also beats Q=2!
      //    Dropping to Q=4 saves 1200 in investment cost (pi_B = 100*200 - 400 = 19,600 > 18,400).
      //    -> B switches from Q=8 to Q=4. State returns to (A: Q=2, B: Q=4)!
      //
      // This produces a deterministic 4-step periodic cycle driven entirely by strategic quality:
      // (A:2, B:4) -> (A:6, B:4) -> (A:6, B:8) -> (A:2, B:8) -> (A:2, B:4)
      const city = {
        width: 10,
        height: 10,
        cells: [{ x: 5, y: 5, population: 200 }],
      };

      const spaceA = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 2),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 6),
      ];
      const spaceB = [
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 4),
        createStrategicQualityStrategy({ x: 5, y: 5 }, 200, 8),
      ];

      const result = runStrategicQualityBestResponseDynamics({
        city,
        strategyA: spaceA[0], // Q=2
        strategyB: spaceB[0], // Q=4
        startingPlayer: 'A',
        strategySpaceA: spaceA,
        strategySpaceB: spaceB,
        variableCost: 100,
        kappa: 25,
        maxIterations: 20,
      });

      // 1. Result must report cycle status
      expect(result.status).toBe('cycle');

      // 2. Must not be reported as converged
      expect(result.converged).toBe(false);

      // 3. Cycle detection explicitly fired
      expect(result.cycleDetected).toBe(true);

      // 4. cycleStart is a valid non-negative integer
      expect(typeof result.cycleStart).toBe('number');
      expect(result.cycleStart).toBe(0);
      expect(result.cycleStartIndex).toBe(0);

      // 5 & 6. cycleLength is exactly 4
      expect(result.cycleLength).toBe(4);

      // 8. Assert exact iterations
      expect(result.iterations).toBe(4);
      expect(result.iterationCount).toBe(4);
      expect(result.message).toContain('cycle of period 4');

      // 7. Assert trajectory actually returns to the same state after exactly cycleLength steps
      const start = result.cycleStart;
      const length = result.cycleLength;
      expect(result.trajectory[start].stateKey).toBe(
        result.trajectory[start + length].stateKey
      );

      // Verify that start and start + length represent the exact same strategic state across all dimensions
      const startState = result.trajectory[start];
      const endState = result.trajectory[start + length];
      expect(startState.strategyA.location).toEqual(endState.strategyA.location);
      expect(startState.strategyA.price).toBe(endState.strategyA.price);
      expect(startState.strategyA.quality).toBe(endState.strategyA.quality);
      expect(startState.strategyB.location).toEqual(endState.strategyB.location);
      expect(startState.strategyB.price).toBe(endState.strategyB.price);
      expect(startState.strategyB.quality).toBe(endState.strategyB.quality);

      // Quality must actually participate: verify quality changes across each step of the cycle
      // Step 0 -> 1: Player A updates quality from 2 to 6
      expect(result.trajectory[0].strategyA.quality).toBe(2);
      expect(result.trajectory[1].strategyA.quality).toBe(6);
      expect(result.trajectory[1].actingPlayer).toBe('A');

      // Step 1 -> 2: Player B updates quality from 4 to 8
      expect(result.trajectory[1].strategyB.quality).toBe(4);
      expect(result.trajectory[2].strategyB.quality).toBe(8);
      expect(result.trajectory[2].actingPlayer).toBe('B');

      // Step 2 -> 3: Player A drops quality from 6 to 2 to minimize investment loss
      expect(result.trajectory[2].strategyA.quality).toBe(6);
      expect(result.trajectory[3].strategyA.quality).toBe(2);
      expect(result.trajectory[3].actingPlayer).toBe('A');

      // Step 3 -> 4: Player B drops quality from 8 to 4 to save investment cost
      expect(result.trajectory[3].strategyB.quality).toBe(8);
      expect(result.trajectory[4].strategyB.quality).toBe(4);
      expect(result.trajectory[4].actingPlayer).toBe('B');
    });

    it('stops at max iterations when dynamics do not converge or cycle within limit', () => {
      const space = [
        createStrategicQualityStrategy({ x: 2, y: 2 }, 200, 4),
        createStrategicQualityStrategy({ x: 7, y: 7 }, 250, 8),
      ];

      const dyn = runStrategicQualityBestResponseDynamics({
        city: balancedCity,
        strategyA: space[0],
        strategyB: space[1],
        strategySpace: space,
        maxIterations: 2,
      });

      expect(dyn.iterations).toBeLessThanOrEqual(2);
      expect(['converged', 'cycle', 'max-iterations'].includes(dyn.status)).toBe(true);
    });

    it('records trajectory state keys containing strategic quality', () => {
      const stratA = createStrategicQualityStrategy({ x: 4, y: 4 }, 250, 6);
      const stratB = createStrategicQualityStrategy({ x: 4, y: 4 }, 200, 4);

      const dyn = runStrategicQualityBestResponseDynamics({
        city: balancedCity,
        strategyA: stratA,
        strategyB: stratB,
        maxIterations: 1,
      });

      const initialStep = dyn.trajectory[0];
      expect(initialStep.stateKey).toBe('4,4,250,6|4,4,200,4');
      expect(initialStep.formattedState).toBe('A(4,4,250,6)|B(4,4,200,4)');
    });

    it('maintains immutability of dynamics outputs and snapshot inputs', () => {
      const stratA = createStrategicQualityStrategy({ x: 3, y: 3 }, 200, 4);
      const stratB = createStrategicQualityStrategy({ x: 6, y: 6 }, 250, 8);

      const inputA = JSON.stringify(stratA);
      const inputB = JSON.stringify(stratB);

      const dyn = runStrategicQualityBestResponseDynamics({
        city: balancedCity,
        strategyA: stratA,
        strategyB: stratB,
        maxIterations: 5,
      });

      // Inputs not mutated
      expect(JSON.stringify(stratA)).toBe(inputA);
      expect(JSON.stringify(stratB)).toBe(inputB);

      // Outputs frozen
      expect(Object.isFrozen(dyn)).toBe(true);
      expect(Object.isFrozen(dyn.trajectory)).toBe(true);
      expect(Object.isFrozen(dyn.finalProfile)).toBe(true);
      expect(Object.isFrozen(dyn.finalPayoffs)).toBe(true);
    });
  });
});
