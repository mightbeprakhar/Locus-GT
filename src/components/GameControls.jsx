/**
 * @file GameControls.jsx
 * @description Controls for selecting active player, adjusting discrete prices, and resetting simulation state.
 */

import { Sliders, RotateCcw, DollarSign, MapPin } from 'lucide-react';
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
    <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col gap-4">
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-700/60 text-cyan-400">
            <Sliders className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Strategic Decision Controls
          </h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          title="Reset both restaurants to initial baseline configuration"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Target Restaurant Selection Cards */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
          Active Controlled Restaurant
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Restaurant A Selector */}
          <button
            type="button"
            onClick={() => onSelectRestaurant('A')}
            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus:ring-2 ${
              isA
                ? 'bg-cyan-950/40 border-cyan-500 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-950/30'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                <span className="w-4 h-4 rounded bg-cyan-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  A
                </span>
                Restaurant A
              </span>
              {isA && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 mt-1">
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3 h-3 text-cyan-400" />
                ({strategyA.location.x}, {strategyA.location.y})
              </span>
              <span className="flex items-center gap-0.5 font-semibold text-cyan-200">
                <DollarSign className="w-3 h-3 text-cyan-400" />
                {strategyA.price}
              </span>
            </div>
          </button>

          {/* Restaurant B Selector */}
          <button
            type="button"
            onClick={() => onSelectRestaurant('B')}
            className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus:ring-2 ${
              !isA
                ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/50 shadow-lg shadow-rose-950/30'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between w-full mb-1">
              <span className="flex items-center gap-1.5 font-bold text-xs text-rose-300">
                <span className="w-4 h-4 rounded bg-rose-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                  B
                </span>
                Restaurant B
              </span>
              {!isA && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 mt-1">
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3 h-3 text-rose-400" />
                ({strategyB.location.x}, {strategyB.location.y})
              </span>
              <span className="flex items-center gap-0.5 font-semibold text-rose-200">
                <DollarSign className="w-3 h-3 text-rose-400" />
                {strategyB.price}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Discrete Price Control for Active Restaurant */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
            Set Unit Price for {selectedRestaurant === 'A' ? 'Restaurant A' : 'Restaurant B'}
          </label>
          <span className="text-xs font-mono font-bold text-white">
            Current: ${activeStrategy.price}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {DEFAULT_ALLOWED_PRICES.map((p) => {
            const isSelected = activeStrategy.price === p;
            let activeStyle = '';
            if (isSelected) {
              activeStyle = isA
                ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-md shadow-cyan-500/30'
                : 'bg-rose-500 text-slate-950 font-bold border-rose-400 shadow-md shadow-rose-500/30';
            } else {
              activeStyle =
                'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800';
            }

            return (
              <button
                key={p}
                type="button"
                onClick={() => onChangePrice(selectedRestaurant, p)}
                className={`py-2 px-1 text-xs font-mono rounded-lg border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 text-center ${activeStyle}`}
              >
                {`$${p}`}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Permitted discrete strategy set: [{DEFAULT_ALLOWED_PRICES.join(', ')}]
        </p>
      </div>
    </div>
  );
}
