export type DomainIconKey =
  | 'health'
  | 'finance'
  | 'career'
  | 'fitness'
  | 'discipline'
  | 'growth'
  | 'creativity'
  | 'relationships'
  | 'overall';

const DOMAIN_ICON_RULES: Array<{ match: RegExp; key: DomainIconKey }> = [
  { match: /health|wellbeing/i, key: 'health' },
  { match: /career|work/i, key: 'career' },
  { match: /financ|money/i, key: 'finance' },
  { match: /relationship|family|friend/i, key: 'relationships' },
  { match: /creativ|craft/i, key: 'creativity' },
  { match: /growth|mind|learn/i, key: 'growth' },
  { match: /disciplin/i, key: 'discipline' },
  { match: /fitness|performance/i, key: 'fitness' },
];

export function getDomainIconKey(title: string): DomainIconKey {
  return DOMAIN_ICON_RULES.find(({ match }) => match.test(title))?.key ?? 'overall';
}
