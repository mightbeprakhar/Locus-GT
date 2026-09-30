/**
 * @file EquilibriumPanel.jsx
 * @description Game theory diagnostic panel showing pure Nash equilibrium status,
 * unilateral deviation incentives, and interactive Nash equilibrium explorer.
 */

import { useState } from 'react';
import { Search, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { findPureNashEquilibria } from '../game/equilibrium.js';

/**
 * @param {Object} props
 * @param {Object} props.equilibriumStatus - Result of checkPureNashEquilibrium()
 * @param {Array<Object>|{cells: Array<Object>}} props.city
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 * @param {Object|null} [props.selectedEquilibrium] - Currently inspected equilibrium
 * @param {(equilibrium: Object|null) => void} [props.onSelectEquilibrium]
 * @param {(equilibrium: Object) => void} [props.onLoadEquilibrium]
 */
export default function EquilibriumPanel({
  equilibriumStatus,
  city,
  strategyA,
  strategyB,
  selectedEquilibrium = null,
  onSelectEquilibrium = () => {},
  onLoadEquilibrium = () => {},
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isListExpanded, setIsListExpanded] = useState(false);

  const { isNash, playerA, playerB } = equilibriumStatus ?? {};

  const handleExhaustiveScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      try {
        const result = findPureNashEquilibria({ city });
        setScanResult(result);
        if (result.count > 0) {
          setIsListExpanded(true);
        }
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

  // Helper to check if an equilibrium matches current simulation state
  const isCurrentProfile = (eq) => {
    if (!eq) return false;
    return (
      strategyA.location.x === eq.strategyA.location.x &&
      strategyA.location.y === eq.strategyA.location.y &&
      strategyA.price === eq.strategyA.price &&
      strategyB.location.x === eq.strategyB.location.x &&
      strategyB.location.y === eq.strategyB.location.y &&
      strategyB.price === eq.strategyB.price
    );
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

      {/* Part A: Current-Profile Nash Diagnostic */}
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

      {/* Part B: Full-Game Nash Search Section */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-medium text-slate-300">Full-game Nash search</h3>
            <p className="text-[11px] text-slate-500">
              Exhaustive analysis across 250,000 strategy profiles
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            500 × 500 = 250,000
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
          <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs flex flex-col gap-2.5">
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

            {scanResult.count > 0 && (
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isListExpanded ? `Showing all ${scanResult.count} discovered equilibria` : `${scanResult.count} equilibria available`}
                </span>
                <button
                  type="button"
                  onClick={() => setIsListExpanded((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 px-2.5 py-1 rounded border border-slate-700/60 transition-colors cursor-pointer"
                >
                  <span>{isListExpanded ? 'Hide equilibria' : `View ${scanResult.count} equilibria`}</span>
                  {isListExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Selected Equilibrium Detailed Inspector */}
        {selectedEquilibrium && (
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-sky-500/40 text-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">
                  {`Selected Equilibrium #${selectedEquilibrium.id}`}
                </span>
                <span className="text-[10px] text-emerald-300 font-medium bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  Pure Nash
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectEquilibrium(null)}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Clear selected equilibrium inspection"
              >
                Clear inspection
              </button>
            </div>

            {/* Profile Comparison: Current Profile vs Selected Equilibrium */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-slate-900/40 border border-slate-800/60">
                <span className="text-slate-400 font-medium">Current simulation:</span>
                <span className="font-mono text-slate-300">
                  {`A(${strategyA.location.x}, ${strategyA.location.y}) @ ₹${strategyA.price} vs B(${strategyB.location.x}, ${strategyB.location.y}) @ ₹${strategyB.price}`}
                </span>
                <span className={`text-[10px] font-medium ${equilibriumStatus.isNash ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {equilibriumStatus.isNash ? 'Nash' : 'Not Nash'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded bg-sky-950/20 border border-sky-500/30">
                <span className="text-sky-300 font-medium">{`Selected equilibrium #${selectedEquilibrium.id}:`}</span>
                <span className="font-mono text-slate-200">
                  {`A(${selectedEquilibrium.strategyA.location.x}, ${selectedEquilibrium.strategyA.location.y}) @ ₹${selectedEquilibrium.strategyA.price} vs B(${selectedEquilibrium.strategyB.location.x}, ${selectedEquilibrium.strategyB.location.y}) @ ₹${selectedEquilibrium.strategyB.price}`}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {isCurrentProfile(selectedEquilibrium) ? 'Active profile' : 'Candidate'}
                </span>
              </div>
            </div>

            {/* Payoffs & Demands */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/60">
                <div className="text-sky-400 font-medium">Restaurant A</div>
                <div className="text-slate-200 font-mono font-semibold">
                  {`Profit: ₹${Math.round(selectedEquilibrium.payoffA).toLocaleString()}`}
                </div>
                <div className="text-slate-400">
                  {`Demand: ${Math.round(selectedEquilibrium.demandA).toLocaleString()} (${((selectedEquilibrium.marketShareA ?? 0.5) * 100).toFixed(1)}%)`}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900/60 border border-slate-800/60">
                <div className="text-rose-400 font-medium">Restaurant B</div>
                <div className="text-slate-200 font-mono font-semibold">
                  {`Profit: ₹${Math.round(selectedEquilibrium.payoffB).toLocaleString()}`}
                </div>
                <div className="text-slate-400">
                  {`Demand: ${Math.round(selectedEquilibrium.demandB).toLocaleString()} (${((selectedEquilibrium.marketShareB ?? 0.5) * 100).toFixed(1)}%)`}
                </div>
              </div>
            </div>

            {/* Why is it a Nash equilibrium explanation */}
            <div className="p-2 rounded bg-slate-900/40 border border-slate-800/50 text-[11px] text-slate-400 space-y-1">
              <div className="font-medium text-slate-300">Why is this a Nash equilibrium?</div>
              <p className="leading-relaxed">
                Neither restaurant can increase its profit by unilaterally changing its location or price while the other restaurant's strategy remains fixed. Both firms' payoffs equal their maximum best-response payoffs against each other.
              </p>
            </div>

            {/* Action to load into simulation */}
            <button
              type="button"
              onClick={() => onLoadEquilibrium(selectedEquilibrium)}
              className="w-full py-2 px-3 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 rounded-lg transition-colors cursor-pointer text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              Load into simulation
            </button>
          </div>
        )}

        {/* Scrollable Equilibrium Explorer List */}
        {scanResult && scanResult.count > 0 && isListExpanded && (
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-medium text-slate-300">
                Pure-strategy Nash equilibria ({scanResult.count})
              </span>
              <span className="text-[11px] text-slate-500">
                Select to inspect on map
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 select-none">
              {scanResult.equilibria.map((eq) => {
                const isSelected = selectedEquilibrium?.id === eq.id;
                const isCurrent = isCurrentProfile(eq);

                return (
                  <div
                    key={eq.id}
                    onClick={() => onSelectEquilibrium(eq)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900/90 border-sky-500/60 ring-1 ring-sky-500/40 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">
                        Equilibrium #{eq.id}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isCurrent && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            Current profile
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/30">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-sky-400 font-sans font-medium">A: </span>
                        <span>({eq.strategyA.location.x}, {eq.strategyA.location.y}) @ ₹{eq.strategyA.price}</span>
                        <div className="text-slate-400 text-[10px]">
                          Profit: ₹{Math.round(eq.payoffA).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-rose-400 font-sans font-medium">B: </span>
                        <span>({eq.strategyB.location.x}, {eq.strategyB.location.y}) @ ₹{eq.strategyB.price}</span>
                        <div className="text-slate-400 text-[10px]">
                          Profit: ₹{Math.round(eq.payoffB).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-800/40 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">
                        Click to inspect on map
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadEquilibrium(eq);
                        }}
                        className="text-[11px] text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition-colors cursor-pointer"
                      >
                        Load into simulation
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
