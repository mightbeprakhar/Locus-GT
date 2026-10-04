/**
 * @file platformEconomics.js
 * @description Frontier Aggregator / Platform Economics & Profit Accounting Engine (Phase 8C).
 *
 * Mathematical Foundations:
 * 1. Predecessor (Phase 8B) Restaurant Profit before Platform Commission:
 *      pi_j^8B = (P_j - C_j) * D_j - F_j - K(Q_j) - C_delivery,j
 *
 * 2. Platform Commission:
 *      C_platform,j = m_j * P_j * D_delivery,j
 *    where:
 *      m_j          = platform commission rate (fraction in [0, 1])
 *      P_j          = restaurant food price
 *      D_delivery,j = actual delivery customers served by restaurant j
 *
 * 3. Final Restaurant Profit (Phase 8C):
 *      pi_j^8C = pi_j^8B - C_platform,j
 *              = (P_j - C_j) * D_j - F_j - K(Q_j) - C_delivery,j - m_j * P_j * D_delivery,j
 *
 * Critical Economic Principles:
 * - Platform commission applies ONLY to delivery demand (D_delivery).
 * - Dine-in demand incurs ZERO platform commission.
 * - Consumer delivery fee (F_j from Phase 8A) is NOT commissioned.
 * - When platform is disabled (enabled: false), commission is strictly zero,
 *   and Phase 8C profit reduces exactly to Phase 8B profit.
 * - Strategic quality investment cost K(Q_j) = kappa * Q_j^2 remains preserved.
 */

import { calculateRestaurantProfitWithDelivery } from './deliveryEconomics.js';
import { calculateFrontierDeliveryMarket } from './deliveryChoice.js';
import {
  DEFAULT_PLATFORM_CONFIG,
  createPlatformConfig,
  calculatePlatformCommission,
} from './platform.js';

/**
 * Calculates complete restaurant profit accounting incorporating restaurant delivery operating costs
 * and platform aggregator commission.
 *
 * Implements:
 *   profitBeforePlatformCommission = Phase 8B final profit
 *   platformCommission             = enabled ? m * P * deliveryDemand : 0
 *   finalProfit                    = profitBeforePlatformCommission - platformCommission
 *
 * @param {Object} params
 * @param {Object} params.restaurant - Restaurant definition { id, price, quality?, variableCost?, fixedCost?, kappa?, platform? }
 * @param {Object|Array<Object>} [params.marketResult] - Authoritative Phase 8A market output or zone allocations
 * @param {Object} [params.deliveryEconomics] - Delivery economics config or overrides
 * @param {Object} [params.platform] - Platform configuration or overrides { enabled, commissionRate }
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
 *   platformCommission: number,
 *   qualityInvestmentCost: number,
 *   baseProfit: number,
 *   profitBeforePlatformCommission: number,
 *   finalProfit: number
 * }>}
 */
export function calculateRestaurantProfitWithPlatform(params = {}) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('calculateRestaurantProfitWithPlatform requires a parameters object.');
  }

  const { restaurant, platform } = params;

  if (!restaurant || typeof restaurant !== 'object') {
    throw new TypeError('calculateRestaurantProfitWithPlatform requires a valid restaurant object.');
  }

  // 1. Compute Phase 8B profit breakdown
  const deliveryProfit = calculateRestaurantProfitWithDelivery(params);

  // 2. Resolve platform configuration
  const platformConfig =
    platform !== undefined
      ? createPlatformConfig(platform)
      : (restaurant.platform !== undefined
          ? createPlatformConfig(restaurant.platform)
          : DEFAULT_PLATFORM_CONFIG);

  // 3. Calculate platform commission on actual delivery demand
  const platformCommission = calculatePlatformCommission({
    price: restaurant.price,
    deliveryDemand: deliveryProfit.deliveryDemand,
    config: platformConfig,
  });

  // 4. Calculate Phase 8C final profit
  const profitBeforePlatformCommission = deliveryProfit.finalProfit;
  const finalProfit = profitBeforePlatformCommission - platformCommission;

  return Object.freeze({
    restaurantId: deliveryProfit.restaurantId,
    totalDemand: deliveryProfit.totalDemand,
    dineInDemand: deliveryProfit.dineInDemand,
    deliveryDemand: deliveryProfit.deliveryDemand,
    deliveryDistanceSum: deliveryProfit.deliveryDistanceSum,
    deliveryOperatingCost: deliveryProfit.deliveryOperatingCost,
    platformCommission,
    qualityInvestmentCost: deliveryProfit.qualityInvestmentCost,
    baseProfit: deliveryProfit.baseProfit,
    profitBeforePlatformCommission,
    finalProfit,
  });
}

/**
 * Evaluates the full Frontier market demand, zone allocations, delivery economics, platform commission,
 * and payoffs for two competing restaurants.
 *
 * Bridges Phase 8A consumer choice, Phase 8B delivery operating costs, and Phase 8C platform commission
 * into final firm payoffs.
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
 * @param {Object} [options.platform] - Shared platform configuration
 * @param {Object} [options.platformA] - Platform config for restaurant A
 * @param {Object} [options.platformB] - Platform config for restaurant B
 * @param {number} [options.variableCost] - Default marginal cost (100)
 * @param {number} [options.fixedCost] - Default fixed cost (0)
 * @param {number} [options.variableCostA] - Specific marginal cost for restaurant A
 * @param {number} [options.variableCostB] - Specific marginal cost for restaurant B
 * @param {number} [options.fixedCostA] - Specific fixed cost for restaurant A
 * @param {number} [options.fixedCostB] - Specific fixed cost for restaurant B
 * @param {number} [options.kappa] - Default quality cost kappa
 * @param {number} [options.kappaA] - Quality cost kappa for restaurant A
 * @param {number} [options.kappaB] - Quality cost kappa for restaurant B
 * @param {number} [options.tolerance]
 * @returns {Readonly<{
 *   restaurantA: Readonly<{
 *     id: string,
 *     demand: number,
 *     totalDemand: number,
 *     dineInDemand: number,
 *     deliveryDemand: number,
 *     deliveryDistanceSum: number,
 *     deliveryOperatingCost: number,
 *     platformCommission: number,
 *     qualityInvestmentCost: number,
 *     baseProfit: number,
 *     profitBeforePlatformCommission: number,
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
 *     platformCommission: number,
 *     qualityInvestmentCost: number,
 *     baseProfit: number,
 *     profitBeforePlatformCommission: number,
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
export function calculateFrontierPlatformPayoff(options = {}) {
  if (!options || typeof options !== 'object') {
    throw new TypeError('calculateFrontierPlatformPayoff requires an options object.');
  }

  // 1. Authoritative Phase 8A market evaluation
  const market = calculateFrontierDeliveryMarket(options);

  const rawA = options.restaurantA ?? options.restaurants?.[0] ?? market.restaurants[0];
  const rawB = options.restaurantB ?? options.restaurants?.[1] ?? market.restaurants[1];
  const rA = { ...market.restaurants[0], ...rawA };
  const rB = { ...market.restaurants[1], ...rawB };
  const idA = rA.id;
  const idB = rB.id;

  const econA =
    options.deliveryEconomicsA ?? options.deliveryEconomics ?? rawA.deliveryEconomics ?? rA.deliveryEconomics;
  const econB =
    options.deliveryEconomicsB ?? options.deliveryEconomics ?? rawB.deliveryEconomics ?? rB.deliveryEconomics;

  const platA =
    options.platformA ?? options.platform ?? rawA.platform ?? rA.platform;
  const platB =
    options.platformB ?? options.platform ?? rawB.platform ?? rB.platform;

  const varCostA = options.variableCostA ?? rawA.variableCost ?? rA.variableCost ?? options.variableCost;
  const varCostB = options.variableCostB ?? rawB.variableCost ?? rB.variableCost ?? options.variableCost;
  const fixCostA = options.fixedCostA ?? rawA.fixedCost ?? rA.fixedCost ?? options.fixedCost;
  const fixCostB = options.fixedCostB ?? rawB.fixedCost ?? rB.fixedCost ?? options.fixedCost;
  const kappaA = options.kappaA ?? rawA.kappa ?? rA.kappa ?? options.kappa;
  const kappaB = options.kappaB ?? rawB.kappa ?? rB.kappa ?? options.kappa;

  const reportA = calculateRestaurantProfitWithPlatform({
    restaurant: rA,
    marketResult: market,
    deliveryEconomics: econA,
    platform: platA,
    variableCost: varCostA,
    fixedCost: fixCostA,
    kappa: kappaA,
  });

  const reportB = calculateRestaurantProfitWithPlatform({
    restaurant: rB,
    marketResult: market,
    deliveryEconomics: econB,
    platform: platB,
    variableCost: varCostB,
    fixedCost: fixCostB,
    kappa: kappaB,
  });

  return Object.freeze({
    restaurantA: Object.freeze({
      id: idA,
      demand: reportA.totalDemand,
      totalDemand: reportA.totalDemand,
      dineInDemand: reportA.dineInDemand,
      deliveryDemand: reportA.deliveryDemand,
      deliveryDistanceSum: reportA.deliveryDistanceSum,
      deliveryOperatingCost: reportA.deliveryOperatingCost,
      platformCommission: reportA.platformCommission,
      qualityInvestmentCost: reportA.qualityInvestmentCost,
      baseProfit: reportA.baseProfit,
      profitBeforePlatformCommission: reportA.profitBeforePlatformCommission,
      finalProfit: reportA.finalProfit,
      profit: reportA.finalProfit, // Payoff alias
      marketShare: market.marketShares[idA] ?? 0,
      quality: rA.quality,
    }),
    restaurantB: Object.freeze({
      id: idB,
      demand: reportB.totalDemand,
      totalDemand: reportB.totalDemand,
      dineInDemand: reportB.dineInDemand,
      deliveryDemand: reportB.deliveryDemand,
      deliveryDistanceSum: reportB.deliveryDistanceSum,
      deliveryOperatingCost: reportB.deliveryOperatingCost,
      platformCommission: reportB.platformCommission,
      qualityInvestmentCost: reportB.qualityInvestmentCost,
      baseProfit: reportB.baseProfit,
      profitBeforePlatformCommission: reportB.profitBeforePlatformCommission,
      finalProfit: reportB.finalProfit,
      profit: reportB.finalProfit, // Payoff alias
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
