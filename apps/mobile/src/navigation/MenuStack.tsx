import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuScreen } from '../screens/MenuScreen';
import { AreasScreen } from '../screens/AreasScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import { UpcomingScreen } from '../screens/UpcomingScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { ExerciseLibraryScreen } from '../screens/ExerciseLibraryScreen';
import { ExerciseMuscleGroupScreen } from '../screens/ExerciseMuscleGroupScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
import { WorkoutTemplateDetailScreen } from '../screens/WorkoutTemplateDetailScreen';
import { WorkoutSessionScreen } from '../screens/WorkoutSessionScreen';
import { MedicationsScreen } from '../screens/MedicationsScreen';
import { ToGetScreen } from '../screens/ToGetScreen';
import { ArchiveScreen } from '../screens/ArchiveScreen';

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
      <Stack.Screen name="Habits" component={HabitsScreen} />
      <Stack.Screen name="Upcoming" component={UpcomingScreen} />
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
      <Stack.Screen name="ExerciseMuscleGroup" component={ExerciseMuscleGroupScreen} />
      <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
      <Stack.Screen name="WorkoutTemplateDetail" component={WorkoutTemplateDetailScreen} />
      <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} />
      <Stack.Screen name="Medications" component={MedicationsScreen} />
      <Stack.Screen name="ToGet" component={ToGetScreen} />
      <Stack.Screen name="Archive" component={ArchiveScreen} />
    </Stack.Navigator>
  );
}
