/**
 * @file App.jsx
 * @description Main application shell for LOCUS: Spatial Game Theory Laboratory.
 * Orchestrates game state, city map, economic telemetry, and equilibrium diagnostics.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  RotateCcw,
  Compass,
  Cpu,
  Layers,
  Activity,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import CityMap from './components/CityMap.jsx';
import GameControls from './components/GameControls.jsx';
import PayoffPanel from './components/PayoffPanel.jsx';
import EquilibriumPanel from './components/EquilibriumPanel.jsx';
import { createDefaultCity } from './game/city.js';
import { evaluateProfile } from './game/payoff.js';
import { checkPureNashEquilibrium } from './game/equilibrium.js';

// Canonical initial baseline strategy profile
const INITIAL_STRATEGY_A = Object.freeze({
  location: { x: 2, y: 5 },
  price: 250,
});

const INITIAL_STRATEGY_B = Object.freeze({
  location: { x: 7, y: 5 },
  price: 250,
});

export default function App() {
  // Deterministic 10x10 city grid (created once)
  const city = useMemo(() => createDefaultCity(), []);

  // Canonical player strategies: { location: { x, y }, price }
  const [strategyA, setStrategyA] = useState(INITIAL_STRATEGY_A);
  const [strategyB, setStrategyB] = useState(INITIAL_STRATEGY_B);

  // Active controlled restaurant for relocation and price changes
  const [selectedRestaurant, setSelectedRestaurant] = useState('A');

  // Live profile evaluation (allocations included for cell coloring and inspector HUD)
  const evaluation = useMemo(() => {
    return evaluateProfile({
      city,
      strategyA,
      strategyB,
      includeAllocations: true,
    });
  }, [city, strategyA, strategyB]);

  // Real-time pure Nash equilibrium diagnostic for current profile
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

  // Reset simulation to baseline initial configuration
  const handleReset = useCallback(() => {
    setStrategyA(INITIAL_STRATEGY_A);
    setStrategyB(INITIAL_STRATEGY_B);
    setSelectedRestaurant('A');
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header Area */}
      <header className="sticky top-0 z-40 bg-[#090e18]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wider text-white">
                LOCUS
              </h1>
              <span className="text-[10px] font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                Phase 3 Lab
              </span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-wide">
              Spatial Game Theory Laboratory • Modified Hotelling Duopoly Model
            </p>
          </div>
        </div>

        {/* Global HUD status telemetry */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Grid: 10×10</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Pop: {city.totalPopulation.toLocaleString()}</span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-semibold ${
              equilibriumStatus.isNash
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            }`}
          >
            {equilibriumStatus.isNash ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>{equilibriumStatus.isNash ? 'Pure Nash' : 'Unstable Profile'}</span>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors cursor-pointer"
            title="Reset simulation to initial baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Section: Interactive City Map Workspace */}
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col gap-4">
          <CityMap
            city={city}
            strategyA={strategyA}
            strategyB={strategyB}
            selectedRestaurant={selectedRestaurant}
            onSelectLocation={handleSelectLocation}
            evaluation={evaluation}
          />
        </section>

        {/* Right Section: Strategic Controls, Payoffs, and Equilibrium Panel */}
        <section className="lg:col-span-5 xl:col-span-5 flex flex-col gap-5">
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
          />
        </section>
      </main>

      {/* Footer / Status bar */}
      <footer className="mt-auto border-t border-slate-900 bg-[#05080e] px-6 py-2.5 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>LOCUS Pure Mathematical Engine Active</span>
          <span>•</span>
          <span>Euclidean Spatial Metric</span>
          <span>•</span>
          <span>Strict Discrete Pricing Strategy</span>
        </div>
        <div className="font-mono text-slate-400">
          State: A({strategyA.location.x},{strategyA.location.y}) @ ${strategyA.price} vs B(
          {strategyB.location.x},{strategyB.location.y}) @ ${strategyB.price}
        </div>
      </footer>
    </div>
  );
}
