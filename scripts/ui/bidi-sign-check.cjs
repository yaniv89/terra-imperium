const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const cases = { isolated: 'פרס: ⁦-10%⁩ עלות', raw: 'פרס: -10% עלות', plusIso: 'אספקה ⁦+50⁩ בתור', plusRaw: 'אספקה +50 בתור' };
  await p.setContent(`<html dir="rtl"><body style="font:28px sans-serif">${Object.entries(cases).map(([k, v]) => `<div id="${k}">${v}</div>`).join('')}</body></html>`);
  const r = await p.evaluate((keys) => keys.map((k) => {
    const n = document.getElementById(k).firstChild; const t = n.nodeValue;
    const x = (ch) => { const i = t.indexOf(ch); const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); return Math.round(rg.getBoundingClientRect().x); };
    const sign = t.includes('-') ? '-' : '+';
    return `${k}: sign x=${x(sign)} digit x=${x(sign === '-' ? '1' : '5')} -> sign ${x(sign) < x(sign === '-' ? '1' : '5') ? 'LEFT of number (correct)' : 'RIGHT of number (flipped)'}`;
  }), Object.keys(cases));
  console.log(r.join('\n')); await b.close();
})();
