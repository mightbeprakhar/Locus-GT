/**
 * @file PayoffPanel.jsx
 * @description Real-time economic telemetry displaying demand, market share, and profits for both firms.
 */

import { TrendingUp, PieChart } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Object} props.evaluation - Output of evaluateProfile()
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 */
export default function PayoffPanel({ evaluation, strategyA, strategyB }) {
  const {
    demandA = 0,
    demandB = 0,
    profitA = 0,
    profitB = 0,
    marketShareA = 0.5,
    marketShareB = 0.5,
    totalPopulation = 10000,
  } = evaluation ?? {};

  const shareAPct = (marketShareA * 100).toFixed(1);
  const shareBPct = (marketShareB * 100).toFixed(1);

  // Format profit into clean currency display
  const formatProfit = (val) => {
    const formatted = Math.abs(val).toLocaleString();
    if (val < 0) {
      return `-$${formatted}`;
    }
    return `$${formatted}`;
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col gap-4">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Economic Telemetry & Payoffs
          </h3>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Total Market: <strong className="text-white">{totalPopulation.toLocaleString()}</strong>
        </div>
      </div>

      {/* Dual Comparative Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Restaurant A Telemetry */}
        <div className="bg-slate-900/60 border border-cyan-500/30 rounded-xl p-3.5 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/80" />
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-cyan-400 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                A
              </span>
              Restaurant A
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {`P=$${strategyA.price}`}
            </span>
          </div>

          <div className="mt-1 flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Profit (π):</span>
              <span
                className={`text-base font-mono font-bold ${
                  profitA < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatProfit(profitA)}
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">Demand (D):</span>
              <span className="font-mono font-semibold text-slate-200">
                {Math.round(demandA).toLocaleString()}{' '}
                <span className="text-slate-400 font-normal">({shareAPct}%)</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">Margin / Unit:</span>
              <span className="font-mono text-slate-300">
                {`$${strategyA.price - 100}`}
              </span>
            </div>
          </div>
        </div>

        {/* Restaurant B Telemetry */}
        <div className="bg-slate-900/60 border border-rose-500/30 rounded-xl p-3.5 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/80" />
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-rose-400 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                B
              </span>
              Restaurant B
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {`P=$${strategyB.price}`}
            </span>
          </div>

          <div className="mt-1 flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Profit (π):</span>
              <span
                className={`text-base font-mono font-bold ${
                  profitB < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatProfit(profitB)}
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">Demand (D):</span>
              <span className="font-mono font-semibold text-slate-200">
                {Math.round(demandB).toLocaleString()}{' '}
                <span className="text-slate-400 font-normal">({shareBPct}%)</span>
              </span>
            </div>

            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">Margin / Unit:</span>
              <span className="font-mono text-slate-300">
                {`$${strategyB.price - 100}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Share Division Bar */}
      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1 text-cyan-400">
            <PieChart className="w-3 h-3" />
            Share A: {shareAPct}%
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            D_A + D_B = {Math.round(demandA + demandB).toLocaleString()}
          </span>
          <span className="text-rose-400">Share B: {shareBPct}%</span>
        </div>

        {/* Proportional Split Bar */}
        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex p-0.5 border border-slate-800 shadow-inner">
          <div
            className="h-full bg-cyan-500 rounded-l-full transition-all duration-300"
            style={{ width: `${shareAPct}%` }}
            title={`Restaurant A: ${shareAPct}%`}
          />
          <div
            className="h-full bg-rose-500 rounded-r-full transition-all duration-300"
            style={{ width: `${shareBPct}%` }}
            title={`Restaurant B: ${shareBPct}%`}
          />
        </div>
      </div>
    </div>
  );
}
