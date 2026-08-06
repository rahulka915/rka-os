import type { ComponentType } from 'react';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { Briefcase, Banknotes, Users, PuzzlePiece, ChartBar, Lock, Dumbbell } from '../icons';

type DomainIconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Matches the 8 canonical Harada Domain names seeded by OnboardingScreen —
// case-insensitive substring match so "Health & Wellbeing" and a
// user-renamed "Health" both resolve. Falls back to AreaBonsaiIcon (the
// original generic Domain glyph) for any custom Domain title that doesn't
// match one of the 8.
const DOMAIN_ICON_RULES: Array<{ match: RegExp; Icon: DomainIconComponent }> = [
  { match: /health|wellbeing/i, Icon: AreaBonsaiIcon as unknown as DomainIconComponent },
  { match: /career|work/i, Icon: Briefcase },
  { match: /financ|money/i, Icon: Banknotes },
  { match: /relationship|family|friend/i, Icon: Users },
  { match: /creativ|craft/i, Icon: PuzzlePiece },
  { match: /growth|mind|learn/i, Icon: ChartBar },
  { match: /disciplin/i, Icon: Lock },
  { match: /fitness|performance/i, Icon: Dumbbell },
];

export function getDomainIcon(title: string): DomainIconComponent {
  const rule = DOMAIN_ICON_RULES.find((r) => r.match.test(title));
  return rule ? rule.Icon : (AreaBonsaiIcon as unknown as DomainIconComponent);
}
