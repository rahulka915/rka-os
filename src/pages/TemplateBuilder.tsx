import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Plus, Search, X, GripVertical, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getMuscleImage } from '../utils/workout';
import { Button, IconButton } from '../components/ui/primitives';
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

    await db.transaction('rw', [db.items, db.entityLinks, db.syncQueue], async () => {
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
          const blockExerciseLinks = await db.entityLinks.where({ sourceId: blockId, linkType: 'includes_exercise' }).toArray();
          for (const link of blockExerciseLinks) {
            await db.entityLinks.delete(link.id);
          }
          await db.items.delete(blockId);
        }
        for (const link of oldBlockLinks) {
          await db.entityLinks.delete(link.id);
        }
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
          <IconButton label="Go back" icon={<ArrowLeft size={20} />} onClick={() => navigate(-1)} className="back-btn" />
          <input 
            type="text" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            className="template-title-input"
            placeholder="Template Name"
          />
        </div>
        <Button onClick={handleSave} disabled={isSaving} icon={<Save size={16} />} className="save-btn">
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Body */}
      <div className="builder-body">
        
        {/* Muscle Overview */}
        {targetedMuscles.length > 0 && (
          <div className="builder-muscle-summary">
            <div className="builder-muscle-title">{targetedMuscles.join(', ')}</div>
            <div className="builder-muscle-grid">
              {targetedMuscles.map(m => (
                <div key={m} className="builder-muscle-card">
                  <img src={getMuscleImage([m])} alt="" className="builder-muscle-image" />
                  <div className="builder-muscle-percent">100%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="builder-block-stack">
          {/* Vertical Timeline Line */}
          {blocks.length > 0 && <div className="builder-timeline-line"></div>}

          {blocks.map((block) => (
            <div key={block.id} className="builder-block">
              <div className="builder-block-header">
                <div className="builder-grip">
                  <GripVertical size={16} color="var(--rka-text-tertiary)" />
                </div>
                <input 
                  type="text" 
                  value={block.title} 
                  onChange={e => handleUpdateBlockTitle(block.id, e.target.value)}
                  className="block-title-input"
                />
                <IconButton label={`Remove block ${block.title}`} icon={<X size={16} />} onClick={() => handleRemoveBlock(block.id)} className="remove-btn" />
              </div>

              <div className="builder-exercise-list">
                {block.exercises.map(ex => (
                  <div key={ex.id} className="builder-exercise-item">
                    <div className="builder-exercise-main">
                      <div className="builder-exercise-thumb">
                        <img src={ex.metadata?.image || getMuscleImage(ex.metadata?.muscles)} alt="" className="builder-exercise-thumb-image" />
                      </div>
                      <div className="builder-exercise-copy">
                        <div className="builder-exercise-name">{ex.name}</div>
                        <div className="builder-exercise-meta">{ex.metadata?.muscles?.[0] || 'Various'}</div>
                      </div>
                    </div>
                    <IconButton label={`Remove exercise ${ex.name}`} icon={<X size={14} />} onClick={() => handleRemoveExercise(block.id, ex.id)} className="remove-btn" />
                  </div>
                ))}
              </div>

              <div className="builder-add-exercise-row">
                <Button onClick={() => setShowExerciseModal(block.id)} variant="secondary" icon={<Plus size={16} />} className="add-exercise-btn">
                  Add an exercise
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleAddBlock} variant="secondary" icon={<Plus size={18} />} className="add-block-btn">
          Add Block
        </Button>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <div className="exercise-modal-overlay">
          <div className="exercise-modal-content">
            <div className="exercise-modal-header" style={{ padding: '20px 20px 12px' }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowExerciseModal(null);
                  setSelectedExercisesForModal([]);
                }}
                className="exercise-modal-cancel"
              >
                Cancel
              </Button>
              <h3 className="exercise-modal-title">Add Exercise</h3>
              <div className="exercise-modal-spacer"></div>
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

            <div className="exercise-filter-row">
              <Button variant="secondary" className="exercise-filter-btn">All Equipment</Button>
              <Button variant="secondary" className="exercise-filter-btn">All Muscles</Button>
            </div>

            <div className="exercise-results">
              <div className="exercise-results-kicker">Library</div>
              {allExercises
                .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(ex => {
                  const isSelected = selectedExercisesForModal.some(e => e.exerciseId === ex.id);
                  return (
                    <div 
                      key={ex.id} 
                      className="exercise-result-item"
                      onClick={() => handleToggleExerciseModal(ex.id, ex.title)}
                      data-selected={isSelected ? 'true' : 'false'}
                    >
                      <div className="exercise-result-main">
                        <div className="exercise-result-thumb">
                          <img src={ex.metadata?.image || getMuscleImage(ex.metadata?.muscles)} alt="" className="exercise-result-thumb-image" />
                        </div>
                        <div className="exercise-result-copy">
                          <div className="exercise-result-name">{ex.title}</div>
                          <div className="exercise-result-meta">
                            {ex.metadata?.muscles?.[0] || 'Full Body'} • {ex.metadata?.equipment || 'Bodyweight'}
                          </div>
                        </div>
                      </div>
                      <div className="exercise-result-check">
                        {isSelected && <div className="exercise-result-check-dot"></div>}
                      </div>
                    </div>
                  );
                })}
            </div>

            {selectedExercisesForModal.length > 0 && (
              <div className="exercise-modal-footer">
                <Button 
                  onClick={handleConfirmExercises}
                  variant="primary"
                  className="exercise-confirm-btn"
                >
                  Add {selectedExercisesForModal.length} exercise{selectedExercisesForModal.length > 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
