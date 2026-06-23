import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata } from '../db/db';
import { Pill as PillIcon, AlertTriangle, ChevronRight, Plus } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { EmptyState, ListRow, MetadataPill, PageHeader, StatCard } from '../components/ui/primitives';
import { EntityCreator } from '../components/creator/EntityCreator';
import { createEntity } from '../db/actions';
import './health.css';

export function Medications() {
  const { inspectEntity } = useInspector();
  const [creatorOpen, setCreatorOpen] = useState(false);

  const allItems = useLiveQuery(() => db.items.where('type').equals('medication').toArray());
  const meds = allItems || [];
  
  const lowStockCount = meds.filter(item => {
    const meta = item.metadata as MedicationMetadata;
    return meta.stockRemaining !== undefined && meta.stockRemaining !== null && meta.stockRemaining <= (meta.refillThreshold || 5);
  }).length;

  const handleSaveEntity = async (_: string, data: any) => {
    try {
      const { title, scheduledDate, tags, ...metadata } = data;
      const safeTitle = title || 'Untitled Medication';
      const safeTags = tags || [];
      
      if (metadata.initialStock !== undefined) {
        metadata.stockRemaining = metadata.initialStock;
      }

      await createEntity('medication', safeTitle, metadata, 'active', scheduledDate, safeTags);
      setCreatorOpen(false);
    } catch (e) {
      console.error('[Medications] FAILED to create entity:', e);
    }
  };

  return (
    <div className="rka-page health-container">
      <PageHeader
        title="Medications"
        subtitle="Manage your medication inventory, doses, and schedules."
      />

      <div className="rka-stat-grid health-summary-grid">
        <StatCard label="Medications" value={meds.length} trend={lowStockCount > 0 ? `${lowStockCount} low stock` : 'tracked items'} />
        <StatCard label="Low Stock" value={lowStockCount} trend="items need refill" />
      </div>
      
      <div className="health-grid" style={{ gridTemplateColumns: '1fr' }}>
        <section className="rka-section">
          <div className="rka-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="rka-section-title" style={{ marginBottom: 0 }}>Medications</h3>
            <button className="rka-icon-button" onClick={() => setCreatorOpen(true)} aria-label="Add Medication">
              <Plus size={20} />
            </button>
          </div>
          {meds.length > 0 ? (
            <div className="rka-list">
              {meds.map(item => {
                const meta = item.metadata as MedicationMetadata;
                const hasStock = meta.stockRemaining !== undefined && meta.stockRemaining !== null;
                const isLowStock = hasStock && meta.stockRemaining <= (meta.refillThreshold || 5);
                
                return (
                  <ListRow
                    key={item.id} 
                    title={item.title}
                    subtitle={meta.dose || 'Dose unset'}
                    leading={<PillIcon size={18} />}
                    metadata={
                      <>
                        {!hasStock ? (
                          <MetadataPill label="Set stock" tone="gray" />
                        ) : (
                          <MetadataPill
                            label={`${meta.stockRemaining} left`}
                            tone={isLowStock ? 'red' : 'green'}
                            icon={isLowStock ? <AlertTriangle size={12} /> : undefined}
                          />
                        )}
                        <MetadataPill label="Daily" tone="blue" />
                      </>
                    }
                    trailing={<ChevronRight size={18} />}
                    onClick={() => inspectEntity(item.id, 'medication')}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<PillIcon size={30} />} title="No active medications" />
          )}
        </section>
      </div>

      {creatorOpen && (
        <EntityCreator 
          entityType="medication"
          onClose={() => setCreatorOpen(false)} 
          onSave={handleSaveEntity} 
        />
      )}
    </div>
  );
}
