/**
 * @file DynamicsPanel.jsx
 * @description Sequential Best-Response Dynamics analytical panel for LOCUS:
 * Spatial Game Theory Laboratory.
 * Allows users to run or step through Cournot-style best-response adjustment paths,
 * detect pure Nash convergence or cycles, inspect historical trajectories,
 * and load historical states into the simulation.
 */

import { Activity, Play, StepForward, RotateCcw, CheckCircle2, Repeat, AlertCircle, ArrowRight } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Object|null} props.result - Output of runBestResponseDynamics() or step trajectory
 * @param {Object|null} props.selectedState - Currently inspected trajectory state
 * @param {(state: Object) => void} props.onSelectState - State selection callback
 * @param {() => void} props.onRun - Run full dynamics callback
 * @param {() => void} props.onStep - Single unilateral step callback
 * @param {() => void} props.onReset - Reset dynamics state callback
 * @param {'A'|'B'} props.startingPlayer - Initial acting firm ('A' or 'B')
 * @param {(player: 'A'|'B') => void} props.onStartingPlayerChange
 * @param {number} props.maxIterations - Iteration limit (10, 25, 50)
 * @param {(limit: number) => void} props.onMaxIterationsChange
 * @param {(state: Object) => void} props.onLoadState - Load historical profile into simulation
 * @param {boolean} [props.isRunning=false]
 */
export default function DynamicsPanel({
  result = null,
  selectedState = null,
  onSelectState = () => {},
  onRun = () => {},
  onStep = () => {},
  onReset = () => {},
  startingPlayer = 'A',
  onStartingPlayerChange = () => {},
  maxIterations = 25,
  onMaxIterationsChange = () => {},
  onLoadState = () => {},
  isRunning = false,
}) {
  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '—';
    const formatted = Math.abs(Math.round(val)).toLocaleString();
    return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  const formatStrategyCompact = (strat) => {
    if (!strat?.location) return '—';
    return `(${strat.location.x}, ${strat.location.y}) · ₹${strat.price}`;
  };

  const getRowStatus = (entry, res) => {
    if (entry.iteration === 0) return 'Initial';
    if (entry.isNash) return 'Nash';
    if (res?.status === 'cycle' && entry.iteration === res.iterationCount) return 'Cycle';
    if (entry.deviationOccurred) return 'Moved';
    return 'No change';
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Nash':
        return 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300';
      case 'Cycle':
        return 'bg-purple-950/40 border-purple-500/40 text-purple-300';
      case 'Moved':
        return 'bg-sky-950/40 border-sky-500/40 text-sky-300';
      case 'Initial':
        return 'bg-slate-800/60 border-slate-700/60 text-slate-300';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-400';
    }
  };

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <span>Best-Response Dynamics</span>
          </h2>
          <p className="text-xs text-slate-400">Sequential unilateral adjustments</p>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Cournot process</span>
      </div>

      {/* Brief explanation */}
      <p className="text-xs text-slate-400 leading-relaxed">
        Firms alternate best-response moves. The process may converge to a pure Nash equilibrium,
        enter a cycle, or reach the iteration limit.
      </p>

      {/* Configuration & Action Controls */}
      <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800/80 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Starting firm selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Starting firm</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onStartingPlayerChange('A')}
                className={`py-1.5 px-2 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  startingPlayer === 'A'
                    ? 'bg-sky-950/50 border-sky-500/50 text-sky-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Restaurant 1 (Firm A)</span>
              </button>
              <button
                type="button"
                onClick={() => onStartingPlayerChange('B')}
                className={`py-1.5 px-2 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  startingPlayer === 'B'
                    ? 'bg-rose-950/50 border-rose-500/50 text-rose-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Restaurant 2 (Firm B)</span>
              </button>
            </div>
          </div>

          {/* Max iterations selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Max iterations</span>
            <div className="grid grid-cols-3 gap-1.5">
              {[10, 25, 50].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => onMaxIterationsChange(limit)}
                  className={`py-1.5 px-2 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center ${
                    maxIterations === limit
                      ? 'bg-violet-950/50 border-violet-500/50 text-violet-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Dynamics</span>
          </button>
          <button
            type="button"
            onClick={onStep}
            disabled={isRunning}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-3 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <StepForward className="w-3.5 h-3.5 text-violet-300" />
            <span>Step Once</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1 border border-slate-800 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Dynamics</span>
          </button>
        </div>
      </div>

      {/* Result Summary */}
      {!result ? (
        <div className="text-xs text-slate-400 text-center py-6 border border-dashed border-slate-800 rounded-lg">
          Run the dynamics to observe strategic adjustment.
        </div>
      ) : (
        <div
          className={`p-3.5 rounded-lg border flex flex-col gap-2 transition-colors ${
            result.status === 'converged'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : result.status === 'cycle'
              ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
              : result.status === 'max-iterations'
              ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
              : 'bg-slate-950/40 border-slate-800/80 text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.status === 'converged' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {result.status === 'cycle' && <Repeat className="w-4 h-4 text-purple-400 shrink-0" />}
              {result.status === 'max-iterations' && (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              {result.status === 'stepping' && (
                <StepForward className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="text-xs font-semibold">
                {result.status === 'converged'
                  ? 'Converged to Nash equilibrium'
                  : result.status === 'cycle'
                  ? 'Cycle detected'
                  : result.status === 'max-iterations'
                  ? 'Maximum iterations reached'
                  : 'Stepping in progress'}
              </span>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-current opacity-80">
              {`${result.iterationCount} ${result.iterationCount === 1 ? 'iteration' : 'iterations'}`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1 border-t border-white/10">
            <div>
              <span className="text-slate-400">Iterations: </span>
              <span className="font-mono font-medium">{result.iterationCount}</span>
            </div>
            <div>
              <span className="text-slate-400">Starting firm: </span>
              <span className="font-medium">
                {startingPlayer === 'A' ? 'Restaurant 1' : 'Restaurant 2'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Final status: </span>
              <span className="font-medium capitalize">{result.status}</span>
            </div>
          </div>

          {result.message && (
            <p className="text-[11px] text-slate-300 italic opacity-90">{result.message}</p>
          )}
        </div>
      )}

      {/* Trajectory Inspector */}
      {result?.history && result.history.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-medium text-slate-300">{`Trajectory (${result.history.length} steps)`}</h3>
            <span className="text-[10px] text-slate-400">Click a row to preview profile</span>
          </div>

          <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-950/60 max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900/90 text-[11px] text-slate-400 border-b border-slate-800 sticky top-0 z-10 select-none">
                <tr>
                  <th className="py-2 px-2.5 font-medium">Step</th>
                  <th className="py-2 px-2 font-medium">Acting Firm</th>
                  <th className="py-2 px-2 font-medium">Restaurant 1</th>
                  <th className="py-2 px-2 font-medium">Restaurant 2</th>
                  <th className="py-2 px-2 font-medium text-right">Profit 1</th>
                  <th className="py-2 px-2 font-medium text-right">Profit 2</th>
                  <th className="py-2 px-2.5 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {result.history.map((entry) => {
                  const isSelected = selectedState?.iteration === entry.iteration;
                  const rowStatus = getRowStatus(entry, result);
                  const isInitial = entry.iteration === 0;

                  return (
                    <tr
                      key={entry.iteration}
                      onClick={() => onSelectState(entry)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-950/50 text-white font-medium border-l-2 border-l-sky-400'
                          : 'hover:bg-slate-900/70 text-slate-300'
                      }`}
                    >
                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                        {isInitial ? '0 (Initial)' : entry.iteration}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap font-sans">
                        {isInitial ? (
                          <span className="text-slate-400">Initial</span>
                        ) : entry.actingPlayer === 'A' ? (
                          <span className="text-sky-400 font-medium">Restaurant 1</span>
                        ) : (
                          <span className="text-rose-400 font-medium">Restaurant 2</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-sky-300">
                        {formatStrategyCompact(entry.strategyA)}
                      </td>
                      <td className="py-1.5 px-2 whitespace-nowrap text-rose-300">
                        {formatStrategyCompact(entry.strategyB)}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-200">
                        {formatCurrency(entry.payoffA)}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap text-slate-200">
                        {formatCurrency(entry.payoffB)}
                      </td>
                      <td className="py-1.5 px-2.5 text-center whitespace-nowrap font-sans">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusBadgeStyle(
                            rowStatus
                          )}`}
                        >
                          {rowStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected State Inspector */}
      {selectedState && (
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Selected Step</span>
              <span className="font-mono text-xs font-bold text-sky-400">
                {`#${selectedState.iteration}`}
              </span>
              {selectedState.iteration === 0 && (
                <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded bg-slate-800">
                  Initial
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] px-2 py-0.5 rounded border font-medium ${
                  selectedState.isNash
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                }`}
              >
                {selectedState.isNash ? 'Nash equilibrium' : 'Not Nash'}
              </span>
            </div>
          </div>

          {/* Acting firm & deviation info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pb-2 border-b border-slate-800/60">
            <div>
              <span className="text-slate-400">Acting firm: </span>
              <span className="font-medium">
                {selectedState.iteration === 0
                  ? 'Initial'
                  : selectedState.actingPlayer === 'A'
                  ? 'Restaurant 1 (Firm A)'
                  : 'Restaurant 2 (Firm B)'}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Deviation: </span>
              <span className="font-medium">
                {selectedState.iteration === 0
                  ? '—'
                  : selectedState.deviationOccurred
                  ? 'Strategy changed'
                  : 'No deviation (inertia)'}
              </span>
            </div>
          </div>

          {/* Side-by-side Strategy & Outcome Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Restaurant 1 Details */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                <span className="font-semibold text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  Restaurant 1
                </span>
                <span className="font-mono text-slate-300">
                  {`₹${selectedState.strategyA?.price}`}
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-300 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Location:</span>
                  <span>
                    ({selectedState.strategyA?.location.x}, {selectedState.strategyA?.location.y})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Price:</span>
                  <span>{`₹${selectedState.strategyA?.price}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Profit:</span>
                  <span className="text-emerald-400 font-medium">
                    {formatCurrency(selectedState.payoffA)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Demand:</span>
                  <span>{Math.round(selectedState.demandA).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Market share:</span>
                  <span>{`${(selectedState.marketShareA * 100).toFixed(1)}%`}</span>
                </div>
              </div>
            </div>

            {/* Restaurant 2 Details */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70 flex flex-col gap-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                <span className="font-semibold text-rose-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Restaurant 2
                </span>
                <span className="font-mono text-slate-300">
                  {`₹${selectedState.strategyB?.price}`}
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-300 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Location:</span>
                  <span>
                    ({selectedState.strategyB?.location.x}, {selectedState.strategyB?.location.y})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Price:</span>
                  <span>{`₹${selectedState.strategyB?.price}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Profit:</span>
                  <span className="text-emerald-400 font-medium">
                    {formatCurrency(selectedState.payoffB)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Demand:</span>
                  <span>{Math.round(selectedState.demandB).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Market share:</span>
                  <span>{`${(selectedState.marketShareB * 100).toFixed(1)}%`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Load into Simulation Button */}
          <button
            type="button"
            onClick={() => onLoadState(selectedState)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium py-1.5 px-3 rounded-lg border border-slate-700 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
          >
            <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
            <span>Load into Simulation</span>
          </button>
        </div>
      )}
    </section>
  );
}
