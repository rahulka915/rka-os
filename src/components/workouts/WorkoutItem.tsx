import { Link } from 'react-router-dom';
import type { Item, ItemInstance, WorkoutMetadata } from '../../db/db';
import { Dumbbell } from 'lucide-react';
import '../actions/actions.css';

interface WorkoutItemProps {
  item: Item;
  instance: ItemInstance;
}

export function WorkoutItem({ item, instance }: WorkoutItemProps) {
  const isCompleted = instance.status === 'completed';
  const meta = item.metadata as WorkoutMetadata;
  const numExercises = meta?.exercises?.length || 0;

  return (
    <Link to={`/active-workout/${instance.id}`} style={{ textDecoration: 'none' }}>
      <div className={`action-item flex-col items-start ${isCompleted ? 'completed' : ''}`} style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: 'none', marginBottom: '8px' }}>
        <div className="flex items-center gap-2 mb-2" style={{ color: isCompleted ? 'var(--text-muted)' : 'var(--accent-color)' }}>
          <Dumbbell size={18} />
          <strong style={{ fontSize: '1.1rem', color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{item.title}</strong>
        </div>
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>
          {isCompleted ? 'Workout Completed' : `${numExercises} Exercises • Tap to start`}
        </div>
      </div>
    </Link>
  );
}
