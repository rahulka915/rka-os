import { useState } from 'react';
import { db } from '../../db/db';
import { PlayCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/primitives';

interface MedicationDashboardProps {
  medicationId: string;
}

export function MedicationDashboard({ medicationId }: MedicationDashboardProps) {
  const [isLogging, setIsLogging] = useState(false);

  const handleLogDose = async (startTimer: boolean) => {
    setIsLogging(true);
    try {
      const medication = await db.items.get(medicationId);
      if (!medication) throw new Error('Medication not found');

      const dose = medication.metadata?.dose || '1 dose';

      await db.activityLogs.add({
        id: crypto.randomUUID(),
        entityId: medicationId,
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

      // Optionally deduct stock if we wanted to get fancy, but let's keep it simple for now
    } catch (e) {
      console.error(e);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="medication-dashboard" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
      <div style={{ flex: 1 }}>
        <Button 
          variant="secondary" 
          onClick={() => handleLogDose(false)}
          disabled={isLogging}
        >
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={18} /> Log Dose
          </span>
        </Button>
      </div>
      <div style={{ flex: 1 }}>
        <Button 
          variant="primary" 
          onClick={() => handleLogDose(true)}
          disabled={isLogging}
        >
          <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <PlayCircle size={18} /> Start Timer
          </span>
        </Button>
      </div>
    </div>
  );
}
