/**
 * @file ClassicLab.jsx
 * @description Classic Lab simulation page for LOCUS: Spatial Game Theory Laboratory.
 * Houses the fully functional Hotelling 10x10 discrete spatial duopoly,
 * payoff computations, best response analysis, pure Nash explorer,
 * and sequential best-response dynamics.
 */

import { useState, useMemo, useCallback } from 'react';
import CityMap from '../components/CityMap.jsx';
import GameControls from '../components/GameControls.jsx';
import PayoffPanel from '../components/PayoffPanel.jsx';
import BestResponsePanel from '../components/BestResponsePanel.jsx';
import EquilibriumPanel from '../components/EquilibriumPanel.jsx';
import DynamicsPanel from '../components/DynamicsPanel.jsx';
import { createDefaultCity } from '../game/city.js';
import { evaluateProfile } from '../game/payoff.js';
import { checkPureNashEquilibrium, computeBestResponseAnalysis } from '../game/equilibrium.js';
import {
  runBestResponseDynamics,
  stepBestResponseDynamics,
  createStrategyProfileKey,
} from '../game/dynamics.js';

// Baseline strategy profile
const INITIAL_STRATEGY_A = Object.freeze({
  location: { x: 2, y: 5 },
  price: 250,
});

const INITIAL_STRATEGY_B = Object.freeze({
  location: { x: 7, y: 5 },
  price: 250,
});

export default function ClassicLab() {
  // Deterministic 10x10 city grid
  const city = useMemo(() => createDefaultCity(), []);

  // Player strategies: { location: { x, y }, price }
  const [strategyA, setStrategyA] = useState(INITIAL_STRATEGY_A);
  const [strategyB, setStrategyB] = useState(INITIAL_STRATEGY_B);

  // Active controlled restaurant for relocation and pricing
  const [selectedRestaurant, setSelectedRestaurant] = useState('A');

  // Currently inspected Nash equilibrium profile (Phase 4A Explorer)
  const [selectedEquilibrium, setSelectedEquilibrium] = useState(null);

  // Currently inspected Best Response target (Phase 4B Analysis)
  const [selectedBestResponse, setSelectedBestResponse] = useState(null);

  // Phase 4C: Best-Response Dynamics state
  const [dynamicsResult, setDynamicsResult] = useState(null);
  const [selectedDynamicsState, setSelectedDynamicsState] = useState(null);
  const [dynamicsStartingPlayer, setDynamicsStartingPlayer] = useState('A');
  const [dynamicsMaxIterations, setDynamicsMaxIterations] = useState(25);
  const [dynamicsStepState, setDynamicsStepState] = useState(null);

  // Profile evaluation (allocations included for market visualization)
  const evaluation = useMemo(() => {
    return evaluateProfile({
      city,
      strategyA,
      strategyB,
      includeAllocations: true,
    });
  }, [city, strategyA, strategyB]);

  // Real-time pure Nash equilibrium diagnostic
  const equilibriumStatus = useMemo(() => {
    return checkPureNashEquilibrium({
      strategyA,
      strategyB,
      city,
    });
  }, [city, strategyA, strategyB]);

  // Real-time Best Response analysis for both restaurants
  const bestResponseAnalysis = useMemo(() => {
    return computeBestResponseAnalysis({
      city,
      strategyA,
      strategyB,
    });
  }, [city, strategyA, strategyB]);

  // Relocate active restaurant to selected cell
  const handleSelectLocation = useCallback(
    (newLocation) => {
      if (selectedRestaurant === 'A') {
        setStrategyA((prev) => ({
          ...prev,
          location: newLocation,
        }));
      } else {
        setStrategyB((prev) => ({
          ...prev,
          location: newLocation,
        }));
      }
    },
    [selectedRestaurant]
  );

  // Update unit price for a restaurant
  const handleChangePrice = useCallback((restaurantId, newPrice) => {
    if (restaurantId === 'A') {
      setStrategyA((prev) => ({
        ...prev,
        price: newPrice,
      }));
    } else {
      setStrategyB((prev) => ({
        ...prev,
        price: newPrice,
      }));
    }
  }, []);

  // Apply a recommended best response to a specific restaurant
  const handleApplyBestResponse = useCallback((player, strategy) => {
    if (!strategy) return;
    if (player === 'A') {
      setStrategyA(strategy);
    } else {
      setStrategyB(strategy);
    }
    setSelectedBestResponse(null);
    setSelectedEquilibrium(null);
    setSelectedDynamicsState(null);
  }, []);

  // Select an equilibrium to inspect on map
  const handleSelectEquilibrium = useCallback((eq) => {
    setSelectedEquilibrium(eq);
    setSelectedBestResponse(null);
    setSelectedDynamicsState(null);
  }, []);

  // Select a best response to inspect on map
  const handleSelectBestResponse = useCallback((br) => {
    setSelectedBestResponse(br);
    setSelectedEquilibrium(null);
    setSelectedDynamicsState(null);
  }, []);

  // Select a dynamics trajectory state to inspect on map
  const handleSelectDynamicsState = useCallback((state) => {
    setSelectedDynamicsState(state);
    setSelectedEquilibrium(null);
    setSelectedBestResponse(null);
  }, []);

  // Load a discovered Nash equilibrium profile directly into simulation
  const handleLoadEquilibrium = useCallback((equilibrium) => {
    if (!equilibrium) return;
    setStrategyA(equilibrium.strategyA);
    setStrategyB(equilibrium.strategyB);
    setSelectedBestResponse(null);
    setSelectedEquilibrium(null);
    setSelectedDynamicsState(null);
  }, []);

  // Load a historical trajectory state directly into simulation
  const handleLoadDynamicsState = useCallback((state) => {
    if (!state) return;
    setStrategyA(state.strategyA);
    setStrategyB(state.strategyB);
    setSelectedDynamicsState(null);
    setSelectedBestResponse(null);
    setSelectedEquilibrium(null);
  }, []);

  // Run full best-response dynamics solver
  const handleRunDynamics = useCallback(() => {
    setSelectedEquilibrium(null);
    setSelectedBestResponse(null);
    const res = runBestResponseDynamics({
      city,
      strategyA,
      strategyB,
      startingPlayer: dynamicsStartingPlayer,
      maxIterations: dynamicsMaxIterations,
    });
    setDynamicsResult(res);
    setSelectedDynamicsState(res.finalState);
    setDynamicsStepState({
      strategyA: res.finalState.strategyA,
      strategyB: res.finalState.strategyB,
      nextActingPlayer: res.finalState.actingPlayer === 'A' ? 'B' : 'A',
    });
  }, [city, strategyA, strategyB, dynamicsStartingPlayer, dynamicsMaxIterations]);

  // Execute a single unilateral best-response dynamic step
  const handleStepDynamics = useCallback(() => {
    setSelectedEquilibrium(null);
    setSelectedBestResponse(null);

    // Case 1: No dynamics result yet -> Start from current simulation profile
    if (!dynamicsResult || dynamicsResult.history.length === 0) {
      const initialEvaluation = evaluateProfile({ city, strategyA, strategyB });
      const initialNashCheck = checkPureNashEquilibrium({ city, strategyA, strategyB });
      const key0 = createStrategyProfileKey(strategyA, strategyB);

      const state0 = {
        iteration: 0,
        actingPlayer: null,
        strategyA: { ...strategyA, location: { ...strategyA.location } },
        strategyB: { ...strategyB, location: { ...strategyB.location } },
        payoffA: initialEvaluation.profitA,
        payoffB: initialEvaluation.profitB,
        demandA: initialEvaluation.demandA,
        demandB: initialEvaluation.demandB,
        marketShareA: initialEvaluation.marketShareA,
        marketShareB: initialEvaluation.marketShareB,
        isNash: initialNashCheck.isNash,
        deviationOccurred: false,
        tiedCount: 1,
        stateKey: key0,
      };

      if (initialNashCheck.isNash) {
        const res = {
          status: 'converged',
          history: [state0],
          iterationCount: 0,
          converged: true,
          cycleDetected: false,
          cycleStartIndex: null,
          cycleLength: null,
          finalState: state0,
          message: 'Initial strategy profile is already a pure-strategy Nash equilibrium.',
        };
        setDynamicsResult(res);
        setSelectedDynamicsState(state0);
        setDynamicsStepState(null);
        return;
      }

      const actingPlayer = dynamicsStartingPlayer;
      const stepResult = stepBestResponseDynamics({
        city,
        strategyA,
        strategyB,
        actingPlayer,
      });

      const state1 = {
        iteration: 1,
        actingPlayer: stepResult.actingPlayer,
        strategyA: stepResult.strategyA,
        strategyB: stepResult.strategyB,
        payoffA: stepResult.payoffA,
        payoffB: stepResult.payoffB,
        demandA: stepResult.demandA,
        demandB: stepResult.demandB,
        marketShareA: stepResult.marketShareA,
        marketShareB: stepResult.marketShareB,
        isNash: stepResult.isNash,
        deviationOccurred: stepResult.deviationOccurred,
        tiedCount: stepResult.tiedCount,
        stateKey: stepResult.stateKey,
      };

      const newHistory = [state0, state1];
      let status = 'stepping';
      let converged = false;
      let message = 'Step 1 complete.';

      if (state1.isNash) {
        status = 'converged';
        converged = true;
        message = 'Best-response dynamics converged to a pure-strategy Nash equilibrium at iteration 1.';
      } else if (dynamicsMaxIterations <= 1) {
        status = 'max-iterations';
        message = `Best-response dynamics reached the maximum iteration limit (${dynamicsMaxIterations}).`;
      }

      const res = {
        status,
        history: newHistory,
        iterationCount: 1,
        converged,
        cycleDetected: false,
        cycleStartIndex: null,
        cycleLength: null,
        finalState: state1,
        message,
      };

      setDynamicsResult(res);
      setSelectedDynamicsState(state1);
      setDynamicsStepState({
        strategyA: stepResult.strategyA,
        strategyB: stepResult.strategyB,
        nextActingPlayer: stepResult.nextActingPlayer,
      });
      return;
    }

    // Case 2: dynamicsResult exists. Continue from selectedDynamicsState (or finalState)
    const baseState = selectedDynamicsState ?? dynamicsResult.finalState;
    if (baseState.isNash) {
      return;
    }

    const actingPlayer =
      dynamicsStepState &&
      dynamicsStepState.strategyA === baseState.strategyA &&
      dynamicsStepState.strategyB === baseState.strategyB
        ? dynamicsStepState.nextActingPlayer
        : baseState.iteration === 0
        ? dynamicsStartingPlayer
        : baseState.actingPlayer === 'A'
        ? 'B'
        : 'A';

    const stepResult = stepBestResponseDynamics({
      city,
      strategyA: baseState.strategyA,
      strategyB: baseState.strategyB,
      actingPlayer,
    });

    const nextIteration = baseState.iteration + 1;
    const nextState = {
      iteration: nextIteration,
      actingPlayer: stepResult.actingPlayer,
      strategyA: stepResult.strategyA,
      strategyB: stepResult.strategyB,
      payoffA: stepResult.payoffA,
      payoffB: stepResult.payoffB,
      demandA: stepResult.demandA,
      demandB: stepResult.demandB,
      marketShareA: stepResult.marketShareA,
      marketShareB: stepResult.marketShareB,
      isNash: stepResult.isNash,
      deviationOccurred: stepResult.deviationOccurred,
      tiedCount: stepResult.tiedCount,
      stateKey: stepResult.stateKey,
    };

    const baseIndex = dynamicsResult.history.findIndex(
      (s) => s.iteration === baseState.iteration
    );
    const historyPrefix =
      baseIndex >= 0
        ? dynamicsResult.history.slice(0, baseIndex + 1)
        : dynamicsResult.history;
    const newHistory = [...historyPrefix, nextState];

    // Cycle detection
    let cycleDetected = false;
    let cycleStartIndex = null;
    let cycleLength = null;

    for (let i = 0; i < newHistory.length - 1; i++) {
      if (newHistory[i].stateKey === nextState.stateKey) {
        const len = nextIteration - newHistory[i].iteration;
        if (len >= 2) {
          cycleDetected = true;
          cycleStartIndex = newHistory[i].iteration;
          cycleLength = len;
          break;
        }
      }
    }

    let status = 'stepping';
    let converged = false;
    let message = `Step ${nextIteration} complete.`;

    if (nextState.isNash) {
      status = 'converged';
      converged = true;
      message = `Best-response dynamics converged to a pure-strategy Nash equilibrium at iteration ${nextIteration}.`;
    } else if (cycleDetected) {
      status = 'cycle';
      message = `Best-response dynamics entered a cycle of period ${cycleLength} starting at iteration ${cycleStartIndex}.`;
    } else if (nextIteration >= dynamicsMaxIterations) {
      status = 'max-iterations';
      message = `Best-response dynamics reached the maximum iteration limit (${dynamicsMaxIterations}).`;
    }

    const res = {
      status,
      history: newHistory,
      iterationCount: nextIteration,
      converged,
      cycleDetected,
      cycleStartIndex,
      cycleLength,
      finalState: nextState,
      message,
    };

    setDynamicsResult(res);
    setSelectedDynamicsState(nextState);
    setDynamicsStepState({
      strategyA: stepResult.strategyA,
      strategyB: stepResult.strategyB,
      nextActingPlayer: stepResult.nextActingPlayer,
    });
  }, [
    city,
    strategyA,
    strategyB,
    dynamicsResult,
    selectedDynamicsState,
    dynamicsStartingPlayer,
    dynamicsMaxIterations,
    dynamicsStepState,
  ]);

  // Reset dynamics only without affecting main simulation
  const handleResetDynamics = useCallback(() => {
    setDynamicsResult(null);
    setSelectedDynamicsState(null);
    setDynamicsStepState(null);
  }, []);

  // Reset simulation to baseline initial configuration
  const handleReset = useCallback(() => {
    setStrategyA(INITIAL_STRATEGY_A);
    setStrategyB(INITIAL_STRATEGY_B);
    setSelectedRestaurant('A');
    setSelectedEquilibrium(null);
    setSelectedBestResponse(null);
    setSelectedDynamicsState(null);
    setDynamicsResult(null);
    setDynamicsStepState(null);
  }, []);

  return (
    <div className="flex-1 flex flex-col">
      {/* Simulation Header Bar */}
      <header className="border-b border-slate-800/80 bg-[#090d16] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
            Classic Lab
          </h1>
          <p className="text-xs text-slate-400">
            Discrete Hotelling Spatial Competition & Pure Nash Dynamics
          </p>
        </div>

        {/* Compact Metadata / Status Row */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 font-mono">10 × 10 grid</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">
            {city.totalPopulation.toLocaleString()} customers
          </span>
          <span className="text-slate-600">·</span>
          <span
            className={`font-medium px-2 py-0.5 rounded text-[11px] border ${
              equilibriumStatus.isNash
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            }`}
          >
            {equilibriumStatus.isNash ? 'Nash equilibrium' : 'Not a Nash equilibrium'}
          </span>
          <span className="text-slate-600">·</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 px-2.5 py-1 rounded border border-slate-700/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: City Map Simulation */}
        <div className="lg:col-span-7 xl:col-span-7">
          <CityMap
            city={city}
            strategyA={strategyA}
            strategyB={strategyB}
            selectedRestaurant={selectedRestaurant}
            onSelectLocation={handleSelectLocation}
            evaluation={evaluation}
            selectedEquilibrium={selectedEquilibrium}
            selectedBestResponse={selectedBestResponse}
            selectedDynamicsState={selectedDynamicsState}
          />
        </div>

        {/* Right: Analytical Sidebar */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4">
          <GameControls
            strategyA={strategyA}
            strategyB={strategyB}
            selectedRestaurant={selectedRestaurant}
            onSelectRestaurant={setSelectedRestaurant}
            onChangePrice={handleChangePrice}
            onReset={handleReset}
          />

          <PayoffPanel
            evaluation={evaluation}
            strategyA={strategyA}
            strategyB={strategyB}
          />

          <BestResponsePanel
            analysis={bestResponseAnalysis}
            strategyA={strategyA}
            strategyB={strategyB}
            selectedBestResponse={selectedBestResponse}
            onSelectBestResponse={handleSelectBestResponse}
            onApplyBestResponse={handleApplyBestResponse}
          />

          <DynamicsPanel
            result={dynamicsResult}
            selectedState={selectedDynamicsState}
            onSelectState={handleSelectDynamicsState}
            onRun={handleRunDynamics}
            onStep={handleStepDynamics}
            onReset={handleResetDynamics}
            startingPlayer={dynamicsStartingPlayer}
            onStartingPlayerChange={setDynamicsStartingPlayer}
            maxIterations={dynamicsMaxIterations}
            onMaxIterationsChange={setDynamicsMaxIterations}
            onLoadState={handleLoadDynamicsState}
          />

          <EquilibriumPanel
            equilibriumStatus={equilibriumStatus}
            city={city}
            strategyA={strategyA}
            strategyB={strategyB}
            selectedEquilibrium={selectedEquilibrium}
            onSelectEquilibrium={handleSelectEquilibrium}
            onLoadEquilibrium={handleLoadEquilibrium}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#060910] px-4 sm:px-8 py-3 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          Model: Euclidean travel distance · discrete prices · full market coverage
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          R1({strategyA.location.x}, {strategyA.location.y}) at ₹{strategyA.price} vs R2({strategyB.location.x}, {strategyB.location.y}) at ₹{strategyB.price}
        </div>
      </footer>
    </div>
  );
}
