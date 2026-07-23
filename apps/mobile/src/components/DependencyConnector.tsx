import { View, StyleSheet } from 'react-native';
import { ChevronDown } from '../icons';
import { getThemeColors } from '../theme';

const ICON_SIZE = 12;

interface DependencyConnectorProps {
  isDark: boolean;
  // Horizontal center of the checkbox column above/below, in px from the row's
  // left edge — lets each screen's differently-padded rows line the connector
  // up with their own checkboxes.
  leftOffset: number;
}

// "Skill tree" style unlock line — drawn between two adjacent rows when the
// lower one is directly blocked by the upper one, so a dependency chain the
// user builds in order reads as a literal connected chain.
//
// Rendered as an absolute-positioned OVERLAY that reaches up into the uniform
// gap above its row and contributes ZERO height to the cell. This is load-
// bearing for drag-to-reorder: react-native-draggable-flatlist assumes each
// cell's measured height is a stable function of the item, not its position.
// The connector's presence is inherently order-dependent, so it must never
// affect layout — otherwise reordering changes cached cell measurements and
// the drag engine renders rows overlapping/clipped. Only meaningful when both
// rows are adjacent in the same flat list; non-adjacent dependencies fall back
// to BlockedBadge's text-only indicator.
export function DependencyConnector({ isDark, leftOffset }: DependencyConnectorProps) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={[styles.stack, { marginLeft: leftOffset - ICON_SIZE / 2 }]}>
        <View style={[styles.line, { backgroundColor: palette.separatorStrong }]} />
        <ChevronDown size={ICON_SIZE} color={palette.textTertiary} strokeWidth={2.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    // Sits in the gap above the row (its parent cell), drawing upward from the
    // row's top edge into the uniform gap separating it from the row above.
    // Height is not reserved in layout — hence zero effect on cell height.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  stack: {
    width: ICON_SIZE,
    alignItems: 'center',
  },
  line: {
    width: 2,
    height: 9,
    borderRadius: 1,
    marginBottom: -3,
  },
});
