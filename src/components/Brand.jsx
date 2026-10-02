/**
 * @file Brand.jsx
 * @description Reusable LOCUS laboratory branding component.
 */

/**
 * @param {Object} props
 * @param {boolean} [props.subtitle=true] - Whether to display the secondary descriptive text
 * @param {string} [props.className=''] - Additional container classes
 */
export default function Brand({ subtitle = true, className = '' }) {
  return (
    <div className={`flex flex-col select-none ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-base sm:text-lg font-bold tracking-tight text-slate-100 font-sans">
          LOCUS
        </span>
        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-500/30 text-sky-400">
          GT Lab
        </span>
      </div>
      {subtitle && (
        <span className="text-[11px] text-slate-400">
          Spatial Game Theory Laboratory
        </span>
      )}
    </div>
  );
}
