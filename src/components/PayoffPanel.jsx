/**
 * @file PayoffPanel.jsx
 * @description Economic payoffs panel displaying demand, market share, profit, and unit margin.
 */

import { DEFAULT_VARIABLE_COST } from '../game/types.js';

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

  const marginA = strategyA.price - DEFAULT_VARIABLE_COST;
  const marginB = strategyB.price - DEFAULT_VARIABLE_COST;

  const formatCurrency = (val) => {
    const formatted = Math.abs(Math.round(val)).toLocaleString();
    return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Payoffs</h2>
          <p className="text-xs text-slate-400">Firm economic outcomes at current strategy profile</p>
        </div>
        <div className="text-xs text-slate-400">
          Total market: <span className="font-mono text-slate-200">{totalPopulation.toLocaleString()}</span>
        </div>
      </div>

      {/* Firm Outcomes Comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Restaurant A */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
            <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              Restaurant A
            </span>
            <span className="text-xs font-mono text-slate-400">{`₹${strategyA.price}`}</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="text-[11px] text-slate-400">Profit</div>
              <div
                className={`text-base font-mono font-semibold ${
                  profitA < 0 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {formatCurrency(profitA)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[11px] text-slate-400">Demand</div>
                <div className="font-mono font-medium text-slate-200">
                  {Math.round(demandA).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Market share</div>
                <div className="font-mono font-medium text-slate-200">{shareAPct}%</div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Margin</div>
              <div className="text-xs font-mono text-slate-300">
                {`₹${marginA}`}{' '}
                <span className="text-[10px] text-slate-500">/ unit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant B */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/60">
            <span className="text-xs font-semibold text-rose-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Restaurant B
            </span>
            <span className="text-xs font-mono text-slate-400">{`₹${strategyB.price}`}</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="text-[11px] text-slate-400">Profit</div>
              <div
                className={`text-base font-mono font-semibold ${
                  profitB < 0 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {formatCurrency(profitB)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-[11px] text-slate-400">Demand</div>
                <div className="font-mono font-medium text-slate-200">
                  {Math.round(demandB).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Market share</div>
                <div className="font-mono font-medium text-slate-200">{shareBPct}%</div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Margin</div>
              <div className="text-xs font-mono text-slate-300">
                {`₹${marginB}`}{' '}
                <span className="text-[10px] text-slate-500">/ unit</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Share Division Bar */}
      <div className="pt-2 border-t border-slate-800/60 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Market share</span>
          <span className="font-mono">
            <span className="text-sky-400">{shareAPct}%</span>
            {' : '}
            <span className="text-rose-400">{shareBPct}%</span>
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-sky-500 transition-all duration-200"
            style={{ width: `${shareAPct}%` }}
            title={`Restaurant A: ${shareAPct}%`}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-200"
            style={{ width: `${shareBPct}%` }}
            title={`Restaurant B: ${shareBPct}%`}
          />
        </div>
      </div>
    </section>
  );
}
