import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { MedicationMetadata } from '../../db/db';
import { Pill, CheckCircle2, PlayCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { BottomSheet, Button, ListRow } from '../ui/primitives';

interface QuickMedicationLoggerProps {
  onClose: () => void;
}

export function QuickMedicationLogger({ onClose }: QuickMedicationLoggerProps) {
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  const medications = useLiveQuery(() => db.items.where('type').equals('medication').toArray());
  const logs = useLiveQuery(() => db.activityLogs.toArray());

  const handleLog = async (medId: string, startTimer: boolean) => {
    setIsLogging(true);
    try {
      const med = await db.items.get(medId);
      if (!med) throw new Error('Medication not found');

      const dose = (med.metadata as MedicationMetadata)?.dose || '1 dose';

      await db.activityLogs.add({
        id: crypto.randomUUID(),
        entityId: medId,
        actionType: 'medication-taken',
        timestamp: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: {
          dose,
          timerActive: startTimer,
          startedAt: startTimer ? Date.now() : undefined,
        }
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsLogging(false);
    }
  };

  const renderSelectionList = () => {
    if (!medications) return null;
    if (medications.length === 0) {
      return (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--rka-text-secondary)' }}>
          No medications found. Add one from the Health tab.
        </div>
      );
    }

    return (
      <div className="rka-list">
        {medications.map(med => {
          const meta = med.metadata as MedicationMetadata;
          return (
            <ListRow
              key={med.id}
              title={med.title}
              subtitle={meta.dose || 'Dose unset'}
              leading={<Pill size={18} style={{ color: 'var(--rka-blue)' }} />}
              trailing={<ChevronRight size={18} />}
              onClick={() => setSelectedMedId(med.id)}
            />
          );
        })}
      </div>
    );
  };

  const renderConfirmation = () => {
    if (!medications || !logs || !selectedMedId) return null;
    const med = medications.find(m => m.id === selectedMedId);
    if (!med) return null;

    const metadata = (med.metadata || {}) as MedicationMetadata;
    const maxPerDay = metadata.maxPerDay;
    const minHours = metadata.minHoursBetweenDoses;

    const medLogs = logs.filter(l => l.entityId === selectedMedId && l.actionType === 'medication-taken').sort((a, b) => b.timestamp - a.timestamp);
    
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    const dosesLast24h = medLogs.filter(l => l.timestamp >= twentyFourHoursAgo).length;
    const lastDose = medLogs[0];
    const hoursSinceLastDose = lastDose ? (now - lastDose.timestamp) / (1000 * 60 * 60) : Infinity;

    const isOverDailyLimit = maxPerDay !== undefined && dosesLast24h >= maxPerDay;
    const isTooSoon = minHours !== undefined && hoursSinceLastDose < minHours;
    const isLocked = isOverDailyLimit || isTooSoon;

    return (
      <div style={{ padding: '0 4px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: 48, height: 48, background: 'var(--rka-blue-soft)', color: 'var(--rka-blue)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Pill size={24} />
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600 }}>Log {med.title}?</h3>
          <p style={{ margin: 0, color: 'var(--rka-text-secondary)', fontSize: '14px' }}>{metadata.dose || 'Dose unset'}</p>
        </div>

        {isLocked && (
          <div style={{ background: 'var(--rka-red-soft)', color: 'var(--rka-red)', padding: '12px 16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '24px' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Medication Locked</div>
              <div style={{ fontSize: '13px', opacity: 0.9 }}>
                {isOverDailyLimit 
                  ? `You have reached your daily limit of ${maxPerDay} dose${maxPerDay === 1 ? '' : 's'} in the last 24 hours.`
                  : `You must wait at least ${minHours} hours between doses. (It has only been ${hoursSinceLastDose.toFixed(1)}h)`}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button 
            variant="primary" 
            onClick={() => handleLog(selectedMedId, true)}
            disabled={isLogging || isLocked}
          >
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <PlayCircle size={18} /> Log & Start Timer
            </span>
          </Button>
          <Button 
            variant="secondary" 
            onClick={() => handleLog(selectedMedId, false)}
            disabled={isLogging || isLocked}
          >
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} /> Just Log
            </span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <BottomSheet
      open
      title={selectedMedId ? "Confirm Dose" : "Log Medication"}
      onDismiss={onClose}
      secondaryAction={selectedMedId ? { label: 'Back', onClick: () => setSelectedMedId(null) } : { label: 'Cancel', onClick: onClose }}
    >
      <div style={{ paddingBottom: '16px' }}>
        {selectedMedId ? renderConfirmation() : renderSelectionList()}
      </div>
    </BottomSheet>
  );
}
