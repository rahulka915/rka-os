import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronLeft, Search, Dumbbell, Filter, Loader2 } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { MetadataPill } from '../components/ui/primitives';
import './exercise-library.css';

export function ExerciseLibrary() {
  const navigate = useNavigate();
  const { inspectEntity } = useInspector();
  const [searchQuery, setSearchQuery] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string>('all');

  const exercises = useLiveQuery(() => db.items.where('type').equals('exercise').toArray());

  const filteredExercises = useMemo(() => {
    if (!exercises) return [];
    let filtered = exercises;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ex => ex.title.toLowerCase().includes(q));
    }

    if (muscleFilter !== 'all') {
      filtered = filtered.filter(ex => {
        const muscles = (ex.metadata?.muscles as string[]) || [];
        return muscles.includes(muscleFilter);
      });
    }

    // Sort alphabetically
    return filtered.sort((a, b) => a.title.localeCompare(b.title));
  }, [exercises, searchQuery, muscleFilter]);

  const allMuscles = useMemo(() => {
    if (!exercises) return [];
    const set = new Set<string>();
    exercises.forEach(ex => {
      const muscles = (ex.metadata?.muscles as string[]) || [];
      muscles.forEach(m => set.add(m));
    });
    return Array.from(set).sort();
  }, [exercises]);

  return (
    <div className="rka-page ex-lib-page">
      <header className="ex-lib-header">
        <div className="ex-lib-header-top">
          <button className="rka-icon-button" onClick={() => navigate('/health-search')} aria-label="Back to Health">
            <ChevronLeft size={24} />
          </button>
          <h1 className="ex-lib-title">Exercise Library</h1>
          <div style={{ width: 40 }} /> {/* spacer for balance */}
        </div>

        <div className="ex-lib-controls">
          <div className="ex-lib-search">
            <Search size={18} className="ex-lib-search-icon" />
            <input 
              type="text" 
              placeholder="Search exercises..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="ex-lib-search-input"
            />
          </div>
          
          <div className="ex-lib-filter-wrapper">
            <Filter size={16} className="ex-lib-filter-icon" />
            <select 
              value={muscleFilter}
              onChange={e => setMuscleFilter(e.target.value)}
              className="ex-lib-filter-select"
            >
              <option value="all">All Muscles</option>
              {allMuscles.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="ex-lib-content">
        {!exercises ? (
          <div className="ex-lib-loading">
            <Loader2 className="rka-spin" size={32} />
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="ex-lib-empty">
            <Dumbbell size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p>No exercises found.</p>
          </div>
        ) : (
          <div className="ex-lib-grouped">
            {Array.from(new Set(filteredExercises.map(ex => (ex.metadata?.muscles as string[])?.[0] || 'other')))
              .sort()
              .map(muscleGroup => {
                const groupExercises = filteredExercises.filter(ex => ((ex.metadata?.muscles as string[])?.[0] || 'other') === muscleGroup);
                
                return (
                  <div key={muscleGroup} className="ex-lib-group" style={{ marginBottom: '32px' }}>
                    <h2 className="rka-section-title" style={{ textTransform: 'capitalize', marginBottom: '16px', position: 'sticky', top: '70px', background: 'var(--rka-bg)', zIndex: 10, padding: '8px 0' }}>
                      {muscleGroup}
                    </h2>
                    <div className="ex-lib-grid">
                      {groupExercises.map(ex => {
                        const muscles = (ex.metadata?.muscles as string[]) || [];
                        const image = ex.metadata?.image as string | undefined;

                        return (
                          <div key={ex.id} className="ex-lib-card" onClick={() => inspectEntity(ex.id, 'exercise')}>
                            <div className="ex-lib-card-icon" style={{ padding: image ? 0 : undefined, overflow: 'hidden', background: image ? 'transparent' : undefined }}>
                              {image ? (
                                <img src={image} alt={ex.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <Dumbbell size={24} strokeWidth={1.5} />
                              )}
                            </div>
                            <h3 className="ex-lib-card-title">{ex.title}</h3>
                            
                            <div className="ex-lib-card-tags">
                              {muscles.slice(0, 2).map(m => (
                                <MetadataPill key={m} label={m} tone="blue" />
                              ))}
                              {muscles.length > 2 && <MetadataPill label={`+${muscles.length - 2}`} tone="gray" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </main>
    </div>
  );
}
