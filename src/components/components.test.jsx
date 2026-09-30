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
import { checkPureNashEquilibrium, findPureNashEquilibria } from '../game/equilibrium.js';

describe('LOCUS UI Components', () => {
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
    expect(html).toContain('₹150');
  });

  it('renders EquilibriumPanel with real-time Nash equilibrium diagnostic and search button', () => {
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
    expect(html).toContain('Full-game Nash search');
  });

  it('renders the complete App shell with header, branding, workspace, and telemetry', () => {
    const html = renderToString(<App />);

    expect(html).toContain('LOCUS');
    expect(html).toContain('Spatial Game Theory Laboratory');
    expect(html).toContain('10 × 10 grid');
    expect(html).toContain('customers');
    expect(html).toContain('Model:');
  });

  // PHASE 4A — Nash Equilibrium Explorer Component Tests
  describe('Phase 4A — Nash Equilibrium Explorer Component Integration', () => {
    const mockEquilibrium = {
      id: 7,
      strategyA: { location: { x: 4, y: 5 }, price: 250 },
      strategyB: { location: { x: 5, y: 5 }, price: 250 },
      payoffA: 875000,
      payoffB: 875000,
      demandA: 5000,
      demandB: 5000,
      marketShareA: 0.5,
      marketShareB: 0.5,
    };

    it('renders CityMap with preview markers A* and B* when an equilibrium is selected', () => {
      const html = renderToString(
        <CityMap
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedRestaurant="A"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedEquilibrium={mockEquilibrium}
        />
      );

      // Current positions are A(2,5) and B(7,5)
      expect(html).toContain('>A<');
      expect(html).toContain('>B<');

      // Candidate preview markers for Equilibrium #7 at (4,5) and (5,5)
      expect(html).toContain('>A*<');
      expect(html).toContain('>B*<');

      // Inspector bar and legend reflect preview state
      expect(html).toContain('Inspecting Eq #7:');
      expect(html).toContain('A*(4, 5)');
      expect(html).toContain('B*(5, 5)');
      expect(html).toContain('A* Eq.');
      expect(html).toContain('B* Eq.');
    });

    it('renders EquilibriumPanel with detailed inspection card when an equilibrium is selected', () => {
      const html = renderToString(
        <EquilibriumPanel
          equilibriumStatus={equilibriumStatus}
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedEquilibrium={mockEquilibrium}
          onSelectEquilibrium={() => {}}
          onLoadEquilibrium={() => {}}
        />
      );

      // Selected equilibrium title and status
      expect(html).toContain('Selected Equilibrium #7');
      expect(html).toContain('Pure Nash');

      // Explicit comparison: Current Simulation vs Selected Equilibrium
      expect(html).toContain('Current simulation:');
      expect(html).toContain('Selected equilibrium #7:');

      // Why is this a Nash equilibrium?
      expect(html).toContain('Why is this a Nash equilibrium?');
      expect(html).toContain('Neither restaurant can increase its profit by unilaterally changing its location or price');

      // Load action
      expect(html).toContain('Load into simulation');
      expect(html).toContain('Clear inspection');
    });

    it('renders CityMap cleanly when the selected equilibrium matches current positions', () => {
      const matchingEq = {
        id: 1,
        strategyA: { location: { x: 2, y: 5 }, price: 250 },
        strategyB: { location: { x: 7, y: 5 }, price: 250 },
        payoffA: 700000,
        payoffB: 700000,
      };

      const html = renderToString(
        <CityMap
          city={city}
          strategyA={matchingEq.strategyA}
          strategyB={matchingEq.strategyB}
          selectedRestaurant="A"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedEquilibrium={matchingEq}
        />
      );

      // Markers A and B should be rendered with matching title
      expect(html).toContain('>A<');
      expect(html).toContain('>B<');
      expect(html).toContain('at equilibrium location');
    });

    it('findPureNashEquilibria provides all data needed by the EquilibriumPanel explorer', () => {
      // Test on small controlled space to verify UI data contract
      const smallSpace = [
        { location: { x: 0, y: 0 }, price: 150 },
        { location: { x: 0, y: 0 }, price: 250 },
      ];
      const result = findPureNashEquilibria({
        city: [{ x: 0, y: 0, population: 100 }],
        strategySpace: smallSpace,
      });

      expect(result.count).toBeGreaterThan(0);
      const eq = result.equilibria[0];
      expect(eq.id).toBe(1);
      expect(eq.strategyA.location).toBeDefined();
      expect(eq.strategyB.location).toBeDefined();
      expect(eq.payoffA).toBeDefined();
      expect(eq.payoffB).toBeDefined();
      expect(eq.marketShareA).toBeDefined();
      expect(eq.marketShareB).toBeDefined();
    });
  });
});
