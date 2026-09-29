# LOCUS Game Theory Engine — Mathematical Documentation

This module implements the pure, deterministic economic and game-theoretic foundations for **LOCUS**, an analytical laboratory based on a modified Hotelling Location Game.

All modules in `src/game/` are written in pure JavaScript (ES modules) with zero UI or React dependencies, strictly prioritizing mathematical precision, determinism, performance, and testability.

---

## 1. Mathematical Model

In the classical Hotelling (1929) duopoly model, two firms choose spatial locations on a linear line segment while consumers purchase from the nearest firm. In LOCUS, we generalize and adapt this framework to a **2D discrete spatial grid** where competing restaurants strategically choose both **spatial location** and **pricing**.

### 1.1 City Representation
The spatial landscape is modeled as a discrete 2D grid of customer zones:
$$\mathcal{C} = \{ (x, y) \in \mathbb{Z}^2 \mid 0 \le x < W,\; 0 \le y < H \}$$
- $W = 10$, $H = 10$ ($10 \times 10 = 100$ customer zones).
- Each zone $(x, y)$ has a deterministic population density $N(x, y) \ge 0$.

### 1.2 Restaurants & Firm Strategy
Two competing restaurants $j \in \{A, B\}$ choose a pure strategy $s_j$:
$$s_j = (\text{location}_j, P_j) = ((x_j, y_j), P_j)$$
where:
- **Canonical Strategy Representation**:
  ```javascript
  {
    location: { x, y },
    price
  }
  ```
- $(x_j, y_j) \in \mathcal{C}$ is a valid discrete grid cell.
- $P_j \in \mathcal{P}$ is chosen from a discrete allowed price set:
  $$\mathcal{P} = \{ 150, 200, 250, 300, 350 \}$$
- Duplicate or inconsistent top-level `x`/`y` properties are strictly rejected by the validator to maintain a single source of truth.

---

## 2. Variables & Parameters

| Symbol | Parameter / Variable | Default / Scope | Description |
|---|---|---|---|
| $W, H$ | Grid dimensions | $10 \times 10$ | City width and height in discrete cells |
| $N_i$ | Population of zone $i$ | $\ge 0$ | Number of consumers residing in zone $i$ |
| $V$ | Baseline Consumer Value | $500$ | Reservation price / gross utility derived from consuming the good |
| $\alpha$ | Travel Sensitivity Parameter | $10$ | Disutility penalty per unit of Euclidean travel distance |
| $T_{ij}$ | Travel Distance | $\ge 0$ | Spatial Euclidean distance from zone $i$ to restaurant $j$ |
| $P_j$ | Restaurant Price | $\in \{150, 200, 250, 300, 350\}$ | Unit price charged by restaurant $j$ |
| $C_j$ | Variable Cost | $100$ | Constant marginal cost per customer served |
| $F_j$ | Fixed Cost | $0$ (Phase 1/2) | Overhead / fixed rent expense (reserved for future phases) |
| $U_{ij}$ | Consumer Utility | $\mathbb{R}$ | Net utility of consumer in zone $i$ purchasing from restaurant $j$ |
| $D_j$ | Aggregate Demand | $\ge 0$ | Total consumer volume choosing restaurant $j$ |
| $\pi_j$ | Payoff / Profit | $\mathbb{R}$ | Net economic profit of restaurant $j$ |

---

## 3. Mathematical Equations

### 3.1 Spatial Distance
Travel costs are based on Euclidean distance:
$$T_{ij} = \text{distance}(i, j) = \sqrt{(x_i - x_j)^2 + (y_i - y_j)^2}$$

### 3.2 Consumer Utility
The net utility $U_{ij}$ obtained by a consumer in customer zone $i$ when purchasing from restaurant $j$ is given by:
$$U_{ij} = V - P_j - \alpha \cdot T_{ij}$$
- **Price effect**: Higher price directly decreases utility.
- **Distance effect**: Greater distance incurs travel disutility proportional to $\alpha$.

### 3.3 Consumer Choice & Tie-Breaking Rule
Consumers in zone $i$ act as rational utility maximizers:
- **Strict Preference**:
  $$\text{Zone } i \text{ chooses } \begin{cases} A, & \text{if } U_{iA} > U_{iB} \\ B, & \text{if } U_{iB} > U_{iA} \end{cases}$$
- **Explicit Tie-Breaking Rule**:
  If both restaurants yield identical utility within floating-point tolerance $|U_{iA} - U_{iB}| \le \varepsilon$ ($\varepsilon = 10^{-9}$):
  $$\text{share}_{iA} = 0.5, \quad \text{share}_{iB} = 0.5$$
  The customer population of zone $i$ splits exactly 50/50 between Restaurant A and Restaurant B.

### 3.4 Market Demand & Conservation Invariant
Demand $D_j$ for restaurant $j$ is the sum of populations allocated to $j$ across all customer zones:
$$D_A = \sum_{i \in \mathcal{C}} N_i \cdot \text{share}_{iA}, \qquad D_B = \sum_{i \in \mathcal{C}} N_i \cdot \text{share}_{iB}$$

**Core Invariant**:
$$D_A + D_B = \sum_{i \in \mathcal{C}} N_i = N_{\text{total}}$$
Every customer in the city chooses exactly one restaurant (inelastic local aggregate demand).

### 3.5 Firm Payoff (Profit)
Economic profit $\pi_j$ is given by:
$$\pi_j = (P_j - C_j) \cdot D_j - F_j$$
For Phase 1 and 2, $F_j = 0$ by default:
$$\pi_j = (P_j - C_j) \cdot D_j$$

**Crucial Economic Property**:
- If $P_j < C_j$, firm profit $\pi_j$ is **negative**.
- Profits are **strictly uncapped and never clamped to zero**, preserving proper marginal payoff gradients.

---

## 4. Best-Response Analysis & Nash Equilibrium (Phase 2)

### 4.1 Best Response Correspondence
For a fixed strategy chosen by the opponent $s_{-j}$, the set of best responses for player $j$ consists of all strategies in player $j$'s strategy space $S_j$ that maximize player $j$'s payoff:
$$\text{BR}_A(s_B) = \arg\max_{s_A \in S_A} \pi_A(s_A, s_B)$$
$$\text{BR}_B(s_A) = \arg\max_{s_B \in S_B} \pi_B(s_A, s_B)$$

Because multiple strategies may yield the exact same maximal payoff (e.g. via spatial symmetry or identical utility profiles), $\text{BR}_j(s_{-j})$ is a **set correspondence**, not a single-valued function. All strategies tied within numerical tolerance $\varepsilon = 10^{-9}$ of the maximum payoff are included:
$$\text{BR}_A(s_B) = \left\{ s_A \in S_A \;\middle|\; \pi_A(s_A, s_B) \ge \max_{s_A' \in S_A} \pi_A(s_A', s_B) - \varepsilon \right\}$$

### 4.2 Pure-Strategy Nash Equilibrium Definition
A strategy profile $(s_A^*, s_B^*) \in S_A \times S_B$ is a **Pure-Strategy Nash Equilibrium (PNE)** if and only if no player can unilaterally deviate to another pure strategy and achieve a strictly higher payoff:
$$\pi_A(s_A^*, s_B^*) \ge \pi_A(s_A', s_B^*) \quad \forall s_A' \in S_A$$
$$\pi_B(s_A^*, s_B^*) \ge \pi_B(s_A^*, s_B') \quad \forall s_B' \in S_B$$

Equivalently, a profile is a pure Nash equilibrium if and only if each player's strategy is a mutual best response to the other:
$$(s_A^*, s_B^*) \in \text{NE} \iff s_A^* \in \text{BR}_A(s_B^*) \quad \land \quad s_B^* \in \text{BR}_B(s_A^*)$$

Weak inequalities are used: indifference between strategies does not constitute a profitable deviation. A deviation is defined as profitable if and only if:
$$\pi_{\text{deviate}} > \pi_{\text{current}} + \varepsilon$$

### 4.3 Theoretical Distinction: Pure vs. Mixed Equilibria
- This engine specifically detects and computes **Pure-Strategy Nash Equilibria** within the discrete strategy grid.
- If no pure-strategy equilibrium is found, the engine reports:
  > *"No pure-strategy Nash equilibrium found in the specified discrete strategy space."*
- **Important Game Theory Principle**: By Nash's Existence Theorem (1950), every finite game has at least one **mixed-strategy** Nash equilibrium. Therefore, the non-existence of a pure-strategy equilibrium does *not* imply that no equilibrium exists in the game overall; it merely indicates that firms must randomize their strategies to achieve equilibrium.

---

## 5. Computational Complexity & Algorithmic Optimization

### 5.1 Complexity Analysis
For a discrete $10 \times 10$ city grid and $5$ price options:
- Single player strategy space: $|S_A| = |S_B| = 100 \times 5 = 500$ strategies.
- Total strategy profile space: $|S_A \times S_B| = 500 \times 500 = 250,000$ profiles.

#### Naive Approach ($O(|S|^3)$):
Checking unilateral deviations by running an inner best-response search for every profile requires:
$$|S_A| \times |S_B| \times (|S_A| + |S_B|) = 500 \times 500 \times 1,000 = 250,000,000 \text{ profile evaluations}$$
This naive method causes unacceptable computational latency.

#### Optimized Mutual Best-Response Algorithm ($O(|S|^2)$):
Our implementation evaluates every profile $(s_A, s_B)$ **exactly once**:
1. **Single-Pass Evaluation**: Evaluates all $M \times N = 250,000$ strategy pairs in $O(|S|^2)$ time.
2. **Column & Row Maxima**: Maintains the running best payoff $\max_{s_A} \pi_A(s_A, s_B)$ for each column $s_B$, and $\max_{s_B} \pi_B(s_A, s_B)$ for each row $s_A$.
3. **Mutual Best-Response Filtering**: Iterates over the precomputed payoff matrix in $O(|S|^2)$ to identify profiles satisfying both best-response conditions simultaneously.

This achieves a **500x speedup** over the naive approach.

### 5.2 Memory & Caching Architecture
- **Zero-Allocation Hot Loop**: `calculateDemandFast()` computes spatial Euclidean distance, utilities, and tie-breaking without allocating objects or closures inside the inner 100-cell loop.
- **Flat Continuous Typed Arrays**: Payoff and demand matrices are stored in contiguous `Float64Array` buffers:
  - `payoffsA`: $250,000 \times 8 \text{ bytes} \approx 2 \text{ MB}$
  - `payoffsB`: $250,000 \times 8 \text{ bytes} \approx 2 \text{ MB}$
  - `demandsA`: $250,000 \times 8 \text{ bytes} \approx 2 \text{ MB}$
  - `demandsB`: $250,000 \times 8 \text{ bytes} \approx 2 \text{ MB}$
  - Total buffer memory: $4 \times 2 \text{ MB} \approx 8 \text{ MB}$ total across all four Float64Array buffers, eliminating garbage collection pauses during exhaustive searches.

---

## 6. Current Limitations & Roadmap

- **Phase 1 (Completed)**: Pure mathematical and economic engine, test suites, deterministic spatial grid.
- **Phase 2 (Completed)**: Profile evaluation, best-response correspondences, unilateral deviation checks, and exhaustive pure-strategy Nash equilibrium detection.
- **Phase 3 (Upcoming)**: Quality extensions, asymmetric variable/fixed cost curves, and non-linear travel metrics.
- **Phase 4 (Upcoming)**: Interactive simulation UI, reaction surface heatmaps, and equilibrium visual laboratory.
