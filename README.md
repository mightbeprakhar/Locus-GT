# LOCUS — Game Theory Laboratory

LOCUS is a Game Theory laboratory based on a modified Hotelling Location Game where competing firms choose spatial locations and pricing on a 2D consumer grid.

## Project Status

- **Phase 1 Completed — Pure Mathematical Engine**:
  - Pure, deterministic economic model implemented in `src/game/`.
  - Euclidean spatial distance and consumer utility calculations.
  - Discrete strategy space generation and validation (10×10 grid, 5 discrete price points).
  - Explicit 50/50 tie-breaking and demand conservation invariants ($D_A + D_B = N_{\text{total}}$).
  - Unclamped profit equations ($\pi_j = (P_j - C_j)D_j - F_j$) supporting negative payoff margins.
  - Comprehensive Vitest test suite covering foundational game-theoretic axioms.

- **Phase 2 Completed — Best Responses & Pure-Strategy Nash Equilibrium**:
  - Decoupled profile evaluation (`evaluateProfile`) separating strategic choice `{ location, price }` from operational costs.
  - Full best-response correspondence computation (`findBestResponses`) returning all tied strategies within numerical tolerance.
  - Pure-strategy Nash equilibrium verification (`checkPureNashEquilibrium`) with unilateral deviation diagnostics.
  - High-performance, zero-allocation exhaustive search (`findPureNashEquilibria`) scanning finite strategy spaces in $O(|S|^2)$ time.
  - Normal-form game matrix solver (`solvePureNashFromPayoffs`).
  - Clear theoretical distinction: reports presence of pure-strategy equilibria without precluding mixed-strategy equilibria.

For full mathematical documentation and variable definitions, see [src/game/README.md](file:///c:/Users/prakh/LOCUS%20GT/src/game/README.md).

## Development & Testing

```bash
# Run unit and integration tests
npm test

# Lint verification
npm run lint

# Production build check
npm run build

# Start local development server
npm run dev
```
