// src/i18n/locales/data/he.pnl2.js
// Hebrew data text for the final sweep (area pnl2). Keys are the ones gameText.js / dataText() look up.
// mapfx.<techId>: the line a tech adds to the research sheet ("Armies see one tile further"), from
// src/data/techMapEffects.js. A leading plus or minus sign sits in a left-to-right isolate.
const SIGHT = 'צבאות רואים אריח אחד רחוק יותר';
const SUPPLY_LINES = 'קווי האספקה מגיעים שני אריחים רחוק יותר';
const CULTURE_CLAIM = 'אריחים עולים 10% פחות תרבות לתביעה';
const FLEETS = 'צי מפליג אריח אחד רחוק יותר בתור';
const ROADS_FASTER = 'כבישים נחצים מהר יותר';
const BORDER_RING = 'הגבולות יכולים להגיע טבעת אחת רחוק יותר';
const GOVERNOR = 'מושל פורש שתי טבעות נוספות';
const STACKS = 'ערימות מכילות שתי יחידות נוספות';

export default {
  'mapfx.military_bronze_casting': SIGHT,
  'mapfx.military_composite_bow': 'גבעות לא עולות תנועה נוספת',
  'mapfx.military_feudal_levies': STACKS,
  'mapfx.military_plate_armor': 'מד האספקה ⁦+20⁩',
  'mapfx.military_standing_armies': SUPPLY_LINES,
  'mapfx.military_mechanized_warfare': 'כבישים בשליש מהעלות; צבאות יבשה נעים שני אריחים יותר בתור',
  'mapfx.economy_granary_storage': 'רבע מהמזון נשאר כשעיר גדלה',
  'mapfx.economy_silk_road_trade': CULTURE_CLAIM,
  'mapfx.economy_banking_houses': FLEETS,
  'mapfx.economy_joint_stock_companies': FLEETS,
  'mapfx.economy_colonial_trade': 'אפשר להפליג באוקיינוס הפתוח',
  'mapfx.infrastructure_mudbrick_roads': SIGHT,
  'mapfx.infrastructure_paved_roads': ROADS_FASTER,
  'mapfx.infrastructure_postal_relay': SUPPLY_LINES,
  'mapfx.infrastructure_turnpike_roads': ROADS_FASTER,
  'mapfx.infrastructure_highway_systems': 'הרים עולים שתי נקודות תנועה פחות, גבעות כלום',
  'mapfx.governance_scribal_bureaucracy': 'תביעות מגיעות אריח אחד רחוק יותר',
  'mapfx.governance_provincial_administration': BORDER_RING,
  'mapfx.governance_royal_chancery': GOVERNOR,
  'mapfx.governance_bureaucratic_reform': CULTURE_CLAIM,
  'mapfx.governance_civil_service': GOVERNOR,
  'mapfx.science_cuneiform_records': CULTURE_CLAIM,
  'mapfx.science_early_astronomy': FLEETS,
  'mapfx.science_geometry': BORDER_RING,
  'mapfx.science_natural_philosophy': 'הרים עולים נקודת תנועה אחת פחות',
  'mapfx.science_optics': 'צבאות וצי רואים אריח אחד רחוק יותר',
  'mapfx.science_scientific_method': 'חצי מהמזון נשאר כשעיר גדלה',
  'mapfx.science_calculus': FLEETS,
  'mapfx.science_computing': 'כל מה שבטווח הראייה מגיע אריח אחד רחוק יותר',
  'mapfx.science_genomics': STACKS
};
