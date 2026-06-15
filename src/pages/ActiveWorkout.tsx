import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { WorkoutInstanceMetadata, WorkoutMetadata } from '../db/db';
import { saveWorkoutInstance, completeWorkout } from '../db/actions';
import { Check, ArrowLeft } from 'lucide-react';

export function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const instance = useLiveQuery(() => db.itemInstances.get(id as string), [id]);
  const item = useLiveQuery(() => instance ? db.items.get(instance.itemId) : undefined, [instance]);
  
  const [liveData, setLiveData] = useState<WorkoutInstanceMetadata | null>(null);

  useEffect(() => {
    if (instance && item && !liveData) {
      if (instance.instanceMetadata) {
        setLiveData(instance.instanceMetadata);
      } else if (item.metadata) {
        const template = item.metadata as WorkoutMetadata;
        const initialInstanceData: WorkoutInstanceMetadata = {
          exercises: template.exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets.map(s => ({ ...s, completed: false }))
          }))
        };
        setLiveData(initialInstanceData);
        saveWorkoutInstance(instance.id, initialInstanceData);
      }
    }
  }, [instance, item, liveData]);

  if (!instance || !item || !liveData) return <div className="p-4">Loading workout...</div>;

  const handleUpdateSet = async (exIndex: number, setIndex: number, field: 'reps' | 'weight', value: number) => {
    const newData = { ...liveData };
    newData.exercises[exIndex].sets[setIndex][field] = value;
    setLiveData(newData);
    await saveWorkoutInstance(instance.id, newData);
  };

  const handleToggleSet = async (exIndex: number, setIndex: number) => {
    const newData = { ...liveData };
    newData.exercises[exIndex].sets[setIndex].completed = !newData.exercises[exIndex].sets[setIndex].completed;
    setLiveData(newData);
    await saveWorkoutInstance(instance.id, newData);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const handleFinish = async () => {
    await completeWorkout(instance.id);
    navigate(-1);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-primary)', zIndex: 100, overflowY: 'auto' }}>
      <div className="flex justify-between items-center p-4" style={{ background: 'rgba(17,17,17,0.9)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{item.title}</h2>
        <button onClick={handleFinish} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Finish</button>
      </div>

      <div className="p-4 pb-20">
        {liveData.exercises.map((ex, exIndex) => (
          <div key={exIndex} className="mb-6">
            <h3 className="mb-3" style={{ color: 'var(--accent-color)' }}>{ex.name}</h3>
            <div className="flex-col gap-2">
              {ex.sets.map((set, setIndex) => (
                <div key={setIndex} className={`flex items-center justify-between p-3 rounded-lg`} style={{ background: set.completed ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', opacity: set.completed ? 0.6 : 1, transition: 'all 0.2s', marginBottom: '8px' }}>
                  <div className="text-muted" style={{ width: '20px', fontWeight: 'bold' }}>{setIndex + 1}</div>
                  
                  <div className="flex items-center gap-1">
                    <input type="number" value={set.weight} onChange={e => handleUpdateSet(exIndex, setIndex, 'weight', Number(e.target.value))} style={{ width: '60px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-muted)', color: 'var(--text-primary)', textAlign: 'center', fontSize: '1.2rem', padding: '4px' }} />
                    <span className="text-muted" style={{ fontSize: '0.9rem' }}>kg</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input type="number" value={set.reps} onChange={e => handleUpdateSet(exIndex, setIndex, 'reps', Number(e.target.value))} style={{ width: '50px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--text-muted)', color: 'var(--text-primary)', textAlign: 'center', fontSize: '1.2rem', padding: '4px' }} />
                    <span className="text-muted" style={{ fontSize: '0.9rem' }}>reps</span>
                  </div>

                  <button onClick={() => handleToggleSet(exIndex, setIndex)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: set.completed ? 'var(--success)' : 'transparent', border: `2px solid ${set.completed ? 'var(--success)' : 'var(--text-muted)'}`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    {set.completed && <Check size={20} strokeWidth={3} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
