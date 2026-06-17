import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Plus, Search, X, GripVertical, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getMuscleImage } from '../utils/workout';
import './template-builder.css';

interface BuilderExercise {
  id: string;
  exerciseId: string;
  name: string;
  metadata?: any;
}

interface BuilderBlock {
  id: string;
  title: string;
  exercises: BuilderExercise[];
}

export function TemplateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [title, setTitle] = useState('New Template');
  const [blocks, setBlocks] = useState<BuilderBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Exercise Selection Modal State
  const [showExerciseModal, setShowExerciseModal] = useState<string | null>(null); // block id
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExercisesForModal, setSelectedExercisesForModal] = useState<any[]>([]);

  const allExercises = useLiveQuery(() => db.items.where('type').equals('exercise').toArray()) || [];

  // Compute targeted muscles for the overview
  const targetedMuscles = Array.from(new Set(
    blocks.flatMap(b => b.exercises.flatMap(e => e.metadata?.muscles || []))
  )).filter(Boolean);

  // Load existing template data
  useEffect(() => {
    async function load() {
      if (!id || id === 'new') return;
      
      const template = await db.items.get(id);
      if (template) setTitle(template.title);

      const blockLinks = await db.entityLinks.where({ sourceId: id, linkType: 'contains' }).toArray();
      const blockItems = await Promise.all(blockLinks.map(l => db.items.get(l.targetId)));
      
      const loadedBlocks: BuilderBlock[] = [];
      
      for (const block of blockItems) {
        if (!block || block.type !== 'workout-block') continue;
        
        const exLinks = await db.entityLinks.where({ sourceId: block.id, linkType: 'includes_exercise' }).toArray();
        const exercises = await Promise.all(exLinks.map(l => db.items.get(l.targetId)));
        
        loadedBlocks.push({
          id: block.id,
          title: block.title,
          exercises: exercises.filter(Boolean).map(ex => ({
            id: uuidv4(),
            exerciseId: ex!.id,
            name: ex!.title,
            metadata: ex!.metadata
          }))
        });
      }
      
      setBlocks(loadedBlocks.length > 0 ? loadedBlocks : [{ id: uuidv4(), title: 'Main Block', exercises: [] }]);
    }
    load();
  }, [id]);

  const handleAddBlock = () => {
    setBlocks([...blocks, { id: uuidv4(), title: 'New Block', exercises: [] }]);
  };

  const handleUpdateBlockTitle = (blockId: string, newTitle: string) => {
    setBlocks(blocks.map(b => b.id === blockId ? { ...b, title: newTitle } : b));
  };

  const handleRemoveBlock = (blockId: string) => {
    setBlocks(blocks.filter(b => b.id !== blockId));
  };

  const handleToggleExerciseModal = (exId: string, exTitle: string) => {
    const isSelected = selectedExercisesForModal.some(e => e.exerciseId === exId);
    if (isSelected) {
      setSelectedExercisesForModal(selectedExercisesForModal.filter(e => e.exerciseId !== exId));
    } else {
      setSelectedExercisesForModal([...selectedExercisesForModal, { exerciseId: exId, name: exTitle }]);
    }
  };

  const handleConfirmExercises = () => {
    if (!showExerciseModal || selectedExercisesForModal.length === 0) return;
    
    setBlocks(blocks.map(b => {
      if (b.id === showExerciseModal) {
        const newExercises = selectedExercisesForModal.map(e => ({ ...e, id: uuidv4(), metadata: allExercises.find(ex => ex.id === e.exerciseId)?.metadata }));
        return {
          ...b,
          exercises: [...b.exercises, ...newExercises]
        };
      }
      return b;
    }));
    setShowExerciseModal(null);
    setSearchQuery('');
    setSelectedExercisesForModal([]);
  };

  const handleRemoveExercise = (blockId: string, exerciseTempId: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId) {
        return { ...b, exercises: b.exercises.filter(e => e.id !== exerciseTempId) };
      }
      return b;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    let templateId = id;
    const now = Date.now();

    await db.transaction('rw', db.items, db.entityLinks, async () => {
      // 1. Create or update template
      if (!templateId || templateId === 'new') {
        templateId = uuidv4();
        await db.items.add({
          id: templateId,
          type: 'workout-template',
          title,
          status: 'active',
          metadata: { duration: '1h' },
          createdAt: now,
          updatedAt: now
        });
      } else {
        await db.items.update(templateId, { title, updatedAt: now });
        // Clean up old blocks and links
        const oldBlockLinks = await db.entityLinks.where({ sourceId: templateId, linkType: 'contains' }).toArray();
        for (const l of oldBlockLinks) {
          const blockId = l.targetId;
          await db.entityLinks.where({ sourceId: blockId, linkType: 'includes_exercise' }).delete();
          await db.items.delete(blockId);
        }
        await db.entityLinks.where({ sourceId: templateId, linkType: 'contains' }).delete();
      }

      // 2. Create new blocks and links
      let blockOrder = 0;
      for (const block of blocks) {
        const newBlockId = uuidv4();
        await db.items.add({
          id: newBlockId,
          type: 'workout-block',
          title: block.title,
          status: 'active',
          metadata: { order: blockOrder++ },
          createdAt: now,
          updatedAt: now
        });

        await db.entityLinks.add({ id: uuidv4(), sourceId: templateId!, targetId: newBlockId, linkType: 'contains', createdAt: now });

        for (const ex of block.exercises) {
          await db.entityLinks.add({ id: uuidv4(), sourceId: newBlockId, targetId: ex.exerciseId, linkType: 'includes_exercise', createdAt: now });
        }
      }
    });

    setIsSaving(false);
    navigate(-1);
  };

  return (
    <div className="template-builder-container">
      {/* Header */}
      <div className="builder-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <input 
            type="text" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            className="template-title-input"
            placeholder="Template Name"
          />
        </div>
        <button onClick={handleSave} className="save-btn" disabled={isSaving}>
          {isSaving ? 'Saving...' : <><Save size={16} /> Save</>}
        </button>
      </div>

      {/* Body */}
      <div className="builder-body">
        
        {/* Muscle Overview */}
        {targetedMuscles.length > 0 && (
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#F8FAFC', marginBottom: '16px' }}>{targetedMuscles.join(', ')}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {targetedMuscles.map(m => (
                <div key={m} style={{ width: '64px', height: '64px', borderRadius: '16px', background: '#1D2029', overflow: 'hidden', position: 'relative' }}>
                  <img src={getMuscleImage([m])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                  <div style={{ position: 'absolute', bottom: '4px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#FFF' }}>100%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {/* Vertical Timeline Line */}
          {blocks.length > 0 && <div style={{ position: 'absolute', top: '24px', bottom: '60px', left: '23px', width: '2px', background: '#334155', zIndex: 0 }}></div>}

          {blocks.map((block) => (
            <div key={block.id} className="builder-block">
              <div className="builder-block-header" style={{ position: 'relative', zIndex: 1, background: '#15171E', padding: '8px 0' }}>
                <div style={{ width: '48px', display: 'flex', justifyContent: 'center' }}>
                  <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
                </div>
                <input 
                  type="text" 
                  value={block.title} 
                  onChange={e => handleUpdateBlockTitle(block.id, e.target.value)}
                  className="block-title-input"
                  style={{ color: '#F8FAFC' }}
                />
                <button onClick={() => handleRemoveBlock(block.id)} className="remove-btn"><X size={16} /></button>
              </div>

              <div className="builder-exercise-list">
                {block.exercises.map(ex => (
                  <div key={ex.id} className="builder-exercise-item" style={{ marginLeft: '48px', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#15171E', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={getMuscleImage(ex.metadata?.muscles)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div>
                        <div style={{ color: '#F8FAFC', fontWeight: 500 }}>{ex.name}</div>
                        <div style={{ color: '#64748B', fontSize: '12px' }}>{ex.metadata?.muscles?.[0] || 'Various'}</div>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveExercise(block.id, ex.id)} className="remove-btn"><X size={14} /></button>
                  </div>
                ))}
              </div>

              <div style={{ marginLeft: '48px', zIndex: 1, position: 'relative' }}>
                <button onClick={() => setShowExerciseModal(block.id)} className="add-exercise-btn">
                  <Plus size={16} color="#0EA5E9" /> <span style={{ color: '#0EA5E9' }}>Add an exercise</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleAddBlock} className="add-block-btn">
          <Plus size={18} /> Add Block
        </button>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <div className="exercise-modal-overlay">
          <div className="exercise-modal-content">
            <div className="exercise-modal-header" style={{ padding: '20px 20px 12px' }}>
              <button onClick={() => { setShowExerciseModal(null); setSelectedExercisesForModal([]); }} style={{ color: '#0EA5E9', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}>Cancel</button>
              <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Add Exercise</h3>
              <div style={{ width: '50px' }}></div> {/* Spacer */}
            </div>
            
            <div className="search-bar">
              <Search size={16} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Search exercise" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px' }}>
              <button style={{ flex: 1, padding: '8px', background: '#1D2029', border: 'none', borderRadius: '8px', color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>All Equipment</button>
              <button style={{ flex: 1, padding: '8px', background: '#1D2029', border: 'none', borderRadius: '8px', color: '#F8FAFC', fontSize: '13px', fontWeight: 500 }}>All Muscles</button>
            </div>

            <div className="exercise-results" style={{ paddingBottom: '80px' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500, margin: '16px 0 8px' }}>Library</div>
              {allExercises
                .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(ex => {
                  const isSelected = selectedExercisesForModal.some(e => e.exerciseId === ex.id);
                  return (
                    <div 
                      key={ex.id} 
                      className="exercise-result-item"
                      onClick={() => handleToggleExerciseModal(ex.id, ex.title)}
                      style={{ 
                        borderLeft: isSelected ? '4px solid #0EA5E9' : '4px solid transparent',
                        paddingLeft: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '24px', background: '#15171E', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <img src={getMuscleImage(ex.metadata?.muscles)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: '15px' }}>{ex.title}</div>
                          <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                            {ex.metadata?.muscles?.[0] || 'Full Body'} • {ex.metadata?.equipment || 'Bodyweight'}
                          </div>
                        </div>
                      </div>
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '12px', 
                        border: isSelected ? 'none' : '1px solid #334155',
                        background: isSelected ? '#0EA5E9' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '5px', background: '#FFF' }}></div>}
                      </div>
                    </div>
                  );
                })}
            </div>

            {selectedExercisesForModal.length > 0 && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', background: '#15171E', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button 
                  onClick={handleConfirmExercises}
                  style={{ width: '100%', padding: '16px', background: '#0EA5E9', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add {selectedExercisesForModal.length} exercise{selectedExercisesForModal.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
