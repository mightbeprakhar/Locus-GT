/**
 * @file Frontier.jsx
 * @description Frontier Laboratory roadmap placeholder page.
 * Outlines the future extensions beyond the controlled spatial model.
 */

import { Link } from 'react-router-dom';
import { Compass, ArrowRight, Layers, Network, Milestone, ShieldAlert } from 'lucide-react';

export default function Frontier() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-4xl w-full mx-auto gap-8">
      {/* Header */}
      <section className="flex flex-col gap-3 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>Roadmap Module · Phase 5+</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Compass className="w-7 h-7 text-sky-400" />
          <span>Frontier: Real-World Competition Laboratory</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Extend spatial competition beyond the controlled model. Frontier investigates how physical geography,
          infrastructure friction, and firm heterogeneity alter spatial pricing power and equilibrium selection.
        </p>
      </section>

      {/* Planned Capabilities */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Planned Extensions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Network className="w-4 h-4 text-sky-400" />
              <span>Road Networks & Traffic Topologies</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Replacing straight-line Euclidean distance with non-Euclidean pathfinding over primary roads,
              arterials, and congested corridors.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Milestone className="w-4 h-4 text-amber-400" />
              <span>Natural & Physical Barriers</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Rivers, water bodies, elevation contours, and bottleneck bridges that partition customer markets
              and create localized spatial monopolies.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span>Vertical Quality Differentiation</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Differentiated brand tiers, quality ratings, and customer preference parameters that relax pure
              price-and-distance competition.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Layers className="w-4 h-4 text-violet-400" />
              <span>Asymmetric Operational Costs</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Variable zone-dependent land leases, asymmetric kitchen marginal costs, and multi-firm oligopolies (N &gt; 2).
            </p>
          </div>
        </div>
      </section>

      {/* Connection with Classic Lab */}
      <section className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-slate-200">
            Compare with Theoretical Baseline
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            The Classic Lab provides the analytical benchmark with uniform transport cost and discrete pricing.
          </p>
        </div>
        <Link
          to="/classic"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shrink-0"
        >
          <span>Open Classic Lab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}
