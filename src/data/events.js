// src/data/events.js
// Historical events spanning 1870-2150

import { GamePhases } from './types';

export const HISTORICAL_EVENTS = {
  // ============ PRE-STATE ERA (1870-1947) ============
  
  petah_tikva_1878: {
    id: 'petah_tikva_1878',
    year: 1878,
    title: 'Petah Tikva Founded',
    description: 'The first modern Jewish agricultural settlement is established, marking the beginning of practical Zionism.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Expand agricultural settlements', effects: { money: -3000, controlBonus: 2 } },
      { label: 'Focus on urban development', effects: { money: 2000 } }
    ]
  },

  first_aliyah_1882: {
    id: 'first_aliyah_1882',
    year: 1882,
    title: 'First Aliyah Begins',
    description: 'A wave of Jewish immigration from Eastern Europe begins, driven by pogroms in Russia. Settlers establish agricultural communities with support from Baron Rothschild.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Welcome all settlers', effects: { manpower: 500, money: -2000 }, cost: '$2K' },
      { label: 'Focus on existing communities', effects: { controlBonus: 3 } }
    ]
  },

  rishon_lezion_1882: {
    id: 'rishon_lezion_1882',
    year: 1884,
    title: 'Rishon LeZion Flourishes',
    description: 'The wine industry begins in Rishon LeZion with Rothschild funding, establishing economic foundations.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Invest in wine production', effects: { money: 5000 } },
      { label: 'Diversify agriculture', effects: { money: 2000, manpower: 200 } }
    ]
  },

  dreyfus_affair_1894: {
    id: 'dreyfus_affair_1894',
    year: 1894,
    title: 'The Dreyfus Affair',
    description: 'A French Jewish officer is falsely convicted of treason. The antisemitic trial shocks Theodor Herzl, inspiring the Zionist movement.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Accelerate political organization', effects: { diplomacyPoints: 10 } }
    ],
    mandatory: true
  },
  
  herzl_congress_1897: {
    id: 'herzl_congress_1897',
    year: 1897,
    title: 'First Zionist Congress',
    description: 'Theodor Herzl convenes the First Zionist Congress in Basel, unifying the movement and declaring: "In Basel I founded the Jewish State."',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Embrace Political Zionism', effects: { diplomacyPoints: 15 } },
      { label: 'Focus on Practical Zionism', effects: { money: 5000, controlBonus: 2 } }
    ]
  },

  uganda_proposal_1903: {
    id: 'uganda_proposal_1903',
    year: 1903,
    title: 'Uganda Scheme',
    description: 'Britain offers territory in East Africa for Jewish settlement. The proposal divides the Zionist movement.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Reject - Palestine or nothing', effects: { diplomacyPoints: -5, controlBonus: 2 } },
      { label: 'Consider as temporary refuge', effects: { diplomacyPoints: 10, money: -5000 } }
    ]
  },

  second_aliyah_1904: {
    id: 'second_aliyah_1904',
    year: 1904,
    title: 'Second Aliyah',
    description: 'A new wave of idealistic socialist pioneers arrives, founding kibbutzim and establishing Hebrew as the spoken language. They include future leaders like Ben-Gurion.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Support collective settlements', effects: { manpower: 800, controlBonus: 2 } },
      { label: 'Encourage private enterprise', effects: { money: 8000 } }
    ]
  },

  tel_aviv_1909: {
    id: 'tel_aviv_1909',
    year: 1909,
    title: 'Tel Aviv Founded',
    description: 'Sixty-six families gather on sand dunes north of Jaffa to establish a new Hebrew city. Tel Aviv is born.',
    phase: GamePhases.PRE_STATE,
    mandatory: true,
    options: [
      { label: 'Invest heavily in the new city', effects: { money: -8000, controlBonus: 5 } }
    ]
  },

  hashomer_1909: {
    id: 'hashomer_1909',
    year: 1910,
    title: 'HaShomer Formed',
    description: 'The first Jewish self-defense organization is established to protect settlements from raids.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Fund and expand HaShomer', effects: { money: -3000, undergroundBonus: 300 } },
      { label: 'Rely on Ottoman protection', effects: { diplomacyPoints: 5 } }
    ]
  },

  balfour_1917: {
    id: 'balfour_1917',
    year: 1917,
    title: 'Balfour Declaration',
    description: 'Britain issues the Balfour Declaration, supporting "a national home for the Jewish people" in Palestine.',
    phase: GamePhases.PRE_STATE,
    mandatory: true,
    options: [
      { label: 'Leverage international support', effects: { diplomacyPoints: 25, money: 10000 } },
      { label: 'Accelerate land purchases', effects: { money: -5000, controlBonus: 8 } }
    ]
  },

  third_aliyah_1919: {
    id: 'third_aliyah_1919',
    year: 1919,
    title: 'Third Aliyah',
    description: 'Post-WWI immigration brings laborers who build roads and drain swamps. The Histadrut labor federation is founded.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Focus on infrastructure', effects: { money: 5000, manpower: 600 } },
      { label: 'Strengthen labor movement', effects: { manpower: 1000, controlBonus: 1 } }
    ]
  },

  hebron_1929: {
    id: 'hebron_1929',
    year: 1929,
    title: 'Hebron Massacre',
    description: 'Anti-Jewish riots erupt across Palestine. The ancient Jewish community of Hebron is destroyed.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Expand Haganah protection', effects: { money: -8000, undergroundBonus: 800 } },
      { label: 'Rely on British protection', effects: { diplomacyPoints: -5, manpower: -100 } }
    ]
  },

  fifth_aliyah_1933: {
    id: 'fifth_aliyah_1933',
    year: 1933,
    title: 'Fifth Aliyah',
    description: 'Nazi persecution drives German Jews to Palestine. Many bring capital and professional skills.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Welcome all refugees', effects: { manpower: 2000, money: 15000 } }
    ],
    mandatory: true
  },

  arab_revolt_1936: {
    id: 'arab_revolt_1936',
    year: 1936,
    title: 'Arab Revolt',
    description: 'A three-year Arab uprising begins against Jewish immigration and British rule. Violence spreads across Palestine.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Strengthen Haganah defenses', effects: { money: -10000, undergroundBonus: 1500 } },
      { label: 'Seek British protection', effects: { diplomacyPoints: -10, manpower: -200 } },
      { label: 'Practice Havlagah (restraint)', effects: { diplomacyPoints: 10, controlBonus: -2 } }
    ]
  },

  white_paper_1939: {
    id: 'white_paper_1939',
    year: 1939,
    title: 'White Paper of 1939',
    description: 'Britain restricts Jewish immigration to 75,000 over five years and limits land purchases, just as Jews desperately need refuge.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Organize illegal immigration (Aliyah Bet)', effects: { money: -15000, manpower: 2000 } },
      { label: 'Launch diplomatic campaign', effects: { diplomacyPoints: 20 } }
    ]
  },

  wwii_service_1942: {
    id: 'wwii_service_1942',
    year: 1942,
    title: 'Jewish Brigade',
    description: 'Despite the White Paper, Jews volunteer to fight alongside Britain. A Jewish Brigade is eventually formed.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Maximize military training', effects: { undergroundBonus: 2000, manpower: -500 } },
      { label: 'Focus on home defense', effects: { undergroundBonus: 1000, controlBonus: 2 } }
    ]
  },

  holocaust_1945: {
    id: 'holocaust_1945',
    year: 1945,
    title: 'Holocaust Aftermath',
    description: 'The full horror of the Holocaust is revealed. Survivors desperately seek refuge. World opinion shifts dramatically.',
    phase: GamePhases.PRE_STATE,
    mandatory: true,
    options: [
      { label: 'Mass absorption effort', effects: { money: -20000, manpower: 5000, diplomacyPoints: 30 } }
    ]
  },

  resistance_1946: {
    id: 'resistance_1946',
    year: 1946,
    title: 'Anti-British Resistance',
    description: 'Jewish underground groups intensify operations against British rule. The King David Hotel is bombed.',
    phase: GamePhases.PRE_STATE,
    options: [
      { label: 'Support armed resistance', effects: { undergroundBonus: 1000, diplomacyPoints: -15 } },
      { label: 'Focus on political pressure', effects: { diplomacyPoints: 15 } }
    ]
  },

  un_partition_1947: {
    id: 'un_partition_1947',
    year: 1947,
    title: 'UN Partition Plan',
    description: 'UN Resolution 181 partitions Palestine into Jewish and Arab states. Arabs reject it. War seems inevitable.',
    phase: GamePhases.PRE_STATE,
    mandatory: true,
    options: [
      { label: 'Accept partition', effects: { canDeclareIndependence: true, diplomacyPoints: 20 } }
    ]
  },

  // ============ POST-STATE ERA (1948-2025) ============
  
  independence_1948: {
    id: 'independence_1948',
    year: 1948,
    title: 'War of Independence Begins',
    description: 'Ben-Gurion declares independence. Five Arab armies invade. The fate of the newborn state hangs in the balance.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { label: 'Rally the nation', effects: { manpower: 10000, militaryBonus: 5000 } }
    ]
  },

  altalena_1948: {
    id: 'altalena_1948',
    year: 1948,
    title: 'Altalena Affair',
    description: 'The Irgun ship Altalena arrives with weapons. Ben-Gurion orders it sunk to establish army unity. Civil war narrowly averted.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Support Ben-Gurion\'s decision', effects: { militaryBonus: 2000 } },
      { label: 'Seek compromise', effects: { militaryBonus: 1000, manpower: -500 } }
    ]
  },

  mass_aliyah_1949: {
    id: 'mass_aliyah_1949',
    year: 1949,
    title: 'Mass Immigration',
    description: 'Jews flood in from Europe and Arab lands. The population doubles in four years. Ma\'abarot tent cities spring up.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { label: 'Welcome all Jews home', effects: { manpower: 20000, money: -50000 } }
    ]
  },

  operation_magic_carpet_1949: {
    id: 'operation_magic_carpet_1949',
    year: 1950,
    title: 'Operation Magic Carpet',
    description: 'Nearly 50,000 Yemenite Jews are airlifted to Israel in a massive rescue operation.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Continue rescue operations', effects: { manpower: 8000, money: -20000 } }
    ],
    mandatory: true
  },

  operation_ezra_1951: {
    id: 'operation_ezra_1951',
    year: 1951,
    title: 'Operation Ezra and Nehemiah',
    description: 'Over 120,000 Iraqi Jews are brought to Israel as persecution intensifies in Baghdad.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Absorb Iraqi Jewry', effects: { manpower: 15000, money: -30000 } }
    ],
    mandatory: true
  },

  reparations_1952: {
    id: 'reparations_1952',
    year: 1952,
    title: 'German Reparations',
    description: 'Germany offers reparations for the Holocaust. Many oppose taking "blood money" from the murderers.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Accept reparations', effects: { money: 100000, diplomacyPoints: -10 } },
      { label: 'Reject on moral grounds', effects: { diplomacyPoints: 20 } }
    ]
  },

  arms_deal_1955: {
    id: 'arms_deal_1955',
    year: 1955,
    title: 'Czech Arms Deal',
    description: 'Egypt receives massive Soviet arms through Czechoslovakia, shifting the regional balance of power.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Seek Western arms suppliers', effects: { money: -30000, militaryBonus: 3000 } },
      { label: 'Develop domestic industry', effects: { money: -20000, techPoints: 15 } }
    ]
  },

  suez_1956: {
    id: 'suez_1956',
    year: 1956,
    title: 'Suez Crisis',
    description: 'Egypt nationalizes the Suez Canal. Britain and France plan intervention and invite Israel to join.',
    phase: GamePhases.POST_STATE,
    requiresNoWar: ['egypt'],
    options: [
      { label: 'Join Operation Kadesh', effects: { money: -40000, captureRegions: ['egypt_sinai'], warWith: ['egypt'] }, cost: '$40K' },
      { label: 'Stay neutral', effects: { diplomacyPoints: 15 } }
    ]
  },

  eichmann_1960: {
    id: 'eichmann_1960',
    year: 1960,
    title: 'Eichmann Capture',
    description: 'Mossad agents capture Adolf Eichmann in Argentina. The world watches his trial in Jerusalem.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Public trial for justice', effects: { diplomacyPoints: 20 } }
    ],
    mandatory: true
  },

  water_carrier_1964: {
    id: 'water_carrier_1964',
    year: 1964,
    title: 'National Water Carrier',
    description: 'The National Water Carrier is completed, bringing water from the Sea of Galilee to the Negev.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Expand agricultural development', effects: { money: 10000, controlBonus: 5 } }
    ],
    mandatory: true
  },

  six_day_1967: {
    id: 'six_day_1967',
    year: 1967,
    title: 'Six Day War',
    description: 'Egypt blocks the Straits of Tiran and masses troops in Sinai. Syria shells from the Golan. Arab armies mobilize.',
    phase: GamePhases.POST_STATE,
    requiresNoWar: ['egypt', 'syria', 'jordan'],
    options: [
      { 
        label: 'Preemptive strike', 
        effects: { 
          money: -60000, 
          captureRegions: ['golan', 'west_bank', 'egypt_sinai', 'gaza'], 
          warWith: ['egypt', 'syria', 'jordan'] 
        },
        cost: '$60K'
      },
      { 
        label: 'Wait for international support', 
        effects: { manpower: -5000, warWith: ['egypt', 'syria', 'jordan'] } 
      }
    ]
  },

  war_attrition_1969: {
    id: 'war_attrition_1969',
    year: 1969,
    title: 'War of Attrition',
    description: 'Egypt launches a war of attrition along the Suez Canal with Soviet support.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Deep raids into Egypt', effects: { money: -20000, militaryBonus: 1000 } },
      { label: 'Build Bar-Lev Line', effects: { money: -30000, defenseBonus: 0.2 } }
    ]
  },

  munich_1972: {
    id: 'munich_1972',
    year: 1972,
    title: 'Munich Massacre',
    description: 'Palestinian terrorists murder 11 Israeli athletes at the Munich Olympics. The world is shocked.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Launch Operation Wrath of God', effects: { money: -15000, diplomacyPoints: -10 } },
      { label: 'Focus on security measures', effects: { money: -20000, defenseBonus: 0.1 } }
    ]
  },

  yom_kippur_1973: {
    id: 'yom_kippur_1973',
    year: 1973,
    title: 'Yom Kippur War',
    description: 'Egypt and Syria launch a surprise attack on the holiest day. The nation is caught off guard.',
    phase: GamePhases.POST_STATE,
    requiresNoWar: ['egypt', 'syria'],
    options: [
      { 
        label: 'Emergency mobilization', 
        effects: { money: -80000, manpower: 15000, warWith: ['egypt', 'syria'] },
        cost: '$80K'
      },
      { 
        label: 'Request US airlift', 
        effects: { diplomacyPoints: -40, money: 100000, warWith: ['egypt', 'syria'] },
        cost: '-40 DP'
      }
    ]
  },

  entebbe_1976: {
    id: 'entebbe_1976',
    year: 1976,
    title: 'Entebbe Rescue',
    description: 'Terrorists hijack an Air France flight to Uganda. IDF commandos plan a daring rescue mission.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Launch Operation Thunderbolt', effects: { diplomacyPoints: 25, militaryBonus: 500 } }
    ],
    mandatory: true
  },

  camp_david_1978: {
    id: 'camp_david_1978',
    year: 1978,
    title: 'Camp David Accords',
    description: 'President Carter hosts Begin and Sadat. Historic peace with Egypt is possible.',
    phase: GamePhases.POST_STATE,
    options: [
      { 
        label: 'Sign peace treaty', 
        effects: { returnRegion: 'egypt_sinai', peaceWith: 'egypt', diplomacyPoints: 40 } 
      },
      { label: 'Reject terms', effects: { diplomacyPoints: -25 } }
    ]
  },

  lebanon_1982: {
    id: 'lebanon_1982',
    year: 1982,
    title: 'Lebanon War',
    description: 'PLO attacks from Lebanon intensify. The government plans Operation Peace for Galilee.',
    phase: GamePhases.POST_STATE,
    options: [
      { 
        label: 'Full invasion', 
        effects: { money: -50000, manpower: -3000, captureRegions: ['lebanon_south'] },
        cost: '$50K, 3K Men'
      },
      { label: 'Limited response', effects: { manpower: -1000 } }
    ]
  },

  intifada_1987: {
    id: 'intifada_1987',
    year: 1987,
    title: 'First Intifada',
    description: 'Palestinian uprising begins in the territories. Stones and Molotov cocktails against soldiers.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Security crackdown', effects: { money: -30000, diplomacyPoints: -20 } },
      { label: 'Seek negotiations', effects: { diplomacyPoints: 15, controlPenalty: 10 } }
    ]
  },

  gulf_war_1991: {
    id: 'gulf_war_1991',
    year: 1991,
    title: 'Gulf War',
    description: 'Iraq invades Kuwait. Saddam Hussein fires Scud missiles at Israel, hoping to draw it into the war.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Show restraint (US request)', effects: { diplomacyPoints: 30 } },
      { label: 'Retaliate against Iraq', effects: { diplomacyPoints: -20, warWith: ['iraq'] } }
    ]
  },

  oslo_1993: {
    id: 'oslo_1993',
    year: 1993,
    title: 'Oslo Accords',
    description: 'Secret negotiations in Norway lead to a framework for Palestinian autonomy.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Full implementation', effects: { diplomacyPoints: 35, controlPenalty: 15 } },
      { label: 'Partial implementation', effects: { diplomacyPoints: 10 } }
    ]
  },

  peace_jordan_1994: {
    id: 'peace_jordan_1994',
    year: 1994,
    title: 'Peace with Jordan',
    description: 'Following Oslo, Jordan is ready to sign a peace treaty.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Sign treaty', effects: { peaceWith: 'jordan', tradeWith: 'jordan', diplomacyPoints: 25 } }
    ],
    mandatory: true
  },

  rabin_assassination_1995: {
    id: 'rabin_assassination_1995',
    year: 1995,
    title: 'Rabin Assassination',
    description: 'Prime Minister Yitzhak Rabin is assassinated by a Jewish extremist at a peace rally. The nation mourns.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { label: 'Continue the peace process', effects: { diplomacyPoints: 20 } }
    ]
  },

  terror_wave_1996: {
    id: 'terror_wave_1996',
    year: 1996,
    title: 'Bus Bombing Campaign',
    description: 'Hamas launches devastating suicide bombings on Israeli buses. Dozens killed. Peace process shaken.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Security crackdown', effects: { money: -20000, diplomacyPoints: -10 } },
      { label: 'Continue negotiations', effects: { diplomacyPoints: 10, manpower: -1000 } }
    ]
  },

  tunnel_incident_1996: {
    id: 'tunnel_incident_1996',
    year: 1996,
    title: 'Western Wall Tunnel',
    description: 'Opening of archaeological tunnel near Al-Aqsa sparks riots. Dozens killed.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Assert Israeli rights', effects: { diplomacyPoints: -15 } },
      { label: 'Seek de-escalation', effects: { diplomacyPoints: 10 } }
    ]
  },

  wye_river_1998: {
    id: 'wye_river_1998',
    year: 1998,
    title: 'Wye River Memorandum',
    description: 'Netanyahu and Arafat sign agreement for further Israeli withdrawals.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Implement withdrawals', effects: { diplomacyPoints: 20, controlPenalty: 5 } },
      { label: 'Delay implementation', effects: { diplomacyPoints: -10 } }
    ]
  },

  barak_withdrawal_2000: {
    id: 'barak_withdrawal_2000',
    year: 2000,
    title: 'Lebanon Withdrawal',
    description: 'Israel withdraws from southern Lebanon after 18 years. Hezbollah claims victory.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Complete withdrawal', effects: { returnRegion: 'lebanon_south', diplomacyPoints: 15 } }
    ],
    mandatory: true
  },

  second_intifada_2000: {
    id: 'second_intifada_2000',
    year: 2000,
    title: 'Second Intifada',
    description: 'Camp David summit fails. A violent uprising begins with suicide bombings in Israeli cities.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Operation Defensive Shield', effects: { money: -40000, manpower: -2000, controlBonus: 10 } },
      { label: 'Build security barrier', effects: { money: -60000, diplomacyPoints: -15, defenseBonus: 0.2 } }
    ]
  },

  lebanon_2006: {
    id: 'lebanon_2006',
    year: 2006,
    title: 'Second Lebanon War',
    description: 'Hezbollah kidnaps soldiers and fires rockets. A 34-day war begins.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Full-scale ground operation', effects: { money: -50000, manpower: -2000 } },
      { label: 'Air campaign focus', effects: { money: -30000, diplomacyPoints: -10 } }
    ]
  },

  gaza_2008: {
    id: 'gaza_2008',
    year: 2008,
    title: 'Operation Cast Lead',
    description: 'Hamas rockets continue from Gaza. A major military operation is launched.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Ground invasion', effects: { money: -30000, manpower: -500 } },
      { label: 'Air strikes only', effects: { money: -15000, diplomacyPoints: -10 } }
    ]
  },

  iron_dome_2011: {
    id: 'iron_dome_2011',
    year: 2011,
    title: 'Iron Dome Deployed',
    description: 'The Iron Dome missile defense system becomes operational, intercepting rockets.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Expand coverage nationally', effects: { money: -50000, techPoints: 20, defenseBonus: 0.3 } }
    ],
    mandatory: true
  },

  abraham_2020: {
    id: 'abraham_2020',
    year: 2020,
    title: 'Abraham Accords',
    description: 'Historic normalization agreements with UAE and Bahrain are signed.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { 
        label: 'Sign agreements', 
        effects: { 
          peaceWith: ['uae', 'bahrain'], 
          tradeWith: ['uae', 'bahrain'], 
          diplomacyPoints: 50 
        } 
      }
    ]
  },

  covid_impact_2020: {
    id: 'covid_impact_2020',
    year: 2021,
    title: 'Pandemic Response',
    description: 'COVID-19 ravages the world. Israel leads in vaccine rollout but faces economic challenges.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Prioritize public health', effects: { money: -100000, manpower: 5000, diplomacyPoints: 20 } },
      { label: 'Balance economy and health', effects: { money: -50000, manpower: 2000 } }
    ]
  },

  guardian_walls_2021: {
    id: 'guardian_walls_2021',
    year: 2021,
    title: 'Operation Guardian of the Walls',
    description: 'Hamas launches over 4,000 rockets at Israeli cities. Iron Dome intercepts most, but casualties mount.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Targeted strikes on Hamas', effects: { money: -40000, militaryBonus: 500 } },
      { label: 'Limited ground incursion', effects: { money: -80000, manpower: -500, militaryBonus: 2000 } }
    ]
  },

  tech_boom_2022: {
    id: 'tech_boom_2022',
    year: 2022,
    title: 'Startup Nation Peak',
    description: 'Israeli tech sector reaches new heights with record IPOs and acquisitions.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Invest in tech infrastructure', effects: { money: 80000, techPoints: 30 } }
    ],
    mandatory: true
  },

  judicial_crisis_2023: {
    id: 'judicial_crisis_2023',
    year: 2023,
    title: 'Constitutional Crisis',
    description: 'Proposed judicial reforms divide the nation. Massive protests erupt across the country.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Seek compromise', effects: { diplomacyPoints: 15 } },
      { label: 'Push through reforms', effects: { diplomacyPoints: -20, manpower: -2000 } },
      { label: 'Withdraw proposal', effects: { diplomacyPoints: 10 } }
    ]
  },

  october_war_2023: {
    id: 'october_war_2023',
    year: 2023,
    title: 'October 7th Attack',
    description: 'Hamas launches unprecedented terror attack from Gaza. Over 1,200 civilians murdered. Hostages taken. The nation is shocked to its core.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { 
        label: 'Operation Swords of Iron', 
        effects: { 
          money: -200000, 
          manpower: -5000, 
          militaryBonus: 10000,
          warWith: ['hamas']
        } 
      }
    ]
  },

  hostage_crisis_2024: {
    id: 'hostage_crisis_2024',
    year: 2024,
    title: 'Hostage Negotiations',
    description: 'International pressure mounts for hostage deal. Qatar mediates between Israel and Hamas.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Prioritize hostage release', effects: { diplomacyPoints: 30, money: -50000 } },
      { label: 'Continue military pressure', effects: { militaryBonus: 5000, diplomacyPoints: -20 } },
      { label: 'Balanced approach', effects: { diplomacyPoints: 10, money: -30000 } }
    ]
  },

  northern_front_2024: {
    id: 'northern_front_2024',
    year: 2024,
    title: 'Northern Escalation',
    description: 'Hezbollah escalates attacks from Lebanon. Over 100,000 Israelis evacuated from the north.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Major offensive in Lebanon', effects: { money: -150000, manpower: -3000, captureRegions: ['lebanon_south'] } },
      { label: 'Targeted operations', effects: { money: -60000, militaryBonus: 3000 } },
      { label: 'Diplomatic solution', effects: { diplomacyPoints: 20 } }
    ]
  },

  // ============ FUTURE ERA (2025-2150) ============
  
  // 2025-2035: Near Future
  cyber_warfare_2025: {
    id: 'cyber_warfare_2025',
    year: 2025,
    title: 'Global Cyber Conflict',
    description: 'A massive cyberattack targets critical infrastructure worldwide. Israel\'s Unit 8200 is called to respond.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Lead cyber counteroffensive', effects: { money: -80000, techPoints: 40, diplomacyPoints: 25 } },
      { label: 'Focus on domestic defense', effects: { money: -40000, techPoints: 20 } }
    ]
  },

  iran_deal_2030: {
    id: 'iran_deal_2030',
    year: 2030,
    title: 'Regional Security Pact',
    description: 'A new regional security architecture emerges following the decline of Iranian influence. Historic opportunity for peace.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Join regional alliance', effects: { peaceWith: ['saudi', 'iraq'], diplomacyPoints: 60, money: -50000 } },
      { label: 'Maintain strategic independence', effects: { money: 100000, militaryBonus: 5000 } }
    ]
  },

  drone_swarms_2032: {
    id: 'drone_swarms_2032',
    year: 2032,
    title: 'Drone Swarm Attack',
    description: 'Autonomous drone swarms overwhelm traditional air defenses. A new era of warfare begins.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Develop counter-swarm technology', effects: { money: -120000, techPoints: 60, militaryBonus: 8000 } },
      { label: 'Upgrade Iron Dome systems', effects: { money: -80000, militaryBonus: 4000 } }
    ]
  },

  quantum_breakthrough_2035: {
    id: 'quantum_breakthrough_2035',
    year: 2035,
    title: 'Quantum Computing Breakthrough',
    description: 'Israeli researchers achieve quantum supremacy. All encryption becomes vulnerable.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Commercialize the technology', effects: { money: 300000, techPoints: 80 } },
      { label: 'Keep it classified for security', effects: { militaryBonus: 15000, techPoints: 40 } }
    ]
  },

  // 2036-2050: Mid-Century Challenges
  water_crisis_2040: {
    id: 'water_crisis_2040',
    year: 2040,
    title: 'Regional Water Crisis',
    description: 'Climate change causes severe water shortages across the Middle East. Desertification accelerates.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Share desalination technology', effects: { diplomacyPoints: 50, money: -100000, peaceWith: ['jordan'] } },
      { label: 'Prioritize domestic needs', effects: { diplomacyPoints: -30, manpower: 5000 } },
      { label: 'Water-for-peace program', effects: { diplomacyPoints: 35, money: -150000, tradeWith: ['egypt'] } }
    ]
  },

  fusion_power_2042: {
    id: 'fusion_power_2042',
    year: 2042,
    title: 'Fusion Power Revolution',
    description: 'Commercial fusion reactors become viable. The age of energy scarcity ends.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Build national fusion grid', effects: { money: -400000, techPoints: 100 } },
      { label: 'Export fusion technology', effects: { money: 500000, diplomacyPoints: 40 } }
    ]
  },

  neural_interfaces_2045: {
    id: 'neural_interfaces_2045',
    year: 2045,
    title: 'Neural Interface Technology',
    description: 'Brain-computer interfaces allow direct mental control of machines and instant communication.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Military neural enhancement program', effects: { money: -200000, militaryBonus: 20000, techPoints: 50 } },
      { label: 'Civilian medical applications', effects: { money: 100000, manpower: 10000, diplomacyPoints: 20 } }
    ]
  },

  ai_revolution_2050: {
    id: 'ai_revolution_2050',
    year: 2050,
    title: 'AI Military Revolution',
    description: 'Autonomous weapons systems transform warfare. Ethical debates about machine decision-making intensify globally.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Lead AI weapons development', effects: { money: -200000, techPoints: 100, militaryBonus: 25000 } },
      { label: 'Support international AI treaty', effects: { diplomacyPoints: 50, techPoints: 30 } },
      { label: 'Hybrid human-AI command', effects: { money: -150000, militaryBonus: 15000, diplomacyPoints: 20 } }
    ]
  },

  // 2051-2075: Late Century Transformation
  mars_colony_2055: {
    id: 'mars_colony_2055',
    year: 2055,
    title: 'Mars Colonization',
    description: 'The first permanent Mars colony is established. Israel is invited to contribute.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Establish Israeli Mars presence', effects: { money: -500000, techPoints: 150, diplomacyPoints: 60 } },
      { label: 'Focus on Earth projects', effects: { money: 200000, manpower: 20000 } }
    ]
  },

  genetic_enhancement_2058: {
    id: 'genetic_enhancement_2058',
    year: 2058,
    title: 'Genetic Enhancement Debate',
    description: 'Gene editing technology allows enhancement of human capabilities. Religious and ethical tensions arise.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Permit medical enhancements only', effects: { diplomacyPoints: 20, manpower: 15000 } },
      { label: 'Allow broad genetic research', effects: { techPoints: 80, diplomacyPoints: -20 } },
      { label: 'Ban all genetic modification', effects: { diplomacyPoints: 30, techPoints: -30 } }
    ]
  },

  asteroid_mining_2062: {
    id: 'asteroid_mining_2062',
    year: 2062,
    title: 'Asteroid Mining Begins',
    description: 'First successful asteroid mining operation returns rare minerals worth trillions.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Invest in space mining', effects: { money: -300000, techPoints: 70 } },
      { label: 'License mining technology', effects: { money: 400000 } }
    ]
  },

  space_race_2070: {
    id: 'space_race_2070',
    year: 2070,
    title: 'Space Elevator Completion',
    description: 'The first space elevator dramatically reduces cost of space access. A new frontier opens.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Build orbital manufacturing hub', effects: { money: -600000, techPoints: 100 } },
      { label: 'Join international space station', effects: { money: 300000, diplomacyPoints: 50, techPoints: 50 } },
      { label: 'Focus on lunar development', effects: { money: -400000, techPoints: 80 } }
    ]
  },

  immortality_research_2075: {
    id: 'immortality_research_2075',
    year: 2075,
    title: 'Longevity Breakthrough',
    description: 'Scientists announce successful reversal of aging in trials. The implications are staggering.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'National longevity program', effects: { money: -500000, manpower: 50000, techPoints: 100 } },
      { label: 'Export treatment globally', effects: { money: 1000000, diplomacyPoints: 80 } },
      { label: 'Restrict to prevent overpopulation', effects: { diplomacyPoints: -40, manpower: 10000 } }
    ]
  },

  // 2076-2100: Century\'s End
  global_governance_2080: {
    id: 'global_governance_2080',
    year: 2080,
    title: 'World Government Proposal',
    description: 'A proposal emerges for unified global governance to address planetary challenges.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Support world federation', effects: { diplomacyPoints: 100, money: -200000 } },
      { label: 'Advocate regional autonomy', effects: { diplomacyPoints: 40 } },
      { label: 'Maintain national sovereignty', effects: { militaryBonus: 20000, diplomacyPoints: -30 } }
    ]
  },

  first_contact_2085: {
    id: 'first_contact_2085',
    year: 2085,
    title: 'Extraterrestrial Signal',
    description: 'A confirmed alien signal is detected from a nearby star system. Humanity is not alone.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Lead response initiative', effects: { diplomacyPoints: 80, techPoints: 100, money: -300000 } },
      { label: 'Cautious observation', effects: { techPoints: 50, diplomacyPoints: 30 } },
      { label: 'Prepare defenses', effects: { militaryBonus: 30000, money: -400000 } }
    ]
  },

  climate_migration_2090: {
    id: 'climate_migration_2090',
    year: 2090,
    title: 'Climate Migration Wave',
    description: 'Rising seas and extreme weather displace billions. Massive population movements reshape the world.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Open borders humanitarian policy', effects: { manpower: 100000, money: -300000, diplomacyPoints: 60 } },
      { label: 'Controlled skilled immigration', effects: { manpower: 30000, techPoints: 40 } },
      { label: 'Focus on climate engineering', effects: { money: -500000, techPoints: 80, diplomacyPoints: 40 } }
    ]
  },

  consciousness_upload_2095: {
    id: 'consciousness_upload_2095',
    year: 2095,
    title: 'Digital Consciousness',
    description: 'First successful upload of human consciousness to digital substrate. Death may become optional.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Pioneer digital existence', effects: { techPoints: 150, money: -400000 } },
      { label: 'Regulate carefully', effects: { diplomacyPoints: 40, techPoints: 50 } },
      { label: 'Preserve human essence', effects: { manpower: 20000, diplomacyPoints: 20 } }
    ]
  },

  // 2101-2150: Far Future
  post_scarcity_2105: {
    id: 'post_scarcity_2105',
    year: 2105,
    title: 'Post-Scarcity Economy',
    description: 'Advanced automation and fusion power create material abundance. Traditional economics collapse.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Universal basic resources', effects: { manpower: 80000, diplomacyPoints: 50 } },
      { label: 'Innovation-based economy', effects: { techPoints: 120, money: 500000 } }
    ]
  },

  solar_system_expansion_2110: {
    id: 'solar_system_expansion_2110',
    year: 2110,
    title: 'Solar System Civilization',
    description: 'Humanity establishes permanent presence across the solar system. Earth is no longer the only home.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Lead outer system colonization', effects: { money: -800000, techPoints: 150, diplomacyPoints: 70 } },
      { label: 'Focus on inner system', effects: { money: 600000, techPoints: 80 } }
    ]
  },

  singularity_2120: {
    id: 'singularity_2120',
    year: 2120,
    title: 'Technological Singularity',
    description: 'AI systems surpass human intelligence in all domains. The rate of progress becomes incomprehensible.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Merge with AI systems', effects: { techPoints: 300, militaryBonus: 50000 } },
      { label: 'Human-AI coexistence treaty', effects: { diplomacyPoints: 100, techPoints: 150 } },
      { label: 'Preserve human autonomy', effects: { manpower: 50000, diplomacyPoints: 50 } }
    ]
  },

  dyson_swarm_2135: {
    id: 'dyson_swarm_2135',
    year: 2135,
    title: 'Dyson Swarm Construction',
    description: 'Construction begins on a Dyson swarm to capture the sun\'s energy. Unlimited power awaits.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Major contributor role', effects: { money: -1000000, techPoints: 200 } },
      { label: 'Technology licensing', effects: { money: 800000, techPoints: 100 } }
    ]
  },

  interstellar_probe_2140: {
    id: 'interstellar_probe_2140',
    year: 2140,
    title: 'Interstellar Mission Launch',
    description: 'First crewed interstellar mission prepares to depart for Alpha Centauri.',
    phase: GamePhases.POST_STATE,
    options: [
      { label: 'Send Israeli crew members', effects: { money: -600000, diplomacyPoints: 100, techPoints: 100 } },
      { label: 'Support mission remotely', effects: { money: 200000, diplomacyPoints: 50 } }
    ]
  },

  galactic_age_2150: {
    id: 'galactic_age_2150',
    year: 2150,
    title: 'The Galactic Age Begins',
    description: 'Faster-than-light travel is achieved. Humanity stands ready to join a galactic community. Israel has survived and thrived.',
    phase: GamePhases.POST_STATE,
    mandatory: true,
    options: [
      { label: 'Lead humanity to the stars', effects: { victory: true } }
    ]
  }
};

// Get events sorted by year
export const getEventsByYear = () => {
  return Object.values(HISTORICAL_EVENTS).sort((a, b) => a.year - b.year);
};

// Check if event should fire.
// Deliberately NOT gated on "previousYear < event.year" — that older check gave every event a
// single one-turn firing window, so any two events sharing a year permanently lost the second
// one (this killed six events, including the Oct 7 event). Instead an event is simply "due" once
// its year has arrived; pickNextEvent() below fires at most one due event per turn, in year order,
// so simultaneous-year events queue up and fire on consecutive turns instead of colliding.
export const shouldEventFire = (event, year, phase, nations, firedEvents) => {
  if (firedEvents[event.id]) return false;
  if (event.year > year) return false;

  // Phase check
  const currentPhase = phase === GamePhases.PRE_STATE ? GamePhases.PRE_STATE : GamePhases.POST_STATE;
  if (event.phase !== currentPhase) return false;

  // War requirements
  if (event.requiresNoWar) {
    const anyAtWar = event.requiresNoWar.some(nId => nations[nId]?.isAtWar);
    if (anyAtWar) return false;
  }

  return true;
};

// Pick the single most-overdue eligible event for this turn (earliest scripted year first,
// then stable declaration order for same-year ties).
export const pickNextEvent = (year, phase, nations, firedEvents) => {
  const eligible = Object.values(HISTORICAL_EVENTS).filter(e =>
    shouldEventFire(e, year, phase, nations, firedEvents)
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => a.year - b.year);
  return eligible[0];
};
