import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { logActivity } from '../db/actions';
import { v4 as uuidv4 } from 'uuid';
import { Check, ArrowLeft, Plus } from 'lucide-react';
import { RestTimer } from '../components/common/RestTimer';
import './active-workout.css';

export function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [duration, setDuration] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);

  // Load the full session graph
  const sessionData = useLiveQuery(async () => {
    if (!id) return null;
    const session = await db.workoutSessions.get(id);
    if (!session) return null;
    
    const template = await db.items.get(session.templateId);
    
    const exSessions = await db.exerciseSessions.where({ workoutSessionId: id }).toArray();
    exSessions.sort((a, b) => a.order - b.order);
    
    const exerciseIds = exSessions.map(es => es.exerciseId);
    const exercises = await db.items.where('id').anyOf(exerciseIds).toArray();
    
    const allSets = await Promise.all(exSessions.map(es => 
      db.setEntries.where({ exerciseSessionId: es.id }).toArray()
    ));

    return {
      session,
      template,
      blocks: exSessions.map((es, index) => ({
        exerciseSession: es,
        exercise: exercises.find(e => e.id === es.exerciseId),
        sets: allSets[index].sort((a, b) => a.setNumber - b.setNumber)
      }))
    };
  }, [id]);

  useEffect(() => {
    // Duration counter
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!sessionData) return <div className="p-4" style={{ color: 'var(--text-muted)' }}>Loading session...</div>;

  const { session, template, blocks } = sessionData;

  const formatDuration = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleUpdateSet = async (setId: string, field: 'reps' | 'weight', value: number) => {
    await db.setEntries.update(setId, { [field]: value });
  };

  const handleToggleSet = async (setId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    await db.setEntries.update(setId, { completed: newCompleted });
    
    if (newCompleted) {
      if (navigator.vibrate) navigator.vibrate(50);
      setShowRestTimer(true);
    }
  };

  const handleAddSet = async (exerciseSessionId: string, currentSetsCount: number) => {
    // Try to copy last set's weight/reps if available
    let lastWeight = 0;
    let lastReps = 0;
    
    const block = blocks.find(b => b.exerciseSession.id === exerciseSessionId);
    if (block && block.sets.length > 0) {
      const lastSet = block.sets[block.sets.length - 1];
      lastWeight = lastSet.weight;
      lastReps = lastSet.reps;
    }

    await db.setEntries.add({
      id: uuidv4(),
      exerciseSessionId,
      setNumber: currentSetsCount + 1,
      reps: lastReps,
      weight: lastWeight,
      completed: false
    });
  };

  const handleFinish = async () => {
    await db.workoutSessions.update(session.id, { duration });
    await logActivity(session.templateId, 'workout-session', { sessionId: session.id });
    navigate('/home');
  };

  return (
    <div className="active-workout-container">
      {/* Header */}
      <div className="active-workout-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="workout-title">{template?.title || 'Workout'}</h2>
            <div className="workout-duration">{formatDuration(duration)}</div>
          </div>
        </div>
        <button onClick={handleFinish} className="finish-btn">Finish</button>
      </div>

      {/* Body */}
      <div className="active-workout-body">
        {blocks.map((block) => (
          <div key={block.exerciseSession.id} className="exercise-block">
            <h3 className="exercise-title">{block.exercise?.title || 'Unknown Exercise'}</h3>
            
            {/* Headers */}
            <div className="set-header-row">
              <div style={{ width: '32px', textAlign: 'center' }}>Set</div>
              <div style={{ flex: 1, textAlign: 'center' }}>kg</div>
              <div style={{ flex: 1, textAlign: 'center' }}>Reps</div>
              <div style={{ width: '48px', textAlign: 'center' }}>✓</div>
            </div>

            {/* Sets */}
            {block.sets.map((set, sIndex) => (
              <div key={set.id} className={`set-row ${set.completed ? 'completed' : ''}`}>
                <div className="set-number">{sIndex + 1}</div>
                
                <div className="set-input-group">
                  <input 
                    type="number" 
                    className="set-input"
                    value={set.weight || ''} 
                    onChange={e => handleUpdateSet(set.id, 'weight', Number(e.target.value))} 
                    placeholder="-"
                  />
                </div>

                <div className="set-input-group">
                  <input 
                    type="number" 
                    className="set-input"
                    value={set.reps || ''} 
                    onChange={e => handleUpdateSet(set.id, 'reps', Number(e.target.value))} 
                    placeholder="-"
                  />
                </div>

                <button 
                  className={`set-check-btn ${set.completed ? 'active' : ''}`}
                  onClick={() => handleToggleSet(set.id, set.completed)}
                >
                  <Check size={18} strokeWidth={3} />
                </button>
              </div>
            ))}

            <button 
              className="add-set-btn"
              onClick={() => handleAddSet(block.exerciseSession.id, block.sets.length)}
            >
              <Plus size={16} /> Add Set
            </button>
          </div>
        ))}
      </div>

      {/* Floating Rest Timer */}
      {showRestTimer && (
        <div className="rest-timer-overlay">
          <div className="rest-timer-wrapper">
            <RestTimer initialSeconds={60} autoStart={true} onClose={() => setShowRestTimer(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
