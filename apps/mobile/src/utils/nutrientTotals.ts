// Pure aggregation over supplement-taken activity logs — kept separate from
// database.ts so it's testable under plain node:test (expo-sqlite isn't
// available outside the Expo runtime). database.ts/database.web.ts each
// fetch the relevant rows their own way and hand them to sumNutrientLogs.

export interface NutrientProfile {
  sodium?: number;
  potassium?: number;
  magnesium?: number;
  calcium?: number;
  chloride?: number;
}

export const NUTRIENT_KEYS: (keyof NutrientProfile)[] = ['sodium', 'potassium', 'magnesium', 'calcium', 'chloride'];

export interface SupplementLogDetails {
  nutrients?: NutrientProfile;
}

export function sumNutrientLogs(logs: Array<{ details?: string | null }>): NutrientProfile {
  const totals: NutrientProfile = {};
  for (const log of logs) {
    if (!log.details) continue;
    let parsed: SupplementLogDetails;
    try {
      parsed = JSON.parse(log.details);
    } catch {
      continue;
    }
    const nutrients = parsed.nutrients ?? {};
    for (const key of NUTRIENT_KEYS) {
      const value = nutrients[key];
      if (typeof value === 'number') {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }
  return totals;
}
