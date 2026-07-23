// Single source of truth for the header/tray geometry, so Home can compute
// exactly how much vertical space is left for its content on ANY device —
// derived from live safe-area insets + screen height, not hardcoded per
// device. Keep these in sync with the components that actually own the
// literal values:
//
// - HEADER_TOP_PADDING / HEADER_CONTENT_HEIGHT / HEADER_BOTTOM_PADDING:
//   src/components/AppHeader.tsx (XStack paddingTop = insets.top + N,
//   AvatarCompanion "sm" outer size, paddingBottom "$1")
// - TRAY_CONTENT_HEIGHT / TRAY_BOTTOM_OFFSET_REDUCTION:
//   App.tsx's tabBarInner/tabItem/tabIconBadge styles and the
//   `bottom: Math.max(insets.bottom - N, 0)` tray position.
export const HEADER_TOP_PADDING = 2;
export const HEADER_CONTENT_HEIGHT = 36;
export const HEADER_BOTTOM_PADDING = 4;
export const HEADER_HEIGHT_EXTRA = HEADER_TOP_PADDING + HEADER_CONTENT_HEIGHT + HEADER_BOTTOM_PADDING;

export const TRAY_CONTENT_HEIGHT = 78;
export const TRAY_BOTTOM_OFFSET_REDUCTION = 26;

export function getHeaderHeight(insetsTop: number): number {
  return insetsTop + HEADER_HEIGHT_EXTRA;
}

export function getTrayBottomOffset(insetsBottom: number): number {
  return Math.max(insetsBottom - TRAY_BOTTOM_OFFSET_REDUCTION, 0);
}

// The vertical gap between the bottom of the header and the top of the
// floating tab tray — the actual usable content area on Home, on this
// specific device.
export function getUsableContentHeight(screenHeight: number, insetsTop: number, insetsBottom: number): number {
  const headerHeight = getHeaderHeight(insetsTop);
  const trayTopY = screenHeight - getTrayBottomOffset(insetsBottom) - TRAY_CONTENT_HEIGHT;
  return trayTopY - headerHeight;
}
