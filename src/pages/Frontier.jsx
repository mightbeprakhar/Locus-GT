/**
 * @file Frontier.jsx
 * @description Frontier Laboratory workspace for LOCUS Phase 6A:
 * Urban Geography & Population.
 * Features heterogeneous zoning, urban anchors, deterministic footfall decay,
 * scenario presets, interactive spatial heatmap, and city statistics.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Compass,
  RotateCcw,
  Building2,
  ShoppingBag,
  Home,
  Briefcase,
  Store,
  TrendingUp,
  MapPin,
  Info,
  Layers,
} from 'lucide-react';
import FrontierMap from '../components/FrontierMap.jsx';
import {
  createFrontierCity,
  SCENARIO_IDS,
  FRONTIER_SCENARIOS,
  ZONE_TYPES,
} from '../game/frontier/frontierCity.js';
import { ANCHOR_TYPES } from '../game/frontier/anchors.js';
import { distance } from '../game/utility.js';

export default function Frontier() {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIO_IDS.BALANCED);

  // Generate deterministic Frontier City
  const city = useMemo(() => {
    return createFrontierCity({ scenario: selectedScenario });
  }, [selectedScenario]);

  // Selected zone for inspection
  const [selectedCell, setSelectedCell] = useState(null);

  // Active cell defaults to peak density zone or first cell if not explicitly selected
  const activeInspectedCell = useMemo(() => {
    if (selectedCell) {
      const match = city.cells.find((c) => c.x === selectedCell.x && c.y === selectedCell.y);
      if (match) return match;
    }
    return (
      city.cells.find(
        (c) => c.x === city.stats.peakDensityZone.x && c.y === city.stats.peakDensityZone.y
      ) ?? city.cells[0]
    );
  }, [city, selectedCell]);

  const handleSelectScenario = useCallback((scenarioId) => {
    setSelectedScenario(scenarioId);
    setSelectedCell(null);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedCell(null);
  }, []);

  // Compute anchor distances and impact for inspected cell
  const anchorDistances = useMemo(() => {
    if (!activeInspectedCell) return [];
    return city.anchors.map((anchor) => {
      const dist = distance(activeInspectedCell, anchor.location);
      const decay = 1 / (1 + dist);
      const contribution = Math.round(anchor.strength * decay * 100);
      return {
        anchor,
        distance: Math.round(dist * 100) / 100,
        decay: Math.round(decay * 100) / 100,
        contributionPercent: contribution,
      };
    });
  }, [activeInspectedCell, city.anchors]);

  const activeMeta = FRONTIER_SCENARIOS[selectedScenario] ?? FRONTIER_SCENARIOS[SCENARIO_IDS.BALANCED];

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto gap-6 font-sans">
      {/* ========================================================================= */}
      {/* Workspace Header */}
      {/* ========================================================================= */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Urban Geography &amp; Population · Phase 6A</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Compass className="w-6 h-6 text-sky-400 shrink-0" />
            <span>Frontier: Urban Geography &amp; Population</span>
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Extend spatial competition beyond the controlled model. Frontier introduces heterogeneous urban
            geography, spatial anchor attractors, zoning classifications, and non-uniform effective customer footfall
            decay while preserving game-theory compatibility.
          </p>
        </div>

        {/* Reload / Reset Control */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors cursor-pointer"
            title="Reset active scenario and view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset View</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* Scenario Presets Bar */}
      {/* ========================================================================= */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Urban Scenario Presets
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            {Object.keys(FRONTIER_SCENARIOS).length} Presets Available
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Object.values(FRONTIER_SCENARIOS).map((scenario) => {
            const isSelected = selectedScenario === scenario.id;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleSelectScenario(scenario.id)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-500/80 text-white shadow-xs'
                    : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-semibold">{scenario.name}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      scenario.anchorCount > 0
                        ? 'bg-sky-950/60 border-sky-600/40 text-sky-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                    }`}
                  >
                    {scenario.anchorCount === 0
                      ? 'No Anchors'
                      : `${scenario.anchorCount} ${scenario.anchorCount === 1 ? 'Anchor' : 'Anchors'}`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight line-clamp-2">
                  {scenario.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* Primary Workspace: Map & Analytical Telemetry */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Spatial Grid & Legend (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 sm:p-5 flex flex-col gap-4">
            {/* Map Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/70 gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Urban Topography &amp; Population Heatmap</span>
                </h2>
                <p className="text-xs text-slate-400">
                  10 &times; 10 spatial grid · 100 customer zones · click any cell to inspect
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-mono text-[10px]">Active Scenario:</span>
                <span className="font-semibold text-sky-400 text-xs">{activeMeta.name}</span>
              </div>
            </div>

            {/* Spatial Grid */}
            <FrontierMap
              city={city}
              selectedCell={activeInspectedCell}
              onSelectCell={(cell) => setSelectedCell(cell)}
            />

            {/* Map Legend */}
            <div className="pt-3 border-t border-slate-800/70 flex flex-col gap-2.5 text-xs">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Map Legend &amp; Classifications
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Density Tiers */}
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                  <span className="text-[10px] font-mono text-slate-400">Effective Customer Density</span>
                  <div className="flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 border border-slate-700" />
                      <span className="text-slate-400">Low (&lt;150)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-sky-950 border border-sky-800" />
                      <span className="text-sky-300">Medium (150–249)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-emerald-950 border border-emerald-700" />
                      <span className="text-emerald-300">High (250–379)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-amber-950 border border-amber-600" />
                      <span className="text-amber-300">Very High (&ge;380)</span>
                    </div>
                  </div>
                </div>

                {/* Urban Anchors */}
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                  <span className="text-[10px] font-mono text-slate-400">Urban Anchors</span>
                  <div className="flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="p-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/40">
                        <Building2 className="w-3 h-3" />
                      </span>
                      <span className="text-slate-300">Business District</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="p-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <ShoppingBag className="w-3 h-3" />
                      </span>
                      <span className="text-slate-300">Commercial Mall</span>
                    </div>
                  </div>
                </div>

                {/* Zoning Types */}
                <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                  <span className="text-[10px] font-mono text-slate-400">Zoning Types</span>
                  <div className="flex flex-col gap-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500/70" />
                      <span className="text-slate-300">Residential</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-violet-500/80" />
                      <span className="text-slate-300">Commercial</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500/80" />
                      <span className="text-slate-300">Retail</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics & Statistics Sidebar (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Scenario Overview Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Scenario Profile
              </span>
              <span className="text-xs font-mono text-sky-400 font-semibold">{activeMeta.name}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {activeMeta.description}
            </p>
          </div>

          {/* City Statistics Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Urban Demographics &amp; Footfall</span>
              </h2>
              <span className="text-[10px] font-mono text-slate-500">10 &times; 10 Grid</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-mono">Effective Population</span>
                <span className="text-base font-mono font-bold text-slate-100">
                  {city.stats.totalPopulation.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400">
                  Base Residents: {city.stats.totalBasePopulation.toLocaleString()}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-mono">Populated Zones</span>
                <span className="text-base font-mono font-bold text-slate-100">
                  {city.stats.populatedZonesCount} / 100
                </span>
                <span className="text-[10px] text-slate-400">100% Coverage</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-mono">Peak Density Zone</span>
                <span className="text-base font-mono font-bold text-amber-300">
                  ({city.stats.peakDensityZone.x}, {city.stats.peakDensityZone.y})
                </span>
                <span className="text-[10px] text-slate-400">
                  {city.stats.peakDensityZone.population} footfall ({city.stats.peakDensityZone.zoneType})
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 font-mono">Average Density / Zone</span>
                <span className="text-base font-mono font-bold text-sky-300">
                  {city.stats.averagePopulation}
                </span>
                <span className="text-[10px] text-slate-400">
                  Min: {city.stats.minPopulation} · Max: {city.stats.maxPopulation}
                </span>
              </div>
            </div>
          </div>

          {/* Inspected Zone Card */}
          {activeInspectedCell && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/70">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span>Zone Inspector</span>
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300">
                  ({activeInspectedCell.x}, {activeInspectedCell.y})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Zoning Type</span>
                  <span className="capitalize font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                    {activeInspectedCell.zoneType === ZONE_TYPES.RESIDENTIAL && (
                      <Home className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    {activeInspectedCell.zoneType === ZONE_TYPES.COMMERCIAL && (
                      <Briefcase className="w-3.5 h-3.5 text-violet-400" />
                    )}
                    {activeInspectedCell.zoneType === ZONE_TYPES.RETAIL && (
                      <Store className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{activeInspectedCell.zoneType}</span>
                  </span>
                </div>

                <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex flex-col">
                  <span className="text-[10px] text-slate-500 font-mono">Effective Customer Density</span>
                  <span className="text-base font-mono font-bold text-slate-100">
                    {activeInspectedCell.population}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Base Residents: {activeInspectedCell.basePopulation}
                  </span>
                </div>
              </div>

              {/* Anchor Distance Breakdown */}
              {city.anchors.length > 0 ? (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[10px] font-mono text-slate-400">
                    Anchor Footfall Amplification
                  </span>
                  <div className="flex flex-col gap-1">
                    {anchorDistances.map(({ anchor, distance: d, contributionPercent }) => (
                      <div
                        key={anchor.id}
                        className="flex items-center justify-between p-1.5 rounded bg-slate-950/40 border border-slate-800/60 text-[11px]"
                      >
                        <div className="flex items-center gap-1.5">
                          {anchor.type === ANCHOR_TYPES.MALL ? (
                            <ShoppingBag className="w-3 h-3 text-amber-400 shrink-0" />
                          ) : (
                            <Building2 className="w-3 h-3 text-violet-400 shrink-0" />
                          )}
                          <span className="text-slate-300 font-medium">{anchor.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-slate-400">d = {d}</span>
                          <span className="text-emerald-400">+{contributionPercent}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic p-1.5">
                  No active anchors in this scenario; population reflects base residential distribution.
                </div>
              )}
            </div>
          )}

          {/* Active Anchors Summary */}
          {city.anchors.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5 flex flex-col gap-2.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Active Urban Anchors ({city.anchors.length})
              </span>
              <div className="flex flex-col gap-2">
                {city.anchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/70 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        {anchor.type === ANCHOR_TYPES.MALL ? (
                          <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-violet-400" />
                        )}
                        <span>{anchor.name}</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                        ({anchor.location.x}, {anchor.location.y})
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {anchor.description}
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-500">
                      <span>Type: {anchor.type}</span>
                      <span>Multiplier &lambda; = {anchor.strength}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Theoretical Note Card */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/70 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Info className="w-4 h-4 text-sky-400" />
              <span>Mathematical Architecture &amp; Footfall Interpretation</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              In Frontier, &ldquo;effective population&rdquo; represents effective customer density and commercial
              footfall available to dining establishments, rather than literal residents created by an anchor.
              Applying bounded distance-decay footfall{' '}
              <span className="font-mono text-slate-300">f(d) = 1 / (1 + d)</span> from each urban anchor to
              the base demographic distribution captures the magnetic draw of retail hubs and employment centers
              on restaurant market demand.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
