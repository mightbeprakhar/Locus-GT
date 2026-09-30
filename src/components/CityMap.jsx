/**
 * @file CityMap.jsx
 * @description Spatial simulation view displaying customer zones, population density,
 * market capture, restaurant locations, best-response targets, and selected equilibrium previews.
 */

import { useState, useMemo, Fragment } from 'react';
import { motion } from 'motion/react';
import { distance } from '../game/utility.js';

/**
 * @param {Object} props
 * @param {{width: number, height: number, cells: Array<{x: number, y: number, population: number}>, totalPopulation: number}} props.city
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 * @param {'A'|'B'} props.selectedRestaurant
 * @param {(location: {x: number, y: number}) => void} props.onSelectLocation
 * @param {Object} props.evaluation
 * @param {Object|null} [props.selectedEquilibrium] - Optional equilibrium to preview on the map (Phase 4A)
 * @param {Object|null} [props.selectedBestResponse] - Optional best-response target to preview on the map (Phase 4B)
 */
export default function CityMap({
  city,
  strategyA,
  strategyB,
  selectedRestaurant,
  onSelectLocation,
  evaluation,
  selectedEquilibrium = null,
  selectedBestResponse = null,
}) {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Compute population bounds, cell lookup, and market allocations
  const { minPop, maxPop, cellMap, allocationMap } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    const map = new Map();

    city.cells.forEach((c) => {
      if (c.population < min) min = c.population;
      if (c.population > max) max = c.population;
      map.set(`${c.x},${c.y}`, c);
    });

    const allocMap = new Map();
    if (evaluation?.allocations) {
      evaluation.allocations.forEach((a) => {
        allocMap.set(`${a.x},${a.y}`, a);
      });
    }

    return {
      minPop: min === Infinity ? 100 : min,
      maxPop: max === -Infinity ? 200 : max,
      cellMap: map,
      allocationMap: allocMap,
    };
  }, [city, evaluation]);

  const locA = strategyA.location;
  const locB = strategyB.location;

  // Phase 4A Equilibrium Targets
  const eqLocA = selectedEquilibrium?.strategyA?.location;
  const eqLocB = selectedEquilibrium?.strategyB?.location;

  // Phase 4B Best Response Target
  const brPlayer = selectedBestResponse?.player;
  const brLoc = selectedBestResponse?.strategy?.location;

  const activeName = selectedRestaurant === 'A' ? 'Restaurant 1' : 'Restaurant 2';
  const activeColor = selectedRestaurant === 'A' ? 'text-sky-400' : 'text-rose-400';

  return (
    <section className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
      {/* Map Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/70">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">City</h2>
          <p className="text-xs text-slate-400">
            10 × 10 grid · {city.cells.length} customer zones · {city.totalPopulation.toLocaleString()} population
          </p>
        </div>

        {/* Selected target indicator */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Selected:</span>
          <span className={`font-medium flex items-center gap-1.5 ${activeColor}`}>
            <span
              className={`w-2 h-2 rounded-full ${
                selectedRestaurant === 'A' ? 'bg-sky-400' : 'bg-rose-400'
              }`}
            />
            {activeName}
          </span>
        </div>
      </div>

      {/* Grid container with shared CSS grid coordinate layout */}
      <div className="flex flex-col items-center justify-center p-2 overflow-x-auto max-w-full">
        <div
          className="inline-grid grid-cols-[1rem_repeat(10,2.5rem)] sm:grid-cols-[1.25rem_repeat(10,2.75rem)] md:grid-cols-[1.25rem_repeat(10,3rem)] gap-1 p-2 sm:p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/90 shadow-sm select-none"
          role="grid"
          aria-label="City customer zones"
        >
          {/* Top-Left Corner Spacer (Row 0, Col 0) */}
          <div className="w-full h-5" aria-hidden="true" />

          {/* Top X Coordinate Headers (Row 0, Cols 1..10) */}
          {Array.from({ length: 10 }, (_, x) => (
            <div
              key={`header-x-${x}`}
              className="h-5 flex items-center justify-center font-mono text-[10px] text-slate-500 font-medium"
              aria-hidden="true"
            >
              {x}
            </div>
          ))}

          {/* Grid Rows: Y header in Col 0, followed by 10 cells in Cols 1..10 */}
          {Array.from({ length: 10 }, (_, y) => (
            <Fragment key={`row-${y}`}>
              {/* Left Y Coordinate Header (Col 0) */}
              <div
                className="h-10 sm:h-11 md:h-12 flex items-center justify-center font-mono text-[10px] text-slate-500 font-medium"
                aria-hidden="true"
              >
                {y}
              </div>

              {/* 10 Cells for Row y (Cols 1..10) */}
              {Array.from({ length: 10 }, (_, x) => {
                const cell = cellMap.get(`${x},${y}`) ?? { x, y, population: 100 };
                const alloc = allocationMap.get(`${x},${y}`);

                const isA = locA.x === x && locA.y === y;
                const isB = locB.x === x && locB.y === y;
                const isBoth = isA && isB;

                // Phase 4A Equilibrium Previews
                const isEqA = eqLocA && eqLocA.x === x && eqLocA.y === y;
                const isEqB = eqLocB && eqLocB.x === x && eqLocB.y === y;
                const isEqBoth = isEqA && isEqB;

                // Phase 4B Best Response Target Previews
                const isBrTarget = brLoc && brLoc.x === x && brLoc.y === y;
                const isBrA = isBrTarget && brPlayer === 'A';
                const isBrB = isBrTarget && brPlayer === 'B';

                // Normalized density ratio (0 to 1)
                const popRatio =
                  maxPop > minPop ? (cell.population - minPop) / (maxPop - minPop) : 0.5;

                // Market capture dot styling
                let marketDot = null;
                if (alloc && !isA && !isB && !isBoth && !isEqA && !isEqB && !isBrA && !isBrB) {
                  if (alloc.choice === 'A') {
                    marketDot = 'bg-sky-400/60';
                  } else if (alloc.choice === 'B') {
                    marketDot = 'bg-rose-400/60';
                  } else {
                    marketDot = 'bg-amber-400/60';
                  }
                }

                const isCellHovered = hoveredCell?.x === x && hoveredCell?.y === y;

                return (
                  <button
                    key={`${x},${y}`}
                    type="button"
                    onClick={() => onSelectLocation({ x, y })}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    onFocus={() => setHoveredCell(cell)}
                    onBlur={() => setHoveredCell(null)}
                    aria-label={`Zone (${x}, ${y}), population ${cell.population}${
                      isA ? ', Restaurant 1 (Firm A)' : ''
                    }${isB ? ', Restaurant 2 (Firm B)' : ''}${
                      isBrA ? ', Restaurant 1 Best Response Target' : ''
                    }${isBrB ? ', Restaurant 2 Best Response Target' : ''}${
                      isEqA ? ', Equilibrium A target' : ''
                    }${isEqB ? ', Equilibrium B target' : ''}`}
                    className={`relative w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded border transition-colors flex items-center justify-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
                      isCellHovered
                        ? 'border-slate-500 z-10'
                        : isEqA || isEqB || isBrA || isBrB
                        ? 'border-slate-700'
                        : 'border-slate-800/60 hover:border-slate-700'
                    }`}
                    style={{
                      backgroundColor: `rgba(30, 41, 59, ${0.15 + popRatio * 0.45})`,
                    }}
                  >
                    {/* Active Restaurant Markers, Best-Response Previews & Equilibrium Previews */}
                    {isBoth ? (
                      <div className="flex items-center gap-0.5">
                        <motion.div
                          layoutId="marker-both-A"
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded bg-sky-600 text-white font-bold text-[10px] flex items-center justify-center ${
                            selectedRestaurant === 'A' ? 'ring-1 ring-sky-300' : ''
                          } ${isBrA ? 'ring-2 ring-emerald-400' : ''} ${isEqA ? 'ring-2 ring-emerald-400/90' : ''}`}
                          title={`Restaurant 1${isBrA ? ' (at best-response target)' : ''}${isEqA ? ' (at equilibrium location)' : ''}`}
                        >
                          1
                        </motion.div>
                        <motion.div
                          layoutId="marker-both-B"
                          className={`w-4 h-4 sm:w-5 sm:h-5 rounded bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center ${
                            selectedRestaurant === 'B' ? 'ring-1 ring-rose-300' : ''
                          } ${isBrB ? 'ring-2 ring-emerald-400' : ''} ${isEqB ? 'ring-2 ring-emerald-400/90' : ''}`}
                          title={`Restaurant 2${isBrB ? ' (at best-response target)' : ''}${isEqB ? ' (at equilibrium location)' : ''}`}
                        >
                          2
                        </motion.div>
                      </div>
                    ) : isA ? (
                      <div className="flex items-center gap-0.5">
                        <motion.div
                          layoutId="marker-A"
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded bg-sky-600 text-white font-bold text-xs flex items-center justify-center ${
                            selectedRestaurant === 'A' ? 'ring-2 ring-sky-300' : ''
                          } ${isBrA ? 'ring-2 ring-emerald-400' : ''} ${isEqA ? 'ring-2 ring-emerald-400/90' : ''}`}
                          title={`Restaurant 1${isBrA ? ' (at best-response target)' : ''}${isEqA ? ' (at equilibrium location)' : ''}`}
                        >
                          1
                        </motion.div>
                        {isBrB && (
                          <div
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-rose-400 bg-rose-950/60 text-rose-300 font-bold text-[9px] flex items-center justify-center"
                            title={`Restaurant 2 Best Response Target (${x}, ${y})`}
                          >
                            BR 2
                          </div>
                        )}
                        {isEqB && !isBrB && (
                          <div
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-rose-400 bg-rose-950/60 text-rose-300 font-bold text-[10px] flex items-center justify-center"
                            title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant B target`}
                          >
                            B*
                          </div>
                        )}
                      </div>
                    ) : isB ? (
                      <div className="flex items-center gap-0.5">
                        <motion.div
                          layoutId="marker-B"
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded bg-rose-600 text-white font-bold text-xs flex items-center justify-center ${
                            selectedRestaurant === 'B' ? 'ring-2 ring-rose-300' : ''
                          } ${isBrB ? 'ring-2 ring-emerald-400' : ''} ${isEqB ? 'ring-2 ring-emerald-400/90' : ''}`}
                          title={`Restaurant 2${isBrB ? ' (at best-response target)' : ''}${isEqB ? ' (at equilibrium location)' : ''}`}
                        >
                          2
                        </motion.div>
                        {isBrA && (
                          <div
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-sky-400 bg-sky-950/60 text-sky-300 font-bold text-[9px] flex items-center justify-center"
                            title={`Restaurant 1 Best Response Target (${x}, ${y})`}
                          >
                            BR 1
                          </div>
                        )}
                        {isEqA && !isBrA && (
                          <div
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-sky-400 bg-sky-950/60 text-sky-300 font-bold text-[10px] flex items-center justify-center"
                            title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant A target`}
                          >
                            A*
                          </div>
                        )}
                      </div>
                    ) : isBrA ? (
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded border-2 border-dashed border-sky-400 bg-sky-950/60 text-sky-300 font-bold text-[10px] sm:text-xs flex items-center justify-center shadow-sm select-none"
                        title={`Restaurant 1 Best Response target at (${x}, ${y}) @ ₹${selectedBestResponse?.strategy?.price}`}
                      >
                        BR 1
                      </div>
                    ) : isBrB ? (
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded border-2 border-dashed border-rose-400 bg-rose-950/60 text-rose-300 font-bold text-[10px] sm:text-xs flex items-center justify-center shadow-sm select-none"
                        title={`Restaurant 2 Best Response target at (${x}, ${y}) @ ₹${selectedBestResponse?.strategy?.price}`}
                      >
                        BR 2
                      </div>
                    ) : isEqBoth ? (
                      <div className="flex items-center gap-0.5">
                        <div
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-sky-400 bg-sky-950/60 text-sky-300 font-bold text-[10px] flex items-center justify-center"
                          title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant A target`}
                        >
                          A*
                        </div>
                        <div
                          className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-dashed border-rose-400 bg-rose-950/60 text-rose-300 font-bold text-[10px] flex items-center justify-center"
                          title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant B target`}
                        >
                          B*
                        </div>
                      </div>
                    ) : isEqA ? (
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded border-2 border-dashed border-sky-400 bg-sky-950/60 text-sky-300 font-bold text-xs flex items-center justify-center shadow-sm select-none"
                        title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant A target (${x}, ${y})`}
                      >
                        A*
                      </div>
                    ) : isEqB ? (
                      <div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded border-2 border-dashed border-rose-400 bg-rose-950/60 text-rose-300 font-bold text-xs flex items-center justify-center shadow-sm select-none"
                        title={`Equilibrium #${selectedEquilibrium?.id}: Restaurant B target (${x}, ${y})`}
                      >
                        B*
                      </div>
                    ) : (
                      marketDot && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${marketDot}`}
                          aria-hidden="true"
                        />
                      )
                    )}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Map Footer: Inspector & Legend */}
      <div className="pt-3 border-t border-slate-800/70 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        {hoveredCell ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-slate-200">
              Zone ({hoveredCell.x}, {hoveredCell.y})
            </span>
            <span className="text-slate-300">
              {hoveredCell.population} customers
            </span>
            {allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`) && (
              <span>
                {allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`).choice === 'A' ? (
                  <span className="text-sky-400 font-medium">Restaurant 1 (100%)</span>
                ) : allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`).choice === 'B' ? (
                  <span className="text-rose-400 font-medium">Restaurant 2 (100%)</span>
                ) : (
                  <span className="text-amber-400 font-medium">Split (50% / 50%)</span>
                )}
              </span>
            )}
            <span className="text-slate-500 font-mono text-[11px]">
              d(R1)={distance(hoveredCell, locA).toFixed(1)}, d(R2)={distance(hoveredCell, locB).toFixed(1)}
            </span>
            {brLoc && hoveredCell.x === brLoc.x && hoveredCell.y === brLoc.y && (
              <span className={`font-medium text-[11px] ${brPlayer === 'A' ? 'text-sky-300' : 'text-rose-300'}`}>
                {`[R${brPlayer === 'A' ? '1' : '2'} Best Response Target: (${brLoc.x}, ${brLoc.y}) @ ₹${selectedBestResponse?.strategy?.price}]`}
              </span>
            )}
            {eqLocA && hoveredCell.x === eqLocA.x && hoveredCell.y === eqLocA.y && (
              <span className="text-sky-300 font-medium text-[11px]">
                [Eq #{selectedEquilibrium?.id} A* target]
              </span>
            )}
            {eqLocB && hoveredCell.x === eqLocB.x && hoveredCell.y === eqLocB.y && (
              <span className="text-rose-300 font-medium text-[11px]">
                [Eq #{selectedEquilibrium?.id} B* target]
              </span>
            )}
          </div>
        ) : selectedBestResponse && brLoc ? (
          <div className="text-slate-300 flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">{`Inspecting Restaurant ${brPlayer === 'A' ? '1' : '2'} Best Response:`}</span>
            <span className={`font-mono ${brPlayer === 'A' ? 'text-sky-300' : 'text-rose-300'}`}>
              {`Target (${brLoc.x}, ${brLoc.y}) @ ₹${selectedBestResponse.strategy?.price}`}
            </span>
            <span className="text-slate-500 text-[11px]">(Outlined ghost pin on map)</span>
          </div>
        ) : selectedEquilibrium ? (
          <div className="text-slate-300 flex items-center gap-2 flex-wrap">
            <span className="text-slate-400">{`Inspecting Eq #${selectedEquilibrium.id}:`}</span>
            <span className="font-mono text-sky-300">{`A*(${eqLocA?.x}, ${eqLocA?.y})`}</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-rose-300">{`B*(${eqLocB?.x}, ${eqLocB?.y})`}</span>
            <span className="text-slate-500 text-[11px]">(Click any cell to relocate {activeName})</span>
          </div>
        ) : (
          <div className="text-slate-400">
            Click any cell to relocate <span className={activeColor}>{activeName}</span>.
          </div>
        )}

        {/* Quiet Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400 select-none flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-600 flex items-center justify-center text-[8px] text-white font-bold">1</span>
            <span>Restaurant 1</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-600 flex items-center justify-center text-[8px] text-white font-bold">2</span>
            <span>Restaurant 2</span>
          </span>
          {selectedBestResponse && (
            <span className={`flex items-center gap-1 ${brPlayer === 'A' ? 'text-sky-300' : 'text-rose-300'}`}>
              <span className={`w-3.5 h-2.5 rounded border border-dashed flex items-center justify-center text-[7px] font-bold ${
                brPlayer === 'A'
                  ? 'border-sky-400 bg-sky-950/50 text-sky-300'
                  : 'border-rose-400 bg-rose-950/50 text-rose-300'
              }`}>
                BR
              </span>
              <span>{`BR Target (R${brPlayer === 'A' ? '1' : '2'})`}</span>
            </span>
          )}
          {selectedEquilibrium && (
            <>
              <span className="flex items-center gap-1 text-sky-300">
                <span className="w-2.5 h-2.5 rounded border border-dashed border-sky-400 bg-sky-950/50" />
                <span>A* Eq.</span>
              </span>
              <span className="flex items-center gap-1 text-rose-300">
                <span className="w-2.5 h-2.5 rounded border border-dashed border-rose-400 bg-rose-950/50" />
                <span>B* Eq.</span>
              </span>
            </>
          )}
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/60" />
            <span>R1 market</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400/60" />
            <span>R2 market</span>
          </span>
        </div>
      </div>
    </section>
  );
}
