/**
 * @file Experiments.jsx
 * @description Experiments roadmap placeholder page for LOCUS.
 * Outlines systematic strategic scenario testing and sensitivity analysis.
 */

import { Link } from 'react-router-dom';
import { FlaskConical, ArrowRight, Sliders, PlayCircle, BarChart3, Binary } from 'lucide-react';

export default function Experiments() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-4xl w-full mx-auto gap-8">
      {/* Header */}
      <section className="flex flex-col gap-3 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>Roadmap Module · Phase 5+</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <FlaskConical className="w-7 h-7 text-sky-400" />
          <span>Controlled Strategic Experiments</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Controlled experiments comparing strategic environments. Run batch sensitivity sweeps,
          measure convergence basins, and analyze market tipping points across competing parameter regimes.
        </p>
      </section>

      {/* Planned Experimental Suites */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Planned Experimental Suites
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>Sensitivity Analysis Over Travel Friction</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Varying transportation cost coefficient &alpha; from 0 (pure Bertrand price war) to high friction
              (localized spatial monopoly), tracing equilibrium bifurcations.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              <span>Convergence Basin Mapping</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Evaluating best-response dynamics across all 250,000 initial profiles to compute exact basin of attraction
              sizes for each of the 32 pure-strategy Nash equilibria.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Binary className="w-4 h-4 text-violet-400" />
              <span>Simultaneous vs. Sequential Moves</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Comparing simultaneous best-response updates with sequential leader-follower dynamics
              to quantify first-mover spatial advantage.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Customer Population Density Profiles</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Testing monocentric downtown density distributions vs polycentric suburban nodes to identify
              spatial equilibrium clustering shifts.
            </p>
          </div>
        </div>
      </section>

      {/* Return Action */}
      <section className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-slate-200">
            Current Single-Profile Simulation
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Experiment with unilateral deviations and dynamics directly in the Classic Lab.
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
