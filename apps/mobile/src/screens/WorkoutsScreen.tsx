import { useWorkouts } from '../hooks/useDb';
import { ItemListScreen } from '../components/ItemListScreen';

export function WorkoutsScreen() {
  const { workouts, refresh } = useWorkouts();

  return (
    <ItemListScreen
      itemType="workout-template"
      items={workouts}
      refresh={refresh}
      emptyTitle="No workout templates yet"
      emptySub="Add one below to get started"
      placeholder="New workout template..."
    />
  );
}
