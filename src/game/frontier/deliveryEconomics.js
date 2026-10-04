/**
 * @file deliveryEconomics.js
 * @description Frontier Delivery Economics & Restaurant-Side Delivery Operating Cost Engine (Phase 8B).
 *
 * Mathematical Foundations:
 * 1. Restaurant Profit before Delivery Operating Costs (Phase 7B / 7C baseline):
 *      pi_j^base = (P_j - C_j) * D_j - F_j - K(Q_j)
 *    where:
 *      P_j      = restaurant price
 *      C_j      = variable / marginal cost per customer served (default: 100)
 *      D_j      = total restaurant demand (D_j = D_dineIn,j + D_delivery,j)
 *      F_j      = fixed operational cost (default: 0)
 *      K(Q_j)   = strategic quality investment cost (kappa * Q_j^2, omitted when quality is non-strategic)
 *
 * 2. Restaurant Delivery Operating Cost (Phase 8B):
 *      C_delivery,j = c_base,j * D_delivery,j + c_distance,j * sum_i ( deliveryDemand_ij * T_ij )
 *    where:
 *      c_base,j          = base operating cost per delivered customer (order packing, courier dispatch, packaging)
 *      c_distance,j      = distance-dependent delivery cost coefficient (fuel, driver transit compensation)
 *      deliveryDemand_ij = actual number of customers from zone i choosing delivery from restaurant j
 *      D_delivery,j      = sum_i deliveryDemand_ij (total delivery customers served by restaurant j)
 *      T_ij              = travel cost / road distance from existing Frontier travel-cost abstraction
 *
 * 3. Final Restaurant Profit:
 *      pi_j^final = pi_j^base - C_delivery,j
 *
 * Crucial Economic Distinction:
 * - Consumer Delivery Fee (F_j from Phase 8A):
 *     Consumer-facing surcharge paid by the customer that reduces consumer utility (U_delivery = ... - beta * (P + F) - ...).
 * - Restaurant Delivery Operating Cost (C_delivery,j from Phase 8B):
 *     Restaurant-side operational cost paid by the restaurant that reduces restaurant profit.
 *   These two quantities are conceptually and computationally distinct.
 *
 * Delivery Costs Depend on ACTUAL Delivery Demand:
 * - Dine-in customers incur NO delivery operating cost.
 * - Competitor customers incur NO delivery operating cost.
 * - Unserved / unreachable customers incur NO delivery operating cost.
 * - If deliveryDemand_j == 0, C_delivery,j == 0.
 *
 * Non-Strategic Boundary:
 * Delivery economics parameters (baseCostPerDelivery, distanceCostPerUnit) are exogenous cost parameters.
 * They are NOT strategic decision variables in Phase 8B.
 */

import {
  DEFAULT_VARIABLE_COST,
  DEFAULT_FIXED_COST,
} from '../types.js';
import { calculateFrontierProfit } from './payoff.js';
import { calculateQualityInvestmentCost } from './strategicQuality.js';
import { calculateFrontierDeliveryMarket } from './deliveryChoice.js';

/**
 * Default base operating cost per delivered order (c_base).
 * Covers packaging, order handling, and courier base dispatch.
 */
export const DEFAULT_DELIVERY_BASE_COST = 20;

/**
 * Default distance-dependent delivery cost per unit of spatial travel cost (c_distance).
 * Covers vehicle fuel, driver transit time, and transit wear.
 */
export const DEFAULT_DELIVERY_DISTANCE_COST = 5;

/**
 * Default immutable delivery economics configuration.
 */
export const DEFAULT_DELIVERY_ECONOMICS_CONFIG = Object.freeze({
  baseCostPerDelivery: DEFAULT_DELIVERY_BASE_COST,
  distanceCostPerUnit: DEFAULT_DELIVERY_DISTANCE_COST,
});

/**
 * Validates a delivery economics configuration object.
 * Throws TypeError or RangeError on invalid input.
 *
 * Requirements:
 * - values must be finite numbers
 * - values must be >= 0
 *
 * @param {unknown} config - Delivery economics configuration candidate
 * @returns {boolean} True if structurally and mathematically valid
 */
export function validateDeliveryEconomicsConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Delivery economics configuration must be a valid non-null object.');
  }

  const { baseCostPerDelivery, distanceCostPerUnit } = config;

  if (typeof baseCostPerDelivery !== 'number' || !Number.isFinite(baseCostPerDelivery)) {
    throw new TypeError(
      `Delivery economics "baseCostPerDelivery" must be a finite number, received ${baseCostPerDelivery}.`
    );
  }

  if (baseCostPerDelivery < 0) {
    throw new RangeError(
      `Delivery economics "baseCostPerDelivery" must be non-negative, received ${baseCostPerDelivery}.`
    );
  }

  if (typeof distanceCostPerUnit !== 'number' || !Number.isFinite(distanceCostPerUnit)) {
    throw new TypeError(
      `Delivery economics "distanceCostPerUnit" must be a finite number, received ${distanceCostPerUnit}.`
    );
  }

  if (distanceCostPerUnit < 0) {
    throw new RangeError(
      `Delivery economics "distanceCostPerUnit" must be non-negative, received ${distanceCostPerUnit}.`
    );
  }

  return true;
}

/**
 * Creates and normalizes an immutable delivery economics configuration.
 *
 * @param {Object} [overrides={}]
 * @param {number} [overrides.baseCostPerDelivery=20] - Base operating cost per delivery
 * @param {number} [overrides.distanceCostPerUnit=5] - Distance-dependent cost per travel cost unit
 * @returns {Readonly<{
 *   baseCostPerDelivery: number,
 *   distanceCostPerUnit: number
 * }>}
 */
export function createDeliveryEconomicsConfig(overrides = {}) {
  if (overrides === null || typeof overrides !== 'object') {
    throw new TypeError('createDeliveryEconomicsConfig overrides must be an object.');
  }

  const candidate = {
    baseCostPerDelivery:
      overrides.baseCostPerDelivery !== undefined
        ? overrides.baseCostPerDelivery
        : DEFAULT_DELIVERY_BASE_COST,
    distanceCostPerUnit:
      overrides.distanceCostPerUnit !== undefined
        ? overrides.distanceCostPerUnit
        : DEFAULT_DELIVERY_DISTANCE_COST,
  };

  validateDeliveryEconomicsConfig(candidate);

  return Object.freeze(candidate);
}

/**
 * Calculates restaurant delivery operating cost from delivery demand and aggregate delivery travel distance:
 *   C_delivery = c_base * D_delivery + c_distance * deliveryTravelCost
 *
 * Where:
 *   deliveryTravelCost = sum_i (deliveryDemand_i * T_i)
 *
 * When delivery demand is 0, delivery operating cost is strictly 0.
 *
 * @param {Object} params
 * @param {number} params.deliveryDemand - Total delivery customers served (>= 0)
 * @param {number} [params.deliveryTravelCost=0] - Aggregate travel distance sum for delivery customers (>= 0)
 * @param {number} [params.deliveryDistanceSum] - Alias for deliveryTravelCost
 * @param {Object} [params.config=DEFAULT_DELIVERY_ECONOMICS_CONFIG] - Delivery economics configuration
 * @returns {number} Restaurant delivery operating cost (>= 0)
 */
export function calculateDeliveryOperatingCost(params = {}) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('calculateDeliveryOperatingCost requires a parameters object.');
  }

  const { deliveryDemand, config } = params;

  if (typeof deliveryDemand !== 'number' || !Number.isFinite(deliveryDemand)) {
    throw new TypeError(`Delivery demand must be a finite number, received ${deliveryDemand}.`);
  }

  if (deliveryDemand < 0) {
    throw new RangeError(`Delivery demand must be non-negative, received ${deliveryDemand}.`);
  }

  const rawTravelCost = params.deliveryTravelCost ?? params.deliveryDistanceSum ?? 0;
  if (typeof rawTravelCost !== 'number' || !Number.isFinite(rawTravelCost)) {
    throw new TypeError(
      `Delivery travel cost / distance sum must be a finite number, received ${rawTravelCost}.`
    );
  }

  if (rawTravelCost < 0) {
    throw new RangeError(
      `Delivery travel cost / distance sum must be non-negative, received ${rawTravelCost}.`
    );
  }

  // If there is zero delivery demand, delivery operating cost is strictly zero
  if (deliveryDemand === 0) {
    return 0;
  }

  const econConfig = config !== undefined
    ? (validateDeliveryEconomicsConfig(config), config)
    : DEFAULT_DELIVERY_ECONOMICS_CONFIG;

  const baseCost = econConfig.baseCostPerDelivery * deliveryDemand;
  const distanceCost = econConfig.distanceCostPerUnit * rawTravelCost;

  return baseCost + distanceCost;
}

/**
 * Extracts zone-level delivery demand and travel cost metrics for a specific restaurant from
 * Phase 8A market results or an array of zone allocation records.
 *
 * Supports:
 * - Authoritative `marketResult` from `calculateFrontierDeliveryMarket`
 * - Direct array of zone allocation objects: `[{ zone, deliveryDemand, travelCost }]`
 *
 * @param {Object} params
 * @param {Object|Array<Object>} params.marketResult - Market result or zone allocations array
 * @param {Array<Object>} [params.zoneAllocations] - Alternative explicit zone allocations array
 * @param {string} [params.restaurantId] - Restaurant identifier (e.g. 'A', 'B', or custom ID)
 * @param {Object} [params.restaurant] - Restaurant object containing { id }
 * @returns {Readonly<{
 *   totalDemand: number,
 *   dineInDemand: number,
 *   deliveryDemand: number,
 *   deliveryDistanceSum: number
 * }>}
 */
export function extractZoneDeliveryMetrics(params = {}) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('extractZoneDeliveryMetrics requires a parameters object.');
  }

  const { marketResult, restaurantId, restaurant } = params;
  const targetId = (restaurantId ?? restaurant?.id ?? 'A').toString().trim();

  let rawAllocations = null;
  if (Array.isArray(params.zoneAllocations)) {
    rawAllocations = params.zoneAllocations;
  } else if (Array.isArray(marketResult)) {
    rawAllocations = marketResult;
  } else if (marketResult && typeof marketResult === 'object' && Array.isArray(marketResult.zoneAllocations)) {
    rawAllocations = marketResult.zoneAllocations;
  }

  // Determine whether this target ID corresponds to restaurant A or B in marketResult
  let isRestaurantA = targetId === 'A';
  let isRestaurantB = targetId === 'B';

  if (marketResult && typeof marketResult === 'object' && Array.isArray(marketResult.restaurants)) {
    if (marketResult.restaurants[0]?.id === targetId) {
      isRestaurantA = true;
      isRestaurantB = false;
    } else if (marketResult.restaurants[1]?.id === targetId) {
      isRestaurantA = false;
      isRestaurantB = true;
    }
  }

  let totalDineIn = 0;
  let totalDelivery = 0;
  let deliveryDistanceSum = 0;

  if (rawAllocations && rawAllocations.length > 0) {
    for (let i = 0; i < rawAllocations.length; i++) {
      const alloc = rawAllocations[i];
      if (!alloc || typeof alloc !== 'object') continue;

      // Extract delivery demand for this restaurant in this zone
      let zoneDeliveryDemand = 0;
      if (alloc.deliveryDemand && typeof alloc.deliveryDemand === 'object') {
        zoneDeliveryDemand = alloc.deliveryDemand[targetId] ?? 0;
      } else if (isRestaurantA && alloc.deliveryDemandA !== undefined) {
        zoneDeliveryDemand = alloc.deliveryDemandA;
      } else if (isRestaurantB && alloc.deliveryDemandB !== undefined) {
        zoneDeliveryDemand = alloc.deliveryDemandB;
      } else if (typeof alloc.deliveryDemand === 'number') {
        zoneDeliveryDemand = alloc.deliveryDemand;
      }

      // Extract dine-in demand for this restaurant in this zone
      let zoneDineInDemand = 0;
      if (alloc.dineInDemand && typeof alloc.dineInDemand === 'object') {
        zoneDineInDemand = alloc.dineInDemand[targetId] ?? 0;
      } else if (isRestaurantA && alloc.dineInDemandA !== undefined) {
        zoneDineInDemand = alloc.dineInDemandA;
      } else if (isRestaurantB && alloc.dineInDemandB !== undefined) {
        zoneDineInDemand = alloc.dineInDemandB;
      } else if (typeof alloc.dineInDemand === 'number') {
        zoneDineInDemand = alloc.dineInDemand;
      } else if (typeof alloc.demand === 'number' && zoneDeliveryDemand === 0) {
        zoneDineInDemand = alloc.demand;
      }

      // Extract travel cost from this zone to this restaurant
      let zoneTravelCost = 0;
      if (alloc.travelCosts && typeof alloc.travelCosts === 'object' && alloc.travelCosts[targetId] !== undefined) {
        zoneTravelCost = alloc.travelCosts[targetId];
      } else if (alloc.travelCost && typeof alloc.travelCost === 'object' && alloc.travelCost[targetId] !== undefined) {
        zoneTravelCost = alloc.travelCost[targetId];
      } else if (typeof alloc.travelCost === 'number') {
        zoneTravelCost = alloc.travelCost;
      } else if (isRestaurantA && alloc.travelCostA !== undefined) {
        zoneTravelCost = alloc.travelCostA;
      } else if (isRestaurantB && alloc.travelCostB !== undefined) {
        zoneTravelCost = alloc.travelCostB;
      }

      totalDineIn += zoneDineInDemand;
      totalDelivery += zoneDeliveryDemand;

      if (zoneDeliveryDemand > 0) {
        if (!Number.isFinite(zoneTravelCost)) {
          throw new RangeError(
            `Zone has positive delivery demand (${zoneDeliveryDemand}) but non-finite travel cost (${zoneTravelCost}).`
          );
        }
        deliveryDistanceSum += zoneDeliveryDemand * zoneTravelCost;
      }
    }
  } else if (marketResult && typeof marketResult === 'object') {
    // Fallback if zoneAllocations array is not present (e.g. summarized market object)
    if (marketResult.deliveryDemand && typeof marketResult.deliveryDemand === 'object') {
      totalDelivery = marketResult.deliveryDemand[targetId] ?? 0;
    }
    if (marketResult.dineInDemand && typeof marketResult.dineInDemand === 'object') {
      totalDineIn = marketResult.dineInDemand[targetId] ?? 0;
    } else if (marketResult.restaurantDemand && typeof marketResult.restaurantDemand === 'object') {
      const tot = marketResult.restaurantDemand[targetId] ?? 0;
      totalDineIn = Math.max(0, tot - totalDelivery);
    }
  }

  const totalDemand = totalDineIn + totalDelivery;

  return Object.freeze({
    totalDemand,
    dineInDemand: totalDineIn,
    deliveryDemand: totalDelivery,
    deliveryDistanceSum,
  });
}

/**
 * Calculates complete restaurant profit accounting incorporating restaurant-side delivery operating costs.
 *
 * Implements:
 *   totalDemand           = dineInDemand + deliveryDemand
 *   baseProfit            = (P_j - C_j) * totalDemand - F_j - K(Q_j)
 *   deliveryOperatingCost = c_base * deliveryDemand + c_distance * deliveryDistanceSum
 *   finalProfit           = baseProfit - deliveryOperatingCost
 *
 * @param {Object} params
 * @param {Object} params.restaurant - Restaurant definition { id, price, quality?, variableCost?, fixedCost?, kappa? }
 * @param {Object|Array<Object>} [params.marketResult] - Authoritative Phase 8A market output or zone allocations
 * @param {Object} [params.deliveryEconomics] - Delivery economics config or overrides
 * @param {number} [params.variableCost] - Explicit marginal cost override
 * @param {number} [params.fixedCost] - Explicit fixed cost override
 * @param {number} [params.kappa] - Strategic quality cost parameter override
 * @param {number} [params.deliveryDemand] - Direct delivery demand override
 * @param {number} [params.dineInDemand] - Direct dine-in demand override
 * @param {number} [params.totalDemand] - Direct total demand override
 * @param {number} [params.deliveryTravelCost] - Direct delivery travel cost / distance sum override
 * @param {number} [params.deliveryDistanceSum] - Direct delivery distance sum override
 * @returns {Readonly<{
 *   restaurantId: string,
 *   totalDemand: number,
 *   dineInDemand: number,
 *   deliveryDemand: number,
 *   deliveryDistanceSum: number,
 *   deliveryOperatingCost: number,
 *   qualityInvestmentCost: number,
 *   baseProfit: number,
 *   finalProfit: number
 * }>}
 */
export function calculateRestaurantProfitWithDelivery(params = {}) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('calculateRestaurantProfitWithDelivery requires a parameters object.');
  }

  const {
    restaurant,
    marketResult,
    deliveryEconomics,
    variableCost,
    fixedCost,
    kappa,
  } = params;

  if (!restaurant || typeof restaurant !== 'object') {
    throw new TypeError('calculateRestaurantProfitWithDelivery requires a valid restaurant object.');
  }

  const restaurantId = (restaurant.id ?? 'A').toString().trim();
  const price = restaurant.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    throw new TypeError('Restaurant must have a finite numeric price.');
  }

  const varCost = variableCost ?? restaurant.variableCost ?? DEFAULT_VARIABLE_COST;
  if (typeof varCost !== 'number' || !Number.isFinite(varCost)) {
    throw new TypeError('Variable cost must be a finite number.');
  }

  const fixCost = fixedCost ?? restaurant.fixedCost ?? DEFAULT_FIXED_COST;
  if (typeof fixCost !== 'number' || !Number.isFinite(fixCost)) {
    throw new TypeError('Fixed cost must be a finite number.');
  }

  const econConfig = deliveryEconomics !== undefined
    ? createDeliveryEconomicsConfig(deliveryEconomics)
    : (restaurant.deliveryEconomics !== undefined
        ? createDeliveryEconomicsConfig(restaurant.deliveryEconomics)
        : DEFAULT_DELIVERY_ECONOMICS_CONFIG);

  // Extract or receive demand metrics
  let totalDemand;
  let dineInDemand;
  let deliveryDemand;
  let deliveryDistanceSum;

  if (params.deliveryDemand !== undefined || params.dineInDemand !== undefined || params.totalDemand !== undefined) {
    deliveryDemand = params.deliveryDemand ?? 0;
    dineInDemand = params.dineInDemand ?? 0;
    totalDemand = params.totalDemand !== undefined ? params.totalDemand : (dineInDemand + deliveryDemand);
    deliveryDistanceSum = params.deliveryTravelCost ?? params.deliveryDistanceSum ?? 0;
  } else {
    const metrics = extractZoneDeliveryMetrics({
      marketResult,
      restaurantId,
      restaurant,
      zoneAllocations: params.zoneAllocations,
    });
    totalDemand = metrics.totalDemand;
    dineInDemand = metrics.dineInDemand;
    deliveryDemand = metrics.deliveryDemand;
    deliveryDistanceSum = metrics.deliveryDistanceSum;
  }

  // Calculate delivery operating cost
  const deliveryOperatingCost = calculateDeliveryOperatingCost({
    deliveryDemand,
    deliveryTravelCost: deliveryDistanceSum,
    config: econConfig,
  });

  // Calculate strategic quality investment cost if applicable
  const costKappa = kappa ?? restaurant.kappa;
  let qualityInvestmentCost = 0;
  let baseProfit;

  if (costKappa !== undefined) {
    const quality = restaurant.quality;
    qualityInvestmentCost = calculateQualityInvestmentCost(quality, costKappa);
    baseProfit = (price - varCost) * totalDemand - fixCost - qualityInvestmentCost;
  } else {
    baseProfit = calculateFrontierProfit(restaurant, totalDemand, fixCost, varCost);
  }

  // Final profit is base profit minus restaurant-side delivery operating costs
  const finalProfit = baseProfit - deliveryOperatingCost;

  return Object.freeze({
    restaurantId,
    totalDemand,
    dineInDemand,
    deliveryDemand,
    deliveryDistanceSum,
    deliveryOperatingCost,
    qualityInvestmentCost,
    baseProfit,
    finalProfit,
  });
}

/**
 * Evaluates the full Frontier market demand, zone allocations, delivery economics, and payoffs
 * for two competing restaurants.
 *
 * Bridges Phase 8A consumer-choice output into Phase 8B restaurant-side delivery profit accounting.
 *
 * @param {Object} options
 * @param {Object} options.city - Frontier city object containing `cells` array
 * @param {Object} [options.restaurantA] - First restaurant
 * @param {Object} [options.restaurantB] - Second restaurant
 * @param {Array<Object>} [options.restaurants] - Alternative [rA, rB] array
 * @param {'euclidean'|'road'} [options.mode='euclidean'] - Travel cost mode
 * @param {Object} [options.roadNetwork] - Required when mode is 'road'
 * @param {Object} [options.config] - Economic parameters { V, alpha, gamma, qualityScale, segments }
 * @param {Array<Object>} [options.segments] - Optional consumer segments override
 * @param {Object} [options.deliveryA] - Optional delivery config override for restaurant A
 * @param {Object} [options.deliveryB] - Optional delivery config override for restaurant B
 * @param {Object} [options.deliveryEconomics] - Shared delivery economics configuration
 * @param {Object} [options.deliveryEconomicsA] - Delivery economics config for restaurant A
 * @param {Object} [options.deliveryEconomicsB] - Delivery economics config for restaurant B
 * @param {number} [options.variableCost] - Default marginal cost (100)
 * @param {number} [options.fixedCost] - Default fixed cost (0)
 * @param {number} [options.variableCostA] - Specific marginal cost for restaurant A
 * @param {number} [options.variableCostB] - Specific marginal cost for restaurant B
 * @param {number} [options.fixedCostA] - Specific fixed cost for restaurant A
 * @param {number} [options.fixedCostB] - Specific fixed cost for restaurant B
 * @param {number} [options.kappa] - Default quality cost kappa
 * @param {number} [options.kappaA] - Quality cost kappa for restaurant A
 * @param {number} [options.kappaB] - Quality cost kappa for restaurant B
 * @param {number} [options.tolerance=FLOAT_EPSILON]
 * @returns {Readonly<{
 *   restaurantA: Readonly<{
 *     id: string,
 *     demand: number,
 *     totalDemand: number,
 *     dineInDemand: number,
 *     deliveryDemand: number,
 *     deliveryDistanceSum: number,
 *     deliveryOperatingCost: number,
 *     qualityInvestmentCost: number,
 *     baseProfit: number,
 *     finalProfit: number,
 *     profit: number,
 *     marketShare: number,
 *     quality: number
 *   }>,
 *   restaurantB: Readonly<{
 *     id: string,
 *     demand: number,
 *     totalDemand: number,
 *     dineInDemand: number,
 *     deliveryDemand: number,
 *     deliveryDistanceSum: number,
 *     deliveryOperatingCost: number,
 *     qualityInvestmentCost: number,
 *     baseProfit: number,
 *     finalProfit: number,
 *     profit: number,
 *     marketShare: number,
 *     quality: number
 *   }>,
 *   totalPopulation: number,
 *   servedPopulation: number,
 *   unservedPopulation: number,
 *   reachablePopulation: number,
 *   unreachablePopulation: number,
 *   travelCostMode: string,
 *   marketResult: Readonly<Object>
 * }>}
 */
export function calculateFrontierDeliveryPayoff(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateFrontierDeliveryPayoff requires an options object.');
  }

  // Authoritative Phase 8A market evaluation
  const market = calculateFrontierDeliveryMarket(options);

  const rawA = options.restaurantA ?? options.restaurants?.[0] ?? market.restaurants[0];
  const rawB = options.restaurantB ?? options.restaurants?.[1] ?? market.restaurants[1];
  const rA = { ...market.restaurants[0], ...rawA };
  const rB = { ...market.restaurants[1], ...rawB };
  const idA = rA.id;
  const idB = rB.id;

  const econA = options.deliveryEconomicsA ?? options.deliveryEconomics ?? rawA.deliveryEconomics ?? rA.deliveryEconomics;
  const econB = options.deliveryEconomicsB ?? options.deliveryEconomics ?? rawB.deliveryEconomics ?? rB.deliveryEconomics;

  const varCostA = options.variableCostA ?? rawA.variableCost ?? rA.variableCost ?? options.variableCost;
  const varCostB = options.variableCostB ?? rawB.variableCost ?? rB.variableCost ?? options.variableCost;
  const fixCostA = options.fixedCostA ?? rawA.fixedCost ?? rA.fixedCost ?? options.fixedCost;
  const fixCostB = options.fixedCostB ?? rawB.fixedCost ?? rB.fixedCost ?? options.fixedCost;
  const kappaA = options.kappaA ?? rawA.kappa ?? rA.kappa ?? options.kappa;
  const kappaB = options.kappaB ?? rawB.kappa ?? rB.kappa ?? options.kappa;

  const profitReportA = calculateRestaurantProfitWithDelivery({
    restaurant: rA,
    marketResult: market,
    deliveryEconomics: econA,
    variableCost: varCostA,
    fixedCost: fixCostA,
    kappa: kappaA,
  });

  const profitReportB = calculateRestaurantProfitWithDelivery({
    restaurant: rB,
    marketResult: market,
    deliveryEconomics: econB,
    variableCost: varCostB,
    fixedCost: fixCostB,
    kappa: kappaB,
  });

  return Object.freeze({
    restaurantA: Object.freeze({
      id: idA,
      demand: profitReportA.totalDemand,
      totalDemand: profitReportA.totalDemand,
      dineInDemand: profitReportA.dineInDemand,
      deliveryDemand: profitReportA.deliveryDemand,
      deliveryDistanceSum: profitReportA.deliveryDistanceSum,
      deliveryOperatingCost: profitReportA.deliveryOperatingCost,
      qualityInvestmentCost: profitReportA.qualityInvestmentCost,
      baseProfit: profitReportA.baseProfit,
      finalProfit: profitReportA.finalProfit,
      profit: profitReportA.finalProfit, // Payoff alias
      marketShare: market.marketShares[idA] ?? 0,
      quality: rA.quality,
    }),
    restaurantB: Object.freeze({
      id: idB,
      demand: profitReportB.totalDemand,
      totalDemand: profitReportB.totalDemand,
      dineInDemand: profitReportB.dineInDemand,
      deliveryDemand: profitReportB.deliveryDemand,
      deliveryDistanceSum: profitReportB.deliveryDistanceSum,
      deliveryOperatingCost: profitReportB.deliveryOperatingCost,
      qualityInvestmentCost: profitReportB.qualityInvestmentCost,
      baseProfit: profitReportB.baseProfit,
      finalProfit: profitReportB.finalProfit,
      profit: profitReportB.finalProfit, // Payoff alias
      marketShare: market.marketShares[idB] ?? 0,
      quality: rB.quality,
    }),
    totalPopulation: market.totalPopulation,
    servedPopulation: market.servedPopulation,
    unservedPopulation: market.unservedPopulation,
    reachablePopulation: market.reachablePopulation,
    unreachablePopulation: market.unreachablePopulation,
    travelCostMode: market.travelCostMode,
    marketResult: market,
  });
}
