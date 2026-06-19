import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { logActivity } from '../db/actions';
import { v4 as uuidv4 } from 'uuid';
import { Check, ArrowLeft, Plus } from 'lucide-react';
import { RestTimer } from '../components/common/RestTimer';
import { getMuscleImage } from '../utils/workout';
import { Button, IconButton } from '../components/ui/primitives';
import './active-workout.css';

export function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [duration, setDuration] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

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

    const enhancedBlocks = await Promise.all(exSessions.map(async (es, index) => {
      const sets = allSets[index].sort((a, b) => a.setNumber - b.setNumber);
      let bestStr = '';
      let lastStr = '';
      
      const previousExSessions = await db.exerciseSessions.where('exerciseId').equals(es.exerciseId).toArray();
      const pastExSessions = previousExSessions.filter(p => p.workoutSessionId !== id);
      
      if (pastExSessions.length > 0) {
        const pastSets = await Promise.all(pastExSessions.map(p => db.setEntries.where({ exerciseSessionId: p.id }).toArray()));
        const allPastSets = pastSets.flat().filter(s => s.completed);
        
        if (allPastSets.length > 0) {
          const bestSet = allPastSets.reduce((best, current) => (current.weight || 0) > (best.weight || 0) ? current : best, allPastSets[0]);
          bestStr = `${bestSet.weight}kg × ${bestSet.reps}`;
        }
      }

      return {
        exerciseSession: es,
        exercise: exercises.find(e => e.id === es.exerciseId),
        sets,
        bestStr,
        lastStr
      };
    }));

    return {
      session,
      template,
      blocks: enhancedBlocks
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

  const targetedMuscles = Array.from(new Set(
    blocks.flatMap(b => b.exercise?.metadata?.muscles || [])
  )).filter(Boolean);

  const handleUpdateSet = async (setId: string, field: 'reps' | 'weight', value: number) => {
    await db.setEntries.update(setId, { [field]: value } as any);
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
    setShowSummary(true);
  };

  const handleSaveSummary = async () => {
    await db.workoutSessions.update(session.id, { duration, notes: sessionNotes });
    
    // Calculate total volume
    let totalVolume = 0;
    blocks.forEach(b => {
      b.sets.forEach(s => {
        if (s.completed) {
          totalVolume += (s.weight || 0) * (s.reps || 0);
        }
      });
    });

    await logActivity(session.templateId, 'workout-session', { sessionId: session.id, volume: totalVolume, duration, prs: [] });
    navigate('/home');
  };

  return (
    <div className="active-workout-container">
      {/* Header */}
      <div className="active-workout-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <IconButton label="Go back" icon={<ArrowLeft size={20} />} onClick={() => navigate(-1)} className="back-btn" />
          <div>
            <h2 className="workout-title">{template?.title || 'Workout'}</h2>
            <div className="workout-duration">{formatDuration(duration)}</div>
          </div>
        </div>
        <Button onClick={handleFinish} className="finish-btn" variant="primary">
          Finish
        </Button>
      </div>

      {/* Body */}
      <div className="active-workout-body" style={{ padding: '24px 16px' }}>
        
        {/* Muscle Overview */}
        {targetedMuscles.length > 0 && (
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>{targetedMuscles.join(', ')}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {targetedMuscles.map(m => (
                <div key={m} style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#1D2029', overflow: 'hidden', position: 'relative' }}>
                  <img src={getMuscleImage([m as string])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#FFF' }}>100%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* Vertical Timeline Line */}
          {blocks.length > 0 && <div style={{ position: 'absolute', top: '24px', bottom: '24px', left: '23px', width: '2px', background: '#334155', zIndex: 0 }}></div>}

          {blocks.map((block, bIndex) => {
            const isActive = bIndex === activeExerciseIndex;
            
            if (!isActive) {
              return (
                <div 
                  key={block.exerciseSession.id} 
                  className="accordion-header"
                  onClick={() => setActiveExerciseIndex(bIndex)}
                  style={{ position: 'relative', zIndex: 1, background: '#15171E', marginBottom: '16px', display: 'flex', alignItems: 'center' }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#1D2029', overflow: 'hidden', flexShrink: 0, marginRight: '16px' }}>
                    <img src={block.exercise?.metadata?.image || getMuscleImage(block.exercise?.metadata?.muscles)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 500, color: '#F8FAFC' }}>{block.exercise?.title || 'Unknown Exercise'}</div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      {block.sets.filter(s => s.completed).length} / {block.sets.length} sets
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={block.exerciseSession.id} className="exercise-block" style={{ position: 'relative', zIndex: 1, background: '#15171E', marginBottom: '32px' }}>
                <div className="accordion-header active" style={{ display: 'flex', alignItems: 'center', padding: '0 0 16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#1D2029', overflow: 'hidden', flexShrink: 0, marginRight: '16px', border: '2px solid #0EA5E9' }}>
                    <img src={block.exercise?.metadata?.image || getMuscleImage(block.exercise?.metadata?.muscles)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="exercise-title" style={{ margin: 0, color: '#F8FAFC', fontSize: '18px' }}>
                      {block.exercise?.title || 'Unknown Exercise'}
                    </h3>
                  </div>
                </div>
              
                <div className="exercise-history-preview" style={{ marginLeft: '64px', marginBottom: '16px' }}>
                  {block.bestStr && <span>Best: {block.bestStr}</span>}
                </div>
              
                {/* Headers */}
                <div className="set-header-row" style={{ marginLeft: '64px' }}>
                  <div style={{ width: '32px', textAlign: 'center' }}>Set</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>kg</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>Reps</div>
                  <div style={{ width: '48px', textAlign: 'center' }}>✓</div>
                </div>

                {/* Sets */}
                <div style={{ marginLeft: '64px' }}>
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

                  <Button
                    onClick={() => handleAddSet(block.exerciseSession.id, block.sets.length)}
                    variant="secondary"
                    icon={<Plus size={16} />}
                    className="add-set-btn"
                  >
                    Add Set
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Finish Summary Modal */}
      {showSummary && (
        <div className="finish-modal-overlay">
        <div className="finish-modal-content">
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{template?.title} Completed</h2>
          <div style={{ fontSize: '15px', color: 'var(--accent-color)', fontWeight: 600, textAlign: 'center', marginBottom: '24px' }}>
            {formatDuration(duration)}
          </div>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div className="finish-stat-box">
              <div className="finish-stat-label">Exercises</div>
              <div className="finish-stat-value">{blocks.length}</div>
            </div>
              <div className="finish-stat-box">
                <div className="finish-stat-label">Volume</div>
                <div className="finish-stat-value">
                  {blocks.reduce((acc, b) => acc + b.sets.reduce((sAcc, s) => sAcc + (s.completed ? (s.weight || 0) * (s.reps || 0) : 0), 0), 0)} kg
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block', fontWeight: 600 }}>Notes</label>
              <textarea 
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                placeholder="How did it feel?"
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px', color: '#FFF', fontSize: '15px', minHeight: '80px', outline: 'none', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button onClick={() => setShowSummary(false)} variant="secondary" className="summary-action-btn">
                Cancel
              </Button>
              <Button onClick={handleSaveSummary} variant="primary" className="summary-action-btn">
                Save Session
              </Button>
            </div>
          </div>
        </div>
      )}

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
