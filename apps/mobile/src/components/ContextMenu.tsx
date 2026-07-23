import { useState, useRef } from 'react';
import { Modal, Animated, Pressable, TouchableOpacity, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { YStack, XStack, Text, View } from 'tamagui';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
}

interface ContextMenuProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  delayLongPress?: number;
}

export function ContextMenu({ children, items, style, onPress, onLongPress, onPressOut, delayLongPress = 400 }: ContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    setVisible(true);
  };

  const close = () => setVisible(false);

  return (
    <>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress ?? open}
          onPressOut={onPressOut}
          delayLongPress={delayLongPress}
          activeOpacity={0.8}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 16 }}
          onPress={close}
        >
          <YStack
            backgroundColor="$surface" borderRadius="$4" overflow="hidden"
            shadowColor="black" shadowOffset={{ width: 0, height: 20 }}
            shadowOpacity={0.16} shadowRadius={25} elevation={8}
          >
            {items.map((item, i) => (
              <View key={i}>
                {i > 0 && <View height={0.5} backgroundColor="$separator" marginHorizontal="$4" />}
                <TouchableOpacity
                  onPress={() => {
                    close();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    item.onPress();
                  }}
                >
                  <XStack alignItems="center" gap="$3" paddingVertical="$4" paddingHorizontal="$4" minHeight={50}>
                    {item.icon && <View width={24} alignItems="center">{item.icon}</View>}
                    <Text
                      fontSize="$3"
                      fontWeight="500"
                      color={item.destructive ? '$red' : '$text'}
                    >
                      {item.label}
                    </Text>
                  </XStack>
                </TouchableOpacity>
              </View>
            ))}
          </YStack>
        </Pressable>
      </Modal>
    </>
  );
}
