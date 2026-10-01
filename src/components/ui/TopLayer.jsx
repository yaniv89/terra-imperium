// src/components/ui/TopLayer.jsx
// Renders a sheet or modal at the top of the page (a portal into <body>), so a sheet opened from
// inside a panel isn't trapped under that panel's stacking context. The region card and the tab
// dock are both positioned with a z-index, which used to let the tab rail paint over a battle
// sheet opened from the card. React context and events still flow as if it were nested.
// Server rendering (component tests) has no document: render in place.
import { createPortal } from 'react-dom';

const TopLayer = ({ children }) => (typeof document === 'undefined' ? children : createPortal(children, document.body));

export default TopLayer;
