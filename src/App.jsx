/**
 * @file App.jsx
 * @description Main application shell for LOCUS: Spatial Game Theory Laboratory.
 * Coordinates simulation state, spatial visualization, payoffs, and equilibrium diagnostics.
 */

import { useState, useMemo, useCallback } from 'react';
import CityMap from './components/CityMap.jsx';
import GameControls from './components/GameControls.jsx';
import PayoffPanel from './components/PayoffPanel.jsx';
import EquilibriumPanel from './components/EquilibriumPanel.jsx';
import { createDefaultCity } from './game/city.js';
import { evaluateProfile } from './game/payoff.js';
import { checkPureNashEquilibrium } from './game/equilibrium.js';

// Baseline strategy profile
const INITIAL_STRATEGY_A = Object.freeze({
  location: { x: 2, y: 5 },
  price: 250,
});

const INITIAL_STRATEGY_B = Object.freeze({
  location: { x: 7, y: 5 },
  price: 250,
});

export default function App() {
  // Deterministic 10x10 city grid
  const city = useMemo(() => createDefaultCity(), []);

  // Player strategies: { location: { x, y }, price }
  const [strategyA, setStrategyA] = useState(INITIAL_STRATEGY_A);
  const [strategyB, setStrategyB] = useState(INITIAL_STRATEGY_B);

  // Active controlled restaurant for relocation and pricing
  const [selectedRestaurant, setSelectedRestaurant] = useState('A');

  // Currently inspected Nash equilibrium profile (Phase 4A Explorer)
  const [selectedEquilibrium, setSelectedEquilibrium] = useState(null);

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

  // Load a discovered Nash equilibrium profile directly into simulation
  const handleLoadEquilibrium = useCallback((equilibrium) => {
    if (!equilibrium) return;
    setStrategyA(equilibrium.strategyA);
    setStrategyB(equilibrium.strategyB);
  }, []);

  // Reset simulation to baseline initial configuration
  const handleReset = useCallback(() => {
    setStrategyA(INITIAL_STRATEGY_A);
    setStrategyB(INITIAL_STRATEGY_B);
    setSelectedRestaurant('A');
    setSelectedEquilibrium(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#090d16] px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-100">
            LOCUS
          </h1>
          <p className="text-xs text-slate-400">
            Spatial Game Theory Laboratory
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

          <EquilibriumPanel
            equilibriumStatus={equilibriumStatus}
            city={city}
            strategyA={strategyA}
            strategyB={strategyB}
            selectedEquilibrium={selectedEquilibrium}
            onSelectEquilibrium={setSelectedEquilibrium}
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
          A({strategyA.location.x}, {strategyA.location.y}) at ₹{strategyA.price} vs B({strategyB.location.x}, {strategyB.location.y}) at ₹{strategyB.price}
        </div>
      </footer>
    </div>
  );
}
