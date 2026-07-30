import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface DetailPanelProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function DetailPanel({ visible, onClose, title, children }: DetailPanelProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title ?? ''}</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },
  panel: {
    width: '38%',
    minWidth: 380,
    height: '100%',
    backgroundColor: webColors.card,
    borderLeftWidth: 1,
    borderLeftColor: webColors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[5],
    paddingVertical: webSpacing[4],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: webSpacing[5],
  },
});
