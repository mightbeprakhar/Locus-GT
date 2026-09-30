/**
 * @file GameControls.jsx
 * @description Simulation controls for selecting the active restaurant and setting discrete unit prices.
 */

import { RotateCcw } from 'lucide-react';
import { DEFAULT_ALLOWED_PRICES } from '../game/types.js';

/**
 * @param {Object} props
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 * @param {'A'|'B'} props.selectedRestaurant
 * @param {(restaurantId: 'A'|'B') => void} props.onSelectRestaurant
 * @param {(restaurantId: 'A'|'B', price: number) => void} props.onChangePrice
 * @param {() => void} props.onReset
 */
export default function GameControls({
  strategyA,
  strategyB,
  selectedRestaurant,
  onSelectRestaurant,
  onChangePrice,
  onReset,
}) {
  const activeStrategy = selectedRestaurant === 'A' ? strategyA : strategyB;
  const isA = selectedRestaurant === 'A';

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Controls</h2>
          <p className="text-xs text-slate-400">Configure firm locations and strategic pricing</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          title="Reset simulation to initial baseline"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Choose Restaurant */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-slate-300">Choose restaurant</label>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Restaurant A Selector */}
          <button
            type="button"
            onClick={() => onSelectRestaurant('A')}
            className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              isA
                ? 'bg-sky-950/30 border-sky-500/60 text-slate-100'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="flex items-center gap-1.5 font-semibold text-xs text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Restaurant 1 <span className="text-[10px] text-slate-500 font-normal">(Firm A)</span>
              </span>
              {isA && (
                <span className="text-[10px] font-medium text-sky-300 bg-sky-500/10 px-1.5 py-0.2 rounded border border-sky-500/30">
                  Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300 mt-0.5">
              <span>({strategyA.location.x}, {strategyA.location.y})</span>
              <span>{`₹${strategyA.price}`}</span>
            </div>
          </button>

          {/* Restaurant B Selector */}
          <button
            type="button"
            onClick={() => onSelectRestaurant('B')}
            className={`flex flex-col items-start p-3 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
              !isA
                ? 'bg-rose-950/30 border-rose-500/60 text-slate-100'
                : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="flex items-center gap-1.5 font-semibold text-xs text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Restaurant 2 <span className="text-[10px] text-slate-500 font-normal">(Firm B)</span>
              </span>
              {!isA && (
                <span className="text-[10px] font-medium text-rose-300 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/30">
                  Selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300 mt-0.5">
              <span>({strategyB.location.x}, {strategyB.location.y})</span>
              <span>{`₹${strategyB.price}`}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Discrete Price Selector */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between text-xs">
          <label className="font-medium text-slate-300">
            Price for {selectedRestaurant === 'A' ? 'Restaurant 1' : 'Restaurant 2'}
          </label>
          <span className="font-mono text-slate-200">
            Current: {`₹${activeStrategy.price}`}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {DEFAULT_ALLOWED_PRICES.map((p) => {
            const isSelected = activeStrategy.price === p;
            let buttonStyle = 'bg-slate-950/40 text-slate-300 hover:bg-slate-800/60 border-slate-800';

            if (isSelected) {
              buttonStyle = isA
                ? 'bg-sky-500/20 text-sky-200 font-semibold border-sky-500/60'
                : 'bg-rose-500/20 text-rose-200 font-semibold border-rose-500/60';
            }

            return (
              <button
                key={p}
                type="button"
                onClick={() => onChangePrice(selectedRestaurant, p)}
                className={`py-1.5 px-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-center ${buttonStyle}`}
              >
                {`₹${p}`}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          Allowed discrete prices: [₹150, ₹200, ₹250, ₹300, ₹350]
        </p>
      </div>
    </section>
  );
}
