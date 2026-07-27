import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuScreen } from '../screens/MenuScreen';
import { AreasScreen } from '../screens/AreasScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { MedicationsScreen } from '../screens/MedicationsScreen';
import { ToGetScreen } from '../screens/ToGetScreen';

const Stack = createNativeStackNavigator();

// AreaDetail/ProjectDetail/ObjectDetail are registered at the root (App.tsx),
// not here — they need to be reachable from any tab (useOpenItem), not just
// from this stack's own Areas/Projects/ToGet list screens. navigate() still
// works for those names from within this stack: React Navigation bubbles an
// unmatched screen name up to the nearest parent navigator that has it.
export function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MenuHome" component={MenuScreen} />
      <Stack.Screen name="Areas" component={AreasScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Upcoming" component={UpcomingScreen} />
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="Medications" component={MedicationsScreen} />
      <Stack.Screen name="ToGet" component={ToGetScreen} />
    </Stack.Navigator>
  );
}
