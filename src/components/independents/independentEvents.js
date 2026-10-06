// src/components/independents/independentEvents.js
// Open the independents' sheets from anywhere (the city card, the Relations list, a raid marker,
// a log line), without threading callbacks through the tree. IndependentsHost.jsx listens.
export const OPEN_INDEPENDENT = 'ti:open-independent';
export const OPEN_TRIBUTE_DEMAND = 'ti:open-tribute-demand';
export const OPEN_JOIN_OFFER = 'ti:open-join-offer';
/** The independent city sheet of nation `id`. */
export const openIndependent = (id) => window.dispatchEvent(new CustomEvent(OPEN_INDEPENDENT, { detail: id }));
/** The tribute demand sheet (W15) of demand `id`. */
export const openTributeDemand = (id) => window.dispatchEvent(new CustomEvent(OPEN_TRIBUTE_DEMAND, { detail: id }));
/** The join offer sheet of offer `id`. */
export const openJoinOffer = (id) => window.dispatchEvent(new CustomEvent(OPEN_JOIN_OFFER, { detail: id }));
