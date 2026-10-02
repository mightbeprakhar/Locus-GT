/**
 * @file AppShell.jsx
 * @description Professional application shell and persistent navigation layout for LOCUS.
 * Features a persistent desktop sidebar, mobile responsive drawer, active link styling,
 * and clean spatial layout.
 */

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Compass,
  FlaskConical,
  LineChart,
  Info,
  Menu,
  X,
} from 'lucide-react';
import Brand from './Brand.jsx';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    badge: null,
  },
  {
    to: '/classic',
    label: 'Classic Lab',
    icon: Layers,
    end: false,
    badge: 'Active',
  },
  {
    to: '/frontier',
    label: 'Frontier',
    icon: Compass,
    end: false,
    badge: 'Roadmap',
  },
  {
    to: '/experiments',
    label: 'Experiments',
    icon: FlaskConical,
    end: false,
    badge: 'Roadmap',
  },
  {
    to: '/insights',
    label: 'Insights',
    icon: LineChart,
    end: false,
    badge: 'Roadmap',
  },
  {
    to: '/about',
    label: 'About',
    icon: Info,
    end: false,
    badge: null,
  },
];

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* ========================================================================= */}
      {/* Mobile Top Header (hidden on desktop) */}
      {/* ========================================================================= */}
      <header className="lg:hidden border-b border-slate-800/80 bg-[#090d16] px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Brand subtitle={false} />
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800 transition-colors cursor-pointer"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ========================================================================= */}
      {/* Mobile Navigation Drawer Overlay (hidden on desktop) */}
      {/* ========================================================================= */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex"
          onClick={closeMobileMenu}
        >
          <div
            className="w-72 bg-[#090d16] border-r border-slate-800/90 h-full p-4 flex flex-col gap-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <Brand subtitle={true} />
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1.5 flex-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={closeMobileMenu}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-800/90 text-sky-400 border border-slate-700/80 font-medium'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          item.badge === 'Active'
                            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-3 border-t border-slate-800/70 text-[11px] text-slate-500 font-mono">
              Hotelling Discrete Framework
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Desktop Persistent Left Sidebar (hidden on mobile) */}
      {/* ========================================================================= */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-[#070b14] border-r border-slate-800/80 min-h-screen select-none sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80">
          <Brand subtitle={true} />
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
          <span className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Navigation
          </span>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-colors ${
                    isActive
                      ? 'bg-slate-800/90 text-sky-400 border border-slate-700/80 font-medium shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                      item.badge === 'Active'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Laboratory Status Footer */}
        <div className="p-4 border-t border-slate-800/80 flex flex-col gap-1.5 text-[11px] text-slate-400 bg-[#060910]">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-mono text-[10px]">Model Core</span>
            <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verified
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Hotelling Discrete Framework · 10 × 10 Discrete Grid · 2 Firms · Pure Nash
          </p>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* Main Content Area */}
      {/* ========================================================================= */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen bg-[#080c14]">
        <Outlet />
      </div>
    </div>
  );
}
