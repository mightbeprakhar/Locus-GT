/**
 * @file Insights.jsx
 * @description Insights and Market Welfare roadmap placeholder page for LOCUS.
 * Details theoretical insights, welfare distributions, and economic efficiency.
 */

import { Link } from 'react-router-dom';
import { LineChart, ArrowRight, Scale, TrendingUp, Users, PieChart } from 'lucide-react';

export default function Insights() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-4xl w-full mx-auto gap-8">
      {/* Header */}
      <section className="flex flex-col gap-3 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span>Roadmap Module · Phase 5+</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <LineChart className="w-7 h-7 text-sky-400" />
          <span>Market Insights & Welfare Analysis</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          Explore equilibrium, market, welfare and strategic outcomes. Quantify how spatial competition
          governs consumer surplus, deadweight loss, and social welfare in geographical markets.
        </p>
      </section>

      {/* Planned Insight Topics */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Theoretical & Empirical Topics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Scale className="w-4 h-4 text-sky-400" />
              <span>Minimum vs. Maximum Differentiation</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Analyzing the tension between Hotelling's principle of minimum differentiation (clustering at market center)
              and price-softening incentives (dispersion toward market boundaries).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Consumer Surplus Distribution</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Spatial mapping of net consumer surplus across customer zones: identifying well-served central clusters
              versus peripheral zones bearing heavy travel disutility.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <span>Social Planner vs. Market Equilibrium</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Comparing decentralized Nash equilibrium restaurant locations with the social welfare-maximizing locations
              that minimize total customer travel cost.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <PieChart className="w-4 h-4 text-amber-400" />
              <span>Deadweight Loss & Market Power</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Quantifying inefficiency arising when local spatial differentiation allows firms to sustain prices
              significantly above marginal cost without losing customer capture.
            </p>
          </div>
        </div>
      </section>

      {/* Return Action */}
      <section className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-slate-200">
            Examine Live Payoffs & Market Shares
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            View live demands, profits, and market shares in the Classic Lab.
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
