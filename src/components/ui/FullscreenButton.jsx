// src/components/ui/FullscreenButton.jsx
// "Full screen" button for the Menu card and the title screen. Not drawn when the page is
// already full screen or installed, or when the browser has no Fullscreen API (iPhone).
import React from 'react';
import { Maximize } from 'lucide-react';
import { Button } from './atlas';
import { useT } from '../../i18n/useT';
import { useFullscreenOffer, enterFullscreen } from '../../utils/fullscreen';

const FullscreenButton = ({ className = '', testId = 'fullscreen-button' }) => {
  const { t } = useT();
  const offer = useFullscreenOffer();
  if (!offer) return null;
  return <Button onClick={enterFullscreen} className={className} data-testid={testId}><Maximize className="w-4 h-4" aria-hidden="true" />{t('menu.fullscreen')}</Button>;
};

export default FullscreenButton;
