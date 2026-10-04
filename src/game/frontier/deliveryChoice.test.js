/**
 * @file deliveryChoice.test.js
 * @description Comprehensive unit tests for Frontier Delivery Choice Engine —
 * Dine-in vs Delivery Consumer Choice, Road Network Integration, Heterogeneity,
 * Accounting Invariants, and Backward Compatibility (Phase 8A).
 */

import { describe, it, expect } from 'vitest';
import {
  SERVICE_MODES,
  calculateZoneDeliveryChoice,
  allocateFrontierDeliveryDemand,
  calculateFrontierDeliveryMarket,
} from './deliveryChoice.js';
import { createDeliveryConfig } from './delivery.js';
import { calculateFrontierMarket } from './consumerChoice.js';
import { createFrontierCity, SCENARIO_IDS } from './frontierCity.js';
import { createRoadNetwork, ROAD_SCENARIO_IDS } from './roadNetwork.js';
import {
  createConsumerSegment,
  CONSUMER_SEGMENT_PRESETS,
  CONSUMER_SEGMENT_PRESET_IDS,
} from './consumerSegments.js';
import { TRAVEL_COST_MODES } from './travelCost.js';

describe('LOCUS Frontier Engine — Phase 8A: Delivery Choice Engine', () => {
  const city = createFrontierCity({ scenario: SCENARIO_IDS.BALANCED });

  const restaurantA = {
    id: 'A',
    location: { x: 1, y: 1 },
    price: 50,
    quality: 6,
    delivery: createDeliveryConfig({
      enabled: true,
      radius: 4,
      fee: 20,
      baseTime: 10,
      timePerDistance: 2,
    }),
  };

  const restaurantB = {
    id: 'B',
    location: { x: 3, y: 3 },
    price: 50,
    quality: 6,
    delivery: createDeliveryConfig({
      enabled: true,
      radius: 4,
      fee: 20,
      baseTime: 10,
      timePerDistance: 2,
    }),
  };

  describe('1. Service Mode Options & Consumer Choice Rule', () => {
    it('defines SERVICE_MODES constants', () => {
      expect(SERVICE_MODES).toEqual({
        DINE_IN: 'dine-in',
        DELIVERY: 'delivery',
      });
      expect(Object.isFrozen(SERVICE_MODES)).toBe(true);
    });

    it('23. highest utility option wins 100% of demand share', () => {
      // Zone close to A (travelCostA = 1, travelCostB = 4)
      const res = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 4,
        restaurantA,
        restaurantB,
      });

      // Dine-in A: 500 - 50 + 60 - 10*1 = 500
      // Delivery A: 500 - (50+20) + 60 - 10*1 - 1*(10 + 2*1) = 468
      // Dine-in A is 500 > Delivery A (468) > B options
      expect(res.shareA).toBe(1.0);
      expect(res.shareB).toBe(0.0);
      expect(res.dineInShareA).toBe(1.0);
      expect(res.deliveryShareA).toBe(0.0);
      expect(res.choice).toBe('A');
      expect(res.chosenOptions).toHaveLength(1);
      expect(res.chosenOptions[0].mode).toBe(SERVICE_MODES.DINE_IN);
      expect(res.chosenOptions[0].restaurantId).toBe('A');
    });

    it('24. delivery can be mathematically superior to competitor dine-in and can achieve utility-maximizing choice', () => {
      // Both restaurants offer both dine-in and delivery
      const highQRestaurantB = {
        ...restaurantB,
        quality: 10,
        price: 30,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 6,
          fee: 5,
          baseTime: 2,
          timePerDistance: 0.5,
        }),
      };
      const lowQRestaurantA = {
        ...restaurantA,
        quality: 2,
        price: 80,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 15,
          baseTime: 5,
          timePerDistance: 2,
        }),
      };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 2,
        restaurantA: lowQRestaurantA,
        restaurantB: highQRestaurantB,
      });

      // Verify all 4 options are available
      const optDelB = res.options.find(
        (o) => o.restaurantId === 'B' && o.mode === SERVICE_MODES.DELIVERY
      );
      const optDineA = res.options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DINE_IN
      );
      const optDelA = res.options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      const optDineB = res.options.find(
        (o) => o.restaurantId === 'B' && o.mode === SERVICE_MODES.DINE_IN
      );

      expect(optDelB.available).toBe(true);
      expect(optDineA.available).toBe(true);
      expect(optDelA.available).toBe(true);
      expect(optDineB.available).toBe(true);

      // Utility values:
      // B delivery utility: 500 - (30+5) + 10*10 - 10*2 - 1*(2 + 0.5*2) = 542
      // A dine-in utility: 500 - 80 + 2*10 - 10*1 = 430
      // A delivery utility: 500 - (80+15) + 2*10 - 10*1 - 1*(5 + 2*1) = 408
      expect(optDelB.utility).toBeGreaterThan(optDineA.utility);
      expect(optDineA.utility).toBeGreaterThan(optDelA.utility);

      // Furthermore, when promotional free/instant delivery is offered (fee=0, time=0):
      const promoB = {
        ...highQRestaurantB,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 6,
          fee: 0,
          baseTime: 0,
          timePerDistance: 0,
        }),
      };
      const promoRes = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 2,
        restaurantA: lowQRestaurantA,
        restaurantB: promoB,
        delta: 0,
      });

      // Under promotional delivery, B delivery ties with B dine-in at maximum utility (550),
      // capturing delivery demand and strictly beating all options of competitor A
      expect(promoRes.deliveryShareB).toBe(0.5);
      expect(promoRes.chosenOptions.some((o) => o.mode === SERVICE_MODES.DELIVERY)).toBe(true);
    });

    it('25. dine-in wins when mathematically superior', () => {
      // When delivery has a substantial fee and delivery time, dine-in wins
      const res = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 3,
        restaurantA,
        restaurantB,
      });

      expect(res.dineInShareA).toBe(1.0);
      expect(res.deliveryShareA).toBe(0.0);
      expect(res.shareA).toBe(1.0);
      expect(res.chosenOptions[0].mode).toBe(SERVICE_MODES.DINE_IN);
    });

    it('26. exact tie splits demand equally (50% / 50%)', () => {
      // Symmetrical case: travelCostA = travelCostB, prices identical, quality identical, delivery disabled
      const disabledA = { ...restaurantA, delivery: createDeliveryConfig({ enabled: false }) };
      const disabledB = { ...restaurantB, delivery: createDeliveryConfig({ enabled: false }) };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 2,
        travelCostB: 2,
        restaurantA: disabledA,
        restaurantB: disabledB,
      });

      expect(res.choice).toBe('TIE');
      expect(res.shareA).toBeCloseTo(0.5);
      expect(res.shareB).toBeCloseTo(0.5);
      expect(res.dineInShareA).toBeCloseTo(0.5);
      expect(res.dineInShareB).toBeCloseTo(0.5);
      expect(res.chosenOptions).toHaveLength(2);
    });

    it('exact tie between dine-in and delivery of the same restaurant splits 50% / 50%', () => {
      // When delivery fee = 0 and delta = 0 (or delivery time = 0), dine-in and delivery have identical utility
      const freeZeroTimeDelivery = createDeliveryConfig({
        enabled: true,
        radius: 4,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      });
      const restAWithFree = { ...restaurantA, delivery: freeZeroTimeDelivery };
      const unreachableB = { ...restaurantB, delivery: createDeliveryConfig({ enabled: false }) };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: Infinity, // B unreachable
        restaurantA: restAWithFree,
        restaurantB: unreachableB,
        delta: 0,
      });

      expect(res.shareA).toBe(1.0);
      expect(res.dineInShareA).toBeCloseTo(0.5);
      expect(res.deliveryShareA).toBeCloseTo(0.5);
      expect(res.chosenOptions).toHaveLength(2);
    });

    it('27. multi-way tie splits equally (4-way tie splits 25% each)', () => {
      // When both restaurants have identical price, quality, travel cost, fee=0, time=0
      const zeroDelivery = createDeliveryConfig({
        enabled: true,
        radius: 5,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      });
      const rA = { ...restaurantA, delivery: zeroDelivery };
      const rB = { ...restaurantB, delivery: zeroDelivery };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 2,
        travelCostB: 2,
        restaurantA: rA,
        restaurantB: rB,
        delta: 0,
      });

      expect(res.chosenOptions).toHaveLength(4);
      expect(res.dineInShareA).toBeCloseTo(0.25);
      expect(res.deliveryShareA).toBeCloseTo(0.25);
      expect(res.dineInShareB).toBeCloseTo(0.25);
      expect(res.deliveryShareB).toBeCloseTo(0.25);
      expect(res.shareA).toBeCloseTo(0.5);
      expect(res.shareB).toBeCloseTo(0.5);
      expect(res.choice).toBe('TIE');
    });

    it('28. unavailable delivery is never selected', () => {
      // Restaurant A offers delivery with radius 2. Zone has travelCost 3.
      const smallRadiusDelivery = createDeliveryConfig({
        enabled: true,
        radius: 2,
        fee: 0,
        baseTime: 0,
        timePerDistance: 0,
      });
      const rA = { ...restaurantA, delivery: smallRadiusDelivery };
      const rB = { ...restaurantB, delivery: createDeliveryConfig({ enabled: false }) };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 3, // Outside radius
        travelCostB: Infinity,
        restaurantA: rA,
        restaurantB: rB,
      });

      // Delivery option must NOT be available or chosen
      const delAOpt = res.options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delAOpt.available).toBe(false);
      expect(delAOpt.share).toBe(0.0);
      expect(res.deliveryShareA).toBe(0.0);
      expect(res.dineInShareA).toBe(1.0);
    });
  });

  describe('2. Demand Accounting & Conservation Laws', () => {
    it('29. restaurant demand = dine-in demand + delivery demand at market and zone level', () => {
      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });

      expect(market.restaurantDemand.A).toBeCloseTo(
        market.dineInDemand.A + market.deliveryDemand.A
      );
      expect(market.restaurantDemand.B).toBeCloseTo(
        market.dineInDemand.B + market.deliveryDemand.B
      );

      for (const zoneAlloc of market.zoneAllocations) {
        expect(zoneAlloc.demandA).toBeCloseTo(
          zoneAlloc.dineInDemandA + zoneAlloc.deliveryDemandA
        );
        expect(zoneAlloc.demandB).toBeCloseTo(
          zoneAlloc.dineInDemandB + zoneAlloc.deliveryDemandB
        );
      }
    });

    it('30. served demand + unserved demand = total effective population', () => {
      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });

      const totalServed = market.restaurantDemand.A + market.restaurantDemand.B;
      expect(totalServed + market.unservedDemand).toBeCloseTo(market.totalPopulation);
      expect(market.servedPopulation).toBeCloseTo(totalServed);
    });

    it('31. segment population is strictly conserved across options', () => {
      const segments = [
        createConsumerSegment({ id: 'seg1', populationShare: 0.4 }),
        createConsumerSegment({ id: 'seg2', populationShare: 0.6, delta: 3 }),
      ];

      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
        segments,
      });

      for (const segRes of market.segmentResults) {
        const segTotalServed =
          segRes.restaurantDemand.A + segRes.restaurantDemand.B;
        expect(segTotalServed + segRes.unservedDemand).toBeCloseTo(segRes.population);
      }
    });

    it('32. zone population is strictly conserved across all zones', () => {
      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });

      for (const zoneAlloc of market.zoneAllocations) {
        const sumZone = zoneAlloc.demandA + zoneAlloc.demandB + zoneAlloc.unservedDemand;
        expect(sumZone).toBeCloseTo(zoneAlloc.population);
      }
    });

    it('33. demand and shares are never negative', () => {
      const market = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });

      expect(market.restaurantDemand.A).toBeGreaterThanOrEqual(0);
      expect(market.restaurantDemand.B).toBeGreaterThanOrEqual(0);
      expect(market.dineInDemand.A).toBeGreaterThanOrEqual(0);
      expect(market.deliveryDemand.A).toBeGreaterThanOrEqual(0);
      expect(market.dineInDemand.B).toBeGreaterThanOrEqual(0);
      expect(market.deliveryDemand.B).toBeGreaterThanOrEqual(0);
      expect(market.unservedDemand).toBeGreaterThanOrEqual(0);

      expect(market.restaurantShares.A).toBeGreaterThanOrEqual(0);
      expect(market.restaurantShares.B).toBeGreaterThanOrEqual(0);
      expect(market.modeShares.dineIn).toBeGreaterThanOrEqual(0);
      expect(market.modeShares.delivery).toBeGreaterThanOrEqual(0);
    });
  });

  describe('3. Consumer Heterogeneity & Presets', () => {
    it('34. different delta values produce different mode choices for the same restaurants', () => {
      // Both restaurants support both dine-in and delivery
      const freeFeeRestaurantA = {
        ...restaurantA,
        price: 50,
        quality: 6,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 0,
          baseTime: 10,
          timePerDistance: 2,
        }),
      };

      const restaurantBDistant = {
        ...restaurantB,
        price: 80,
        quality: 2,
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 5,
          fee: 20,
          baseTime: 15,
          timePerDistance: 2,
        }),
      };

      // At travelCostA = 1: tau_A = 10 + 2*1 = 12
      // Dine-in A utility: 500 - 50 + 60 - 10*1 = 500
      // Delivery A utility: 500 - 50 + 60 - 10*1 - delta * 12 = 500 - delta * 12
      // B options have utility < 420 (distant and low quality)

      // Patient consumer (delta = 0): delivery waiting time has zero disutility -> U_Delivery = 500 == U_DineIn
      const patientSegment = createConsumerSegment({
        id: 'patient',
        populationShare: 0.5,
        delta: 0,
      });

      // Impatient consumer (delta = 1.5): delivery waiting time imposes disutility of 1.5 * 12 = 18 -> U_Delivery = 482 < 500
      const impatientSegment = createConsumerSegment({
        id: 'impatient',
        populationShare: 0.5,
        delta: 1.5,
      });

      const choicePatient = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 4,
        restaurantA: freeFeeRestaurantA,
        restaurantB: restaurantBDistant,
        segment: patientSegment,
      });

      const choiceImpatient = calculateZoneDeliveryChoice({
        travelCostA: 1,
        travelCostB: 4,
        restaurantA: freeFeeRestaurantA,
        restaurantB: restaurantBDistant,
        segment: impatientSegment,
      });

      // Patient consumer splits choice between dine-in and delivery (delivery is chosen)
      expect(choicePatient.deliveryShareA).toBe(0.5);
      expect(choicePatient.dineInShareA).toBe(0.5);
      expect(choicePatient.chosenOptions.some((o) => o.mode === SERVICE_MODES.DELIVERY)).toBe(true);

      // Impatient consumer strictly rejects delivery in favor of dine-in
      expect(choiceImpatient.deliveryShareA).toBe(0.0);
      expect(choiceImpatient.dineInShareA).toBe(1.0);
      expect(choiceImpatient.chosenOptions).toHaveLength(1);
      expect(choiceImpatient.chosenOptions[0].mode).toBe(SERVICE_MODES.DINE_IN);
    });

    it('35. convenience-oriented consumers respond appropriately to delivery time', () => {
      const conveniencePreset =
        CONSUMER_SEGMENT_PRESETS[CONSUMER_SEGMENT_PRESET_IDS.CONVENIENCE_SEEKERS];
      expect(conveniencePreset.delta).toBe(2.5);
      expect(conveniencePreset.alpha).toBe(25);
    });

    it('36. all existing consumer presets remain valid and operational with delivery', () => {
      const presets = Object.values(CONSUMER_SEGMENT_PRESETS);
      expect(presets).toHaveLength(4);

      for (const preset of presets) {
        expect(preset.delta).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(preset.delta)).toBe(true);

        const res = calculateZoneDeliveryChoice({
          travelCostA: 2,
          travelCostB: 3,
          restaurantA,
          restaurantB,
          segment: preset,
        });

        expect(res.shareA + res.shareB + res.unservedShare).toBeCloseTo(1.0);
      }
    });
  });

  describe('4. Road Network & Spatial Travel Cost Integration', () => {
    it('37. Euclidean mode uses Euclidean travel cost for delivery radius & time', () => {
      const marketEuclidean = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });

      expect(marketEuclidean.travelCostMode).toBe(TRAVEL_COST_MODES.EUCLIDEAN);
      expect(marketEuclidean.zoneAllocations.length).toBe(city.cells.length);
    });

    it('38. road mode uses road network shortest-path travel cost', () => {
      const roadNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });

      const marketRoad = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: roadNet,
      });

      expect(marketRoad.travelCostMode).toBe(TRAVEL_COST_MODES.ROAD);
      expect(marketRoad.zoneAllocations.length).toBe(city.cells.length);
    });

    it('39. barriers affect delivery availability (road travelCost > radius when detour exists)', () => {
      // Barrier network: vertical boundary between col 4 and 5 is blocked, EXCEPT at row 4
      const barrierNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });

      // Restaurant A at (4, 0)
      const rA = {
        ...restaurantA,
        location: { x: 4, y: 0 },
        delivery: createDeliveryConfig({
          enabled: true,
          radius: 3.0, // Direct distance across col 4-5 at y=0 is 1.0, but detour requires 9 steps!
        }),
      };

      // Zone at (5, 0):
      // In Euclidean mode: distance between (4,0) and (5,0) is 1.0 <= 3.0 (available)
      const allocEuclidean = allocateFrontierDeliveryDemand({
        zone: { x: 5, y: 0, population: 100 },
        restaurantA: rA,
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });
      const delOptEuclidean = allocEuclidean.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delOptEuclidean.available).toBe(true);

      // In Road mode: detour through row 4 crossing gives travelCost = 4 + 1 + 4 = 9.0 > 3.0 (unavailable)
      const allocRoad = allocateFrontierDeliveryDemand({
        zone: { x: 5, y: 0, population: 100 },
        restaurantA: rA,
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: barrierNet,
      });
      const delOptRoad = allocRoad.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delOptRoad.available).toBe(false);
    });

    it('explicitly verifies delivery radius is measured using road travel-cost and not Euclidean distance', () => {
      // Radius = 4. Euclidean distance = 1.0. Road distance with barrier = 9.0.
      const barrierNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BARRIER });
      const rA = {
        id: 'A',
        location: { x: 4, y: 0 },
        price: 50,
        quality: 5,
        delivery: createDeliveryConfig({ enabled: true, radius: 4.0 }),
      };

      // Euclidean check: distance is 1.0 <= 4.0 -> available
      const zoneAllocEucl = allocateFrontierDeliveryDemand({
        zone: { x: 5, y: 0, population: 100 },
        restaurantA: rA,
        restaurantB,
        mode: TRAVEL_COST_MODES.EUCLIDEAN,
      });
      expect(zoneAllocEucl.travelCostA).toBe(1.0);
      expect(zoneAllocEucl.segments[0].options.find((o) => o.mode === SERVICE_MODES.DELIVERY).available).toBe(true);

      // Road check: travel cost is 9.0 > 4.0 -> MUST BE UNAVAILABLE even though Euclidean distance is 1.0
      const zoneAllocRoad = allocateFrontierDeliveryDemand({
        zone: { x: 5, y: 0, population: 100 },
        restaurantA: rA,
        restaurantB,
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: barrierNet,
      });
      expect(zoneAllocRoad.travelCostA).toBe(9.0);
      expect(zoneAllocRoad.segments[0].options.find((o) => o.mode === SERVICE_MODES.DELIVERY).available).toBe(false);
    });

    it('40. bridges restore delivery availability across water/chasm', () => {
      // Bridge network: horizontal barrier between row 4 and 5, bridges at x=2 and x=7
      const bridgeNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BRIDGE });

      // Restaurant at (2, 4) right on the West Bridge
      const rA = {
        ...restaurantA,
        location: { x: 2, y: 4 },
        delivery: createDeliveryConfig({ enabled: true, radius: 2.0 }),
      };

      // Zone at (2, 5) right across the bridge: travel cost is 1.0 <= 2.0 (available)
      const allocBridge = allocateFrontierDeliveryDemand({
        zone: { x: 2, y: 5, population: 50 },
        restaurantA: rA,
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bridgeNet,
      });
      const delOptBridge = allocBridge.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delOptBridge.available).toBe(true);

      // Zone at (0, 5) far from bridge: must detour (0,5)->(2,5)->(2,4) = 2 + 1 = 3 > 2.0 (unavailable)
      const allocNoBridge = allocateFrontierDeliveryDemand({
        zone: { x: 0, y: 5, population: 50 },
        restaurantA: rA,
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bridgeNet,
      });
      const delOptNoBridge = allocNoBridge.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delOptNoBridge.available).toBe(false);
    });

    it('41. bottlenecks increase delivery travel cost and delivery time', () => {
      const gridRoadNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
      const bottleneckRoadNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.BOTTLENECK });

      // Between (1, 4) and (1, 5):
      // On GRID: direct connection, travelCost = 1.0
      // On BOTTLENECK: direct connection blocked; detour through col 4-5 bottleneck corridor, travelCost = 7.0
      const allocGrid = allocateFrontierDeliveryDemand({
        zone: { x: 1, y: 5, population: 100 },
        restaurantA: {
          ...restaurantA,
          location: { x: 1, y: 4 },
          delivery: createDeliveryConfig({ enabled: true, radius: 10 }),
        },
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: gridRoadNet,
      });

      const allocBottleneck = allocateFrontierDeliveryDemand({
        zone: { x: 1, y: 5, population: 100 },
        restaurantA: {
          ...restaurantA,
          location: { x: 1, y: 4 },
          delivery: createDeliveryConfig({ enabled: true, radius: 10 }),
        },
        restaurantB: { ...restaurantB, location: { x: 8, y: 8 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: bottleneckRoadNet,
      });

      const timeGrid = allocGrid.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      ).deliveryTime;
      const timeBottleneck = allocBottleneck.segments[0].options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      ).deliveryTime;

      expect(allocBottleneck.travelCostA).toBeGreaterThan(allocGrid.travelCostA);
      expect(timeBottleneck).toBeGreaterThan(timeGrid);
    });

    it('42. unreachable destinations result in unserved consumers', () => {
      // Construct a road network where node (9,9) has no road links
      const gridRoadNet = createRoadNetwork({ scenario: ROAD_SCENARIO_IDS.GRID });
      const disconnectedNetwork = {
        width: gridRoadNet.width,
        height: gridRoadNet.height,
        adjacency: new Map([...gridRoadNet.adjacency.entries()]),
      };
      disconnectedNetwork.adjacency.set('9,9', []);

      const alloc = allocateFrontierDeliveryDemand({
        zone: { x: 9, y: 9, population: 150 },
        restaurantA: { ...restaurantA, location: { x: 1, y: 1 } },
        restaurantB: { ...restaurantB, location: { x: 2, y: 2 } },
        mode: TRAVEL_COST_MODES.ROAD,
        roadNetwork: disconnectedNetwork,
      });

      expect(alloc.isReachable).toBe(false);
      expect(alloc.unservedDemand).toBe(150);
      expect(alloc.demandA).toBe(0);
      expect(alloc.demandB).toBe(0);
      expect(alloc.choice).toBe('NONE');
    });
  });

  describe('5. Backward Compatibility (Mandatory Invariant)', () => {
    it('43. delivery-disabled behavior matches existing Frontier behavior exactly', () => {
      // Set delivery.enabled = false on both restaurants
      const disabledA = {
        id: 'A',
        location: { x: 1, y: 1 },
        price: 60,
        quality: 5,
        delivery: createDeliveryConfig({ enabled: false }),
      };
      const disabledB = {
        id: 'B',
        location: { x: 3, y: 3 },
        price: 45,
        quality: 7,
        delivery: createDeliveryConfig({ enabled: false }),
      };

      const testCity = createFrontierCity({ scenario: SCENARIO_IDS.POLYCENTRIC });

      // Baseline Phase 7B calculateFrontierMarket
      const baseResult = calculateFrontierMarket({
        city: testCity,
        restaurantA: disabledA,
        restaurantB: disabledB,
      });

      // Phase 8A calculateFrontierDeliveryMarket with delivery disabled
      const deliveryEngineResult = calculateFrontierDeliveryMarket({
        city: testCity,
        restaurantA: disabledA,
        restaurantB: disabledB,
      });

      // Demand must match exactly
      expect(deliveryEngineResult.restaurantDemand.A).toBeCloseTo(
        baseResult.restaurantDemand.A
      );
      expect(deliveryEngineResult.restaurantDemand.B).toBeCloseTo(
        baseResult.restaurantDemand.B
      );

      // Market shares must match exactly
      expect(deliveryEngineResult.marketShares.A).toBeCloseTo(
        baseResult.marketShares.A
      );
      expect(deliveryEngineResult.marketShares.B).toBeCloseTo(
        baseResult.marketShares.B
      );

      // Mode shares: dine-in must be 100% of served, delivery must be 0
      expect(deliveryEngineResult.deliveryDemand.A).toBe(0);
      expect(deliveryEngineResult.deliveryDemand.B).toBe(0);
      expect(deliveryEngineResult.modeShares.delivery).toBe(0);

      // Zone allocations must match exactly
      expect(deliveryEngineResult.zoneAllocations.length).toBe(
        baseResult.zoneAllocations.length
      );
      for (let i = 0; i < baseResult.zoneAllocations.length; i++) {
        const baseAlloc = baseResult.zoneAllocations[i];
        const delAlloc = deliveryEngineResult.zoneAllocations[i];

        expect(delAlloc.demandA).toBeCloseTo(baseAlloc.demandA);
        expect(delAlloc.demandB).toBeCloseTo(baseAlloc.demandB);
        expect(delAlloc.choice).toBe(baseAlloc.choice);
        expect(delAlloc.isReachable).toBe(baseAlloc.isReachable);
      }
    });

    it('matches existing Frontier behavior with multiple heterogeneous consumer segments when delivery is disabled', () => {
      const disabledA = {
        id: 'A',
        location: { x: 0, y: 0 },
        price: 80,
        quality: 8,
        delivery: createDeliveryConfig({ enabled: false }),
      };
      const disabledB = {
        id: 'B',
        location: { x: 4, y: 4 },
        price: 30,
        quality: 3,
        delivery: createDeliveryConfig({ enabled: false }),
      };

      const segments = [
        createConsumerSegment({ id: 'budget', populationShare: 0.35, beta: 2.0, gamma: 5 }),
        createConsumerSegment({ id: 'quality', populationShare: 0.40, beta: 0.8, gamma: 20 }),
        createConsumerSegment({ id: 'convenience', populationShare: 0.25, alpha: 25, delta: 3 }),
      ];

      const testCity = createFrontierCity({ scenario: SCENARIO_IDS.RETAIL_HUB });

      const baseResult = calculateFrontierMarket({
        city: testCity,
        restaurantA: disabledA,
        restaurantB: disabledB,
        segments,
      });

      const delResult = calculateFrontierDeliveryMarket({
        city: testCity,
        restaurantA: disabledA,
        restaurantB: disabledB,
        segments,
      });

      expect(delResult.restaurantDemand.A).toBeCloseTo(baseResult.restaurantDemand.A);
      expect(delResult.restaurantDemand.B).toBeCloseTo(baseResult.restaurantDemand.B);
      expect(delResult.marketShares.A).toBeCloseTo(baseResult.marketShares.A);
      expect(delResult.marketShares.B).toBeCloseTo(baseResult.marketShares.B);

      for (const seg of segments) {
        expect(delResult.segmentDemand[seg.id].A).toBeCloseTo(
          baseResult.segmentDemand[seg.id].A
        );
        expect(delResult.segmentDemand[seg.id].B).toBeCloseTo(
          baseResult.segmentDemand[seg.id].B
        );
      }
    });
  });

  describe('6. Edge Cases & Numerical Invariants', () => {
    it('handles radius = 0 (delivery available only at travelCost = 0)', () => {
      const zeroRadiusA = {
        ...restaurantA,
        delivery: createDeliveryConfig({ enabled: true, radius: 0, fee: 0, baseTime: 0, timePerDistance: 0 }),
      };

      // At travelCost = 0: delivery available
      const atOrigin = calculateZoneDeliveryChoice({
        travelCostA: 0,
        travelCostB: 5,
        restaurantA: zeroRadiusA,
        restaurantB,
      });
      const delAtOrigin = atOrigin.options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delAtOrigin.available).toBe(true);

      // At travelCost = 0.1: delivery unavailable
      const awayFromOrigin = calculateZoneDeliveryChoice({
        travelCostA: 0.1,
        travelCostB: 5,
        restaurantA: zeroRadiusA,
        restaurantB,
      });
      const delAway = awayFromOrigin.options.find(
        (o) => o.restaurantId === 'A' && o.mode === SERVICE_MODES.DELIVERY
      );
      expect(delAway.available).toBe(false);
    });

    it('handles fee = 0, baseTime = 0, timePerDistance = 0 without NaN', () => {
      const freeZeroA = {
        ...restaurantA,
        delivery: createDeliveryConfig({ enabled: true, radius: 5, fee: 0, baseTime: 0, timePerDistance: 0 }),
      };

      const res = calculateZoneDeliveryChoice({
        travelCostA: 2,
        travelCostB: 3,
        restaurantA: freeZeroA,
        restaurantB,
      });

      expect(Number.isFinite(res.shareA)).toBe(true);
      expect(Number.isFinite(res.shareB)).toBe(true);
      expect(res.shareA).toBeGreaterThan(0);
    });

    it('handles zero effective population without NaN or division by zero', () => {
      const zeroPopZone = allocateFrontierDeliveryDemand({
        zone: { x: 1, y: 1, population: 0 },
        restaurantA,
        restaurantB,
      });

      expect(zeroPopZone.demandA).toBe(0);
      expect(zeroPopZone.demandB).toBe(0);
      expect(zeroPopZone.shareA).toBe(0);
      expect(zeroPopZone.shareB).toBe(0);
      expect(zeroPopZone.modeShares.dineIn).toBe(0);
      expect(zeroPopZone.modeShares.delivery).toBe(0);
    });

    it('produces identical deterministic results when evaluated multiple times', () => {
      const r1 = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });
      const r2 = calculateFrontierDeliveryMarket({
        city,
        restaurantA,
        restaurantB,
      });

      expect(r1.restaurantDemand).toEqual(r2.restaurantDemand);
      expect(r1.dineInDemand).toEqual(r2.dineInDemand);
      expect(r1.deliveryDemand).toEqual(r2.deliveryDemand);
      expect(r1.restaurantShares).toEqual(r2.restaurantShares);
      expect(r1.modeShares).toEqual(r2.modeShares);
    });
  });
});
