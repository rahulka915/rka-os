export function findDayForContentY(
  daySectionLayouts: Record<string, { y: number }>,
  contentY: number,
  hourHeight: number,
): string | null {
  const boundaries = Object.entries(daySectionLayouts).sort((a, b) => a[1].y - b[1].y);
  let activeDay: string | null = null;
  for (const [day, layout] of boundaries) {
    if (contentY >= layout.y - hourHeight / 2) activeDay = day;
  }
  return activeDay;
}

export interface ComputeDropTargetOptions {
  hourHeight: number;
  dayTransitionHeight: number;
  laneHeaderHeight: number;
  snapMinutes: number;
}

export interface DropTarget {
  dateStr: string;
  minutes: number | null;
}

export function computeDropTarget(
  daySectionLayouts: Record<string, { y: number }>,
  contentY: number,
  options: ComputeDropTargetOptions,
): DropTarget | null {
  const dateStr = findDayForContentY(daySectionLayouts, contentY, options.hourHeight);
  if (!dateStr) return null;

  const sectionY = daySectionLayouts[dateStr].y;
  const offsetIntoSection = contentY - sectionY;

  if (offsetIntoSection < options.dayTransitionHeight) {
    return { dateStr, minutes: null };
  }

  const offsetIntoGrid = offsetIntoSection - options.dayTransitionHeight - options.laneHeaderHeight;
  const rawMinutes = (Math.max(0, offsetIntoGrid) / options.hourHeight) * 60;
  const maxMinutes = 24 * 60 - options.snapMinutes;
  const clamped = Math.max(0, Math.min(maxMinutes, rawMinutes));
  const snapped = Math.round(clamped / options.snapMinutes) * options.snapMinutes;
  return { dateStr, minutes: snapped };
}
