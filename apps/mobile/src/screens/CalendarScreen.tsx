import { useState } from 'react';
import { ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { YStack, XStack, Text, View } from 'tamagui';
import { useCalendar } from '../hooks/useDb';
import { formatDate, completeInstance } from '../db/database';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight, Check } from '../icons';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function WeekStrip({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate() - selected.getDay());
  const today = formatDate(new Date());

  return (
    <XStack paddingHorizontal="$4" gap="$1">
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(startOfWeek, i);
        const isSelected = formatDate(day) === formatDate(selected);
        const isToday = formatDate(day) === today;

        return (
          <TouchableOpacity
            key={i}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(day); }}
            style={{ flex: 1, alignItems: 'center', gap: 6 }}
          >
            <Text fontSize={10} fontWeight="600" color="$textTertiary" style={{ letterSpacing: 0.5 }}>
              {DAYS[day.getDay()]}
            </Text>
            <View
              width={34} height={34} borderRadius="$6"
              backgroundColor={isSelected ? '$text' : 'transparent'}
              alignItems="center" justifyContent="center"
            >
              <Text
                fontSize="$3"
                fontWeight={isToday ? '800' : '400'}
                color={isSelected ? 'white' : isToday ? '$blue' : '$text'}
              >
                {day.getDate()}
              </Text>
            </View>
            {isToday && !isSelected && (
              <View width={4} height={4} borderRadius="$6" backgroundColor="$blue" />
            )}
          </TouchableOpacity>
        );
      })}
    </XStack>
  );
}

export function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(new Date());
  const dateStr = formatDate(selected);
  const { items, instances, refresh } = useCalendar(dateStr);
  const today = formatDate(new Date());
  const isToday = dateStr === today;

  const goWeek = (dir: number) => setSelected(prev => addDays(prev, dir * 7));

  const handleComplete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeInstance(id);
    refresh();
  };

  const isEmpty = items.length === 0 && instances.length === 0;

  return (
    <YStack flex={1} backgroundColor="$bg" paddingTop={insets.top + 16}>

      {/* Month + nav */}
      <XStack paddingHorizontal="$4" alignItems="center" justifyContent="space-between" marginBottom="$4">
        <TouchableOpacity onPress={() => goWeek(-1)} hitSlop={16}>
          <ChevronLeft size={20} color="rgba(13,13,13,0.4)" strokeWidth={2} />
        </TouchableOpacity>

        <YStack alignItems="center">
          <Text fontSize="$5" fontWeight="800" color="$text" style={{ letterSpacing: -0.3 }}>
            {MONTHS[selected.getMonth()]}
          </Text>
          <Text fontSize={11} fontWeight="600" color={isToday ? '$blue' : '$textTertiary'}>
            {isToday ? 'Today' : selected.getFullYear()}
          </Text>
        </YStack>

        <TouchableOpacity onPress={() => goWeek(1)} hitSlop={16}>
          <ChevronRight size={20} color="rgba(13,13,13,0.4)" strokeWidth={2} />
        </TouchableOpacity>
      </XStack>

      {/* Week strip */}
      <WeekStrip selected={selected} onSelect={setSelected} />

      {/* Divider */}
      <View height={0.5} backgroundColor="$separator" marginTop="$4" marginBottom="$4" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {isEmpty ? (
          <YStack alignItems="center" paddingTop={60} gap="$3">
            <Text fontSize={44} style={{ opacity: 0.2 }}>◯</Text>
            <Text fontSize="$5" fontWeight="800" color="$text">Nothing here</Text>
            <Text fontSize="$2" color="$textSecondary" textAlign="center">
              {isToday ? 'Your day is clear.' : 'No items for this date.'}
            </Text>
            {!isToday && (
              <TouchableOpacity onPress={() => setSelected(new Date())} style={{ marginTop: 8 }}>
                <Text fontSize="$2" color="$blue" fontWeight="700">Go to today →</Text>
              </TouchableOpacity>
            )}
          </YStack>
        ) : (
          <YStack gap="$4">

            {/* Instances — protocol style */}
            {instances.length > 0 && (
              <YStack>
                <Text fontSize={11} fontWeight="700" color="$textTertiary" style={{ letterSpacing: 1, textTransform: 'uppercase' }} marginBottom="$3">
                  Scheduled ({instances.length})
                </Text>
                {instances.map((instance, i) => {
                  const isDone = instance.status === 'completed';
                  const isLast = i === instances.length - 1;
                  return (
                    <XStack key={instance.id}>
                      <YStack width={36} alignItems="center">
                        <TouchableOpacity
                          onPress={() => !isDone && handleComplete(instance.id)}
                          style={{
                            width: 22, height: 22, borderRadius: 11, marginTop: 13,
                            borderWidth: isDone ? 0 : 2,
                            borderColor: isDone ? 'transparent' : 'rgba(13,13,13,0.2)',
                            backgroundColor: isDone ? '#34a853' : 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {isDone && <Check size={12} color="white" strokeWidth={3} />}
                        </TouchableOpacity>
                        {!isLast && (
                          <View width={1.5} flex={1} backgroundColor="rgba(13,13,13,0.08)" marginTop={2} />
                        )}
                      </YStack>
                      <YStack
                        flex={1} marginLeft="$2" marginBottom={isLast ? 0 : "$2"}
                        backgroundColor="$surface" borderRadius="$3" padding="$4"
                        shadowColor="black" shadowOffset={{ width: 0, height: 2 }}
                        shadowOpacity={0.04} shadowRadius={6} elevation={1}
                        opacity={isDone ? 0.5 : 1}
                      >
                        <Text fontSize="$3" fontWeight="500" color="$text"
                          textDecorationLine={isDone ? 'line-through' : 'none'}
                        >
                          {instance.itemId}
                        </Text>
                        <Text fontSize={11} color="$textTertiary" marginTop={2} fontWeight="600">
                          {isDone ? 'Completed' : 'Pending'}
                        </Text>
                      </YStack>
                    </XStack>
                  );
                })}
              </YStack>
            )}

            {/* Scheduled items */}
            {items.length > 0 && (
              <YStack>
                <Text fontSize={11} fontWeight="700" color="$textTertiary" style={{ letterSpacing: 1, textTransform: 'uppercase' }} marginBottom="$3">
                  Items ({items.length})
                </Text>
                {items.map((item, i) => {
                  const isLast = i === items.length - 1;
                  return (
                    <XStack key={item.id}>
                      <YStack width={36} alignItems="center">
                        <View width={8} height={8} borderRadius="$6" backgroundColor="$blue" marginTop={18} />
                        {!isLast && <View width={1.5} flex={1} backgroundColor="rgba(13,13,13,0.08)" marginTop={2} />}
                      </YStack>
                      <YStack
                        flex={1} marginLeft="$2" marginBottom={isLast ? 0 : "$2"}
                        backgroundColor="$surface" borderRadius="$3" padding="$4"
                        shadowColor="black" shadowOffset={{ width: 0, height: 2 }}
                        shadowOpacity={0.04} shadowRadius={6} elevation={1}
                      >
                        <Text fontSize="$3" fontWeight="500" color="$text">{item.title}</Text>
                        {item.notes && (
                          <Text fontSize="$2" color="$textSecondary" marginTop={2}>{item.notes}</Text>
                        )}
                        <View
                          alignSelf="flex-start" paddingHorizontal="$2" paddingVertical={2}
                          borderRadius="$2" backgroundColor="$fill" marginTop="$2"
                        >
                          <Text fontSize={10} fontWeight="700" color="$textSecondary" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {item.type}
                          </Text>
                        </View>
                      </YStack>
                    </XStack>
                  );
                })}
              </YStack>
            )}

          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
