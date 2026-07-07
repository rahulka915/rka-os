// TODO: no real progression/XP system exists yet. This returns a fixed
// placeholder so the hero card has a real data slot to render, without
// presenting fabricated numbers as authoritative. Replace the body of
// getRoninProgress() with a real DB-backed calculation when the
// progression system is built — the RoninHero component consuming this
// does not need to change.
export interface RoninProgress {
  level: number;
  xp: number;
  xpToNext: number;
}

export function getRoninProgress(): RoninProgress {
  return { level: 1, xp: 0, xpToNext: 100 };
}
