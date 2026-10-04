/**
 * @file experiments.test.js
 * @description Comprehensive unit and integration tests for Frontier Experiment Laboratory Engine (Phase 9).
 *
 * Verifies:
 * - Scenario runner normalization and execution
 * - Independent baseline & treatment execution
 * - Metric resolution, extraction, and comparison
 * - Absolute changes and percentage changes (including zero baseline edge cases)
 * - Changed parameter validation and undeclared difference detection (No Hidden Differences)
 * - Identical baseline/treatment zero changes
 * - Canonical Experiment 1: Platform Commission Shock (consumer allocation unchanged, profit lower)
 * - Canonical Experiment 2: Delivery Cost Shock (operating cost higher, profit lower)
 * - Canonical Experiment 3: Urban Geography Shift (population re-allocation)
 * - Canonical Experiment 4: Road Network Friction (travel costs alter market access)
 * - Canonical Experiment 5: Consumer Composition Shift (preference heterogeneity shifts demand)
 * - Reproducibility & determinism (running twice yields identical results)
 */

import { describe, it, expect } from 'vitest';
import {
  EXPERIMENT_METRICS,
  EXPERIMENT_METRIC_CATEGORIES,
  resolveExperimentMetrics,
  validateChangedParameters,
  runFrontierScenario,
  extractExperimentMetrics,
  compareExperimentResults,
  validateExperimentDefinition,
  runExperiment,
  CANONICAL_EXPERIMENT_IDS,
  getCanonicalExperiment,
  listCanonicalExperiments,
  CANONICAL_EXPERIMENT_RESTAURANT_A,
  CANONICAL_EXPERIMENT_RESTAURANT_B,
} from './experiments.js';
import { SCENARIO_IDS } from './frontierCity.js';
import { ROAD_SCENARIO_IDS } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';

describe('LOCUS Frontier Engine — Phase 9: Experiment Laboratory Engine', () => {
  describe('1. Scenario Runner & Normalized Result', () => {
    it('runs a scenario and returns a complete, normalized result structure', () => {
      const scenario = {
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: { baseCostPerDelivery: 20, distanceCostPerUnit: 5 },
        platform: { enabled: true, commissionRate: 0.15 },
      };

      const result = runFrontierScenario(scenario);

      // Verify top-level structure
      expect(result).toHaveProperty('scenario');
      expect(result).toHaveProperty('restaurantA');
      expect(result).toHaveProperty('restaurantB');
      expect(result).toHaveProperty('market');
      expect(result).toHaveProperty('rawPayoff');

      // Verify restaurant A fields
      const rA = result.restaurantA;
      expect(rA.id).toBe('A');
      expect(rA.demand).toBeGreaterThan(0);
      expect(rA.marketShare).toBeGreaterThan(0);
      expect(rA.dineInDemand).toBeGreaterThan(0);
      expect(rA.deliveryDemand).toBeGreaterThan(0);
      expect(rA.deliveryOperatingCost).toBeGreaterThan(0);
      expect(rA.platformCommission).toBeGreaterThan(0);
      expect(rA.baseProfit).toBeDefined();
      expect(rA.profitBeforePlatformCommission).toBeDefined();
      expect(rA.finalProfit).toBeDefined();
      expect(rA.profit).toBe(rA.finalProfit);
      expect(rA.price).toBe(200);
      expect(rA.quality).toBe(6);

      // Verify restaurant B fields
      const rB = result.restaurantB;
      expect(rB.id).toBe('B');
      expect(rB.demand).toBeGreaterThan(0);
      expect(rB.finalProfit).toBeDefined();

      // Verify market fields
      const m = result.market;
      expect(m.totalPopulation).toBeGreaterThan(0);
      expect(m.servedPopulation).toBeGreaterThan(0);
      expect(m.unservedPopulation).toBeDefined();
      expect(m.reachablePopulation).toBe(m.totalPopulation);
      expect(m.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
    });

    it('runs baseline and treatment independently without cross-talk or mutation', () => {
      const baselineScenario = {
        city: SCENARIO_IDS.BALANCED,
        platform: { enabled: true, commissionRate: 0.1 },
      };
      const treatmentScenario = {
        city: SCENARIO_IDS.BALANCED,
        platform: { enabled: true, commissionRate: 0.3 },
      };

      const baseRes = runFrontierScenario(baselineScenario);
      const treatRes = runFrontierScenario(treatmentScenario);

      // Baseline should have lower commission
      expect(baseRes.restaurantA.platformCommission).toBeLessThan(
        treatRes.restaurantA.platformCommission
      );

      // Demands remain identical
      expect(baseRes.restaurantA.demand).toBeCloseTo(treatRes.restaurantA.demand, 9);
      expect(baseRes.restaurantB.demand).toBeCloseTo(treatRes.restaurantB.demand, 9);
    });

    it('rejects invalid scenario input in runFrontierScenario', () => {
      expect(() => runFrontierScenario(null)).toThrow(TypeError);
      expect(() => runFrontierScenario('invalid')).toThrow(TypeError);
    });
  });

  describe('2. Metric Registry, Extraction & Comparison', () => {
    it('defines authoritative metric catalog with proper categories and units', () => {
      expect(EXPERIMENT_METRICS.totalPopulation.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.MARKET
      );
      expect(EXPERIMENT_METRICS.restaurantADemand.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.COMPETITION
      );
      expect(EXPERIMENT_METRICS.restaurantADeliveryDemand.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.DELIVERY
      );
      expect(EXPERIMENT_METRICS.restaurantAPlatformCommission.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.PLATFORM
      );
      expect(EXPERIMENT_METRICS.restaurantAQualityInvestmentCost.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.QUALITY
      );
      expect(EXPERIMENT_METRICS.travelCostMode.category).toBe(
        EXPERIMENT_METRIC_CATEGORIES.GEOGRAPHY
      );
    });

    it('resolves metric IDs and metric objects properly', () => {
      const resolved = resolveExperimentMetrics(['restaurantADemand', 'restaurantAProfit']);
      expect(resolved).toHaveLength(2);
      expect(resolved[0].id).toBe('restaurantADemand');
      expect(resolved[1].id).toBe('restaurantAProfit');

      expect(() => resolveExperimentMetrics(['nonExistentMetric'])).toThrow(RangeError);
      expect(() => resolveExperimentMetrics([123])).toThrow(TypeError);
    });

    it('extracts metrics accurately from scenario results', () => {
      const scenario = {
        city: SCENARIO_IDS.BALANCED,
        platform: { enabled: true, commissionRate: 0.2 },
      };
      const result = runFrontierScenario(scenario);
      const metrics = resolveExperimentMetrics(['restaurantADemand', 'travelCostMode']);
      const extracted = extractExperimentMetrics(result, metrics);

      expect(extracted.restaurantADemand).toBe(result.restaurantA.demand);
      expect(extracted.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
    });

    it('computes absolute and percentage changes correctly', () => {
      const baselineMock = {
        restaurantA: { demand: 100, finalProfit: 5000 },
        market: { totalPopulation: 1000 },
      };
      const treatmentMock = {
        restaurantA: { demand: 120, finalProfit: 4000 },
        market: { totalPopulation: 1000 },
      };

      const metrics = [
        {
          id: 'testDemand',
          label: 'Test Demand',
          category: 'competition',
          unit: 'orders',
          getValue: (r) => r.restaurantA.demand,
        },
        {
          id: 'testProfit',
          label: 'Test Profit',
          category: 'competition',
          unit: 'currency',
          getValue: (r) => r.restaurantA.finalProfit,
        },
        {
          id: 'testPop',
          label: 'Test Pop',
          category: 'market',
          unit: 'people',
          getValue: (r) => r.market.totalPopulation,
        },
      ];

      const comparison = compareExperimentResults(baselineMock, treatmentMock, metrics);

      // Demand: 100 -> 120 (+20, +20%)
      const compDemand = comparison.find((c) => c.id === 'testDemand');
      expect(compDemand.absoluteChange).toBe(20);
      expect(compDemand.percentChange).toBeCloseTo(20, 9);
      expect(compDemand.percentChangeDefined).toBe(true);

      // Profit: 5000 -> 4000 (-1000, -20%)
      const compProfit = comparison.find((c) => c.id === 'testProfit');
      expect(compProfit.absoluteChange).toBe(-1000);
      expect(compProfit.percentChange).toBeCloseTo(-20, 9);
      expect(compProfit.percentChangeDefined).toBe(true);

      // Population: 1000 -> 1000 (0, 0%)
      const compPop = comparison.find((c) => c.id === 'testPop');
      expect(compPop.absoluteChange).toBe(0);
      expect(compPop.percentChange).toBeCloseTo(0, 9);
      expect(compPop.percentChangeDefined).toBe(true);
    });

    it('handles zero baseline gracefully (percentChange = null, percentChangeDefined = false)', () => {
      const baselineMock = {
        restaurantA: { deliveryDemand: 0 },
      };
      const treatmentMock = {
        restaurantA: { deliveryDemand: 50 },
      };

      const metrics = [
        {
          id: 'delDemand',
          label: 'Delivery Demand',
          category: 'delivery',
          unit: 'orders',
          getValue: (r) => r.restaurantA.deliveryDemand,
        },
      ];

      const [comp] = compareExperimentResults(baselineMock, treatmentMock, metrics);
      expect(comp.baseline).toBe(0);
      expect(comp.treatment).toBe(50);
      expect(comp.absoluteChange).toBe(50);
      expect(comp.percentChange).toBeNull();
      expect(comp.percentChangeDefined).toBe(false);
    });

    it('handles non-numeric metrics cleanly', () => {
      const baselineMock = { market: { travelCostMode: 'euclidean' } };
      const treatmentMock = { market: { travelCostMode: 'road' } };

      const metrics = [EXPERIMENT_METRICS.travelCostMode];
      const [comp] = compareExperimentResults(baselineMock, treatmentMock, metrics);

      expect(comp.baseline).toBe('euclidean');
      expect(comp.treatment).toBe('road');
      expect(comp.absoluteChange).toBeNull();
      expect(comp.percentChange).toBeNull();
      expect(comp.percentChangeDefined).toBe(false);
    });
  });

  describe('3. Changed Parameter Validation & No Hidden Differences', () => {
    const validBaseline = {
      city: 'balanced',
      platform: { enabled: true, commissionRate: 0.1 },
    };
    const validTreatment = {
      city: 'balanced',
      platform: { enabled: true, commissionRate: 0.3 },
    };

    it('validates declared changed parameters when values match', () => {
      expect(
        validateChangedParameters({
          baseline: validBaseline,
          treatment: validTreatment,
          changedParameters: [
            { path: 'platform.commissionRate', baseline: 0.1, treatment: 0.3 },
          ],
        })
      ).toBe(true);
    });

    it('throws error when declared baseline does not match actual baseline', () => {
      expect(() =>
        validateChangedParameters({
          baseline: validBaseline,
          treatment: validTreatment,
          changedParameters: [
            { path: 'platform.commissionRate', baseline: 0.15, treatment: 0.3 }, // declared 0.15 != 0.10
          ],
        })
      ).toThrow(/Declared baseline for "platform.commissionRate"/);
    });

    it('throws error when declared treatment does not match actual treatment', () => {
      expect(() =>
        validateChangedParameters({
          baseline: validBaseline,
          treatment: validTreatment,
          changedParameters: [
            { path: 'platform.commissionRate', baseline: 0.1, treatment: 0.4 }, // declared 0.4 != 0.3
          ],
        })
      ).toThrow(/Declared treatment for "platform.commissionRate"/);
    });

    it('detects undeclared accidental scenario differences (No Hidden Differences)', () => {
      const accidentalTreatment = {
        city: 'balanced',
        price: 250, // Accidental unannounced change!
        platform: { enabled: true, commissionRate: 0.3 },
      };

      expect(() =>
        validateChangedParameters({
          baseline: validBaseline,
          treatment: accidentalTreatment,
          changedParameters: [
            { path: 'platform.commissionRate', baseline: 0.1, treatment: 0.3 },
          ],
        })
      ).toThrow(/Undeclared scenario difference detected at "price"/);
    });

    const validExperimentDef = {
      id: 'valid-test',
      name: 'Valid Test',
      description: 'Test description',
      hypothesis: 'Test hypothesis',
      baseline: { scenario: validBaseline },
      treatment: { scenario: validTreatment },
      changedParameters: [{ path: 'platform.commissionRate', baseline: 0.1, treatment: 0.3 }],
      metrics: ['restaurantADemand', 'restaurantAProfit'],
    };

    it('rejects experiment definition when metrics array is missing (TypeError)', () => {
      const expWithoutMetrics = { ...validExperimentDef };
      delete expWithoutMetrics.metrics;
      expect(() => validateExperimentDefinition(expWithoutMetrics)).toThrow(TypeError);
      expect(() => validateExperimentDefinition({ ...validExperimentDef, metrics: null })).toThrow(
        TypeError
      );
      expect(() =>
        validateExperimentDefinition({ ...validExperimentDef, metrics: 'restaurantADemand' })
      ).toThrow(TypeError);
    });

    it('rejects experiment definition when metrics array is empty (TypeError)', () => {
      expect(() =>
        validateExperimentDefinition({ ...validExperimentDef, metrics: [] })
      ).toThrow(TypeError);
    });

    it('rejects experiment definition when metric ID is unknown (RangeError)', () => {
      expect(() =>
        validateExperimentDefinition({
          ...validExperimentDef,
          metrics: ['restaurantADemand', 'unknownMetricIdentifier'],
        })
      ).toThrow(RangeError);
    });

    it('passes validation when a valid non-empty metrics array is supplied', () => {
      expect(validateExperimentDefinition(validExperimentDef)).toBe(true);
    });

    it('produces zero changes when baseline and treatment are identical', () => {
      const experiment = {
        id: 'identical-test',
        name: 'Identical Control Test',
        description: 'Verifies zero changes when scenarios are identical.',
        hypothesis: 'Zero variance when no parameter changes.',
        baseline: { scenario: validBaseline },
        treatment: { scenario: { ...validBaseline } },
        changedParameters: [{ path: 'platform.commissionRate', baseline: 0.1, treatment: 0.1 }],
        metrics: ['restaurantADemand', 'restaurantAProfit'],
      };

      const result = runExperiment(experiment);
      expect(result.comparisonMap.restaurantADemand.absoluteChange).toBe(0);
      expect(result.comparisonMap.restaurantAProfit.absoluteChange).toBe(0);
    });
  });

  describe('4. Canonical Experiments Execution', () => {
    it('defines exactly five valid canonical experiments', () => {
      const list = listCanonicalExperiments();
      expect(list).toHaveLength(5);

      for (const exp of list) {
        expect(validateExperimentDefinition(exp)).toBe(true);
        expect(exp.hypothesis.trim().length).toBeGreaterThan(0);
        expect(exp.changedParameters.length).toBeGreaterThan(0);
        expect(exp.metrics.length).toBeGreaterThan(0);
      }
    });

    // CANONICAL EXPERIMENT 1 — PLATFORM COMMISSION SHOCK
    it('EXPERIMENT 1: Platform Commission Shock (higher commission -> lower profit, unchanged demand)', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.PLATFORM_COMMISSION_SHOCK);
      const res = runExperiment(exp);

      const delDemA = res.comparisonMap.restaurantADeliveryDemand;
      const commA = res.comparisonMap.restaurantAPlatformCommission;
      const profitA = res.comparisonMap.restaurantAProfit;

      // Consumer demand must remain identical
      expect(delDemA.absoluteChange).toBe(0);
      expect(delDemA.treatment).toBe(delDemA.baseline);

      // Commission expense increases
      expect(commA.treatment).toBeGreaterThan(commA.baseline);
      expect(commA.absoluteChange).toBeGreaterThan(0);

      // Restaurant profit decreases
      expect(profitA.treatment).toBeLessThan(profitA.baseline);
      expect(profitA.absoluteChange).toBeLessThan(0);
      expect(profitA.absoluteChange).toBeCloseTo(-commA.absoluteChange, 9);
    });

    // CANONICAL EXPERIMENT 2 — DELIVERY COST SHOCK
    it('EXPERIMENT 2: Delivery Cost Shock (higher delivery operating cost -> lower profit)', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.DELIVERY_COST_SHOCK);
      const res = runExperiment(exp);

      const delCostA = res.comparisonMap.restaurantADeliveryOperatingCost;
      const profitA = res.comparisonMap.restaurantAProfit;

      // Delivery operating cost doubles or increases significantly
      expect(delCostA.treatment).toBeGreaterThan(delCostA.baseline);
      expect(delCostA.absoluteChange).toBeGreaterThan(0);

      // Restaurant profit drops by exactly the increase in delivery operating cost
      expect(profitA.treatment).toBeLessThan(profitA.baseline);
      expect(profitA.absoluteChange).toBeCloseTo(-delCostA.absoluteChange, 9);
    });

    // CANONICAL EXPERIMENT 3 — URBAN GEOGRAPHY SHIFT
    it('EXPERIMENT 3: Urban Geography Shift (balanced vs urban core redistributes demand)', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.URBAN_GEOGRAPHY);
      const res = runExperiment(exp);

      expect(res.comparisonMap.restaurantADemand.baseline).toBeGreaterThan(0);
      expect(res.comparisonMap.restaurantADemand.treatment).toBeGreaterThan(0);
      expect(res.comparisonMap.servedPopulation.treatment).toBeGreaterThan(0);

      // Urban core concentrates population, shifting demands
      expect(res.comparisonMap.restaurantADemand.absoluteChange).not.toBe(0);
    });

    // CANONICAL EXPERIMENT 4 — ROAD NETWORK FRICTION
    it('EXPERIMENT 4: Road Network Friction uses constrained barrier topology and alters travel outcomes', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.ROAD_NETWORK_FRICTION);

      // 1. Verify canonical Experiment 4 baseline uses: mode = EUCLIDEAN
      expect(exp.baseline.scenario.mode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);

      // 2. Verify canonical Experiment 4 treatment uses: mode = ROAD
      expect(exp.treatment.scenario.mode).toBe(TRAVEL_COST_MODES.ROAD);

      // 3. Verify both use the SAME constrained road scenario (BARRIER)
      expect(exp.baseline.scenario.roadScenario).toBe(ROAD_SCENARIO_IDS.BARRIER);
      expect(exp.treatment.scenario.roadScenario).toBe(ROAD_SCENARIO_IDS.BARRIER);
      expect(exp.baseline.scenario.roadScenario).toBe(exp.treatment.scenario.roadScenario);

      // 4. Verify the only declared scenario difference remains "mode"
      expect(exp.changedParameters).toEqual([
        {
          path: 'mode',
          baseline: TRAVEL_COST_MODES.EUCLIDEAN,
          treatment: TRAVEL_COST_MODES.ROAD,
        },
      ]);

      // 5. Run the canonical experiment successfully
      const res = runExperiment(exp);
      expect(res).toBeDefined();

      // 6. Verify the constrained road treatment changes at least one travel/delivery outcome relative to Euclidean travel
      const opCostA = res.comparisonMap.restaurantADeliveryOperatingCost;
      const delDemA = res.comparisonMap.restaurantADeliveryDemand;
      const modeComp = res.comparisonMap.travelCostMode;

      expect(modeComp.baseline).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
      expect(modeComp.treatment).toBe(TRAVEL_COST_MODES.ROAD);

      // The river barrier forces geographical detours and alters reachable delivery areas,
      // changing delivery demand and delivery operating costs relative to Euclidean travel
      expect(opCostA.treatment).not.toBe(opCostA.baseline);
      expect(opCostA.absoluteChange).not.toBe(0);
      expect(delDemA.absoluteChange).not.toBe(0);

      // 7. Verify the experiment remains deterministic
      const res2 = runExperiment(exp);
      expect(res.comparison).toEqual(res2.comparison);
      expect(res.baseline.metrics).toEqual(res2.baseline.metrics);
      expect(res.treatment.metrics).toEqual(res2.treatment.metrics);
    });

    // CANONICAL EXPERIMENT 5 — CONSUMER COMPOSITION SHIFT
    it('EXPERIMENT 5: Consumer Composition Shift (balanced vs convenience seekers)', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.CONSUMER_COMPOSITION);
      const res = runExperiment(exp);

      expect(res.comparisonMap.restaurantADemand.baseline).toBeGreaterThan(0);
      expect(res.comparisonMap.restaurantADemand.treatment).toBeGreaterThan(0);
      expect(res.comparisonMap.restaurantAProfit.treatment).toBeDefined();
    });

    it('running the same canonical experiment twice produces identical results (Determinism)', () => {
      const exp = getCanonicalExperiment(CANONICAL_EXPERIMENT_IDS.PLATFORM_COMMISSION_SHOCK);
      const run1 = runExperiment(exp);
      const run2 = runExperiment(exp);

      expect(run1.baseline.metrics).toEqual(run2.baseline.metrics);
      expect(run1.treatment.metrics).toEqual(run2.treatment.metrics);
      expect(run1.comparison).toEqual(run2.comparison);
    });
  });
});
