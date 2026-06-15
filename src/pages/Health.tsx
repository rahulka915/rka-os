import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { formatDate } from '../db/actions';

export function Health() {
  const medications = useLiveQuery(() => db.items.where('type').equals('medication').toArray());

  const handleAddMedication = async () => {
    const title = prompt('Medication Name (e.g. Elvanse):');
    if (!title) return;
    const dosage = prompt('Dosage (e.g. 50mg):');
    const stockStr = prompt('Current Stock:');
    
    const stock = parseInt(stockStr || '0', 10);
    
    const meta: MedicationMetadata = {
      dosage: dosage || '',
      stock,
      stockUnit: 'pills'
    };
    
    await db.items.add({
      id: uuidv4(),
      type: 'medication',
      title,
      metadata: meta
    });
  };

  const handleRefill = async (id: string, currentStock: number) => {
    const amountStr = prompt('How many added to stock?');
    if (!amountStr) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount)) return;
    
    const item = await db.items.get(id);
    if (item && item.metadata) {
      item.metadata.stock = currentStock + amount;
      await db.items.update(id, { metadata: item.metadata });
    }
  };

  const handleScheduleToday = async (id: string) => {
    await db.itemInstances.add({
      id: uuidv4(),
      itemId: id,
      scheduledDate: formatDate(new Date()),
      status: 'pending'
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mt-4 mb-4">
        <h1>Health</h1>
        <button onClick={handleAddMedication} style={{background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600}}>Add Med</button>
      </div>
      
      <h2>Medications</h2>
      {medications?.length === 0 && <p className="text-muted">No medications tracked.</p>}
      
      <div className="action-list">
        {medications?.map(med => {
          const meta = med.metadata as MedicationMetadata;
          return (
            <div key={med.id} className="action-item flex-col" style={{alignItems: 'flex-start', padding: '16px 0'}}>
              <div className="flex justify-between items-center" style={{width: '100%'}}>
                <strong>{med.title}</strong>
                <div className="flex gap-2">
                  <button onClick={() => handleScheduleToday(med.id)} style={{background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px'}}>+ Today</button>
                  <button onClick={() => handleRefill(med.id, meta.stock)} style={{background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px'}}>Refill</button>
                </div>
              </div>
              <div className="text-muted mt-2" style={{fontSize: '0.85rem'}}>
                Dosage: {meta.dosage} &bull; Stock: {meta.stock} {meta.stockUnit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
