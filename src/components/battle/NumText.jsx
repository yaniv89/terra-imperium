// src/components/battle/NumText.jsx
// Text in the body font with only its numbers in the number font (.fa-num: mono, read left to
// right inside Hebrew). The mono font has no Hebrew letters, so a whole Hebrew line set in it falls
// back letter by letter and looks spaced out (the battle failure card on the iPhone).
import React from 'react';

/** The text cut into [isNumber, piece] runs; a number may carry a decimal point. */
export const numberRuns = (text) => String(text ?? '').split(/(\d+(?:[.,]\d+)?)/).filter((p) => p !== '').map((p) => [/^\d/.test(p), p]);

const NumText = ({ text }) => (
  <>{numberRuns(text).map(([num, p], i) => (num ? <span key={i} className="fa-num">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}</>
);

export default NumText;
