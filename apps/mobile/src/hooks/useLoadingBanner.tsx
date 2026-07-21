import { useCallback } from 'react';
import { LoadingBanner } from '../components/ui/LoadingBanner';
import { useOverlayHost } from './useOverlayHost';

const LOADING_BANNER_OVERLAY_ID = 'loading-banner';

export function useLoadingBanner() {
  const { setOverlay } = useOverlayHost();

  const showLoadingBanner = useCallback(
    (message: string) => {
      setOverlay(LOADING_BANNER_OVERLAY_ID, <LoadingBanner message={message} />);
    },
    [setOverlay]
  );

  const hideLoadingBanner = useCallback(() => {
    setOverlay(LOADING_BANNER_OVERLAY_ID, null);
  }, [setOverlay]);

  return { showLoadingBanner, hideLoadingBanner };
}
