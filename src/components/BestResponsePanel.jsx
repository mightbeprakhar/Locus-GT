/**
 * @file BestResponsePanel.jsx
 * @description Best Response Analysis panel for LOCUS: Spatial Game Theory Laboratory.
 * Exposes unilateral strategic optimization against the opponent's current strategy,
 * detects profitable deviations, handles tied best responses, and provides map preview
 * and application actions.
 */

import { useState } from 'react';
import { Target, CheckCircle2, AlertTriangle, ArrowRight, Eye, Play } from 'lucide-react';

/**
 * @param {Object} props
 * @param {Object} props.analysis - Output of computeBestResponseAnalysis()
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 * @param {Object|null} [props.selectedBestResponse] - Currently previewed best-response target
 * @param {(target: { player: 'A'|'B', strategy: Object } | null) => void} [props.onSelectBestResponse]
 * @param {(player: 'A'|'B', strategy: Object) => void} props.onApplyBestResponse
 */
export default function BestResponsePanel({
  analysis,
  strategyA,
  strategyB,
  selectedBestResponse = null,
  onSelectBestResponse = () => {},
  onApplyBestResponse = () => {},
}) {
  const [selectedTiedA, setSelectedTiedA] = useState(0);
  const [selectedTiedB, setSelectedTiedB] = useState(0);

  const { restaurant1, restaurant2, isNash } = analysis ?? {};

  const formatCurrency = (val) => {
    const formatted = Math.abs(Math.round(val)).toLocaleString();
    return val < 0 ? `-₹${formatted}` : `₹${formatted}`;
  };

  const isCurrentMatching = (current, target) => {
    if (!current || !target) return false;
    return (
      current.location.x === target.location.x &&
      current.location.y === target.location.y &&
      current.price === target.price
    );
  };

  // Safe indexing for tied responses
  const tiedListA = restaurant1?.bestResponseDetails ?? [];
  const tiedListB = restaurant2?.bestResponseDetails ?? [];

  const safeIndexA = Math.min(selectedTiedA, Math.max(0, tiedListA.length - 1));
  const safeIndexB = Math.min(selectedTiedB, Math.max(0, tiedListB.length - 1));

  const activeDetailA = tiedListA[safeIndexA] ?? null;
  const activeDetailB = tiedListB[safeIndexB] ?? null;

  const isPreviewingA =
    selectedBestResponse?.player === 'A' &&
    activeDetailA &&
    isCurrentMatching(selectedBestResponse.strategy, activeDetailA.strategy);

  const isPreviewingB =
    selectedBestResponse?.player === 'B' &&
    activeDetailB &&
    isCurrentMatching(selectedBestResponse.strategy, activeDetailB.strategy);

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-sky-400" />
            <span>Best Response Analysis</span>
          </h2>
          <p className="text-xs text-slate-400">
            Unilateral optimal strategies against opponent's current action
          </p>
        </div>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
            isNash
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
          }`}
        >
          {isNash ? 'Mutual best responses' : 'Deviation incentive exists'}
        </span>
      </div>

      {/* Side-by-side or Stacked Cards for Restaurant 1 and Restaurant 2 */}
      <div className="flex flex-col gap-4">
        {/* ========================================================================= */}
        {/* Restaurant 1 (Firm A) */}
        {/* ========================================================================= */}
        {restaurant1 && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col gap-3">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="font-semibold text-xs sm:text-sm text-sky-400">
                  Restaurant 1
                </span>
                <span className="text-[10px] text-slate-500 font-mono">(Firm A)</span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                  restaurant1.hasProfitableDeviation
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {restaurant1.hasProfitableDeviation ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Profitable deviation available</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Best response</span>
                  </>
                )}
              </span>
            </div>

            {/* Current Strategy vs Best Response Comparison Table */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Current Strategy Column */}
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 flex flex-col gap-1.5">
                <div className="text-[11px] font-medium text-slate-400 pb-1 border-b border-slate-800/50 flex items-center justify-between">
                  <span>Current strategy</span>
                  <span className="font-mono text-slate-300">
                    {`(${strategyA.location.x}, ${strategyA.location.y}) @ ₹${strategyA.price}`}
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-mono text-slate-200">
                      {`(${strategyA.location.x}, ${strategyA.location.y})`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="font-mono text-slate-200">{`₹${strategyA.price}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Demand:</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(restaurant1.current.demand).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Market share:</span>
                    <span className="font-mono text-slate-200">
                      {`${(restaurant1.current.marketShare * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/40">
                    <span className="text-slate-400 font-medium">Profit:</span>
                    <span className="font-mono font-semibold text-slate-100">
                      {formatCurrency(restaurant1.current.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Best Response Column */}
              {activeDetailA && (
                <div className="p-2.5 rounded-lg bg-sky-950/20 border border-sky-500/30 flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium text-sky-300 pb-1 border-b border-sky-500/20 flex items-center justify-between">
                    <span>Best response</span>
                    <span className="font-mono text-sky-200">
                      {`(${activeDetailA.strategy.location.x}, ${activeDetailA.strategy.location.y}) @ ₹${activeDetailA.strategy.price}`}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="font-mono text-sky-300">
                        {`(${activeDetailA.strategy.location.x}, ${activeDetailA.strategy.location.y})`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="font-mono text-sky-300">{`₹${activeDetailA.strategy.price}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected demand:</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(activeDetailA.demand).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected share:</span>
                      <span className="font-mono text-slate-200">
                        {`${(activeDetailA.marketShare * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-sky-500/20">
                      <span className="text-slate-400 font-medium">Expected profit:</span>
                      <span className="font-mono font-semibold text-sky-300">
                        {formatCurrency(activeDetailA.payoff)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profit Improvement / Status Callout */}
            {restaurant1.hasProfitableDeviation ? (
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Profitable deviation available</span>
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {`+${formatCurrency(restaurant1.profitImprovement)}`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center justify-between font-mono">
                  <span>{`Current profit: ${formatCurrency(restaurant1.current.profit)}`}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-sky-300">{`Best-response profit: ${formatCurrency(restaurant1.bestPayoff)}`}</span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No profitable deviation available against the current opponent strategy.</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Restaurant 1 is playing an optimal unilateral response (profit improvement: {formatCurrency(0)}). A full Nash equilibrium additionally requires Restaurant 2 to have no profitable deviation.
                </p>
              </div>
            )}

            {/* Tied Best Responses Selector */}
            {restaurant1.tiedCount > 1 && (
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-300">
                    {`Tied best responses (${restaurant1.tiedCount})`}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Identical payoff of {formatCurrency(restaurant1.bestPayoff)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {tiedListA.map((detail, idx) => {
                    const isSelected = idx === safeIndexA;
                    const isMatchCurrent = isCurrentMatching(strategyA, detail.strategy);
                    return (
                      <button
                        key={`tied-a-${detail.strategy.location.x}-${detail.strategy.location.y}-${detail.strategy.price}`}
                        type="button"
                        onClick={() => {
                          setSelectedTiedA(idx);
                          onSelectBestResponse({ player: 'A', strategy: detail.strategy });
                        }}
                        className={`p-2 rounded border text-left text-[11px] transition-colors cursor-pointer flex flex-col gap-0.5 ${
                          isSelected
                            ? 'bg-sky-950/40 border-sky-500/60 text-slate-100 ring-1 ring-sky-500/30'
                            : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-sky-300">
                            {`Option #${idx + 1}: (${detail.strategy.location.x}, ${detail.strategy.location.y}) @ ₹${detail.strategy.price}`}
                          </span>
                          {isMatchCurrent && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {`Demand: ${Math.round(detail.demand).toLocaleString()} · Share: ${(detail.marketShare * 100).toFixed(1)}%`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions: Preview & Apply Best Response */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <button
                type="button"
                onClick={() => {
                  if (isPreviewingA) {
                    onSelectBestResponse(null);
                  } else if (activeDetailA) {
                    onSelectBestResponse({ player: 'A', strategy: activeDetailA.strategy });
                  }
                }}
                className={`py-1.5 px-3 text-xs rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isPreviewingA
                    ? 'bg-sky-500/20 text-sky-200 border-sky-500/50 font-medium'
                    : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border-slate-700/60'
                }`}
                title="Preview the best-response target pin on the city map"
              >
                <Eye className="w-3.5 h-3.5 text-sky-400" />
                <span>{isPreviewingA ? 'Hide map target' : 'Preview on map'}</span>
              </button>

              <button
                type="button"
                disabled={!activeDetailA || isCurrentMatching(strategyA, activeDetailA.strategy)}
                onClick={() => {
                  if (activeDetailA) {
                    onApplyBestResponse('A', activeDetailA.strategy);
                  }
                }}
                className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {activeDetailA && isCurrentMatching(strategyA, activeDetailA.strategy)
                    ? 'Current strategy is best response'
                    : 'Apply Best Response'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* Restaurant 2 (Firm B) */}
        {/* ========================================================================= */}
        {restaurant2 && (
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex flex-col gap-3">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="font-semibold text-xs sm:text-sm text-rose-400">
                  Restaurant 2
                </span>
                <span className="text-[10px] text-slate-500 font-mono">(Firm B)</span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded border flex items-center gap-1 ${
                  restaurant2.hasProfitableDeviation
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                }`}
              >
                {restaurant2.hasProfitableDeviation ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Profitable deviation available</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Best response</span>
                  </>
                )}
              </span>
            </div>

            {/* Current Strategy vs Best Response Comparison Table */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Current Strategy Column */}
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 flex flex-col gap-1.5">
                <div className="text-[11px] font-medium text-slate-400 pb-1 border-b border-slate-800/50 flex items-center justify-between">
                  <span>Current strategy</span>
                  <span className="font-mono text-slate-300">
                    {`(${strategyB.location.x}, ${strategyB.location.y}) @ ₹${strategyB.price}`}
                  </span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Location:</span>
                    <span className="font-mono text-slate-200">
                      {`(${strategyB.location.x}, ${strategyB.location.y})`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="font-mono text-slate-200">{`₹${strategyB.price}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Demand:</span>
                    <span className="font-mono text-slate-200">
                      {Math.round(restaurant2.current.demand).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Market share:</span>
                    <span className="font-mono text-slate-200">
                      {`${(restaurant2.current.marketShare * 100).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/40">
                    <span className="text-slate-400 font-medium">Profit:</span>
                    <span className="font-mono font-semibold text-slate-100">
                      {formatCurrency(restaurant2.current.profit)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Best Response Column */}
              {activeDetailB && (
                <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30 flex flex-col gap-1.5">
                  <div className="text-[11px] font-medium text-rose-300 pb-1 border-b border-rose-500/20 flex items-center justify-between">
                    <span>Best response</span>
                    <span className="font-mono text-rose-200">
                      {`(${activeDetailB.strategy.location.x}, ${activeDetailB.strategy.location.y}) @ ₹${activeDetailB.strategy.price}`}
                    </span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Location:</span>
                      <span className="font-mono text-rose-300">
                        {`(${activeDetailB.strategy.location.x}, ${activeDetailB.strategy.location.y})`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Price:</span>
                      <span className="font-mono text-rose-300">{`₹${activeDetailB.strategy.price}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected demand:</span>
                      <span className="font-mono text-slate-200">
                        {Math.round(activeDetailB.demand).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected share:</span>
                      <span className="font-mono text-slate-200">
                        {`${(activeDetailB.marketShare * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-rose-500/20">
                      <span className="text-slate-400 font-medium">Expected profit:</span>
                      <span className="font-mono font-semibold text-rose-300">
                        {formatCurrency(activeDetailB.payoff)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profit Improvement / Status Callout */}
            {restaurant2.hasProfitableDeviation ? (
              <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Profitable deviation available</span>
                  </span>
                  <span className="font-mono font-bold text-amber-300">
                    {`+${formatCurrency(restaurant2.profitImprovement)}`}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex items-center justify-between font-mono">
                  <span>{`Current profit: ${formatCurrency(restaurant2.current.profit)}`}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-rose-300">{`Best-response profit: ${formatCurrency(restaurant2.bestPayoff)}`}</span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No profitable deviation available against the current opponent strategy.</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Restaurant 2 is playing an optimal unilateral response (profit improvement: {formatCurrency(0)}). A full Nash equilibrium additionally requires Restaurant 1 to have no profitable deviation.
                </p>
              </div>
            )}

            {/* Tied Best Responses Selector */}
            {restaurant2.tiedCount > 1 && (
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-slate-300">
                    {`Tied best responses (${restaurant2.tiedCount})`}
                  </span>
                  <span className="text-slate-500 text-[10px]">
                    Identical payoff of {formatCurrency(restaurant2.bestPayoff)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {tiedListB.map((detail, idx) => {
                    const isSelected = idx === safeIndexB;
                    const isMatchCurrent = isCurrentMatching(strategyB, detail.strategy);
                    return (
                      <button
                        key={`tied-b-${detail.strategy.location.x}-${detail.strategy.location.y}-${detail.strategy.price}`}
                        type="button"
                        onClick={() => {
                          setSelectedTiedB(idx);
                          onSelectBestResponse({ player: 'B', strategy: detail.strategy });
                        }}
                        className={`p-2 rounded border text-left text-[11px] transition-colors cursor-pointer flex flex-col gap-0.5 ${
                          isSelected
                            ? 'bg-rose-950/40 border-rose-500/60 text-slate-100 ring-1 ring-rose-500/30'
                            : 'bg-slate-950/40 border-slate-800/70 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-rose-300">
                            {`Option #${idx + 1}: (${detail.strategy.location.x}, ${detail.strategy.location.y}) @ ₹${detail.strategy.price}`}
                          </span>
                          {isMatchCurrent && (
                            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {`Demand: ${Math.round(detail.demand).toLocaleString()} · Share: ${(detail.marketShare * 100).toFixed(1)}%`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions: Preview & Apply Best Response */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
              <button
                type="button"
                onClick={() => {
                  if (isPreviewingB) {
                    onSelectBestResponse(null);
                  } else if (activeDetailB) {
                    onSelectBestResponse({ player: 'B', strategy: activeDetailB.strategy });
                  }
                }}
                className={`py-1.5 px-3 text-xs rounded-lg border transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                  isPreviewingB
                    ? 'bg-rose-500/20 text-rose-200 border-rose-500/50 font-medium'
                    : 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border-slate-700/60'
                }`}
                title="Preview the best-response target pin on the city map"
              >
                <Eye className="w-3.5 h-3.5 text-rose-400" />
                <span>{isPreviewingB ? 'Hide map target' : 'Preview on map'}</span>
              </button>

              <button
                type="button"
                disabled={!activeDetailB || isCurrentMatching(strategyB, activeDetailB.strategy)}
                onClick={() => {
                  if (activeDetailB) {
                    onApplyBestResponse('B', activeDetailB.strategy);
                  }
                }}
                className="flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>
                  {activeDetailB && isCurrentMatching(strategyB, activeDetailB.strategy)
                    ? 'Current strategy is best response'
                    : 'Apply Best Response'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
