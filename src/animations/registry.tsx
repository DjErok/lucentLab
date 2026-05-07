import type { AnimationKey } from '../data/curriculum';
import EndoExo from './EndoExo';
import AcidBase from './AcidBase';
import Collision from './Collision';
import Equilibrium from './Equilibrium';
import Orbital from './Orbital';
import IMF from './IMF';
import GasLaw from './GasLaw';
import Titration from './Titration';
import VSEPR from './VSEPR';
import Galvanic from './Galvanic';
import EnergyProfile from './EnergyProfile';
import BeerLambert from './BeerLambert';
import Gibbs from './Gibbs';
import PhaseChange from './PhaseChange';
import Stoichiometry from './Stoichiometry';
import PeriodicTrend from './PeriodicTrend';
import Buffer from './Buffer';
import Entropy from './Entropy';
import Redox from './Redox';
import RateLaw from './RateLaw';
import Calorimetry from './Calorimetry';
import Resonance from './Resonance';
import Enthalpy from './Enthalpy';
import PES from './PES';
import MaxwellBoltzmann from './MaxwellBoltzmann';
import OrbitalShapes from './OrbitalShapes';
import BondFormation from './BondFormation';
import CrystalLattice from './CrystalLattice';
import Dissolution from './Dissolution';
import VaporPressure from './VaporPressure';
import CatalystMechanism from './CatalystMechanism';
import SolubilityKsp from './SolubilityKsp';

type Meta = {
  key: AnimationKey;
  Component: React.ComponentType<any>;
  title: string;
  whatYouSee: string;
  whyItMatters: string;
  equation?: string;
  keyTerms: string[];
};

export const ANIMATIONS: Partial<Record<AnimationKey, Meta>> = {
  'orbital': {
    key: 'orbital',
    Component: Orbital,
    title: 'Electron Configuration & Orbitals',
    equation: '1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰ …',
    whatYouSee: 'A nucleus with electrons traveling along their shells. The right panel shows how electrons fill the subshells one at a time — fill the lowest-energy slot first (Aufbau), at most 2 per slot with opposite spins (Pauli), and one per slot before pairing (Hund).',
    whyItMatters: 'The way an element\'s electrons are arranged is its chemistry "fingerprint." It explains how the element bonds, where it sits on the periodic table, and what colors it produces.',
    keyTerms: ['Aufbau', 'Pauli', 'Hund', 'subshell', 'spin'],
  },
  'periodic-trend': {
    key: 'periodic-trend',
    Component: PeriodicTrend,
    title: 'Periodic Trends',
    whatYouSee: 'A live mini periodic table where each cell\'s glow grows or shrinks with the trend you pick (atomic radius, ionization energy, electronegativity, electron affinity). Hover any element to see the exact value.',
    whyItMatters: 'Most "explain why" questions on the AP exam come down to a periodic trend. Once you can see fluorine glowing brightest for electronegativity and cesium glowing dimmest for ionization energy, the patterns stop being abstract.',
    keyTerms: ['effective nuclear charge', 'shielding', 'periodicity'],
  },
  'photoelectron': {
    key: 'photoelectron',
    Component: PES,
    title: 'Photoelectron Spectroscopy',
    equation: 'binding energy = photon energy − kinetic energy of ejected electron',
    whatYouSee: 'A simulated PES spectrum for the element you choose. Each peak\'s position is the binding energy of an electron, and each peak\'s height is the number of electrons in that subshell.',
    whyItMatters: 'PES is the experimental proof of orbital theory. Reading these peaks is a guaranteed exam skill — bigger peak = more electrons; further left = closer to the nucleus.',
    keyTerms: ['binding energy', 'subshell', 'spectrum'],
  },
  'lewis-resonance': {
    key: 'lewis-resonance',
    Component: Resonance,
    title: 'Resonance & Formal Charge',
    whatYouSee: 'Multiple equivalent Lewis structures for nitrate (NO₃⁻) or ozone (O₃). The double bond hops to a different position with each form. The real molecule is the average — every bond is identical.',
    whyItMatters: 'Lots of molecules can\'t be drawn correctly with one Lewis structure. Resonance explains why all three N–O bonds in NO₃⁻ are the same length, and why benzene is so stable.',
    keyTerms: ['resonance hybrid', 'delocalization', 'bond order'],
  },
  'vsepr': {
    key: 'vsepr',
    Component: VSEPR,
    title: 'VSEPR & Molecular Geometry',
    whatYouSee: 'A real 3-D molecule you can drag and zoom. Pick any cell from the chart (rows = total electron groups, columns = lone pairs) — the example molecule rotates with all its bond angles labeled and electrons shown.',
    whyItMatters: 'Shape decides polarity, intermolecular forces, and reactivity. VSEPR turns a flat Lewis dot drawing into a real 3-D prediction.',
    keyTerms: ['electron domains', 'hybridization', 'lone pair', 'bond angle'],
  },
  'imf': {
    key: 'imf',
    Component: IMF,
    title: 'Intermolecular Forces',
    whatYouSee: 'Three side-by-side scenes: London dispersion (instantaneous dipoles flicker), dipole-dipole (permanent partial charges line up), and hydrogen bonding (the strongest of the three; needs H bonded to N, O, or F).',
    whyItMatters: 'IMFs decide boiling points, viscosity, and solubility. They\'re the reason water boils at 100 °C while methane (similar mass) boils at –161 °C.',
    keyTerms: ['London dispersion', 'dipole-dipole', 'hydrogen bond'],
  },
  'phase': {
    key: 'phase',
    Component: PhaseChange,
    title: 'Phase Changes',
    equation: 'q = m·c·ΔT (warming)   ·   q = m·L (phase change)',
    whatYouSee: 'A box of particles transitioning solid → liquid → gas, paired with a heating curve. Two flat plateaus appear: one at the melting point, one at the boiling point — the temperature stops rising while the heat goes into breaking IMFs.',
    whyItMatters: 'Heating-curve calculations always show up on the exam. The flat plateaus are where most students slip.',
    keyTerms: ['heat of fusion', 'heat of vaporization', 'plateau'],
  },
  'gas-law': {
    key: 'gas-law',
    Component: GasLaw,
    title: 'Ideal Gas Law',
    equation: 'PV = nRT     (R = 0.08206 L·atm·mol⁻¹·K⁻¹)',
    whatYouSee: 'A piston with gas particles. Drag T, n, or V — pressure responds in real time and the particles speed up or slow down with temperature.',
    whyItMatters: 'PV = nRT is the most-used equation in Unit 3. The interactive lets you build a feel for which variables push P up vs down.',
    keyTerms: ['STP', 'KMT', 'partial pressure'],
  },
  'beer-lambert': {
    key: 'beer-lambert',
    Component: BeerLambert,
    title: 'Beer-Lambert Law',
    equation: 'A = ε · b · c',
    whatYouSee: 'A spectrometer beam passing through a cuvette. The solution darkens as you raise the concentration; the detector reads the resulting transmittance and absorbance.',
    whyItMatters: 'This is how concentration is measured in lab without destroying the sample. Linearity in c is the basis of every calibration curve.',
    keyTerms: ['molar absorptivity', 'transmittance', 'calibration curve'],
  },
  'stoichiometry': {
    key: 'stoichiometry',
    Component: Stoichiometry,
    title: 'Stoichiometry & Limiting Reagent',
    equation: '2 H₂ + O₂ → 2 H₂O',
    whatYouSee: 'A flask of H₂ and O₂ molecules turning into water. Adjust the starting amounts: whichever reactant runs out first is the limiting reagent — it sets how much product can form.',
    whyItMatters: 'Limiting-reagent problems are guaranteed exam material. Watching molecules pair up by ratio prevents the most common mistake (using the wrong reactant in the calculation).',
    keyTerms: ['mole ratio', 'limiting reagent', 'theoretical yield'],
  },
  'acid-base-neutralize': {
    key: 'acid-base-neutralize',
    Component: AcidBase,
    title: 'Acid-Base Neutralization',
    equation: 'HCl(aq) + NaOH(aq) → NaCl(aq) + H₂O(l)',
    whatYouSee: 'H⁺ from the acid migrates to OH⁻ from the base — they combine to make water. Na⁺ and Cl⁻ are spectator ions; they never combine. The pH meter slides from 1 → 7 as proton transfer completes.',
    whyItMatters: 'Net ionic equations and pH appear all over Units 4 and 8. Watching the protons move makes the math feel concrete.',
    keyTerms: ['Brønsted-Lowry', 'spectator ion', 'net ionic equation'],
  },
  'redox': {
    key: 'redox',
    Component: Redox,
    title: 'Oxidation–Reduction',
    equation: 'Zn + Cu²⁺ → Zn²⁺ + Cu',
    whatYouSee: 'Two electrons hop from Zn to Cu²⁺. Zn loses 2 electrons (oxidized; oxidation state goes 0 → +2) and Cu²⁺ gains them (reduced; oxidation state goes +2 → 0).',
    whyItMatters: 'Redox is the basis of corrosion, batteries, biology, and Unit 9. Memorize "OIL RIG" — Oxidation Is Loss, Reduction Is Gain.',
    keyTerms: ['oxidation state', 'reductant', 'oxidant', 'OIL RIG'],
  },
  'rate-law': {
    key: 'rate-law',
    Component: RateLaw,
    title: 'Rate Laws · Method of Initial Rates',
    equation: 'rate = k [A]ᵐ [B]ⁿ',
    whatYouSee: 'A 3-trial table of initial concentrations and rates. Drag a slider and watch the rate respond. The order in A and the order in B are derived live from the data.',
    whyItMatters: 'Determining a rate law from data is a Unit 5 staple. The trick is to compare two trials where only one concentration changes.',
    keyTerms: ['reaction order', 'rate constant', 'initial rates'],
  },
  'energy-profile': {
    key: 'energy-profile',
    Component: EnergyProfile,
    title: 'Reaction Energy Profile',
    equation: 'k = A · e^(−Ea / RT)',
    whatYouSee: 'A potential-energy curve traced by a marble. Toggle the catalyst — the activation-energy peak drops, but ΔH stays the same.',
    whyItMatters: 'Catalysts speed reactions without being consumed and without changing ΔH. Even a small drop in Eₐ creates a huge increase in k.',
    keyTerms: ['activation energy', 'transition state', 'catalyst', 'Arrhenius'],
  },
  'collision': {
    key: 'collision',
    Component: Collision,
    title: 'Collision Theory & Maxwell-Boltzmann',
    whatYouSee: 'A box of gas particles bouncing elastically. The histogram on the right tracks the distribution of speeds. Crank the temperature — the distribution broadens and shifts right.',
    whyItMatters: 'Reaction rates depend on (a) how often particles collide and (b) the fraction with enough energy to react. Watching the M-B distribution evolve makes that fraction tangible.',
    keyTerms: ['Maxwell-Boltzmann', 'collision frequency', 'effective collision'],
  },
  'catalyst': {
    key: 'catalyst',
    Component: CatalystMechanism,
    title: 'Catalyst Mechanism',
    equation: 'k_cat / k_uncat = e^((Ea_uncat − Ea_cat) / RT)',
    whatYouSee: 'Two side-by-side reactors at the same temperature. The uncatalyzed box (A + B → AB) has one tall barrier; the catalyzed box adds a homogeneous catalyst K and replaces the single hump with three smaller steps (A+K, AK+B, ABK→AB+K). Catalyst K count is conserved; product count climbs much faster on the catalyzed side.',
    whyItMatters: 'Catalysts power industry (Haber-Bosch, catalytic converters) and biology (enzymes). Remember: only kinetics changes; thermodynamics is untouched.',
    keyTerms: ['homogeneous', 'heterogeneous', 'enzyme', 'turnover', 'mechanism'],
  },
  'endo-exo': {
    key: 'endo-exo',
    Component: EndoExo,
    title: 'Endothermic vs Exothermic',
    equation: 'Exothermic: ΔH < 0   ·   Endothermic: ΔH > 0',
    whatYouSee: 'Two synchronized panels: molecules collide, bonds break, new bonds form, and a marble traces the same reaction along its energy diagram. Toggle exo vs endo to see the diagram flip.',
    whyItMatters: 'The sign of ΔH is the cornerstone of Unit 6. Watching bonds break (energy IN) and form (energy OUT) makes the calculation intuitive.',
    keyTerms: ['ΔH', 'system vs surroundings', 'transition state', 'activation energy'],
  },
  'enthalpy': {
    key: 'enthalpy',
    Component: Enthalpy,
    title: 'Enthalpy from Bond Energies',
    equation: 'ΔH ≈ Σ(bonds broken) − Σ(bonds formed)',
    whatYouSee: 'Bond energies tallied step by step. Step 1: count up energy needed to break the reactant bonds (positive). Step 2: count up energy released when product bonds form (negative). The difference is ΔH.',
    whyItMatters: 'Hess\'s law and bond-energy ΔH problems appear every year on the AP exam.',
    keyTerms: ['bond energy', 'Hess\'s law', 'standard enthalpy of formation'],
  },
  'calorimetry': {
    key: 'calorimetry',
    Component: Calorimetry,
    title: 'Calorimetry',
    equation: 'q = m · c · ΔT     ·     q_metal + q_water = 0',
    whatYouSee: 'A coffee-cup calorimeter. Drop a hot copper block into water; drag the masses and starting temps to compute the final equilibrium temperature.',
    whyItMatters: 'The whole basis of measuring ΔH experimentally. Always remember: heat lost by hot object = heat gained by water.',
    keyTerms: ['specific heat', 'thermal equilibrium', 'q'],
  },
  'equilibrium': {
    key: 'equilibrium',
    Component: Equilibrium,
    title: 'Dynamic Equilibrium',
    equation: 'K = [products]^coef / [reactants]^coef',
    whatYouSee: 'A vessel of N₂O₄ molecules splitting into NO₂ and recombining. The graph tracks both species over time — they level off at constant ratios. Both forward and reverse reactions are still running ("dynamic" equilibrium).',
    whyItMatters: 'Equilibrium isn\'t the absence of reaction — it\'s when forward rate = reverse rate. Use the buttons to push the system and watch Le Châtelier kick in.',
    keyTerms: ['Kc', 'Q', 'forward rate', 'reverse rate'],
  },
  'le-chatelier': {
    key: 'le-chatelier',
    Component: Equilibrium,
    title: 'Le Châtelier\'s Principle',
    whatYouSee: 'Use the buttons in the equilibrium scene to add NO₂ or apply heat. The system shifts toward the side that consumes the stress.',
    whyItMatters: 'Predicting shift direction from a stress (concentration, T, P) is core Unit 7 free-response material.',
    keyTerms: ['stress', 'shift', 'temperature dependence'],
  },
  'ph-titration': {
    key: 'ph-titration',
    Component: Titration,
    title: 'Strong Acid Titration',
    equation: 'mol acid = mol base   at equivalence',
    whatYouSee: 'A burette of NaOH dripping into a flask of HCl. The pH curve plots in real time — there\'s a steep jump precisely at the equivalence point. Use the speed slider to slow it down.',
    whyItMatters: 'Titration curves appear on every Unit 8 free-response. The shape and the location of the equivalence point reveal whether the acid is strong or weak.',
    keyTerms: ['equivalence point', 'half-equivalence', 'indicator'],
  },
  'buffer': {
    key: 'buffer',
    Component: Buffer,
    title: 'How a Buffer Works',
    equation: 'pH = pKa + log([A⁻] / [HA])     ·    Henderson-Hasselbalch',
    whatYouSee: 'Particles of acetic acid (HA) and acetate (A⁻) bouncing in solution. Click "+ add strong acid" — H⁺ ions appear and immediately get neutralized by A⁻ (forming HA). Click "+ add strong base" — OH⁻ ions appear and get neutralized by HA (forming A⁻ + water). The pH graph hardly moves.',
    whyItMatters: 'Buffers are why your blood stays at pH 7.4. Watching the H⁺ ions get gobbled up by acetate makes Henderson-Hasselbalch click.',
    keyTerms: ['conjugate pair', 'Henderson-Hasselbalch', 'buffer capacity', 'pKa'],
  },
  'entropy': {
    key: 'entropy',
    Component: Entropy,
    title: 'Entropy',
    equation: 'S = k · ln(W)     ·     ΔS_universe > 0 (2nd Law)',
    whatYouSee: 'A box of particles confined to one half. Click "remove partition" — they spread out spontaneously into the full volume. The number of available arrangements (microstates W) explodes.',
    whyItMatters: 'The 2nd Law is one of the strongest statements in physics: things naturally spread out. This is the foundation of Unit 9.',
    keyTerms: ['microstate', '2nd Law', 'positional entropy', 'spontaneous'],
  },
  'gibbs': {
    key: 'gibbs',
    Component: Gibbs,
    title: 'Gibbs Free Energy',
    equation: 'ΔG = ΔH − T·ΔS',
    whatYouSee: 'Three sliders for ΔH, ΔS, and T. The point lands in one of four quadrants that summarize spontaneity. The verdict (spontaneous / non-spontaneous) updates instantly.',
    whyItMatters: 'ΔG predicts spontaneity. Building intuition for the four quadrants makes Unit 9 free-response easy.',
    keyTerms: ['spontaneity', 'standard ΔG°', 'temperature dependence'],
  },
  'galvanic': {
    key: 'galvanic',
    Component: Galvanic,
    title: 'Galvanic (Voltaic) Cells',
    equation: 'E°cell = E°cathode − E°anode',
    whatYouSee: 'A Zn/Cu²⁺ cell with a salt bridge. Electrons flow through the wire from anode (Zn) to cathode (Cu); K⁺ and NO₃⁻ migrate through the salt bridge to keep each beaker neutral. Use the tabs to ZOOM IN on either electrode and watch the actual oxidation or reduction at the particulate level. Speed slider lets you slow it down.',
    whyItMatters: 'Cell notation, half-reactions, and E°cell are guaranteed Unit 9 material. Watching the electron flow makes the abstract diagram concrete.',
    keyTerms: ['anode (oxidation)', 'cathode (reduction)', 'salt bridge', 'reduction potential'],
  },
  'maxwell-boltzmann': {
    key: 'maxwell-boltzmann',
    Component: MaxwellBoltzmann,
    title: 'Maxwell–Boltzmann Speed Distribution',
    equation: 'f(v) = 4π · n · (m / 2πkT)^(3/2) · v² · e^(−mv²/2kT)',
    whatYouSee: 'A box of N=80 particles colliding elastically. The histogram on the right is their live speed distribution. Crank the temperature — peak shifts right and broadens; pick a heavier gas — peak shifts left.',
    whyItMatters: 'The shape of f(v) is the foundation of kinetic-molecular theory and explains why heavy gases diffuse slowly, why hot gases react faster, and why effusion follows Graham\'s law.',
    keyTerms: ['v_p', 'v_avg', 'v_rms', 'KMT', 'Graham\'s law'],
  },
  'orbital-shapes': {
    key: 'orbital-shapes',
    Component: OrbitalShapes,
    title: 'Atomic Orbital Shapes',
    equation: '|ψ_{n,l,m}|² · point cloud sampling',
    whatYouSee: 'A live |ψ|² point cloud for hydrogenic orbitals (1s, 2s, 2p, 3p, 3d_{z²}, 3d_{x²−y²}). Drag to rotate the camera. Blue lobes are the positive sign of the wavefunction; orange lobes are the negative sign — for s-orbitals the sign only changes at radial nodes.',
    whyItMatters: 'Orbital shape determines bond geometry, π vs σ overlap, and crystal-field splitting. Seeing the dumbbells and donuts makes hybridization concrete.',
    keyTerms: ['quantum numbers', 'nodes', 'lobes', 'parity'],
  },
  'bond-formation': {
    key: 'bond-formation',
    Component: BondFormation,
    title: 'Quantum Origin of the Covalent Bond',
    equation: 'V(r) = D_e · [1 − e^{−a(r − r_e)}]² − D_e',
    whatYouSee: 'Two H atoms whose distance r you control with a slider. Below the atoms, the Morse potential energy curve plots V vs r with a live marker. As you bring them together, the orbitals overlap (yellow σ glow) and the energy plunges into the bond well at r_e ≈ 0.74 Å; squeeze closer and Pauli repulsion sends V back up.',
    whyItMatters: 'Every covalent bond is a balance between attractive overlap and Pauli repulsion. The bottom of the well is the bond length; the depth is the bond energy.',
    keyTerms: ['Morse potential', 'bond length', 'bond energy', 'σ bond', 'Pauli repulsion'],
  },
  'crystal-lattice': {
    key: 'crystal-lattice',
    Component: CrystalLattice,
    title: 'Crystal Lattices · Solid Types',
    whatYouSee: 'Tabs for the four canonical solids — ionic (NaCl rock-salt), molecular (I₂ dumbbells), metallic (Cu cation cores in a sea of delocalised electrons), and network covalent (diamond-like sp³ network). Each panel lists the bonding type, melting-point range, conductivity, and hardness.',
    whyItMatters: 'AP loves "given these properties, what type of solid?" questions. The four 2D projections show why ionic is hard but brittle, metallic is malleable, and diamond melts above 1500 °C.',
    keyTerms: ['ionic', 'molecular', 'metallic', 'network covalent', 'lattice energy'],
  },
  'dissolution': {
    key: 'dissolution',
    Component: Dissolution,
    title: 'Dissolving Salt · Hydration Shell',
    equation: 'NaCl(s) + H₂O → Na⁺(aq) + Cl⁻(aq)',
    whatYouSee: 'A NaCl crystal with 60 explicit water molecules drawn as bent triangles (red O, orange H). Hit "dissolve" — water dipoles re-orient (O end toward Na⁺, H end toward Cl⁻), edge ions peel off with a ~6-water hydration shell, and drift into the bulk.',
    whyItMatters: 'Dissolution is a competition: lattice energy (holding the crystal together) vs ion–dipole attraction (pulling ions apart). Watching the dipoles snap into shells makes "like dissolves like" tangible.',
    keyTerms: ['lattice energy', 'ion–dipole', 'hydration shell', 'solvation'],
  },
  'vapor-pressure': {
    key: 'vapor-pressure',
    Component: VaporPressure,
    title: 'Vapor Pressure',
    equation: 'ln P = − ΔH_vap / R · 1/T + C   (Clausius–Clapeyron)',
    whatYouSee: 'A sealed container, half-full of liquid. Molecules with KE above the escape threshold leave the surface; vapor molecules that hit the liquid with low KE re-condense. Drag the temperature slider — the equilibrium vapor pressure climbs exponentially.',
    whyItMatters: 'Vapor pressure explains boiling points, distillation, and atmospheric humidity. The Clausius–Clapeyron equation lets you predict P(T) from ΔH_vap.',
    keyTerms: ['evaporation', 'condensation', 'ΔH_vap', 'boiling point', 'Clausius–Clapeyron'],
  },
  'solubility-ksp': {
    key: 'solubility-ksp',
    Component: SolubilityKsp,
    title: 'Solubility · K_sp',
    equation: 'K_sp = [M]^a · [X]^b   ·   compare to Q',
    whatYouSee: 'Pick a sparingly-soluble salt (AgCl, CaF₂, PbI₂, BaSO₄). Drag the log-concentration sliders for cation and anion — the reaction quotient Q updates live. The verdict box turns blue (undersaturated, more dissolves), green (saturated, dynamic equilibrium), or red (supersaturated, precipitate).',
    whyItMatters: 'Q vs K_sp is the entire toolkit for AP solubility-equilibrium free-response: predicting precipitation, common-ion effect, selective precipitation.',
    keyTerms: ['K_sp', 'Q', 'molar solubility', 'common-ion effect', 'precipitation'],
  },
};
