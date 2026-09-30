// src/data/effectRegistry.js
// Maps every action type (the string passed to EffectsContext's triggerEffect) to the choreography
// that animates it — a `scene` from src/effects/scenes/ — plus its two-tone palette (base -> hot)
// and the scene's options. The old model had two generic primitives (`arc`: something flies from
// A to B and explodes; `pulse`: rings and a glyph on one region) shared by ~70 actions, so building
// a granary, researching a tech and changing a law all looked alike. Each scene now acts out what
// its action actually is: recruits march into ranks under a banner, a building rises out of its
// scaffolding, roads unroll toward the real neighbouring provinces, caravans shuttle coins along a
// trade route, a wax seal stamps a decree, a rocket puts a satellite into orbit...
//
// The same scene code drives both the 3D globe and the flat map (src/effects/EffectsLayer.jsx).

const P = (base, hot) => ({ base, hot });

export const EFFECT_REGISTRY = {
  // ---- strikes: ballistic munitions arcing into a detonation ----
  missile_strike: {
    scene: 'strike', palette: P('#f87171', '#fee2e2'), head: 'warhead', archPow: 1, ease: 'accelerate',
    trailWidth: 3.2, fireball: 1, rings: 3, debris: 12,
    projectiles: [{ lateral: 0, loft: 1, delay: 0, scale: 1, spread: 0 }]
  },
  air_strike: {
    scene: 'strike', palette: P('#fb923c', '#fef3c7'), head: 'dart', archPow: 0.7, ease: 'accelerate',
    trailWidth: 2.4, fireball: 0.85, rings: 2, debris: 10,
    projectiles: [
      { lateral: -0.62, loft: 0.6, delay: 0, scale: 0.85, spread: -1 },
      { lateral: 0.04, loft: 0.82, delay: 125, scale: 1, spread: 0.3 },
      { lateral: 0.66, loft: 0.58, delay: 250, scale: 0.85, spread: 1 }
    ]
  },
  asat_strike: {
    scene: 'strike', palette: P('#a855f7', '#f3e8ff'), head: 'dart', archPow: 1.4, ease: 'accelerate',
    trailWidth: 2.2, fireball: 0.45, rings: 2, debris: 14,
    projectiles: [{ lateral: 0, loft: 1.4, delay: 0, scale: 0.8, spread: 0 }]
  },

  // ---- war & armies ----
  declare_war: { scene: 'declareWar', palette: P('#dc2626', '#fecaca') },
  ground_invasion: { scene: 'march', palette: P('#60a5fa', '#dbeafe'), clash: true, count: 5 },
  amphibious_assault: { scene: 'march', palette: P('#22d3ee', '#ecfeff'), clash: true, boats: true, count: 4 },
  move_army: { scene: 'march', palette: P('#4ade80', '#ecfdf5'), count: 3 },
  naval_engagement: { scene: 'navalBattle', palette: P('#1d4ed8', '#bfdbfe') },
  recruit_unit: { scene: 'muster', palette: P('#22c55e', '#dcfce7') },
  disband_unit: { scene: 'disband', palette: P('#f87171', '#fef2f2') },
  promote_unit: { scene: 'promotion', palette: P('#fbbf24', '#fffbeb'), icon: 'rank', label: 'Promoted!' },
  hire_general: { scene: 'promotion', palette: P('#38bdf8', '#e0f2fe'), icon: 'medal', label: 'General hired' },
  appoint_general: { scene: 'promotion', palette: P('#0ea5e9', '#e0f2fe'), icon: 'swords', label: 'General takes command' },
  hire_advisor: { scene: 'promotion', palette: P('#a78bfa', '#ede9fe'), icon: 'quill', label: 'Advisor hired' },
  marry_noble: { scene: 'promotion', palette: P('#ec4899', '#fce7f3'), icon: 'heart', label: 'Royal wedding' },
  adopt_heir: { scene: 'promotion', palette: P('#38bdf8', '#e0f2fe'), icon: 'crown', label: 'Heir named' },
  suppress_rebellion: { scene: 'suppress', palette: P('#f87171', '#fef2f2') },
  embark_unit: { scene: 'march', palette: P('#22d3ee', '#ecfeff'), boats: true, count: 3 },
  disembark_unit: { scene: 'march', palette: P('#2dd4bf', '#f0fdfa'), count: 3 },

  // ---- building up a province ----
  construct_building: { scene: 'construct', palette: P('#f59e0b', '#fef3c7') },
  start_great_project: { scene: 'construct', palette: P('#facc15', '#fffbeb'), grand: true, iconKey: 'castle', label: 'Great project begun' },
  upgrade_great_project: { scene: 'construct', palette: P('#eab308', '#fef9c3'), grand: true, iconKey: 'castle', label: 'Great project upgraded' },
  build_climate_resilience: { scene: 'construct', palette: P('#34d399', '#ecfdf5'), iconKey: 'tree', label: 'Climate defenses built' },
  build_defenses: { scene: 'fortify', palette: P('#94a3b8', '#f1f5f9'), label: 'Walls raised' },
  build_abm_defense: { scene: 'fortify', palette: P('#38bdf8', '#e0f2fe'), dome: true, label: 'ABM shield online' },
  build_infrastructure: { scene: 'roads', palette: P('#38bdf8', '#e0f2fe') },
  develop_resource_site: { scene: 'mine', palette: P('#fb923c', '#ffedd5') },
  develop_province: { scene: 'develop', palette: P('#22c55e', '#dcfce7') },
  population_policy: { scene: 'growth', palette: P('#4ade80', '#f0fdf4') },
  settle_colonize: { scene: 'growth', palette: P('#fbbf24', '#fef9c3'), flag: true, label: 'Land settled' },
  gain_control: { scene: 'claim', palette: P('#60a5fa', '#dbeafe') },
  move_capital: { scene: 'claim', palette: P('#f59e0b', '#fef3c7'), crown: true, label: 'New capital' },
  declare_independence: { scene: 'claim', palette: P('#dc2626', '#fee2e2'), chains: true, label: 'Independence!' },
  seize_land: { scene: 'claim', palette: P('#b45309', '#fef3c7'), pull: true, label: 'Crown land seized' },
  sell_land: { scene: 'claim', palette: P('#a16207', '#fef9c3'), coins: true, label: 'Crown land sold' },
  quell_unrest: { scene: 'order', palette: P('#fb7185', '#fff1f2') },
  increase_stability: { scene: 'order', palette: P('#60a5fa', '#dbeafe'), scales: true, label: 'Stability rises' },

  // ---- statecraft from the capital ----
  research_tech: { scene: 'knowledge', palette: P('#a78bfa', '#ede9fe') },
  fund_scholars: { scene: 'knowledge', palette: P('#818cf8', '#eef2ff'), coins: true, label: 'Scholars funded' },
  set_research_focus: { scene: 'knowledge', palette: P('#a78bfa', '#ede9fe'), focus: true, label: 'Research focused' },
  change_law: { scene: 'decree', palette: P('#94a3b8', '#f1f5f9'), label: 'Law enacted' },
  enact_government_reform: { scene: 'decree', palette: P('#c084fc', '#f3e8ff'), label: 'Reform enacted' },
  change_government_type: { scene: 'decree', palette: P('#818cf8', '#e0e7ff'), throne: true, label: 'New government' },
  shift_identity: { scene: 'decree', palette: P('#c084fc', '#f3e8ff'), scales: true, label: 'Identity shifts' },
  grant_estate_privilege: { scene: 'decree', palette: P('#7c3aed', '#ede9fe'), label: 'Privilege granted' },
  revoke_estate_privilege: { scene: 'decree', palette: P('#64748b', '#f1f5f9'), crack: true, label: 'Privilege revoked' },
  set_tax_rate: { scene: 'treasury', palette: P('#facc15', '#fef9c3'), label: 'Taxes adjusted' },
  clergy_tithe: { scene: 'treasury', palette: P('#eab308', '#fef9c3'), label: 'Tithe collected' },
  nobility_levies: { scene: 'treasury', palette: P('#dc2626', '#fee2e2'), figures: true, label: 'Levies raised' },

  // ---- diplomacy between capitals ----
  sue_for_peace: { scene: 'envoy', palette: P('#84cc16', '#ecfccb'), dove: true, label: 'Peace offered' },
  trade_agreement: { scene: 'tradeRoute', palette: P('#fbbf24', '#fffbeb') },
  gift_bribe: { scene: 'gift', palette: P('#eab308', '#fef9c3') },
  fabricate_claim: { scene: 'claimLine', palette: P('#f59e0b', '#fef3c7') },
  espionage: { scene: 'espionage', palette: P('#64748b', '#e2e8f0') },
  counter_intelligence: { scene: 'counterIntel', palette: P('#0ea5e9', '#e0f2fe') },
  military_alliance: { scene: 'pact', palette: P('#6366f1', '#e0e7ff'), emblem: 'shield', union: 'handshake', label: 'Alliance formed' },
  propose_marriage: { scene: 'pact', palette: P('#ec4899', '#fce7f3'), emblem: 'heart', union: 'ring', label: 'Royal marriage' },
  break_alliance: { scene: 'rupture', palette: P('#ef4444', '#fee2e2'), label: 'Alliance broken' },
  release_vassal: { scene: 'rupture', palette: P('#a78bfa', '#f5f3ff'), label: 'Vassal released' },
  insult: { scene: 'hostility', palette: P('#dc2626', '#fecaca'), insult: true },
  rival_nation: { scene: 'hostility', palette: P('#f97316', '#ffedd5') },
  assign_diplomat: { scene: 'envoy', palette: P('#0ea5e9', '#e0f2fe'), label: 'Diplomat assigned' },
  vassalize: { scene: 'vassalize', palette: P('#7c3aed', '#ede9fe') },

  // ---- space & spectacle ----
  launch_satellite: { scene: 'launch', palette: P('#22d3ee', '#ecfeff') },
  launch_mission: { scene: 'launch', palette: P('#facc15', '#fffbeb'), mission: true },
  build_missile: { scene: 'silo', palette: P('#f97316', '#fff7ed') },
  cultural_export: { scene: 'culture', palette: P('#f472b6', '#fce7f3') },
  // Age Advance (plan §10.5's "showpiece") — App.jsx's GameLayout triggers this on the player's
  // capital when state.age changes turn over turn.
  age_advance: { scene: 'ageAdvance', palette: P('#facc15', '#fffde7') }
};

const DEFAULT_EFFECT_TYPE = 'missile_strike';

export const getEffectSpec = (actionType) => EFFECT_REGISTRY[actionType] || EFFECT_REGISTRY[DEFAULT_EFFECT_TYPE];
