import { View } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import type { StockBreakdown } from '../db/database';

interface MedicationStockMeterProps {
  breakdown: StockBreakdown;
}

// Visual stand-in for the container/sheet math: one rounded segment per container, sized by
// its share of total capacity and filled by how much of it remains. Thin internal ticks mark
// sheet boundaries when configured. No numbers here — the row above already says "N left".
export function MedicationStockMeter({ breakdown }: MedicationStockMeterProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { capacity, containers } = breakdown;
  if (capacity === 0) return null;

  const fillColor = isDark ? '#3dbb5e' : '#34a853';

  return (
    <View style={{ flexDirection: 'row', gap: 3, height: 8 }}>
      {containers.map((c, i) => {
        const fillPct = c.total > 0 ? c.remaining / c.total : 0;
        return (
          <View
            key={i}
            style={{
              flex: c.total,
              height: 8,
              borderRadius: 4,
              backgroundColor: palette.fill,
              overflow: 'hidden',
              flexDirection: 'row',
            }}
          >
            <View
              style={{
                width: `${fillPct * 100}%`,
                height: '100%',
                backgroundColor: fillColor,
              }}
            />
            {c.sheets && c.sheets.length > 1 && (
              <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' }}>
                {c.sheets.slice(0, -1).map((_, sheetIndex) => (
                  <View
                    key={sheetIndex}
                    style={{
                      position: 'absolute',
                      left: `${((sheetIndex + 1) / c.sheets!.length) * 100}%`,
                      width: 1,
                      height: '100%',
                      backgroundColor: palette.bg,
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
