import { useState } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from 'react-native';
import { YStack, XStack, Text, View } from 'tamagui';
import { MedicationsScreen } from './MedicationsScreen';
import { FolderKanban, Dumbbell, Pill, ChevronRight, X, Disc3 } from '../icons';

export function MenuScreen({ onAudioPlayerPress }: { onAudioPlayerPress: () => void }) {
  const insets = useSafeAreaInsets();
  const [medOpen, setMedOpen] = useState(false);

  const menuItems = [
    { label: 'Audio Player', sub: 'Pick an MP3 and dock it into a mini-player', icon: Disc3, onPress: onAudioPlayerPress },
    { label: 'Projects', sub: 'Manage your projects and tasks', icon: FolderKanban, onPress: () => {} },
    { label: 'Workouts', sub: 'Templates and exercise library', icon: Dumbbell, onPress: () => {} },
    { label: 'Medications', sub: 'Inventory and schedules', icon: Pill, onPress: () => setMedOpen(true) },
  ];

  return (
    <YStack flex={1} backgroundColor="$bg" paddingTop={insets.top + 16} paddingHorizontal="$4">
      <Text fontSize="$6" fontWeight="700" color="$text" marginBottom="$3">Apps</Text>

      <YStack
        backgroundColor="$surface" borderRadius="$4"
        shadowColor="black" shadowOffset={{ width: 0, height: 8 }}
        shadowOpacity={0.08} shadowRadius={12} elevation={3}
        overflow="hidden"
      >
        {menuItems.map(({ label, sub, icon: Icon, onPress }, i) => (
          <TouchableOpacity key={label} onPress={onPress} activeOpacity={0.7}>
            <XStack
              alignItems="center" gap="$3" padding="$4"
              borderBottomWidth={i < menuItems.length - 1 ? 0.5 : 0}
              borderBottomColor="$separator"
            >
              <View width={36} height={36} borderRadius="$3" backgroundColor="$fill" alignItems="center" justifyContent="center">
                <Icon size={18} color="rgba(60,60,67,0.66)" strokeWidth={1.5} />
              </View>
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="500" color="$text">{label}</Text>
                <Text fontSize="$2" color="$textSecondary" marginTop={2}>{sub}</Text>
              </YStack>
              <ChevronRight size={16} color="rgba(60,60,67,0.42)" strokeWidth={1.5} />
            </XStack>
          </TouchableOpacity>
        ))}
      </YStack>

      {/* Medications modal */}
      <Modal visible={medOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMedOpen(false)}>
        <YStack flex={1} backgroundColor="$bg">
          <XStack paddingTop="$4" paddingHorizontal="$4" paddingBottom="$2" alignItems="center" justifyContent="flex-end">
            <TouchableOpacity onPress={() => setMedOpen(false)} style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(118,118,128,0.12)', alignItems: 'center', justifyContent: 'center' }} hitSlop={12}>
              <X size={18} color="rgba(60,60,67,0.66)" strokeWidth={2} />
            </TouchableOpacity>
          </XStack>
          <MedicationsScreen />
        </YStack>
      </Modal>
    </YStack>
  );
}
