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
        {blocks.map((block, bIndex) => {
          const isActive = bIndex === activeExerciseIndex;
          
          if (!isActive) {
            return (
              <div 
                key={block.exerciseSession.id} 
                className="accordion-header"
                onClick={() => setActiveExerciseIndex(bIndex)}
              >
                <div className="accordion-title-row">
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>{bIndex + 1}</span>
                  <span style={{ fontSize: '16px', fontWeight: 500 }}>{block.exercise?.title || 'Unknown Exercise'}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {block.sets.filter(s => s.completed).length} / {block.sets.length} sets
                </div>
              </div>
            );
          }

          return (
            <div key={block.exerciseSession.id} className="exercise-block">
              <div className="accordion-header active">
                <h3 className="exercise-title">
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{bIndex + 1}</span>
                  {block.exercise?.title || 'Unknown Exercise'}
                </h3>
              </div>
              
              <div className="exercise-history-preview">
                {block.bestStr && <span>Best: {block.bestStr}</span>}
              </div>
              
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
          );
        })}
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
              <button onClick={() => setShowSummary(false)} style={{ flex: 1, padding: '16px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '12px', fontSize: '16px', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSaveSummary} style={{ flex: 1, padding: '16px', background: 'var(--accent-color)', border: 'none', color: '#FFF', borderRadius: '12px', fontSize: '16px', fontWeight: 600 }}>Save Session</button>
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
