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

describe('Phase 3.5 — LOCUS Refined UI Components', () => {
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

  it('renders CityMap with customer zones and restaurant markers A and B', () => {
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

    expect(html).toContain('City');
    expect(html).toContain('Restaurant A');
    expect(html).toContain('Restaurant B');
    expect(html).toContain('Selected:');
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

    expect(html).toContain('Controls');
    expect(html).toContain('Choose restaurant');
    expect(html).toContain('₹150');
    expect(html).toContain('₹200');
    expect(html).toContain('₹250');
    expect(html).toContain('₹300');
    expect(html).toContain('₹350');
    expect(html).toContain('Reset');
  });

  it('renders PayoffPanel with live demands, profits, margins, and market shares', () => {
    const html = renderToString(
      <PayoffPanel
        evaluation={evaluation}
        strategyA={strategyA}
        strategyB={strategyB}
      />
    );

    expect(html).toContain('Payoffs');
    expect(html).toContain('Market share');
    expect(html).toContain('Demand');
    expect(html).toContain('Profit');
    expect(html).toContain('Margin');
    // Margin for price 250 is 250 - 100 = 150 -> ₹150
    expect(html).toContain('₹150');
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

    expect(html).toContain('Equilibrium');
    expect(html).toContain('Unilateral deviation analysis');
    expect(html).toContain('Search for pure Nash equilibria');
  });

  it('renders the complete App shell with header, branding, workspace, and telemetry', () => {
    const html = renderToString(<App />);

    expect(html).toContain('LOCUS');
    expect(html).toContain('Spatial Game Theory Laboratory');
    expect(html).toContain('10 × 10 grid');
    expect(html).toContain('customers');
    expect(html).toContain('Model:');
  });
});
