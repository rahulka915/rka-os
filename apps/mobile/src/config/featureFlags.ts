export const FEATURE_FLAGS = {
  heroEnvironment: process.env.EXPO_PUBLIC_HERO_ENVIRONMENT_ENABLED !== 'false',
} as const;
