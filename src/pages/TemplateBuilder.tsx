import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Plus, Search, X, GripVertical, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import './template-builder.css';

interface BuilderExercise {
  id: string;
  exerciseId: string;
  name: string;
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

  const allExercises = useLiveQuery(() => db.items.where('type').equals('exercise').toArray()) || [];

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
            name: ex!.title
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

  const handleAddExerciseToBlock = (exerciseId: string, name: string) => {
    if (!showExerciseModal) return;
    
    setBlocks(blocks.map(b => {
      if (b.id === showExerciseModal) {
        return {
          ...b,
          exercises: [...b.exercises, { id: uuidv4(), exerciseId, name }]
        };
      }
      return b;
    }));
    setShowExerciseModal(null);
    setSearchQuery('');
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
        {blocks.map((block) => (
          <div key={block.id} className="builder-block">
            <div className="builder-block-header">
              <GripVertical size={16} color="var(--text-muted)" style={{ cursor: 'grab' }} />
              <input 
                type="text" 
                value={block.title} 
                onChange={e => handleUpdateBlockTitle(block.id, e.target.value)}
                className="block-title-input"
              />
              <button onClick={() => handleRemoveBlock(block.id)} className="remove-btn"><X size={16} /></button>
            </div>

            <div className="builder-exercise-list">
              {block.exercises.map(ex => (
                <div key={ex.id} className="builder-exercise-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GripVertical size={14} color="var(--border-color)" />
                    <span>{ex.name}</span>
                  </div>
                  <button onClick={() => handleRemoveExercise(block.id, ex.id)} className="remove-btn"><X size={14} /></button>
                </div>
              ))}
            </div>

            <button onClick={() => setShowExerciseModal(block.id)} className="add-exercise-btn">
              <Plus size={16} /> Add Exercise
            </button>
          </div>
        ))}

        <button onClick={handleAddBlock} className="add-block-btn">
          <Plus size={18} /> Add Block
        </button>
      </div>

      {/* Exercise Selection Modal */}
      {showExerciseModal && (
        <div className="exercise-modal-overlay">
          <div className="exercise-modal-content">
            <div className="exercise-modal-header">
              <h3>Select Exercise</h3>
              <button onClick={() => setShowExerciseModal(null)} className="close-btn"><X size={20} /></button>
            </div>
            
            <div className="search-bar">
              <Search size={16} color="var(--text-muted)" />
              <input 
                type="text" 
                placeholder="Search library..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className="exercise-results">
              {allExercises
                .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(ex => (
                <div 
                  key={ex.id} 
                  className="exercise-result-item"
                  onClick={() => handleAddExerciseToBlock(ex.id, ex.title)}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{ex.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ex.metadata?.muscles?.join(', ') || 'Various'} • {ex.metadata?.equipment || 'Bodyweight'}</div>
                  </div>
                  <Plus size={16} color="var(--accent-color)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
