// src/i18n/rich.jsx
// A translated sentence with parts that are not plain text (a bold name, an icon):
//   t('start.capital', { land })        leaves {city} as written
//   rich(text, { city: <b>{name}</b> })  puts the node where {city} stands, in either language
import React from 'react';

export const rich = (text, nodes) => String(text).split(/(\{\w+\})/g).map((part, i) => {
  const m = /^\{(\w+)\}$/.exec(part);
  if (m && nodes[m[1]] !== undefined) return <React.Fragment key={i}>{nodes[m[1]]}</React.Fragment>;
  return part ? <React.Fragment key={i}>{part}</React.Fragment> : null;
});
