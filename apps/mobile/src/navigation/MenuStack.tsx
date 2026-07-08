import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MenuScreen } from '../screens/MenuScreen';
import { AreasScreen } from '../screens/AreasScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { MedicationsScreen } from '../screens/MedicationsScreen';

const Stack = createNativeStackNavigator();

export function MenuStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="MenuHome" component={MenuScreen} />
      <Stack.Screen name="Areas" component={AreasScreen} />
      <Stack.Screen name="Projects" component={ProjectsScreen} />
      <Stack.Screen name="Tasks" component={TasksScreen} />
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="Medications" component={MedicationsScreen} />
    </Stack.Navigator>
  );
}
