/**
 * @file Dashboard.jsx
 * @description Dashboard landing page for LOCUS: Spatial Game Theory Laboratory.
 * Explains the laboratory framework, highlights the active and roadmap modules,
 * and provides direct entry points to Classic Lab, Frontier, and Experiments.
 */

import { Link } from 'react-router-dom';
import {
  Layers,
  Compass,
  FlaskConical,
  ArrowRight,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-6xl w-full mx-auto gap-8">
      {/* Overview Header */}
      <section className="flex flex-col gap-3 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>Spatial Game Theory Laboratory</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Theoretical & Spatial Competition Platform
        </h1>
        <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
          LOCUS models spatial competition, discrete price equilibrium, and unilateral dynamic adjustments
          in geographically constrained customer markets. Grounded in the discrete Hotelling location framework,
          the laboratory connects theoretical microfoundations with computational game theory.
        </p>
      </section>

      {/* Module Overview Cards */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Laboratory Modules
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Classic Lab Card */}
          <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-sky-950/60 border border-sky-500/40 text-sky-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-medium">
                  Active Module
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Classic Lab
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The core discrete Hotelling spatial duopoly on a 10×10 grid. Features real-time consumer choice,
                payoff evaluation, unilateral best-response analysis, sequential best-response dynamics, and exhaustive pure-strategy Nash equilibrium solver.
              </p>
            </div>

            <Link
              to="/classic"
              className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors"
            >
              <span>Enter Classic Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Frontier Card */}
          <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/60 text-slate-400 font-medium">
                  Roadmap
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-200">
                Frontier
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extends spatial competition beyond the controlled model. Incorporates physical terrain barriers,
                road network topologies, traffic friction, product quality differentiation, and asymmetric cost structures.
              </p>
            </div>

            <Link
              to="/frontier"
              className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors"
            >
              <span>View Frontier Scope</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Experiments Card */}
          <div className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-400 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/60 text-slate-400 font-medium">
                  Roadmap
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-200">
                Experiments
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Systematic parameter sweeps across transport cost sensitivity and reservation values.
                Benchmarking convergence basins, market tipping thresholds, and multi-firm dynamics.
              </p>
            </div>

            <Link
              to="/experiments"
              className="inline-flex items-center justify-between w-full px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors"
            >
              <span>View Experiments Scope</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Structural Organization & Architecture */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
        <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800/70 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span>Mathematical & Computational Core</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The platform is powered by a pure, deterministic JavaScript game theory engine decoupled from rendering.
            It performs exact profile evaluations across 250,000 joint strategy combinations, identifies unilateral deviations,
            and detects pure-strategy Nash equilibria in milliseconds.
          </p>
          <div className="pt-2 flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>500 strategies / firm</span>
            <span>·</span>
            <span>250k strategy profiles</span>
            <span>·</span>
            <span>32 pure Nash</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-950/40 border border-slate-800/70 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Analytical Architecture</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            LOCUS follows a progressive disclosure model: explore live spatial duopoly in Classic Lab,
            evaluate unilateral deviations with best-response analysis, trace sequential best-response adjustment paths in dynamics,
            and inspect exhaustive equilibria in the Nash Explorer.
          </p>
          <div className="pt-2 flex items-center gap-2 text-xs">
            <Link
              to="/about"
              className="text-sky-400 hover:text-sky-300 transition-colors inline-flex items-center gap-1 font-medium text-[11px]"
            >
              <span>Read Model Documentation & Theory</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
