# Lucent Lab — Manual Test Plan

Run from `npm run dev`. Each row is a single check; tick ✅ / ❌ and note the symptom.

## 0 · Smoke

| # | Step | Expected | Result |
|---|------|----------|--------|
| 0.1 | Load `/` | Atlas grid renders, no console errors | |
| 0.2 | Load `/table` | Periodic table renders, hover tooltips work | |
| 0.3 | Open Units dropdown in nav | All 9 units listed, hue swatches visible | |
| 0.4 | Click each unit from dropdown | Routes to `/unit/<slug>`, dropdown closes | |
| 0.5 | DevTools console after every page | Zero red errors | |

## 1 · Cross-cutting UI

| # | Step | Expected |
|---|------|----------|
| 1.1 | Resize window to 700 px wide | No horizontal scroll, controls wrap |
| 1.2 | Hover any unit card | Hue accent appears |
| 1.3 | Reload mid-animation | State resets, no NaN values |
| 1.4 | Tab key through controls | Focus ring visible, order logical |
| 1.5 | Within a unit, topics that share an animation show "↑ See ..." pointer (no double render) | Verified on Unit 06 (6.3 → 6.4) and any unit reusing a key |

## 2 · Animations (Unit 1–9)

For each animation: load the topic, exercise every control, confirm math sanity, watch console.

### Unit 1 — Atomic Structure
- **1.4 Orbital** — element selector covers Z=1–46; Pd valence reads 0; Aufbau diagram fills correctly.
- **1.5 PES** — peaks fall at correct subshell energies; eject button removes outermost peak.
- **1.6 PeriodicTrend** — gauge stays in [0, 100 %]; switching trend never shows NaN.

### Unit 2 — Molecular Structure
- **2.2 IMF (intramolecular)** — slider works, no graph loop-back, drag rotates molecule.
- **2.6 Resonance** — Ozone shows distinct partial charges on Oa/Ob/Oc.
- **2.7 VSEPR** — every shape selectable; bond-angle label matches geometry.

### Unit 3 — IMF & Properties
- **3.1 IMF** — H-bond network mode shows 4 H₂O at tetrahedral angles.
- **3.3 Phase** — Play/Pause/Reset/scrub all work; phase-jump buttons (Solid → Gas) snap correctly; speed slider 0.25–3 ×.
- **3.4 GasLaw** — PV = nRT holds across slider range.
- **3.7 BeerLambert** — 4 solutions tabbed; cuvette stack 1×–5× shifts A linearly until A > 1 (then bends).

### Unit 4 — Reactions
- **4.3 Stoichiometry** — switching reaction tabs never produces NaN bar heights.
- **4.4 Acid-Base** — neutralization goes to pH 7 for strong-strong.
- **4.5 Redox** — `◂ Prev` and `▸ Next step` both navigate balancing steps.

### Unit 5 — Kinetics
- **5.1 / 5.2 Rate Law** — dedup pointer for 5.2.
- **5.3 / 6.2 Energy Profile** — Ea labels read kJ/mol (not kJ).
- **5.4 / 5.6 Collision** — dedup pointer for 5.6.
- **5.5 Catalyst** — Ea drops on toggle; rate ratio updates.

### Unit 6 — Thermodynamics
- **6.1 Endo/Exo** — energy curve passes through peak without looping back.
- **6.3 Heat Transfer** — pointer to 6.4 (NOT a second full Calorimetry render).
- **6.4 Calorimetry**
  - Coffee-cup tab: H₂O is **not** in the material list; block sits inside the cup, water always visible.
  - Bomb tab: every fuel computes a sensible ΔH_combustion.
  - Mixing waters: T_f lies between T_hot and T_cold.
  - Phase change: heating curve has 2 plateaus.
- **6.5 Phase** — pointer to 3.3.
- **6.6 Enthalpy** — Hess's law sums correctly.

### Unit 7 — Equilibrium
- **7.1 / 7.2 Equilibrium** — dedup pointer for 7.2.
- **7.3 Le Châtelier** — every stress shifts in the right direction.
- **7.5 Common-Ion** — pointer to Buffer.

### Unit 8 — Acids & Bases
- **8.1 / 8.2 / 8.4 Titration**
  - **Curve continuity** (regression): NH₄⁺ titration starts at pH ≈ 5.13 and rises smoothly — no jump from pH 5 → pH 7 between V=0 and V=0.15 mL.
  - At V = ½V_eq: pH ≈ pKa for every weak acid.
  - At V_eq: HCl → 7, weak acids → > 7.
- **8.3 / 8.5 Buffer**
  - Chart aspect ratio is reasonable (no extreme horizontal stretch).
  - Buffered pH stays near pKa across many ±H⁺/±OH⁻ doses; pure-water comparator swings far.

### Unit 9 — Applications
- **9.1 Entropy** — mixing labels match colors (x_A is blue, x_B is red).
- **9.2 / 9.4 Gibbs** — dedup pointer for 9.4. ΔG sign flips at T = ΔH/ΔS.
- **9.5 Galvanic** — E°_cell = E°_cathode − E°_anode for every metal pair.

## 3 · Math regression suite (run via `npm test` once Vitest is added)

Located in `testing/unit/` — see `chemistry.test.ts`. Covers:
- Titration NH₄⁺ continuity at V = 0
- Buffer Henderson-Hasselbalch
- Calorimetry T_f mixing identity
- Stoichiometry limiting reagent

## 4 · Bug log

| Date | Animation | Symptom | Status |
|------|-----------|---------|--------|
| | | | |
