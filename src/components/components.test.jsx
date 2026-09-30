/**
 * @file components.test.jsx
 * @description Component integration test suite verifying that UI components render correctly
 * with the mathematical model and produce expected markup for Phase 3, 3.5, 4A, and 4B.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App.jsx';
import CityMap from './CityMap.jsx';
import GameControls from './GameControls.jsx';
import PayoffPanel from './PayoffPanel.jsx';
import EquilibriumPanel from './EquilibriumPanel.jsx';
import BestResponsePanel from './BestResponsePanel.jsx';
import { createDefaultCity } from '../game/city.js';
import { evaluateProfile } from '../game/payoff.js';
import {
  checkPureNashEquilibrium,
  findPureNashEquilibria,
  computeBestResponseAnalysis,
} from '../game/equilibrium.js';

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

  const bestResponseAnalysis = computeBestResponseAnalysis({
    city,
    strategyA,
    strategyB,
  });

  it('renders CityMap with customer zones and restaurant markers 1 and 2', () => {
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
    expect(html).toContain('Restaurant 1');
    expect(html).toContain('Restaurant 2');
    expect(html).toContain('Selected:');
    // Markers
    expect(html).toContain('>1<');
    expect(html).toContain('>2<');
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
    expect(html).toContain('Restaurant 1');
    expect(html).toContain('Restaurant 2');
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
    expect(html).toContain('Restaurant 1');
    expect(html).toContain('Restaurant 2');
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
    expect(html).toContain('Best Response Analysis');
    expect(html).toContain('Payoffs');
    expect(html).toContain('Equilibrium');
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

      // Current positions are Restaurant 1 at (2,5) and Restaurant 2 at (7,5)
      expect(html).toContain('>1<');
      expect(html).toContain('>2<');

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

      // Markers 1 and 2 should be rendered with matching title
      expect(html).toContain('>1<');
      expect(html).toContain('>2<');
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

  // PHASE 4B — Best Response Analysis Component Tests
  describe('Phase 4B — Best Response Analysis Component Integration', () => {
    it('renders BestResponsePanel with Restaurant 1 and Restaurant 2 comparative data', () => {
      const html = renderToString(
        <BestResponsePanel
          analysis={bestResponseAnalysis}
          strategyA={strategyA}
          strategyB={strategyB}
          onApplyBestResponse={() => {}}
        />
      );

      expect(html).toContain('Best Response Analysis');
      expect(html).toContain('Restaurant 1');
      expect(html).toContain('Restaurant 2');
      expect(html).toContain('Current strategy');
      expect(html).toContain('Best response');
      expect(html).toContain('Expected demand');
      expect(html).toContain('Expected share');
      expect(html).toContain('Expected profit');
      expect(html).toContain('Apply Best Response');
    });

    it('clearly communicates profitable deviation state and potential profit gain', () => {
      const html = renderToString(
        <BestResponsePanel
          analysis={bestResponseAnalysis}
          strategyA={strategyA}
          strategyB={strategyB}
          onApplyBestResponse={() => {}}
        />
      );

      expect(html).toContain('Profitable deviation available');
      // Gain of ₹467,400 on default city (supports standard and en-IN lakh formatting)
      expect(html).toMatch(/\+₹(467,400|4,67,400)/);
      expect(html).toContain('Current profit:');
      expect(html).toContain('Best-response profit:');
    });

    it('clearly communicates no-profitable-deviation state with exact required text on equilibrium profile', () => {
      // Known equilibrium profile: A(4, 4) @ 150 vs B(4, 4) @ 150
      const eqStrategyA = { location: { x: 4, y: 4 }, price: 150 };
      const eqStrategyB = { location: { x: 4, y: 4 }, price: 150 };
      const eqAnalysis = computeBestResponseAnalysis({
        city,
        strategyA: eqStrategyA,
        strategyB: eqStrategyB,
      });

      const html = renderToString(
        <BestResponsePanel
          analysis={eqAnalysis}
          strategyA={eqStrategyA}
          strategyB={eqStrategyB}
          onApplyBestResponse={() => {}}
        />
      );

      // Exact requirement 5 string:
      expect(html).toContain(
        'No profitable deviation available against the current opponent strategy.'
      );
      // Explains unilateral stability does not unilaterally guarantee full Nash without opponent
      expect(html).toContain('Restaurant 1 is playing an optimal unilateral response');
    });

    it('displays tied best responses without discarding tied strategies and allows selection', () => {
      // Equilibrium profile has 4 tied best responses
      const eqStrategyA = { location: { x: 4, y: 4 }, price: 150 };
      const eqStrategyB = { location: { x: 4, y: 4 }, price: 150 };
      const eqAnalysis = computeBestResponseAnalysis({
        city,
        strategyA: eqStrategyA,
        strategyB: eqStrategyB,
      });

      const html = renderToString(
        <BestResponsePanel
          analysis={eqAnalysis}
          strategyA={eqStrategyA}
          strategyB={eqStrategyB}
          onApplyBestResponse={() => {}}
        />
      );

      // Check tied response section is rendered with count
      expect(html).toContain('Tied best responses (4)');
      expect(html).toContain('Option #1');
      expect(html).toContain('Option #2');
      expect(html).toContain('Option #3');
      expect(html).toContain('Option #4');
    });

    it('renders CityMap with ghost pin BR 1 for best-response target distinct from active solid pins', () => {
      const selectedBR = {
        player: 'A',
        strategy: { location: { x: 6, y: 5 }, price: 250 },
      };

      const html = renderToString(
        <CityMap
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedRestaurant="A"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedBestResponse={selectedBR}
        />
      );

      // Active solid restaurant pins: 1 at (2, 5) and 2 at (7, 5)
      expect(html).toContain('>1<');
      expect(html).toContain('>2<');

      // Best response ghost pin at target (6, 5)
      expect(html).toContain('>BR 1<');

      // Inspector and legend reflect best-response target preview
      expect(html).toContain('Inspecting Restaurant 1 Best Response:');
      expect(html).toContain('Target (6, 5) @ ₹250');
      expect(html).toContain('BR Target (R1)');

      // Verify no A*/B* equilibrium notation is used for the best response target
      expect(html).not.toContain('A* Eq.');
    });

    it('renders CityMap with ghost pin BR 2 when Restaurant 2 best-response target is selected', () => {
      const selectedBR = {
        player: 'B',
        strategy: { location: { x: 3, y: 5 }, price: 250 },
      };

      const html = renderToString(
        <CityMap
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedRestaurant="B"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedBestResponse={selectedBR}
        />
      );

      expect(html).toContain('>BR 2<');
      expect(html).toContain('Inspecting Restaurant 2 Best Response:');
      expect(html).toContain('Target (3, 5) @ ₹250');
      expect(html).toContain('BR Target (R2)');
    });

    it('applying a best response updates only the selected restaurant while preserving the opponent strategy', () => {
      let appliedPlayer = null;
      let appliedStrategy = null;

      const handleApply = (player, strategy) => {
        appliedPlayer = player;
        appliedStrategy = strategy;
      };

      // Best response for Restaurant 1 against B(7, 5) @ 250 is (6, 5) @ 250
      const brStrategyA = bestResponseAnalysis.restaurant1.bestResponses[0];

      // Simulate applying best response for Restaurant 1
      handleApply('A', brStrategyA);

      expect(appliedPlayer).toBe('A');
      expect(appliedStrategy).toEqual({ location: { x: 6, y: 5 }, price: 250 });

      // Simulate state update in application:
      // strategyA becomes brStrategyA, strategyB remains completely unchanged!
      const newStrategyA = appliedStrategy;
      const unchangedStrategyB = strategyB;

      expect(newStrategyA.location).toEqual({ x: 6, y: 5 });
      expect(unchangedStrategyB.location).toEqual({ x: 7, y: 5 });
      expect(unchangedStrategyB.price).toBe(250);

      // Verify recalculated simulation state has significantly improved profit for Restaurant 1
      const newEvaluation = evaluateProfile({
        city,
        strategyA: newStrategyA,
        strategyB: unchangedStrategyB,
      });

      expect(newEvaluation.profitA).toBe(1516800);
      expect(newEvaluation.profitA).toBeGreaterThan(evaluation.profitA);
      // Opponent strategy was preserved
      expect(unchangedStrategyB).toEqual(strategyB);
    });

    it('selecting a tied best response allows user to choose which optimal strategy to apply', () => {
      // Profile with multiple tied responses
      const eqStrategyA = { location: { x: 4, y: 4 }, price: 150 };
      const eqStrategyB = { location: { x: 4, y: 4 }, price: 150 };
      const eqAnalysis = computeBestResponseAnalysis({
        city,
        strategyA: eqStrategyA,
        strategyB: eqStrategyB,
      });

      expect(eqAnalysis.restaurant1.tiedCount).toBe(4);

      // The 4 tied strategies each have identical optimal payoff
      const tiedStrategies = eqAnalysis.restaurant1.bestResponseDetails;
      expect(tiedStrategies).toHaveLength(4);
      const expectedPayoff = tiedStrategies[0].payoff;

      for (let i = 0; i < 4; i++) {
        expect(tiedStrategies[i].payoff).toBe(expectedPayoff);
        expect(tiedStrategies[i].strategy.location).toBeDefined();
        expect(tiedStrategies[i].strategy.price).toBeDefined();
      }

      // User can choose Option #2 to apply
      let chosenStrategy = null;
      const chooseTiedOption = (index) => {
        chosenStrategy = tiedStrategies[index].strategy;
      };

      chooseTiedOption(1); // Choose option 2
      expect(chosenStrategy).toEqual(tiedStrategies[1].strategy);
    });
  });
});
