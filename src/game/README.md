# LOCUS Game Theory Engine — Phase 1: Pure Mathematical Model

This module implements the pure, deterministic economic and mathematical foundations for **LOCUS**, a Game Theory laboratory based on a modified Hotelling Location Game.

All modules in `src/game/` are implemented in plain JavaScript (ES modules) with zero UI or React dependencies, strictly prioritizing mathematical precision, determinism, and testability.

---

## 1. Mathematical Model

In the classical Hotelling (1929) duopoly model, two firms choose spatial locations on a linear line segment while consumers purchase from the nearest firm. In LOCUS, we generalize and adapt this framework to a **2D discrete spatial grid** where competing restaurants strategically choose both **spatial location** and **pricing**.

### 1.1 City Representation
The spatial landscape is modeled as a discrete 2D grid of customer zones:
$$\mathcal{C} = \{ (x, y) \in \mathbb{Z}^2 \mid 0 \le x < W,\; 0 \le y < H \}$$
For Phase 1:
- $W = 10$, $H = 10$ ($10 \times 10 = 100$ customer zones).
- Each zone $(x, y)$ has a deterministic population density $N(x, y) \ge 0$.

### 1.2 Restaurants & Firm Strategy
Two competing restaurants $j \in \{A, B\}$ choose a pure strategy $s_j$:
$$s_j = (\text{location}_j, P_j) = ((x_j, y_j), P_j)$$
where:
- Canonical Representation: `{ location: { x, y }, price }`
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
| $F_j$ | Fixed Cost | $0$ (Phase 1) | Overhead / fixed rent expense (reserved for future phases) |
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
For Phase 1, $F_j = 0$:
$$\pi_j = (P_j - C_j) \cdot D_j$$

**Crucial Economic Property**:
- If $P_j < C_j$, firm profit $\pi_j$ is **negative**.
- Profits are **strictly uncapped and never clamped to zero**, preserving proper marginal payoff gradients.

---

## 4. Strategy Space

For a single firm, a strategy consists of choosing an integer grid coordinate and an allowed price:
- Grid cells: $10 \times 10 = 100$ locations.
- Allowed prices: 5 options ($150, 200, 250, 300, 350$).
- Total strategy space per firm:
  $$|S_j| = 100 \times 5 = 500 \text{ pure strategies}$$
- Total game state combinations:
  $$|S_A \times S_B| = 500 \times 500 = 250,000 \text{ strategy profiles}$$

---

## 5. Assumptions & Modeling Notes

1. **Deterministic Environment**: No stochastic shocks or random distributions. All calculations yield identical outputs for identical inputs.
2. **Homogeneous Travel Sensitivity**: For Phase 1, all customer zones share the same baseline valuation $V$ and sensitivity $\alpha$.
3. **Inelastic Individual Demand**: Each resident in a customer zone buys exactly one meal from either restaurant A or B (market is fully covered).
4. **No Quality Differentiation (Yet)**: Quality parameter $Q_j$ is omitted in Phase 1.
5. **No Fixed Rent / Overheads (Yet)**: $F_j = 0$ by default in Phase 1, but the mathematical API accepts fixed costs without refactoring.

---

## 6. Current Limitations & Future Roadmap

- **Phase 1 (Current)**: Pure mathematical and economic engine, test suites, deterministic spatial grid.
- **Phase 2 (Upcoming)**: Best-response calculation, reaction surfaces, and Nash Equilibrium detection.
- **Phase 3 (Upcoming)**: Quality extensions, asymmetric costs, and non-linear travel metrics (e.g. Manhattan, congestion penalties).
- **Phase 4 (Upcoming)**: Interactive simulation UI, city density heatmaps, and equilibrium visualization laboratory.
