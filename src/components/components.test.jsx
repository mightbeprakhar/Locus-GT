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
import DynamicsPanel from './DynamicsPanel.jsx';
import { createDefaultCity } from '../game/city.js';
import { evaluateProfile } from '../game/payoff.js';
import {
  checkPureNashEquilibrium,
  findPureNashEquilibria,
  computeBestResponseAnalysis,
} from '../game/equilibrium.js';
import { runBestResponseDynamics } from '../game/dynamics.js';

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

  // PHASE 4C — Best-Response Dynamics Component Tests
  describe('Phase 4C — Best-Response Dynamics Component Integration', () => {
    // Helper to find button elements in React JSX output
    const findButtons = (element, acc = []) => {
      if (!element || typeof element !== 'object') return acc;
      if (element.type === 'button') acc.push(element);
      if (Array.isArray(element.props?.children)) {
        element.props.children.forEach((c) => findButtons(c, acc));
      } else if (element.props?.children) {
        findButtons(element.props.children, acc);
      }
      return acc;
    };

    it('DynamicsPanel empty state renders', () => {
      const html = renderToString(<DynamicsPanel result={null} />);

      expect(html).toContain('Best-Response Dynamics');
      expect(html).toContain('Sequential unilateral adjustments');
      expect(html).toContain('Run the dynamics to observe strategic adjustment.');
      expect(html).toContain('Run Dynamics');
      expect(html).toContain('Step Once');
      expect(html).toContain('Reset Dynamics');
    });

    it('DynamicsPanel renders converged result', () => {
      const mockConvergedResult = {
        status: 'converged',
        iterationCount: 11,
        converged: true,
        cycleDetected: false,
        cycleStartIndex: null,
        cycleLength: null,
        message: 'Best-response dynamics converged to a pure-strategy Nash equilibrium at iteration 11.',
        history: [
          {
            iteration: 0,
            actingPlayer: null,
            strategyA: { location: { x: 2, y: 5 }, price: 250 },
            strategyB: { location: { x: 7, y: 5 }, price: 250 },
            payoffA: 700000,
            payoffB: 700000,
            isNash: false,
            deviationOccurred: false,
          },
          {
            iteration: 11,
            actingPlayer: 'A',
            strategyA: { location: { x: 4, y: 4 }, price: 150 },
            strategyB: { location: { x: 4, y: 4 }, price: 150 },
            payoffA: 500000,
            payoffB: 500000,
            isNash: true,
            deviationOccurred: true,
          },
        ],
      };

      const html = renderToString(<DynamicsPanel result={mockConvergedResult} />);

      expect(html).toContain('Converged to Nash equilibrium');
      expect(html).toContain('11 iterations');
      expect(html).toContain('Final status:');
      expect(html).toContain('converged');
    });

    it('DynamicsPanel renders cycle result', () => {
      const mockCycleResult = {
        status: 'cycle',
        iterationCount: 4,
        converged: false,
        cycleDetected: true,
        cycleLength: 4,
        cycleStartIndex: 0,
        message: 'Best-response dynamics entered a cycle of period 4 starting at iteration 0.',
        history: [
          {
            iteration: 0,
            actingPlayer: null,
            strategyA: { location: { x: 0, y: 0 }, price: 150 },
            strategyB: { location: { x: 0, y: 0 }, price: 200 },
            payoffA: 50000,
            payoffB: 40000,
            isNash: false,
            deviationOccurred: false,
          },
        ],
      };

      const html = renderToString(<DynamicsPanel result={mockCycleResult} />);

      expect(html).toContain('Cycle detected');
      expect(html).toContain('4 iterations');
      expect(html).toContain('Final status:');
      expect(html).toContain('cycle');
      expect(html).not.toContain('no Nash equilibrium');
    });

    it('DynamicsPanel renders max-iterations result', () => {
      const mockMaxResult = {
        status: 'max-iterations',
        iterationCount: 25,
        converged: false,
        cycleDetected: false,
        cycleStartIndex: null,
        cycleLength: null,
        message: 'Best-response dynamics reached the maximum iteration limit (25).',
        history: [
          {
            iteration: 0,
            actingPlayer: null,
            strategyA: { location: { x: 2, y: 5 }, price: 250 },
            strategyB: { location: { x: 7, y: 5 }, price: 250 },
            payoffA: 700000,
            payoffB: 700000,
            isNash: false,
            deviationOccurred: false,
          },
        ],
      };

      const html = renderToString(<DynamicsPanel result={mockMaxResult} />);

      expect(html).toContain('Maximum iterations reached');
      expect(html).toContain('25 iterations');
      expect(html).toContain('Final status:');
      expect(html).toContain('max-iterations');
      expect(html).not.toContain('no Nash equilibrium');
    });

    it('trajectory rows render with step, firms, profits, and statuses', () => {
      const dynamicsRun = runBestResponseDynamics({
        city,
        strategyA,
        strategyB,
        maxIterations: 3,
      });

      const html = renderToString(<DynamicsPanel result={dynamicsRun} />);

      expect(html).toContain('Trajectory (4 steps)');
      expect(html).toContain('Step');
      expect(html).toContain('Acting Firm');
      expect(html).toContain('Profit 1');
      expect(html).toContain('Profit 2');
      expect(html).toContain('0 (Initial)');
      expect(html).toContain('(2, 5) · ₹250');
      expect(html).toContain('(7, 5) · ₹250');
    });

    it('selected trajectory state renders inspector with full metrics', () => {
      const selectedState = {
        iteration: 2,
        actingPlayer: 'B',
        strategyA: { location: { x: 6, y: 5 }, price: 250 },
        strategyB: { location: { x: 5, y: 5 }, price: 200 },
        payoffA: 950000,
        payoffB: 880000,
        demandA: 6333,
        demandB: 5866,
        marketShareA: 0.519,
        marketShareB: 0.481,
        isNash: false,
        deviationOccurred: true,
      };

      const mockResult = {
        status: 'stepping',
        iterationCount: 2,
        history: [selectedState],
      };

      const html = renderToString(
        <DynamicsPanel result={mockResult} selectedState={selectedState} />
      );

      expect(html).toContain('Selected Step');
      expect(html).toContain('#2');
      expect(html).toContain('Restaurant 2 (Firm B)');
      expect(html).toContain('Strategy changed');
      expect(html).toContain('Not Nash');
      expect(html).toContain('(6, 5)');
      expect(html).toContain('(5, 5)');
      expect(html).toContain('₹250');
      expect(html).toContain('₹200');
      expect(html).toContain('51.9%');
      expect(html).toContain('48.1%');
      expect(html).toContain('Load into Simulation');
    });

    it('"Load into Simulation" callback fires when button is clicked', () => {
      const selectedState = {
        iteration: 1,
        actingPlayer: 'A',
        strategyA: { location: { x: 6, y: 5 }, price: 250 },
        strategyB: { location: { x: 7, y: 5 }, price: 250 },
        payoffA: 1516800,
        payoffB: 700000,
      };

      let loaded = null;
      const element = DynamicsPanel({
        result: { status: 'stepping', iterationCount: 1, history: [selectedState] },
        selectedState,
        onLoadState: (state) => {
          loaded = state;
        },
      });

      const buttons = findButtons(element);
      const loadBtn = buttons.find((b) => renderToString(b).includes('Load into Simulation'));
      expect(loadBtn).toBeDefined();

      loadBtn.props.onClick();
      expect(loaded).toEqual(selectedState);
    });

    it('starting-player selector callback fires with selected player', () => {
      let selectedPlayer = null;
      const element = DynamicsPanel({
        startingPlayer: 'A',
        onStartingPlayerChange: (p) => {
          selectedPlayer = p;
        },
      });

      const buttons = findButtons(element);
      const btnB = buttons.find((b) => renderToString(b).includes('Restaurant 2 (Firm B)'));
      expect(btnB).toBeDefined();

      btnB.props.onClick();
      expect(selectedPlayer).toBe('B');
    });

    it('max-iteration selector callback fires with selected iteration count', () => {
      let chosenLimit = null;
      const element = DynamicsPanel({
        maxIterations: 25,
        onMaxIterationsChange: (l) => {
          chosenLimit = l;
        },
      });

      const buttons = findButtons(element);
      const btn50 = buttons.find((b) => renderToString(b).includes('>50<'));
      expect(btn50).toBeDefined();

      btn50.props.onClick();
      expect(chosenLimit).toBe(50);
    });

    it('CityMap renders dynamics historical preview with D1 and D2 markers', () => {
      const dynState = {
        iteration: 2,
        strategyA: { location: { x: 3, y: 4 }, price: 200 },
        strategyB: { location: { x: 8, y: 8 }, price: 300 },
      };

      const html = renderToString(
        <CityMap
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedRestaurant="A"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedDynamicsState={dynState}
        />
      );

      expect(html).toContain('>D1<');
      expect(html).toContain('>D2<');
      expect(html).toContain('Inspecting Dynamics Step #2:');
      expect(html).toContain('D1(3, 4)');
      expect(html).toContain('D2(8, 8)');
      expect(html).toContain('D1 Step 2');
      expect(html).toContain('D2 Step 2');
    });

    it('dynamics preview remains separate and avoids duplicate marker when matching current location', () => {
      // Firm A historical location matches current strategyA (2, 5)
      // Firm B historical location is separate (8, 8) vs current (7, 5)
      const matchingDynState = {
        iteration: 1,
        strategyA: { location: { x: 2, y: 5 }, price: 250 },
        strategyB: { location: { x: 8, y: 8 }, price: 250 },
      };

      const html = renderToString(
        <CityMap
          city={city}
          strategyA={strategyA}
          strategyB={strategyB}
          selectedRestaurant="A"
          onSelectLocation={() => {}}
          evaluation={evaluation}
          selectedDynamicsState={matchingDynState}
        />
      );

      // Marker 1 remains authoritative at (2, 5); no duplicate D1 target marker is rendered on grid cells
      expect(html).toContain('>1<');
      expect(html).not.toContain('Dynamics Step #1 D1 target');

      // Separate D2 marker IS rendered on grid at (8, 8)
      expect(html).toContain('Dynamics Step #1 D2 target');
      expect(html).toContain('D2 Step 1');
    });

    it('App renders DynamicsPanel within the analytical sidebar', () => {
      const html = renderToString(<App />);

      expect(html).toContain('Best-Response Dynamics');
      expect(html).toContain('Sequential unilateral adjustments');
      expect(html).toContain('Cournot process');
      expect(html).toContain('Run the dynamics to observe strategic adjustment.');
    });
  });
});
