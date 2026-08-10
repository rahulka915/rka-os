import type { ComponentType } from 'react';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import {
  CareerDomainIcon,
  CreativityDomainIcon,
  DisciplineDomainIcon,
  FinanceDomainIcon,
  FitnessDomainIcon,
  GrowthDomainIcon,
  HealthDomainIcon,
  RelationshipsDomainIcon,
} from '../components/icons/DomainIcons';
import { getDomainIconKey } from './domainIconKey';

type DomainIconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Matches the 8 canonical Harada Domain names seeded by OnboardingScreen —
// case-insensitive substring match so "Health & Wellbeing" and a
// user-renamed "Health" both resolve. Falls back to AreaBonsaiIcon (the
// original generic Domain glyph) for any custom Domain title that doesn't
// match one of the 8.
const DOMAIN_ICONS: Record<ReturnType<typeof getDomainIconKey>, DomainIconComponent> = {
  health: HealthDomainIcon,
  finance: FinanceDomainIcon,
  career: CareerDomainIcon,
  fitness: FitnessDomainIcon,
  discipline: DisciplineDomainIcon,
  growth: GrowthDomainIcon,
  creativity: CreativityDomainIcon,
  relationships: RelationshipsDomainIcon,
  overall: AreaBonsaiIcon as unknown as DomainIconComponent,
};

export function getDomainIcon(title: string): DomainIconComponent {
  return DOMAIN_ICONS[getDomainIconKey(title)];
}
