/**
 * @file components.test.jsx
 * @description Component integration test suite verifying that UI components render correctly
 * with the mathematical model and produce expected markup.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App.jsx';
import CityMap from './CityMap.jsx';
import GameControls from './GameControls.jsx';
import PayoffPanel from './PayoffPanel.jsx';
import EquilibriumPanel from './EquilibriumPanel.jsx';
import { createDefaultCity } from '../game/city.js';
import { evaluateProfile } from '../game/payoff.js';
import { checkPureNashEquilibrium } from '../game/equilibrium.js';

describe('Phase 3 — LOCUS Interactive UI Components', () => {
  const city = createDefaultCity();
  const strategyA = { location: { x: 2, y: 5 }, price: 250 };
  const strategyB = { location: { x: 7, y: 5 }, price: 250 };

  const evaluation = evaluateProfile({
    city,
    strategyA,
    strategyB,
    includeAllocations: true,
  });

  const equilibriumStatus = checkPureNashEquilibrium({
    city,
    strategyA,
    strategyB,
  });

  it('renders CityMap with 100 customer zones and restaurant markers A and B', () => {
    const html = renderToString(
      <CityMap
        city={city}
        strategyA={strategyA}
        strategyB={strategyB}
        selectedRestaurant="A"
        onSelectLocation={() => {}}
        evaluation={evaluation}
      />
    );

    expect(html).toContain('City Customer Grid (10 × 10)');
    expect(html).toContain('Restaurant A');
    expect(html).toContain('Restaurant B');
    // Coordinates 2,5 and 7,5
    expect(html).toContain('2,5');
    expect(html).toContain('7,5');
    // Markers
    expect(html).toContain('>A<');
    expect(html).toContain('>B<');
  });

  it('renders GameControls with price selectors and active restaurant switcher', () => {
    const html = renderToString(
      <GameControls
        strategyA={strategyA}
        strategyB={strategyB}
        selectedRestaurant="A"
        onSelectRestaurant={() => {}}
        onChangePrice={() => {}}
        onReset={() => {}}
      />
    );

    expect(html).toContain('Strategic Decision Controls');
    expect(html).toContain('$150');
    expect(html).toContain('$200');
    expect(html).toContain('$250');
    expect(html).toContain('$300');
    expect(html).toContain('$350');
    expect(html).toContain('Reset');
  });

  it('renders PayoffPanel with live demands, profits, and market shares', () => {
    const html = renderToString(
      <PayoffPanel
        evaluation={evaluation}
        strategyA={strategyA}
        strategyB={strategyB}
      />
    );

    expect(html).toContain('Economic Telemetry &amp; Payoffs');
    expect(html).toContain('Share A:');
    expect(html).toContain('Share B:');
    expect(html).toContain('Total Market:');
    expect(html).toContain('Margin / Unit:');
    // Margin for price 250 is 250 - 100 = 150
    expect(html).toContain('$150');
  });

  it('renders EquilibriumPanel with real-time Nash equilibrium diagnostic', () => {
    const html = renderToString(
      <EquilibriumPanel
        equilibriumStatus={equilibriumStatus}
        city={city}
        strategyA={strategyA}
        strategyB={strategyB}
      />
    );

    expect(html).toContain('Game Theory Diagnostics');
    expect(html).toContain('Unilateral Deviation Analysis');
    expect(html).toContain('Scan Full Space for Pure Nash Equilibria');
  });

  it('renders the complete App shell with header, branding, workspace, and telemetry', () => {
    const html = renderToString(<App />);

    expect(html).toContain('LOCUS');
    expect(html).toContain('Spatial Game Theory Laboratory');
    expect(html).toContain('Grid: 10×10');
    expect(html).toContain('Pop:');
  });
});
