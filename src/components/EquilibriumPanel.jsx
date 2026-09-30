/**
 * @file EquilibriumPanel.jsx
 * @description Game theory diagnostic panel showing pure Nash equilibrium status,
 * unilateral deviation incentives, and on-demand exhaustive equilibrium analysis.
 */

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
} from 'lucide-react';
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
    // Use setTimeout so the UI updates to show the loading spinner immediately
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

  return (
    <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-cyan-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Game Theory Diagnostics
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          Pure Strategy
        </span>
      </div>

      {/* Real-time Nash Equilibrium Status Badge */}
      <div
        className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
          isNash
            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-200'
            : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
        }`}
      >
        <div className="mt-0.5">
          {isNash ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isNash ? 'Pure Nash Equilibrium' : 'Not in Equilibrium (Unstable Profile)'}
            </h4>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                isNash
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {isNash ? 'Stable' : 'Deviations Exist'}
            </span>
          </div>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {isNash
              ? 'Neither firm can unilaterally improve its profit by changing location or price.'
              : 'At least one firm has a unilateral incentive to deviate to a more profitable strategy.'}
          </p>
        </div>
      </div>

      {/* Unilateral Deviation Diagnostics */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
          Unilateral Deviation Analysis
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Player A Deviation Card */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-cyan-400 flex items-center gap-1">
                Player A
              </span>
              {playerA?.hasProfitableDeviation ? (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" /> Deviation Incentive
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Best Response
                </span>
              )}
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Strategy:</span>
              <span className="font-mono text-cyan-300">
                ({strategyA.location.x}, {strategyA.location.y}) @ ${strategyA.price}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Current Payoff:</span>
              <span className="font-mono text-slate-200">
                ${Math.round(playerA?.currentPayoff ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Best Alternative:</span>
              <span className="font-mono text-cyan-300">
                ${Math.round(playerA?.bestPayoff ?? 0).toLocaleString()}
              </span>
            </div>

            {playerA?.hasProfitableDeviation && (
              <div className="text-[10px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                Profit gain: +$
                {Math.round(
                  (playerA?.bestPayoff ?? 0) - (playerA?.currentPayoff ?? 0)
                ).toLocaleString()}
              </div>
            )}
          </div>

          {/* Player B Deviation Card */}
          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-400 flex items-center gap-1">
                Player B
              </span>
              {playerB?.hasProfitableDeviation ? (
                <span className="text-[10px] text-amber-400 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" /> Deviation Incentive
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Best Response
                </span>
              )}
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>Strategy:</span>
              <span className="font-mono text-rose-300">
                ({strategyB.location.x}, {strategyB.location.y}) @ ${strategyB.price}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Current Payoff:</span>
              <span className="font-mono text-slate-200">
                ${Math.round(playerB?.currentPayoff ?? 0).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Best Alternative:</span>
              <span className="font-mono text-rose-300">
                ${Math.round(playerB?.bestPayoff ?? 0).toLocaleString()}
              </span>
            </div>

            {playerB?.hasProfitableDeviation && (
              <div className="text-[10px] text-amber-300/90 pt-1 border-t border-slate-800/80">
                Profit gain: +$
                {Math.round(
                  (playerB?.bestPayoff ?? 0) - (playerB?.currentPayoff ?? 0)
                ).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Exhaustive Search Section */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
            Global Strategy Space Scan
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            500 × 500 = 250,000 Profiles
          </span>
        </div>

        <button
          type="button"
          disabled={isScanning}
          onClick={handleExhaustiveScan}
          className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 active:bg-slate-700 disabled:opacity-50 border border-slate-700/80 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50 shadow-sm"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Scanning 250,000 Profiles...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Scan Full Space for Pure Nash Equilibria</span>
            </>
          )}
        </button>

        {scanResult && (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs flex flex-col gap-1.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">
                Scan Findings ({scanResult.profilesEvaluated.toLocaleString()} profiles):
              </span>
              <span
                className={`font-mono font-bold text-xs ${
                  scanResult.count > 0 ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {scanResult.count} Pure Equilibria
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {scanResult.message}
            </p>
            {scanResult.count === 0 && (
              <p className="text-[10px] text-slate-400 italic">
                Note: Non-existence of a pure equilibrium does not preclude mixed-strategy equilibria.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
