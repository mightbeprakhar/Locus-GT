/**
 * @file About.jsx
 * @description About and mathematical model documentation page for LOCUS.
 * Outlines the theoretical equations, strategy space formulation, and computational architecture.
 */

import { Link } from 'react-router-dom';
import { Info, ArrowRight, BookOpen, Layers, CheckCircle2 } from 'lucide-react';

export default function About() {
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-10 max-w-4xl w-full mx-auto gap-8">
      {/* Header */}
      <section className="flex flex-col gap-3 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs font-mono text-sky-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>Documentation & Theory</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 flex items-center gap-3">
          <Info className="w-7 h-7 text-sky-400" />
          <span>About LOCUS & The Mathematical Model</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
          LOCUS (Spatial Game Theory Laboratory) is an interactive research environment designed
          to explore spatial competition, discrete price equilibrium, and unilateral dynamic adjustments.
        </p>
      </section>

      {/* Model Equations & Microfoundations */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Theoretical Microfoundations
        </h2>

        <div className="grid grid-cols-1 gap-4 text-xs">
          {/* Utility Equation Card */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <h3 className="text-slate-200 font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" />
              <span>1. Consumer Utility & Choice Rule</span>
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Customers at location i = (x_i, y_i) choose firm j from {'{'}A, B{'}'} by maximizing net utility:
            </p>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-slate-200 text-center text-xs sm:text-sm">
              U_ij = V - P_j - &alpha; &middot; d(loc_i, loc_j)
            </div>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li><strong className="text-slate-300">V = ₹500:</strong> Base customer reservation value for dining.</li>
              <li><strong className="text-slate-300">P_j:</strong> Unit price charged by firm j (discrete prices: ₹150, ₹200, ₹250, ₹300, ₹350).</li>
              <li><strong className="text-slate-300">&alpha; = 10:</strong> Travel cost penalty per Euclidean grid unit.</li>
              <li><strong className="text-slate-300">Tie-Breaking:</strong> When U_iA = U_iB, customer population splits equally (50% / 50%).</li>
            </ul>
          </div>

          {/* Payoff Equation Card */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <h3 className="text-slate-200 font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>2. Demand Aggregation & Profit Function</span>
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Total demand for firm j is the sum of captured customer populations across all grid cells.
              Operating profit is determined by unit margin and fixed overhead:
            </p>
            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-slate-200 text-center text-xs sm:text-sm">
              &Pi;_j = (P_j - c) &middot; Demand_j - F
            </div>
            <ul className="space-y-1 text-slate-400 list-disc list-inside">
              <li><strong className="text-slate-300">c = ₹100:</strong> Variable marginal cost per meal served.</li>
              <li><strong className="text-slate-300">F = ₹0:</strong> Baseline fixed operational overhead cost per period (default in base model).</li>
            </ul>
          </div>

          {/* Strategy Space Card */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col gap-2">
            <h3 className="text-slate-200 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-violet-400" />
              <span>3. Strategic Space & Pure Nash Equilibria</span>
            </h3>
            <p className="text-slate-400 leading-relaxed">
              Each firm selects a joint pure strategy s_j = (loc_j, P_j) consisting of one grid cell
              out of 100 and one discrete price out of 5:
            </p>
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-slate-300 text-xs">
              100 locations &times; 5 prices = 500 pure strategies per firm &rarr; 250,000 joint profiles
            </div>
            <p className="text-slate-400 leading-relaxed">
              Under default city demographics (10 &times; 10 grid, 13,992 consumers across 100 customer zones), the exhaustive Pure Nash Solver proves there are exactly
              <strong className="text-slate-200"> 32 pure-strategy Nash equilibria</strong> where neither firm has an incentive to unilaterally deviate.
            </p>
          </div>
        </div>
      </section>

      {/* Return Action */}
      <section className="p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold text-slate-200">
            Explore the Model Hands-On
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Interact with the spatial grid, adjust prices, and inspect equilibria in the Classic Lab.
          </p>
        </div>
        <Link
          to="/classic"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shrink-0"
        >
          <span>Open Classic Lab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </div>
  );
}
