export type Topic = {
  id: string;
  title: string;
  blurb: string;
  animationKey?: AnimationKey;
};

export type Unit = {
  number: string;
  slug: string;
  title: string;
  subtitle: string;
  weight: string;
  hue: string;
  topics: Topic[];
};

export type AnimationKey =
  | 'orbital'
  | 'photoelectron'
  | 'periodic-trend'
  | 'lewis-resonance'
  | 'vsepr'
  | 'imf'
  | 'gas-law'
  | 'phase'
  | 'beer-lambert'
  | 'stoichiometry'
  | 'redox'
  | 'acid-base-neutralize'
  | 'collision'
  | 'rate-law'
  | 'energy-profile'
  | 'catalyst'
  | 'endo-exo'
  | 'enthalpy'
  | 'calorimetry'
  | 'equilibrium'
  | 'le-chatelier'
  | 'ph-titration'
  | 'buffer'
  | 'entropy'
  | 'gibbs'
  | 'galvanic'
  // Molecular Workbench imports — AP curriculum gaps
  | 'maxwell-boltzmann'
  | 'orbital-shapes'
  | 'bond-formation'
  | 'crystal-lattice'
  | 'dissolution'
  | 'vapor-pressure'
  | 'solubility-ksp';

export const UNITS: Unit[] = [
  {
    number: '01',
    slug: 'atomic-structure',
    title: 'Atomic Structure & Properties',
    subtitle: 'The architecture of matter, from the mole to the orbital.',
    weight: '7–9%',
    hue: '#4ea8ff',
    topics: [
      { id: '1.1', title: 'Moles & Molar Mass', blurb: 'Avogadro\'s constant and conversion between mass, moles and particles.' },
      { id: '1.2', title: 'Mass Spectroscopy', blurb: 'Determining isotopic abundance from mass spectra.' },
      { id: '1.3', title: 'Atomic Structure', blurb: 'The nucleus, electron clouds and isotopes.', animationKey: 'orbital-shapes' },
      { id: '1.4', title: 'Electron Configuration', blurb: 'Filling orbitals with the Aufbau, Pauli and Hund principles.', animationKey: 'orbital' },
      { id: '1.5', title: 'Photoelectron Spectroscopy', blurb: 'Probing electron energies with high-energy photons.', animationKey: 'photoelectron' },
      { id: '1.6', title: 'Periodic Trends', blurb: 'Atomic radius, ionization energy, electronegativity.', animationKey: 'periodic-trend' },
      { id: '1.7', title: 'Valence Electrons & Ionic Compounds', blurb: 'How outer-shell electrons drive ion formation.', animationKey: 'crystal-lattice' },
    ],
  },
  {
    number: '02',
    slug: 'molecular-structure',
    title: 'Molecular & Ionic Compound Structure',
    subtitle: 'Bonds, lattices, and the geometry of molecules.',
    weight: '7–9%',
    hue: '#a78bfa',
    topics: [
      { id: '2.1', title: 'Types of Chemical Bonds', blurb: 'Ionic, covalent and metallic bonding behaviors.', animationKey: 'bond-formation' },
      { id: '2.2', title: 'Intramolecular Force & Potential Energy', blurb: 'Lennard-Jones-like potential wells inside molecules — same shape, different magnitude than IMF.', animationKey: 'imf' },
      { id: '2.3', title: 'Structure of Ionic Solids', blurb: 'Coulombic attraction in extended lattices.', animationKey: 'crystal-lattice' },
      { id: '2.4', title: 'Metals & Alloys', blurb: 'Sea-of-electrons, substitutional and interstitial alloys.', animationKey: 'crystal-lattice' },
      { id: '2.5', title: 'Lewis Diagrams', blurb: 'Octet, expanded octet, lone pairs.' },
      { id: '2.6', title: 'Resonance & Formal Charge', blurb: 'Delocalized electrons and structure averaging.', animationKey: 'lewis-resonance' },
      { id: '2.7', title: 'VSEPR & Hybridization', blurb: 'Predicting 3D shape from electron domains.', animationKey: 'vsepr' },
    ],
  },
  {
    number: '03',
    slug: 'intermolecular-forces',
    title: 'Intermolecular Forces & Properties',
    subtitle: 'How molecules touch — gases, liquids, solids and solutions.',
    weight: '18–22%',
    hue: '#5dd0ff',
    topics: [
      { id: '3.1', title: 'Intermolecular Forces', blurb: 'LDF, dipole-dipole, hydrogen bonding hierarchies.', animationKey: 'imf' },
      { id: '3.2', title: 'Properties of Solids', blurb: 'Network covalent, molecular, ionic, metallic.', animationKey: 'crystal-lattice' },
      { id: '3.3', title: 'Solids, Liquids, Gases', blurb: 'Particle motion across phases.', animationKey: 'phase' },
      { id: '3.4', title: 'Ideal Gas Law', blurb: 'PV = nRT and the kinetic-molecular foundation.', animationKey: 'gas-law' },
      { id: '3.5', title: 'Kinetic Molecular Theory', blurb: 'Maxwell-Boltzmann distribution of speeds.', animationKey: 'maxwell-boltzmann' },
      { id: '3.6', title: 'Solutions & Mixtures', blurb: 'Dissolution, solubility, like-dissolves-like.', animationKey: 'dissolution' },
      { id: '3.7', title: 'Beer-Lambert Law', blurb: 'A = εbc — concentration from absorbance.', animationKey: 'beer-lambert' },
    ],
  },
  {
    number: '04',
    slug: 'chemical-reactions',
    title: 'Chemical Reactions',
    subtitle: 'Conservation, transformation, and the language of change.',
    weight: '7–9%',
    hue: '#69e36b',
    topics: [
      { id: '4.1', title: 'Types of Reactions', blurb: 'Synthesis, decomposition, combustion, displacement.' },
      { id: '4.2', title: 'Net Ionic Equations', blurb: 'Spectator ions and the real chemistry.' },
      { id: '4.3', title: 'Stoichiometry', blurb: 'Mole-mole conversions and limiting reagents.', animationKey: 'stoichiometry' },
      { id: '4.4', title: 'Acid-Base Reactions', blurb: 'Proton transfer in aqueous solutions.', animationKey: 'acid-base-neutralize' },
      { id: '4.5', title: 'Oxidation-Reduction', blurb: 'Electron transfer and oxidation states.', animationKey: 'redox' },
    ],
  },
  {
    number: '05',
    slug: 'kinetics',
    title: 'Kinetics',
    subtitle: 'Speed, mechanism, and the path of a reaction.',
    weight: '7–9%',
    hue: '#fbbf24',
    topics: [
      { id: '5.1', title: 'Reaction Rates', blurb: 'How concentration changes over time — measure initial slope.', animationKey: 'rate-law' },
      { id: '5.2', title: 'Rate Laws', blurb: 'Determining order from initial-rate experiments.', animationKey: 'rate-law' },
      { id: '5.3', title: 'Energy Profile', blurb: 'Activation energy and the transition state.', animationKey: 'energy-profile' },
      { id: '5.4', title: 'Collision Theory', blurb: 'Effective collisions: orientation + energy.', animationKey: 'collision' },
      { id: '5.5', title: 'Catalysts', blurb: 'Lowering activation energy without being consumed.', animationKey: 'catalyst' },
      { id: '5.6', title: 'Reaction Mechanisms', blurb: 'Elementary steps and the rate-determining step — collisions sum into a mechanism.', animationKey: 'collision' },
    ],
  },
  {
    number: '06',
    slug: 'thermodynamics',
    title: 'Thermodynamics',
    subtitle: 'Heat, work, and the energy of chemical change.',
    weight: '7–9%',
    hue: '#ff6b35',
    topics: [
      { id: '6.1', title: 'Endothermic & Exothermic', blurb: 'Energy flow in and out of a system.', animationKey: 'endo-exo' },
      { id: '6.2', title: 'Energy Diagrams', blurb: 'Visualizing potential energy across a reaction.', animationKey: 'energy-profile' },
      { id: '6.3', title: 'Heat Transfer & Thermal Equilibrium', blurb: 'When two systems reach the same T — heat flows from hot to cold until ΔT = 0.', animationKey: 'calorimetry' },
      { id: '6.4', title: 'Heat Capacity & Calorimetry', blurb: 'q = mcΔT and the bomb calorimeter.', animationKey: 'calorimetry' },
      { id: '6.5', title: 'Phase Change Energy', blurb: 'Latent heat at melting and boiling — heating curve plateaus at ΔH(fus) and ΔH(vap).', animationKey: 'phase' },
      { id: '6.7', title: 'Vapor Pressure', blurb: 'Liquid–vapor equilibrium and the Clausius–Clapeyron relation.', animationKey: 'vapor-pressure' },
      { id: '6.6', title: 'Enthalpy of Reaction', blurb: 'ΔH from bond energies and Hess\'s law.', animationKey: 'enthalpy' },
    ],
  },
  {
    number: '07',
    slug: 'equilibrium',
    title: 'Equilibrium',
    subtitle: 'The dynamic balance of forward and reverse.',
    weight: '7–9%',
    hue: '#f0abfc',
    topics: [
      { id: '7.1', title: 'Reaction Quotient & Equilibrium Constant', blurb: 'Q vs K — direction of shift.', animationKey: 'equilibrium' },
      { id: '7.2', title: 'ICE Tables', blurb: 'Initial-Change-Equilibrium concentration tracking — watch the bookkeeping live.', animationKey: 'equilibrium' },
      { id: '7.3', title: 'Le Châtelier\'s Principle', blurb: 'Stress and response in equilibrium systems.', animationKey: 'le-chatelier' },
      { id: '7.4', title: 'Solubility Equilibria', blurb: 'Ksp and the limits of dissolution.', animationKey: 'solubility-ksp' },
      { id: '7.5', title: 'Common-Ion Effect', blurb: 'Suppressing dissociation with a shared ion — buffers are the canonical case.', animationKey: 'buffer' },
    ],
  },
  {
    number: '08',
    slug: 'acids-bases',
    title: 'Acids & Bases',
    subtitle: 'Proton donors, acceptors, and the pH scale.',
    weight: '11–15%',
    hue: '#ff5b3c',
    topics: [
      { id: '8.1', title: 'pH & pOH', blurb: 'Logarithmic acidity — pH + pOH = 14 in water at 25 °C.', animationKey: 'acid-base-neutralize' },
      { id: '8.2', title: 'Strong vs Weak Acids', blurb: 'Complete vs partial dissociation — different titration curve shapes.', animationKey: 'ph-titration' },
      { id: '8.3', title: 'Buffers', blurb: 'Resisting pH change with conjugate pairs.', animationKey: 'buffer' },
      { id: '8.4', title: 'Acid-Base Titrations', blurb: 'Equivalence points and indicator selection.', animationKey: 'ph-titration' },
      { id: '8.5', title: 'pKa & Conjugate Strength', blurb: 'Stronger acid → weaker conjugate base — pKa governs the buffer hinge.', animationKey: 'buffer' },
    ],
  },
  {
    number: '09',
    slug: 'applications-thermo',
    title: 'Applications of Thermodynamics',
    subtitle: 'Entropy, free energy, and the cells that power us.',
    weight: '7–9%',
    hue: '#69e36b',
    topics: [
      { id: '9.1', title: 'Entropy', blurb: 'The arrow of disorder.', animationKey: 'entropy' },
      { id: '9.2', title: 'Gibbs Free Energy', blurb: 'ΔG = ΔH − TΔS — the spontaneity criterion.', animationKey: 'gibbs' },
      { id: '9.3', title: 'Thermodynamic vs Kinetic Control', blurb: 'When the slow product wins.' },
      { id: '9.4', title: 'Free Energy & Equilibrium', blurb: 'ΔG° = −RT ln K — same spontaneity criterion, expressed via K.', animationKey: 'gibbs' },
      { id: '9.5', title: 'Galvanic & Electrolytic Cells', blurb: 'Spontaneous and driven electron transfer.', animationKey: 'galvanic' },
    ],
  },
];
