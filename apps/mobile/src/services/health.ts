import { Platform } from 'react-native';
import { isHealthDataAvailable, requestAuthorization, queryStatisticsForQuantity } from '@kingstinct/react-native-healthkit';

const STEP_COUNT_IDENTIFIER = 'HKQuantityTypeIdentifierStepCount' as const;

export async function requestHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  const available = await isHealthDataAvailable();
  if (!available) return false;
  return requestAuthorization({ toRead: [STEP_COUNT_IDENTIFIER] });
}

export async function getTodayStepCount(): Promise<number> {
  if (Platform.OS !== 'ios') return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const result = await queryStatisticsForQuantity(STEP_COUNT_IDENTIFIER, ['cumulativeSum'], {
    filter: { date: { startDate: startOfDay, endDate: new Date() } },
  });
  return result.sumQuantity?.quantity ?? 0;
}
