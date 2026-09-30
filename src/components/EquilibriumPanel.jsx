/**
 * @file EquilibriumPanel.jsx
 * @description Game theory diagnostic panel showing pure Nash equilibrium status,
 * unilateral deviation incentives, and exhaustive equilibrium analysis.
 */

import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { findPureNashEquilibria } from '../game/equilibrium.js';

/**
 * @param {Object} props
 * @param {Object} props.equilibriumStatus - Result of checkPureNashEquilibrium()
 * @param {Array<Object>|{cells: Array<Object>}} props.city
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 */
export default function EquilibriumPanel({
  equilibriumStatus,
  city,
  strategyA,
  strategyB,
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const { isNash, playerA, playerB } = equilibriumStatus ?? {};

  const handleExhaustiveScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      try {
        const result = findPureNashEquilibria({ city });
        setScanResult(result);
      } catch (err) {
        console.error('Scan error:', err);
      } finally {
        setIsScanning(false);
      }
    }, 50);
  };

  const formatCurrency = (val) => {
    const formatted = Math.abs(Math.round(val)).toLocaleString();
    return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Equilibrium</h2>
          <p className="text-xs text-slate-400">Pure-strategy Nash stability and unilateral incentives</p>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Pure strategy
        </span>
      </div>

      {/* Equilibrium Status Banner */}
      <div
        className={`px-3.5 py-3 rounded-lg border flex flex-col gap-1.5 transition-colors ${
          isNash
            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
            : 'bg-amber-950/20 border-amber-500/30 text-amber-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">
            {isNash ? 'Nash equilibrium' : 'Not a Nash equilibrium'}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              isNash ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </div>

        <div className="text-xs text-slate-300 space-y-0.5">
          {isNash ? (
            <p>Neither restaurant has a profitable unilateral deviation.</p>
          ) : (
            <>
              {playerA?.hasProfitableDeviation && (
                <p>Restaurant A has a profitable unilateral deviation.</p>
              )}
              {playerB?.hasProfitableDeviation && (
                <p>Restaurant B has a profitable unilateral deviation.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unilateral Deviation Analysis */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-slate-300">Unilateral deviation analysis</h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Restaurant A */}
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/70 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
              <span className="font-semibold text-sky-400">Restaurant A</span>
              <span
                className={`text-[10px] font-medium ${
                  playerA?.hasProfitableDeviation ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {playerA?.hasProfitableDeviation ? 'Deviation available' : 'Best response'}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Strategy:</span>
                <span className="font-mono text-slate-300">
                  {`(${strategyA.location.x}, ${strategyA.location.y}) @ ₹${strategyA.price}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Current payoff:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(playerA?.currentPayoff ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Best alternative:</span>
                <span className="font-mono text-sky-300">
                  {formatCurrency(playerA?.bestPayoff ?? 0)}
                </span>
              </div>
              {playerA?.hasProfitableDeviation && (
                <div className="flex justify-between text-amber-300/90 pt-1 border-t border-slate-800/50 font-medium">
                  <span>Gain:</span>
                  <span className="font-mono">
                    +{formatCurrency((playerA?.bestPayoff ?? 0) - (playerA?.currentPayoff ?? 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Restaurant B */}
          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/70 flex flex-col gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
              <span className="font-semibold text-rose-400">Restaurant B</span>
              <span
                className={`text-[10px] font-medium ${
                  playerB?.hasProfitableDeviation ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {playerB?.hasProfitableDeviation ? 'Deviation available' : 'Best response'}
              </span>
            </div>

            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Strategy:</span>
                <span className="font-mono text-slate-300">
                  {`(${strategyB.location.x}, ${strategyB.location.y}) @ ₹${strategyB.price}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Current payoff:</span>
                <span className="font-mono text-slate-200">
                  {formatCurrency(playerB?.currentPayoff ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Best alternative:</span>
                <span className="font-mono text-rose-300">
                  {formatCurrency(playerB?.bestPayoff ?? 0)}
                </span>
              </div>
              {playerB?.hasProfitableDeviation && (
                <div className="flex justify-between text-amber-300/90 pt-1 border-t border-slate-800/50 font-medium">
                  <span>Gain:</span>
                  <span className="font-mono">
                    +{formatCurrency((playerB?.bestPayoff ?? 0) - (playerB?.currentPayoff ?? 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-Game Exhaustive Search Section */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-slate-300">Full-game Nash search</h3>
          <span className="text-[11px] font-mono text-slate-400">
            500 × 500 = 250,000 profiles
          </span>
        </div>

        <button
          type="button"
          disabled={isScanning}
          onClick={handleExhaustiveScan}
          className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-700 disabled:opacity-50 border border-slate-700/60 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
              <span>Scanning 250,000 profiles...</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search for pure Nash equilibria</span>
            </>
          )}
        </button>

        {scanResult && (
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-200">
                Full-game search across {scanResult.profilesEvaluated.toLocaleString()} possible strategy profiles
              </span>
              <span
                className={`font-mono font-semibold ${
                  scanResult.count > 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {scanResult.count} pure-strategy Nash equilibria
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {scanResult.message}
            </p>
            <p className="text-[11px] text-slate-400">
              The count depends on the current city/model, not the restaurants' current strategies.
            </p>
            {scanResult.count === 0 && (
              <p className="text-[11px] text-slate-500 italic">
                Note: Non-existence of a pure strategy equilibrium does not preclude mixed-strategy equilibria.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
