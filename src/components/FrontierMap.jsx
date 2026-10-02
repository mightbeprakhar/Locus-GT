/**
 * @file FrontierMap.jsx
 * @description 10x10 spatial grid visualization for LOCUS Frontier.
 * Renders heterogeneous population density, zoning classifications,
 * and urban anchor attractors (malls, business districts).
 */

import { Fragment, useMemo } from 'react';
import { Building2, ShoppingBag } from 'lucide-react';
import { ANCHOR_TYPES } from '../game/frontier/anchors.js';
import { getPopulationTier, POPULATION_TIERS } from '../game/frontier/population.js';
import { ZONE_TYPES } from '../game/frontier/frontierCity.js';

/**
 * Visual styling classes for population density tiers.
 */
const TIER_STYLES = {
  [POPULATION_TIERS.LOW]: {
    bg: 'bg-slate-900/60 hover:bg-slate-800/80',
    border: 'border-slate-800/80',
    text: 'text-slate-400',
    badge: 'bg-slate-800 text-slate-400 border-slate-700',
  },
  [POPULATION_TIERS.MEDIUM]: {
    bg: 'bg-sky-950/35 hover:bg-sky-900/50',
    border: 'border-sky-800/50',
    text: 'text-sky-300 font-medium',
    badge: 'bg-sky-950/70 text-sky-300 border-sky-700/60',
  },
  [POPULATION_TIERS.HIGH]: {
    bg: 'bg-emerald-950/45 hover:bg-emerald-900/60',
    border: 'border-emerald-700/60',
    text: 'text-emerald-300 font-semibold',
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/70',
  },
  [POPULATION_TIERS.VERY_HIGH]: {
    bg: 'bg-amber-950/50 hover:bg-amber-900/70',
    border: 'border-amber-600/70 shadow-xs shadow-amber-950/50',
    text: 'text-amber-200 font-bold',
    badge: 'bg-amber-950/80 text-amber-200 border-amber-500/80',
  },
};

/**
 * Tiny zone indicator styling.
 */
const ZONE_INDICATORS = {
  [ZONE_TYPES.RESIDENTIAL]: {
    color: 'bg-sky-500/50',
    label: 'Res',
  },
  [ZONE_TYPES.COMMERCIAL]: {
    color: 'bg-violet-500/70',
    label: 'Com',
  },
  [ZONE_TYPES.RETAIL]: {
    color: 'bg-amber-500/70',
    label: 'Ret',
  },
};

/**
 * @param {Object} props
 * @param {Object} props.city - Frontier city object
 * @param {{x: number, y: number}|null} props.selectedCell - Currently inspected cell
 * @param {(cell: Object) => void} props.onSelectCell - Cell selection callback
 */
export default function FrontierMap({ city, selectedCell, onSelectCell }) {
  const { cellMap, anchorMap } = useMemo(() => {
    const cMap = new Map();
    city.cells.forEach((cell) => {
      cMap.set(`${cell.x},${cell.y}`, cell);
    });

    const aMap = new Map();
    city.anchors.forEach((anchor) => {
      aMap.set(`${anchor.location.x},${anchor.location.y}`, anchor);
    });

    return { cellMap: cMap, anchorMap: aMap };
  }, [city]);


  return (
    <div className="flex flex-col items-center justify-center p-2 overflow-x-auto max-w-full">
      <div
        className="inline-grid grid-cols-[1rem_repeat(10,2.5rem)] sm:grid-cols-[1.25rem_repeat(10,2.75rem)] md:grid-cols-[1.25rem_repeat(10,3rem)] gap-1 p-2 sm:p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/90 shadow-sm select-none"
        role="grid"
        aria-label="Frontier urban spatial grid"
      >
        {/* Top-Left Corner Spacer (Row 0, Col 0) */}
        <div className="w-full h-5" aria-hidden="true" />

        {/* Top X Coordinate Headers (Row 0, Cols 1..10) */}
        {Array.from({ length: 10 }, (_, x) => (
          <div
            key={`frontier-header-x-${x}`}
            className="h-5 flex items-center justify-center font-mono text-[10px] text-slate-500 font-medium"
            aria-hidden="true"
          >
            {x}
          </div>
        ))}

        {/* Grid Rows */}
        {Array.from({ length: 10 }, (_, y) => (
          <Fragment key={`frontier-row-${y}`}>
            {/* Left Y Coordinate Header (Col 0) */}
            <div
              className="h-10 sm:h-11 md:h-12 flex items-center justify-center font-mono text-[10px] text-slate-500 font-medium"
              aria-hidden="true"
            >
              {y}
            </div>

            {/* 10 Cells for Row y (Cols 1..10) */}
            {Array.from({ length: 10 }, (_, x) => {
              const cell = cellMap.get(`${x},${y}`) ?? {
                x,
                y,
                basePopulation: 100,
                population: 100,
                zoneType: ZONE_TYPES.RESIDENTIAL,
              };

              const anchor = anchorMap.get(`${x},${y}`);
              const isSelected = selectedCell?.x === x && selectedCell?.y === y;
              const tier = getPopulationTier(cell.population);
              const tierStyle = TIER_STYLES[tier] ?? TIER_STYLES[POPULATION_TIERS.LOW];
              const zoneStyle = ZONE_INDICATORS[cell.zoneType] ?? ZONE_INDICATORS[ZONE_TYPES.RESIDENTIAL];

              return (
                <button
                  key={`frontier-cell-${x}-${y}`}
                  type="button"
                  onClick={() => onSelectCell(cell)}
                  className={`relative flex flex-col items-center justify-between p-1 rounded-sm sm:rounded border transition-all cursor-pointer h-10 sm:h-11 md:h-12 ${
                    tierStyle.bg
                  } ${tierStyle.border} ${
                    isSelected ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-950 z-10' : ''
                  }`}
                  aria-label={`Zone (${x}, ${y}): ${cell.zoneType}, Population ${cell.population}${
                    anchor ? `, Anchor: ${anchor.name}` : ''
                  }`}
                >
                  {/* Top Row: Zone Indicator & Coordinates */}
                  <div className="w-full flex items-center justify-between px-0.5 pointer-events-none">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${zoneStyle.color}`}
                      title={`Zone Type: ${cell.zoneType}`}
                    />
                    <span className="text-[8px] font-mono text-slate-500 leading-none">
                      {x},{y}
                    </span>
                  </div>

                  {/* Center: Anchor Marker OR Population Figure */}
                  {anchor ? (
                    <div className="flex flex-col items-center pointer-events-none my-auto">
                      {anchor.type === ANCHOR_TYPES.MALL ? (
                        <div
                          className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300"
                          title={`Mall: ${anchor.name}`}
                        >
                          <ShoppingBag className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[8px] font-bold font-mono uppercase">Mall</span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-violet-500/20 border border-violet-500/50 text-violet-300"
                          title={`Business District: ${anchor.name}`}
                        >
                          <Building2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[8px] font-bold font-mono uppercase">CBD</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Bottom: Population Figure */}
                  <div className="w-full flex items-center justify-center pointer-events-none mt-auto">
                    <span className={`text-[10px] sm:text-[11px] font-mono leading-tight ${tierStyle.text}`}>
                      {cell.population}
                    </span>
                  </div>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
