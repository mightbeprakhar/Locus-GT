/**
 * @file CityMap.jsx
 * @description Interactive 10x10 2D city grid displaying customer zones, population density,
 * consumer market capture, and draggable/clickable restaurant positions.
 */

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { MapPin, Users, Store, Crosshair } from 'lucide-react';
import { distance } from '../game/utility.js';

/**
 * @param {Object} props
 * @param {{width: number, height: number, cells: Array<{x: number, y: number, population: number}>, totalPopulation: number}} props.city
 * @param {{location: {x: number, y: number}, price: number}} props.strategyA
 * @param {{location: {x: number, y: number}, price: number}} props.strategyB
 * @param {'A'|'B'} props.selectedRestaurant
 * @param {(location: {x: number, y: number}) => void} props.onSelectLocation
 * @param {Object} props.evaluation
 */
export default function CityMap({
  city,
  strategyA,
  strategyB,
  selectedRestaurant,
  onSelectLocation,
  evaluation,
}) {
  const [hoveredCell, setHoveredCell] = useState(null);

  // Determine min and max population for relative density coloring
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

  // Active restaurant info for display
  const activeName = selectedRestaurant === 'A' ? 'Restaurant A' : 'Restaurant B';
  const activeColor = selectedRestaurant === 'A' ? 'text-cyan-400' : 'text-rose-400';

  return (
    <div className="flex flex-col h-full bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 shadow-2xl backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-700/60 text-cyan-400">
            <Store className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
              City Customer Grid (10 × 10)
            </h2>
            <p className="text-xs text-slate-400">
              {city.cells.length} Customer Zones • {city.totalPopulation.toLocaleString()} Total Population
            </p>
          </div>
        </div>

        {/* Selected target hint */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/70 text-xs">
          <span className="text-slate-400">Moving Target:</span>
          <span className={`font-semibold flex items-center gap-1.5 ${activeColor}`}>
            <span
              className={`w-2 h-2 rounded-full ${
                selectedRestaurant === 'A' ? 'bg-cyan-400' : 'bg-rose-400'
              } animate-pulse`}
            />
            {activeName}
          </span>
        </div>
      </div>

      {/* Grid container with coordinate headers */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[460px] p-2">
        <div className="relative inline-block">
          {/* Top X coordinate numbers */}
          <div className="flex ml-7 mb-1.5 text-[10px] font-mono font-medium text-slate-400 select-none">
            {Array.from({ length: 10 }, (_, x) => (
              <div key={x} className="w-10 sm:w-11 md:w-12 text-center">
                {x}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Left Y coordinate numbers */}
            <div className="flex flex-col mr-1.5 text-[10px] font-mono font-medium text-slate-400 select-none justify-around">
              {Array.from({ length: 10 }, (_, y) => (
                <div key={y} className="h-10 sm:h-11 md:h-12 flex items-center justify-center w-5">
                  {y}
                </div>
              ))}
            </div>

            {/* 10 x 10 Cell Matrix */}
            <div
              className="grid grid-cols-10 gap-1 sm:gap-1.5 p-2 rounded-xl bg-slate-900/90 border border-slate-800 shadow-inner"
              role="grid"
              aria-label="City customer zones"
            >
              {Array.from({ length: 10 }, (_, y) =>
                Array.from({ length: 10 }, (_, x) => {
                  const cell = cellMap.get(`${x},${y}`) ?? { x, y, population: 100 };
                  const alloc = allocationMap.get(`${x},${y}`);

                  const isA = locA.x === x && locA.y === y;
                  const isB = locB.x === x && locB.y === y;
                  const isBoth = isA && isB;

                  // Normalized density ratio (0 to 1)
                  const popRatio =
                    maxPop > minPop ? (cell.population - minPop) / (maxPop - minPop) : 0.5;

                  // Market dominance styling
                  let marketBorder = 'border-slate-800/80';
                  let marketDot = null;
                  if (alloc) {
                    if (alloc.choice === 'A') {
                      marketDot = 'bg-cyan-400/80';
                      marketBorder = 'hover:border-cyan-400/70';
                    } else if (alloc.choice === 'B') {
                      marketDot = 'bg-rose-400/80';
                      marketBorder = 'hover:border-rose-400/70';
                    } else {
                      marketDot = 'bg-amber-400/80';
                      marketBorder = 'hover:border-amber-400/70';
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
                        isA ? ', Restaurant A here' : ''
                      }${isB ? ', Restaurant B here' : ''}`}
                      className={`relative w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-lg border transition-all duration-150 flex flex-col items-center justify-between p-1 select-none focus:outline-none focus:ring-2 focus:ring-cyan-400/60 cursor-pointer ${marketBorder} ${
                        isCellHovered
                          ? 'ring-2 ring-slate-300/40 scale-105 z-20'
                          : 'hover:scale-[1.02]'
                      }`}
                      style={{
                        backgroundColor: `rgba(30, 41, 59, ${0.35 + popRatio * 0.45})`,
                      }}
                    >
                      {/* Top micro info: zone coordinate or market dot */}
                      <div className="w-full flex items-center justify-between px-0.5">
                        <span className="text-[9px] font-mono text-slate-400/70 leading-none">
                          {`${x},${y}`}
                        </span>
                        {marketDot && !isBoth && !isA && !isB && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${marketDot} shadow-sm`}
                            title={`Captured by: ${alloc?.choice}`}
                          />
                        )}
                      </div>

                      {/* Center Restaurant Marker(s) */}
                      <div className="flex-1 flex items-center justify-center w-full">
                        {isBoth ? (
                          <div className="flex items-center -space-x-1">
                            <motion.div
                              layoutId="marker-both-A"
                              className={`w-5 h-5 rounded-md bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-lg shadow-cyan-500/40 border border-cyan-200 ${
                                selectedRestaurant === 'A' ? 'ring-2 ring-cyan-300' : ''
                              }`}
                            >
                              A
                            </motion.div>
                            <motion.div
                              layoutId="marker-both-B"
                              className={`w-5 h-5 rounded-md bg-rose-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-lg shadow-rose-500/40 border border-rose-200 ${
                                selectedRestaurant === 'B' ? 'ring-2 ring-rose-300' : ''
                              }`}
                            >
                              B
                            </motion.div>
                          </div>
                        ) : isA ? (
                          <motion.div
                            layoutId="marker-A"
                            className={`relative w-7 h-7 rounded-md bg-cyan-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-cyan-500/50 border border-cyan-200 ${
                              selectedRestaurant === 'A'
                                ? 'ring-2 ring-cyan-300 ring-offset-1 ring-offset-slate-950 scale-110'
                                : ''
                            }`}
                          >
                            A
                            {selectedRestaurant === 'A' && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-300 rounded-full animate-ping" />
                            )}
                          </motion.div>
                        ) : isB ? (
                          <motion.div
                            layoutId="marker-B"
                            className={`relative w-7 h-7 rounded-md bg-rose-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md shadow-rose-500/50 border border-rose-200 ${
                              selectedRestaurant === 'B'
                                ? 'ring-2 ring-rose-300 ring-offset-1 ring-offset-slate-950 scale-110'
                                : ''
                            }`}
                          >
                            B
                            {selectedRestaurant === 'B' && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-300 rounded-full animate-ping" />
                            )}
                          </motion.div>
                        ) : (
                          // Subtle population text when no restaurant is present
                          <span className="text-[10px] font-mono text-slate-400/80 font-medium">
                            {cell.population}
                          </span>
                        )}
                      </div>

                      {/* Bottom density micro-bar */}
                      <div className="w-full h-1 bg-slate-950/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-500/40 rounded-full"
                          style={{ width: `${Math.round(popRatio * 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map Footer: Telemetry & Inspector Bar */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        {hoveredCell ? (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-mono text-slate-200">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              Zone ({hoveredCell.x}, {hoveredCell.y})
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Pop: <strong className="text-white">{hoveredCell.population}</strong>
            </span>
            {allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`) && (
              <span className="flex items-center gap-1.5">
                Market:{' '}
                {allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`).choice === 'A' ? (
                  <strong className="text-cyan-400">Restaurant A (100%)</strong>
                ) : allocationMap.get(`${hoveredCell.x},${hoveredCell.y}`).choice === 'B' ? (
                  <strong className="text-rose-400">Restaurant B (100%)</strong>
                ) : (
                  <strong className="text-amber-400">Split (50% / 50%)</strong>
                )}
              </span>
            )}
            <span className="text-slate-400 text-[11px]">
              Dist: A={distance(hoveredCell, locA).toFixed(1)}, B={distance(hoveredCell, locB).toFixed(1)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Click any cell to relocate <strong className={activeColor}>{activeName}</strong>.
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-cyan-500 shadow-sm" />
            <span>Rest. A</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500 shadow-sm" />
            <span>Rest. B</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400/80 inline-block" />
            <span>A Dem.</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-rose-400/80 inline-block" />
            <span>B Dem.</span>
          </span>
        </div>
      </div>
    </div>
  );
}
