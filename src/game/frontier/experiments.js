/**
 * @file experiments.js
 * @description Frontier Experiment Laboratory Engine (Phase 9).
 *
 * Core Principles:
 * 1. Controlled Experimentation:
 *      BASELINE vs TREATMENT
 *    Strictly changes only declared parameters while holding all other economic,
 *    geographic, behavioral, and cost variables constant.
 *
 * 2. Orchestration Layer:
 *    Reuses existing authoritative Frontier engines:
 *      Phase 6A/6B/6C (Urban Geography & Road Networks)
 *      Phase 7A/7B/7C (Quality & Consumer Segments)
 *      Phase 8A/8B/8C (Delivery Choice, Operating Costs & Platform Commissions)
 *    Does NOT introduce duplicate economic or behavioral calculations.
 *
 * 3. Validation & No Hidden Differences:
 *    Enforces that declared changed parameters match actual scenario differences,
 *    and detects any undeclared accidental parameter discrepancies.
 *
 * 4. Deterministic Metric Extraction & Comparison:
 *    Extracts normalized metrics from computed scenario results and computes
 *    absolute (treatment - baseline) and percentage changes without dividing by zero.
 */

import { SCENARIO_IDS, createFrontierCity } from './frontierCity.js';
import { ROAD_SCENARIO_IDS, createRoadNetwork } from './roadNetwork.js';
import { TRAVEL_COST_MODES } from './travelCost.js';
import {
  CONSUMER_SEGMENT_PRESET_IDS,
  CONSUMER_SEGMENT_PRESETS,
} from './consumerSegments.js';
import { calculateFrontierPlatformPayoff } from './platformEconomics.js';

/**
 * Metric category classifications.
 */
export const EXPERIMENT_METRIC_CATEGORIES = Object.freeze({
  MARKET: 'market',
  COMPETITION: 'competition',
  DELIVERY: 'delivery',
  PLATFORM: 'platform',
  QUALITY: 'quality',
  GEOGRAPHY: 'geography',
});

/**
 * Authoritative registry of standard experiment metrics.
 */
export const EXPERIMENT_METRICS = Object.freeze({
  // Market Metrics
  totalPopulation: Object.freeze({
    id: 'totalPopulation',
    label: 'Total Population',
    category: EXPERIMENT_METRIC_CATEGORIES.MARKET,
    unit: 'people',
    getValue: (res) => res.market.totalPopulation,
  }),
  servedPopulation: Object.freeze({
    id: 'servedPopulation',
    label: 'Served Population',
    category: EXPERIMENT_METRIC_CATEGORIES.MARKET,
    unit: 'people',
    getValue: (res) => res.market.servedPopulation,
  }),
  unservedPopulation: Object.freeze({
    id: 'unservedPopulation',
    label: 'Unserved Population',
    category: EXPERIMENT_METRIC_CATEGORIES.MARKET,
    unit: 'people',
    getValue: (res) => res.market.unservedPopulation,
  }),
  reachablePopulation: Object.freeze({
    id: 'reachablePopulation',
    label: 'Reachable Population',
    category: EXPERIMENT_METRIC_CATEGORIES.MARKET,
    unit: 'people',
    getValue: (res) => res.market.reachablePopulation,
  }),
  unreachablePopulation: Object.freeze({
    id: 'unreachablePopulation',
    label: 'Unreachable Population',
    category: EXPERIMENT_METRIC_CATEGORIES.MARKET,
    unit: 'people',
    getValue: (res) => res.market.unreachablePopulation,
  }),

  // Competition Metrics
  restaurantADemand: Object.freeze({
    id: 'restaurantADemand',
    label: 'Restaurant A Demand',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'orders',
    getValue: (res) => res.restaurantA.demand,
  }),
  restaurantBDemand: Object.freeze({
    id: 'restaurantBDemand',
    label: 'Restaurant B Demand',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'orders',
    getValue: (res) => res.restaurantB.demand,
  }),
  restaurantAMarketShare: Object.freeze({
    id: 'restaurantAMarketShare',
    label: 'Restaurant A Market Share',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'share',
    getValue: (res) => res.restaurantA.marketShare,
  }),
  restaurantBMarketShare: Object.freeze({
    id: 'restaurantBMarketShare',
    label: 'Restaurant B Market Share',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'share',
    getValue: (res) => res.restaurantB.marketShare,
  }),
  restaurantAProfit: Object.freeze({
    id: 'restaurantAProfit',
    label: 'Restaurant A Profit',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'currency',
    getValue: (res) => res.restaurantA.finalProfit,
  }),
  restaurantBProfit: Object.freeze({
    id: 'restaurantBProfit',
    label: 'Restaurant B Profit',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'currency',
    getValue: (res) => res.restaurantB.finalProfit,
  }),
  profitDifference: Object.freeze({
    id: 'profitDifference',
    label: 'Profit Difference (A - B)',
    category: EXPERIMENT_METRIC_CATEGORIES.COMPETITION,
    unit: 'currency',
    getValue: (res) => res.restaurantA.finalProfit - res.restaurantB.finalProfit,
  }),

  // Delivery Metrics
  restaurantADeliveryDemand: Object.freeze({
    id: 'restaurantADeliveryDemand',
    label: 'Restaurant A Delivery Demand',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'orders',
    getValue: (res) => res.restaurantA.deliveryDemand,
  }),
  restaurantBDeliveryDemand: Object.freeze({
    id: 'restaurantBDeliveryDemand',
    label: 'Restaurant B Delivery Demand',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'orders',
    getValue: (res) => res.restaurantB.deliveryDemand,
  }),
  restaurantADeliveryShare: Object.freeze({
    id: 'restaurantADeliveryShare',
    label: 'Restaurant A Delivery Share',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'share',
    getValue: (res) =>
      res.restaurantA.demand > 0
        ? res.restaurantA.deliveryDemand / res.restaurantA.demand
        : 0,
  }),
  restaurantBDeliveryShare: Object.freeze({
    id: 'restaurantBDeliveryShare',
    label: 'Restaurant B Delivery Share',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'share',
    getValue: (res) =>
      res.restaurantB.demand > 0
        ? res.restaurantB.deliveryDemand / res.restaurantB.demand
        : 0,
  }),
  restaurantADeliveryOperatingCost: Object.freeze({
    id: 'restaurantADeliveryOperatingCost',
    label: 'Restaurant A Delivery Operating Cost',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'currency',
    getValue: (res) => res.restaurantA.deliveryOperatingCost,
  }),
  restaurantBDeliveryOperatingCost: Object.freeze({
    id: 'restaurantBDeliveryOperatingCost',
    label: 'Restaurant B Delivery Operating Cost',
    category: EXPERIMENT_METRIC_CATEGORIES.DELIVERY,
    unit: 'currency',
    getValue: (res) => res.restaurantB.deliveryOperatingCost,
  }),

  // Platform Metrics
  restaurantAPlatformCommission: Object.freeze({
    id: 'restaurantAPlatformCommission',
    label: 'Restaurant A Platform Commission',
    category: EXPERIMENT_METRIC_CATEGORIES.PLATFORM,
    unit: 'currency',
    getValue: (res) => res.restaurantA.platformCommission,
  }),
  restaurantBPlatformCommission: Object.freeze({
    id: 'restaurantBPlatformCommission',
    label: 'Restaurant B Platform Commission',
    category: EXPERIMENT_METRIC_CATEGORIES.PLATFORM,
    unit: 'currency',
    getValue: (res) => res.restaurantB.platformCommission,
  }),
  totalPlatformCommission: Object.freeze({
    id: 'totalPlatformCommission',
    label: 'Total Platform Commission',
    category: EXPERIMENT_METRIC_CATEGORIES.PLATFORM,
    unit: 'currency',
    getValue: (res) =>
      res.restaurantA.platformCommission + res.restaurantB.platformCommission,
  }),

  // Quality Metrics
  restaurantAQualityInvestmentCost: Object.freeze({
    id: 'restaurantAQualityInvestmentCost',
    label: 'Restaurant A Quality Cost',
    category: EXPERIMENT_METRIC_CATEGORIES.QUALITY,
    unit: 'currency',
    getValue: (res) => res.restaurantA.qualityInvestmentCost,
  }),
  restaurantBQualityInvestmentCost: Object.freeze({
    id: 'restaurantBQualityInvestmentCost',
    label: 'Restaurant B Quality Cost',
    category: EXPERIMENT_METRIC_CATEGORIES.QUALITY,
    unit: 'currency',
    getValue: (res) => res.restaurantB.qualityInvestmentCost,
  }),

  // Geography Metrics
  travelCostMode: Object.freeze({
    id: 'travelCostMode',
    label: 'Travel Cost Mode',
    category: EXPERIMENT_METRIC_CATEGORIES.GEOGRAPHY,
    unit: 'text',
    getValue: (res) => res.market.travelCostMode,
  }),
});

/**
 * Resolves a list of metric IDs or metric objects into canonical metric definitions.
 *
 * @param {Array<string|Object>} [metricsList]
 * @returns {Array<Object>}
 */
export function resolveExperimentMetrics(metricsList) {
  if (!metricsList || !Array.isArray(metricsList) || metricsList.length === 0) {
    return Object.values(EXPERIMENT_METRICS);
  }

  return metricsList.map((m) => {
    if (typeof m === 'string') {
      const metric = EXPERIMENT_METRICS[m];
      if (!metric) {
        throw new RangeError(`Unknown experiment metric identifier "${m}".`);
      }
      return metric;
    }
    if (m && typeof m === 'object' && typeof m.id === 'string' && typeof m.getValue === 'function') {
      return m;
    }
    throw new TypeError('Invalid experiment metric specification.');
  });
}

/**
 * Helper to deep-compare two values deterministically.
 *
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function areValuesEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areValuesEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!areValuesEqual(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Retrieves a nested value from a scenario object given a dot-separated or aliased path.
 *
 * @param {Object} scenario
 * @param {string} path
 * @returns {unknown}
 */
export function getScenarioValue(scenario, path) {
  if (!scenario || typeof scenario !== 'object') return undefined;

  // Handle common top-level aliases
  if (path === 'city' || path === 'city.scenario') {
    if (typeof scenario.city === 'string') return scenario.city;
    if (scenario.city?.scenario) return scenario.city.scenario;
    if (scenario.city?.id) return scenario.city.id;
  }

  if (path === 'mode' || path === 'travelCost.mode' || path === 'travelCostMode') {
    return scenario.mode ?? scenario.travelCost?.mode ?? scenario.travelCostMode;
  }

  if (path === 'roadScenario' || path === 'roadNetwork' || path === 'roadNetwork.scenario') {
    if (typeof scenario.roadScenario === 'string') return scenario.roadScenario;
    if (typeof scenario.roadNetwork === 'string') return scenario.roadNetwork;
    if (scenario.roadNetwork?.scenario) return scenario.roadNetwork.scenario;
  }

  if (path === 'consumerSegments' || path === 'segments') {
    return scenario.consumerSegments ?? scenario.segments;
  }

  // Generic dot-path resolution
  const parts = path.split('.');
  let curr = scenario;
  for (const p of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = curr[p];
  }
  return curr;
}

/**
 * Normalizes path strings to canonical identifiers for comparison purposes.
 *
 * @param {string} path
 * @returns {string}
 */
function normalizeScenarioPath(path) {
  if (path === 'travelCost.mode' || path === 'travelCostMode') return 'mode';
  if (path === 'city.scenario') return 'city';
  if (path === 'segments') return 'consumerSegments';
  if (path === 'roadNetwork') return 'roadScenario';
  return path;
}

/**
 * Recursively inspects differences between two scenario objects.
 *
 * @param {Object} baseline
 * @param {Object} treatment
 * @param {string} [prefix='']
 * @returns {Array<{ path: string, baseline: unknown, treatment: unknown }>}
 */
export function findScenarioDifferences(baseline, treatment, prefix = '') {
  const diffs = [];

  if (areValuesEqual(baseline, treatment)) {
    return diffs;
  }

  if (
    baseline === null ||
    typeof baseline !== 'object' ||
    treatment === null ||
    typeof treatment !== 'object'
  ) {
    diffs.push({ path: prefix, baseline, treatment });
    return diffs;
  }

  // Compare arrays directly
  if (Array.isArray(baseline) || Array.isArray(treatment)) {
    if (!areValuesEqual(baseline, treatment)) {
      diffs.push({ path: prefix, baseline, treatment });
    }
    return diffs;
  }

  const allKeys = Array.from(new Set([...Object.keys(baseline), ...Object.keys(treatment)]));

  for (const key of allKeys) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    const valB = baseline[key];
    const valT = treatment[key];

    if (!areValuesEqual(valB, valT)) {
      if (
        valB !== null &&
        typeof valB === 'object' &&
        valT !== null &&
        typeof valT === 'object' &&
        !Array.isArray(valB) &&
        !Array.isArray(valT)
      ) {
        diffs.push(...findScenarioDifferences(valB, valT, currentPath));
      } else {
        diffs.push({ path: currentPath, baseline: valB, treatment: valT });
      }
    }
  }

  return diffs;
}

/**
 * Validates that declared changed parameters match actual values in baseline/treatment,
 * and ensures no undeclared hidden differences exist.
 *
 * @param {Object} params
 * @param {Object} params.baseline
 * @param {Object} params.treatment
 * @param {Array<{ path: string, baseline: unknown, treatment: unknown }>} params.changedParameters
 */
export function validateChangedParameters({ baseline, treatment, changedParameters }) {
  if (!Array.isArray(changedParameters) || changedParameters.length === 0) {
    throw new TypeError('Experiment definition must declare at least one changedParameter.');
  }

  const declaredNormalizedPaths = new Set();

  for (let i = 0; i < changedParameters.length; i++) {
    const item = changedParameters[i];
    if (!item || typeof item !== 'object' || typeof item.path !== 'string') {
      throw new TypeError(`Changed parameter at index ${i} must specify a string "path".`);
    }

    const normPath = normalizeScenarioPath(item.path);
    declaredNormalizedPaths.add(normPath);

    const actualBaseline = getScenarioValue(baseline, item.path);
    const actualTreatment = getScenarioValue(treatment, item.path);

    if (!areValuesEqual(actualBaseline, item.baseline)) {
      throw new Error(
        `Declared baseline for "${item.path}" (${JSON.stringify(item.baseline)}) does not match actual baseline scenario value (${JSON.stringify(actualBaseline)}).`
      );
    }

    if (!areValuesEqual(actualTreatment, item.treatment)) {
      throw new Error(
        `Declared treatment for "${item.path}" (${JSON.stringify(item.treatment)}) does not match actual treatment scenario value (${JSON.stringify(actualTreatment)}).`
      );
    }
  }

  // Detect undeclared hidden differences
  const allDiffs = findScenarioDifferences(baseline, treatment);

  for (const diff of allDiffs) {
    const normDiffPath = normalizeScenarioPath(diff.path);

    const isDeclared = Array.from(declaredNormalizedPaths).some(
      (decl) =>
        normDiffPath === decl ||
        normDiffPath.startsWith(`${decl}.`) ||
        decl.startsWith(`${normDiffPath}.`)
    );

    if (!isDeclared) {
      throw new Error(
        `Undeclared scenario difference detected at "${diff.path}": baseline has ${JSON.stringify(diff.baseline)}, treatment has ${JSON.stringify(diff.treatment)}.`
      );
    }
  }

  return true;
}

/**
 * Canonical default test restaurants for experiment scenarios.
 */
export const CANONICAL_EXPERIMENT_RESTAURANT_A = Object.freeze({
  id: 'A',
  location: Object.freeze({ x: 2, y: 2 }),
  price: 200,
  quality: 6,
  delivery: Object.freeze({
    enabled: true,
    radius: 6,
    fee: 0,
    baseTime: 0,
    timePerDistance: 0,
  }),
});

export const CANONICAL_EXPERIMENT_RESTAURANT_B = Object.freeze({
  id: 'B',
  location: Object.freeze({ x: 7, y: 7 }),
  price: 200,
  quality: 6,
  delivery: Object.freeze({
    enabled: true,
    radius: 6,
    fee: 0,
    baseTime: 0,
    timePerDistance: 0,
  }),
});

/**
 * Runs one Frontier scenario through the authoritative multi-phase pipeline
 * and returns one normalized scenario result object.
 *
 * @param {Object} scenario
 * @returns {Readonly<{
 *   scenario: Object,
 *   restaurantA: Readonly<Object>,
 *   restaurantB: Readonly<Object>,
 *   market: Readonly<Object>,
 *   rawPayoff: Readonly<Object>
 * }>}
 */
export function runFrontierScenario(scenario = {}) {
  if (!scenario || typeof scenario !== 'object') {
    throw new TypeError('runFrontierScenario requires a valid scenario object.');
  }

  // 1. Resolve city
  let city;
  if (typeof scenario.city === 'string') {
    city = createFrontierCity({ scenario: scenario.city });
  } else if (scenario.city && typeof scenario.city === 'object' && Array.isArray(scenario.city.cells)) {
    city = scenario.city;
  } else {
    city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });
  }

  // 2. Resolve travel cost mode and road network
  const mode =
    scenario.mode ??
    scenario.travelCostMode ??
    scenario.travelCost?.mode ??
    TRAVEL_COST_MODES.EUCLIDEAN;

  let roadNetwork = null;
  if (mode === TRAVEL_COST_MODES.ROAD) {
    if (scenario.roadNetwork && typeof scenario.roadNetwork === 'object' && scenario.roadNetwork.adjacency) {
      roadNetwork = scenario.roadNetwork;
    } else {
      const roadScenario =
        typeof scenario.roadScenario === 'string'
          ? scenario.roadScenario
          : typeof scenario.roadNetwork === 'string'
            ? scenario.roadNetwork
            : ROAD_SCENARIO_IDS.GRID;
      roadNetwork = createRoadNetwork({ city, scenario: roadScenario });
    }
  }

  // 3. Resolve consumer segments
  let segments = undefined;
  const rawSegments = scenario.consumerSegments ?? scenario.segments;
  if (typeof rawSegments === 'string') {
    const preset = CONSUMER_SEGMENT_PRESETS[rawSegments];
    if (!preset) {
      throw new RangeError(`Unknown consumer segment preset "${rawSegments}".`);
    }
    segments = [preset];
  } else if (Array.isArray(rawSegments)) {
    segments = rawSegments;
  }

  // 4. Resolve restaurants
  const rawA = scenario.restaurantA ?? scenario.restaurants?.[0] ?? CANONICAL_EXPERIMENT_RESTAURANT_A;
  const rawB = scenario.restaurantB ?? scenario.restaurants?.[1] ?? CANONICAL_EXPERIMENT_RESTAURANT_B;

  const rA = { ...rawA };
  const rB = { ...rawB };

  // 5. Evaluate full Phase 8A -> 8B -> 8C pipeline via calculateFrontierPlatformPayoff
  const payoff = calculateFrontierPlatformPayoff({
    city,
    mode,
    roadNetwork,
    restaurantA: rA,
    restaurantB: rB,
    segments,
    deliveryA: scenario.deliveryA ?? rA.delivery,
    deliveryB: scenario.deliveryB ?? rB.delivery,
    deliveryEconomics: scenario.deliveryEconomics,
    deliveryEconomicsA: scenario.deliveryEconomicsA ?? rA.deliveryEconomics,
    deliveryEconomicsB: scenario.deliveryEconomicsB ?? rB.deliveryEconomics,
    platform: scenario.platform,
    platformA: scenario.platformA ?? rA.platform,
    platformB: scenario.platformB ?? rB.platform,
    variableCost: scenario.variableCost,
    variableCostA: scenario.variableCostA ?? rA.variableCost,
    variableCostB: scenario.variableCostB ?? rB.variableCost,
    fixedCost: scenario.fixedCost,
    fixedCostA: scenario.fixedCostA ?? rA.fixedCost,
    fixedCostB: scenario.fixedCostB ?? rB.fixedCost,
    kappa: scenario.kappa,
    kappaA: scenario.kappaA ?? rA.kappa,
    kappaB: scenario.kappaB ?? rB.kappa,
    config: scenario.config,
    tolerance: scenario.tolerance,
  });

  return Object.freeze({
    scenario: Object.freeze({ ...scenario }),
    restaurantA: Object.freeze({
      id: payoff.restaurantA.id,
      demand: payoff.restaurantA.demand,
      marketShare: payoff.restaurantA.marketShare,
      dineInDemand: payoff.restaurantA.dineInDemand,
      deliveryDemand: payoff.restaurantA.deliveryDemand,
      deliveryDistanceSum: payoff.restaurantA.deliveryDistanceSum,
      deliveryOperatingCost: payoff.restaurantA.deliveryOperatingCost,
      platformCommission: payoff.restaurantA.platformCommission,
      qualityInvestmentCost: payoff.restaurantA.qualityInvestmentCost,
      baseProfit: payoff.restaurantA.baseProfit,
      profitBeforePlatformCommission: payoff.restaurantA.profitBeforePlatformCommission,
      finalProfit: payoff.restaurantA.finalProfit,
      profit: payoff.restaurantA.finalProfit,
      price: rA.price,
      quality: rA.quality,
      location: Object.freeze({ ...(rA.location ?? rA) }),
    }),
    restaurantB: Object.freeze({
      id: payoff.restaurantB.id,
      demand: payoff.restaurantB.demand,
      marketShare: payoff.restaurantB.marketShare,
      dineInDemand: payoff.restaurantB.dineInDemand,
      deliveryDemand: payoff.restaurantB.deliveryDemand,
      deliveryDistanceSum: payoff.restaurantB.deliveryDistanceSum,
      deliveryOperatingCost: payoff.restaurantB.deliveryOperatingCost,
      platformCommission: payoff.restaurantB.platformCommission,
      qualityInvestmentCost: payoff.restaurantB.qualityInvestmentCost,
      baseProfit: payoff.restaurantB.baseProfit,
      profitBeforePlatformCommission: payoff.restaurantB.profitBeforePlatformCommission,
      finalProfit: payoff.restaurantB.finalProfit,
      profit: payoff.restaurantB.finalProfit,
      price: rB.price,
      quality: rB.quality,
      location: Object.freeze({ ...(rB.location ?? rB) }),
    }),
    market: Object.freeze({
      totalPopulation: payoff.totalPopulation,
      servedPopulation: payoff.servedPopulation,
      unservedPopulation: payoff.unservedPopulation,
      reachablePopulation: payoff.reachablePopulation,
      unreachablePopulation: payoff.unreachablePopulation,
      travelCostMode: payoff.travelCostMode,
    }),
    rawPayoff: payoff,
  });
}

/**
 * Extracts all requested metrics from a single scenario result.
 *
 * @param {Object} result - Normalized scenario result
 * @param {Array<Object>} metrics - Metric definitions
 * @returns {Record<string, number|string>}
 */
export function extractExperimentMetrics(result, metrics) {
  const values = {};
  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i];
    values[m.id] = m.getValue(result);
  }
  return Object.freeze(values);
}

/**
 * Compares baseline and treatment scenario results across specified metrics.
 * Computes absolute change and safe percentage change.
 *
 * When baseline is 0:
 *   percentChange = null
 *   percentChangeDefined = false
 *
 * @param {Object} baselineResult
 * @param {Object} treatmentResult
 * @param {Array<string|Object>} [metricsList]
 * @returns {Array<Readonly<Object>>}
 */
export function compareExperimentResults(baselineResult, treatmentResult, metricsList) {
  if (!baselineResult || !treatmentResult) {
    throw new TypeError('compareExperimentResults requires baseline and treatment results.');
  }

  const metrics = resolveExperimentMetrics(metricsList);
  const comparisons = [];

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const bVal = metric.getValue(baselineResult);
    const tVal = metric.getValue(treatmentResult);

    let absoluteChange = null;
    let percentChange = null;
    let percentChangeDefined = false;

    if (typeof bVal === 'number' && typeof tVal === 'number') {
      absoluteChange = tVal - bVal;
      if (bVal === 0) {
        percentChange = null;
        percentChangeDefined = false;
      } else {
        percentChange = ((tVal - bVal) / Math.abs(bVal)) * 100;
        percentChangeDefined = true;
      }
    }

    comparisons.push(
      Object.freeze({
        id: metric.id,
        label: metric.label,
        category: metric.category,
        unit: metric.unit,
        baseline: bVal,
        treatment: tVal,
        absoluteChange,
        percentChange,
        percentChangeDefined,
      })
    );
  }

  return Object.freeze(comparisons);
}

/**
 * Validates an experiment definition object.
 *
 * @param {unknown} def
 * @returns {boolean}
 */
export function validateExperimentDefinition(def) {
  if (!def || typeof def !== 'object') {
    throw new TypeError('Experiment definition must be a valid non-null object.');
  }

  const { id, name, description, hypothesis, baseline, treatment, changedParameters, metrics } = def;

  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('Experiment definition must have a non-empty string "id".');
  }

  if (typeof name !== 'string' || name.trim() === '') {
    throw new TypeError('Experiment definition must have a non-empty string "name".');
  }

  if (typeof description !== 'string' || description.trim() === '') {
    throw new TypeError('Experiment definition must have a non-empty string "description".');
  }

  if (typeof hypothesis !== 'string' || hypothesis.trim() === '') {
    throw new TypeError('Experiment definition must have a non-empty string "hypothesis".');
  }

  if (!baseline || typeof baseline !== 'object' || !baseline.scenario) {
    throw new TypeError('Experiment definition must define a valid baseline with a scenario.');
  }

  if (!treatment || typeof treatment !== 'object' || !treatment.scenario) {
    throw new TypeError('Experiment definition must define a valid treatment with a scenario.');
  }

  if (!Array.isArray(changedParameters) || changedParameters.length === 0) {
    throw new TypeError('Experiment definition must specify a non-empty changedParameters array.');
  }

  if (!Array.isArray(metrics) || metrics.length === 0) {
    throw new TypeError('Experiment definition must specify a non-empty metrics array.');
  }

  // Validate that all metric specifications or IDs are valid (throws RangeError on unknown metric)
  resolveExperimentMetrics(metrics);

  // Validate declared changed parameters and verify no hidden differences
  validateChangedParameters({
    baseline: baseline.scenario,
    treatment: treatment.scenario,
    changedParameters,
  });

  return true;
}

/**
 * Runs a complete experiment: validates definition, executes baseline & treatment,
 * extracts metrics, and computes comparisons.
 *
 * @param {Object} experimentDefinition
 * @returns {Readonly<{
 *   experiment: Object,
 *   baseline: Readonly<{ result: Object, metrics: Record<string, number|string> }>,
 *   treatment: Readonly<{ result: Object, metrics: Record<string, number|string> }>,
 *   comparison: ReadonlyArray<Readonly<Object>>,
 *   comparisonMap: Readonly<Record<string, Readonly<Object>>>
 * }>}
 */
export function runExperiment(experimentDefinition) {
  validateExperimentDefinition(experimentDefinition);

  const baselineResult = runFrontierScenario(experimentDefinition.baseline.scenario);
  const treatmentResult = runFrontierScenario(experimentDefinition.treatment.scenario);

  const resolvedMetrics = resolveExperimentMetrics(experimentDefinition.metrics);

  const baselineMetrics = extractExperimentMetrics(baselineResult, resolvedMetrics);
  const treatmentMetrics = extractExperimentMetrics(treatmentResult, resolvedMetrics);

  const comparison = compareExperimentResults(baselineResult, treatmentResult, resolvedMetrics);

  const comparisonMap = {};
  for (let i = 0; i < comparison.length; i++) {
    comparisonMap[comparison[i].id] = comparison[i];
  }

  return Object.freeze({
    experiment: Object.freeze({ ...experimentDefinition }),
    baseline: Object.freeze({
      result: baselineResult,
      metrics: baselineMetrics,
    }),
    treatment: Object.freeze({
      result: treatmentResult,
      metrics: treatmentMetrics,
    }),
    comparison,
    comparisonMap: Object.freeze(comparisonMap),
  });
}

/**
 * Canonical Experiment Identifiers.
 */
export const CANONICAL_EXPERIMENT_IDS = Object.freeze({
  PLATFORM_COMMISSION_SHOCK: 'platform-commission-shock',
  DELIVERY_COST_SHOCK: 'delivery-cost-shock',
  URBAN_GEOGRAPHY: 'urban-geography',
  ROAD_NETWORK_FRICTION: 'road-network-friction',
  CONSUMER_COMPOSITION: 'consumer-composition',
});

/**
 * Canonical Experiment Definitions.
 * Exactly 5 foundational experiments demonstrating the platform engine.
 */
export const CANONICAL_EXPERIMENTS = Object.freeze({
  // 1. Platform Commission Shock
  [CANONICAL_EXPERIMENT_IDS.PLATFORM_COMMISSION_SHOCK]: Object.freeze({
    id: CANONICAL_EXPERIMENT_IDS.PLATFORM_COMMISSION_SHOCK,
    name: 'Platform Commission Shock',
    description:
      'Evaluates firm profits under an aggregator take-rate hike from 10% to 30% while consumer choices remain fixed.',
    hypothesis:
      'Increasing aggregator commission reduces restaurant profit when delivery demand is positive, while consumer allocation remains unchanged when all consumer-facing variables remain fixed.',
    baseline: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.1 }),
      }),
    }),
    treatment: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.3 }),
      }),
    }),
    changedParameters: Object.freeze([
      Object.freeze({
        path: 'platform.commissionRate',
        baseline: 0.1,
        treatment: 0.3,
      }),
    ]),
    metrics: Object.freeze([
      'restaurantADeliveryDemand',
      'restaurantBDeliveryDemand',
      'restaurantAPlatformCommission',
      'restaurantBPlatformCommission',
      'restaurantAProfit',
      'restaurantBProfit',
    ]),
  }),

  // 2. Delivery Cost Shock
  [CANONICAL_EXPERIMENT_IDS.DELIVERY_COST_SHOCK]: Object.freeze({
    id: CANONICAL_EXPERIMENT_IDS.DELIVERY_COST_SHOCK,
    name: 'Delivery Cost Shock',
    description:
      'Measures firm profit erosion when courier dispatch and transit costs double.',
    hypothesis:
      'Increasing delivery operating cost reduces restaurant profit when delivery demand is positive.',
    baseline: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    treatment: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 40, distanceCostPerUnit: 10 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    changedParameters: Object.freeze([
      Object.freeze({
        path: 'deliveryEconomics.baseCostPerDelivery',
        baseline: 20,
        treatment: 40,
      }),
      Object.freeze({
        path: 'deliveryEconomics.distanceCostPerUnit',
        baseline: 5,
        treatment: 10,
      }),
    ]),
    metrics: Object.freeze([
      'restaurantADeliveryDemand',
      'restaurantBDeliveryDemand',
      'restaurantADeliveryOperatingCost',
      'restaurantBDeliveryOperatingCost',
      'restaurantAProfit',
      'restaurantBProfit',
    ]),
  }),

  // 3. Urban Geography Shift
  [CANONICAL_EXPERIMENT_IDS.URBAN_GEOGRAPHY]: Object.freeze({
    id: CANONICAL_EXPERIMENT_IDS.URBAN_GEOGRAPHY,
    name: 'Urban Geography Shift',
    description:
      'Compares market access and competition between a uniform balanced city and a monocentric urban core.',
    hypothesis:
      'Concentrating population around an urban core changes restaurant demand and spatial competition relative to a balanced city.',
    baseline: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    treatment: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.URBAN_CORE,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    changedParameters: Object.freeze([
      Object.freeze({
        path: 'city',
        baseline: SCENARIO_IDS.BALANCED,
        treatment: SCENARIO_IDS.URBAN_CORE,
      }),
    ]),
    metrics: Object.freeze([
      'restaurantADemand',
      'restaurantBDemand',
      'restaurantAMarketShare',
      'restaurantBMarketShare',
      'restaurantADeliveryDemand',
      'restaurantBDeliveryDemand',
      'restaurantAProfit',
      'restaurantBProfit',
      'servedPopulation',
    ]),
  }),

  // 4. Road Network Friction
  [CANONICAL_EXPERIMENT_IDS.ROAD_NETWORK_FRICTION]: Object.freeze({
    id: CANONICAL_EXPERIMENT_IDS.ROAD_NETWORK_FRICTION,
    name: 'Road Network Friction',
    description:
      'Compares idealized Euclidean travel with a constrained river barrier road network topology.',
    hypothesis:
      'Replacing Euclidean travel with a constrained road network changes market access and restaurant outcomes when barriers or bottlenecks alter travel costs.',
    baseline: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
        roadScenario: ROAD_SCENARIO_IDS.BARRIER,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    treatment: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        mode: TRAVEL_COST_MODES.ROAD,
        roadScenario: ROAD_SCENARIO_IDS.BARRIER,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    changedParameters: Object.freeze([
      Object.freeze({
        path: 'mode',
        baseline: TRAVEL_COST_MODES.EUCLIDEAN,
        treatment: TRAVEL_COST_MODES.ROAD,
      }),
    ]),
    metrics: Object.freeze([
      'restaurantADemand',
      'restaurantBDemand',
      'restaurantAMarketShare',
      'restaurantBMarketShare',
      'restaurantADeliveryDemand',
      'restaurantBDeliveryDemand',
      'restaurantADeliveryOperatingCost',
      'restaurantBDeliveryOperatingCost',
      'restaurantAProfit',
      'restaurantBProfit',
      'servedPopulation',
      'travelCostMode',
    ]),
  }),

  // 5. Consumer Composition Shift
  [CANONICAL_EXPERIMENT_IDS.CONSUMER_COMPOSITION]: Object.freeze({
    id: CANONICAL_EXPERIMENT_IDS.CONSUMER_COMPOSITION,
    name: 'Consumer Composition Shift',
    description:
      'Examines market re-allocation when consumers shift from balanced preferences to high convenience/time sensitivity.',
    hypothesis:
      'Changing consumer segment composition changes restaurant demand because different consumer types weight price, quality, and convenience differently.',
    baseline: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        consumerSegments: CONSUMER_SEGMENT_PRESET_IDS.BALANCED,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    treatment: Object.freeze({
      scenario: Object.freeze({
        city: SCENARIO_IDS.BALANCED,
        consumerSegments: CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS,
        restaurantA: CANONICAL_EXPERIMENT_RESTAURANT_A,
        restaurantB: CANONICAL_EXPERIMENT_RESTAURANT_B,
        deliveryEconomics: Object.freeze({ baseCostPerDelivery: 20, distanceCostPerUnit: 5 }),
        platform: Object.freeze({ enabled: true, commissionRate: 0.2 }),
      }),
    }),
    changedParameters: Object.freeze([
      Object.freeze({
        path: 'consumerSegments',
        baseline: CONSUMER_SEGMENT_PRESET_IDS.BALANCED,
        treatment: CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS,
      }),
    ]),
    metrics: Object.freeze([
      'restaurantADemand',
      'restaurantBDemand',
      'restaurantAMarketShare',
      'restaurantBMarketShare',
      'restaurantADeliveryDemand',
      'restaurantBDeliveryDemand',
      'restaurantAProfit',
      'restaurantBProfit',
    ]),
  }),
});

/**
 * Retrieves a canonical experiment definition by identifier.
 *
 * @param {string} id
 * @returns {Readonly<Object>}
 */
export function getCanonicalExperiment(id) {
  const exp = CANONICAL_EXPERIMENTS[id];
  if (!exp) {
    throw new RangeError(`Unknown canonical experiment ID "${id}".`);
  }
  return exp;
}

/**
 * Lists all canonical experiment definitions.
 *
 * @returns {Array<Readonly<Object>>}
 */
export function listCanonicalExperiments() {
  return Object.values(CANONICAL_EXPERIMENTS);
}
