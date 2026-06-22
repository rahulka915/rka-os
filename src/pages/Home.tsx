import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate } from '../db/actions';
import type { MedicationMetadata } from '../db/db';
import { CheckCircle2, Pill, Dumbbell, Calendar as CalendarIcon, Sunrise, Sun, Moon, Clock, Database, Loader2 } from 'lucide-react';
import { CollapsibleTimeBlock } from '../components/ui/CollapsibleTimeBlock';
import { HomeContextBar } from '../components/home/HomeContextBar';
import { useInspector } from '../components/shell/InspectorContext';
import { QuickMedicationLogger } from '../components/medications/QuickMedicationLogger';
import { Button, EmptyState, ListRow, MetadataPill, PageHeader, StatCard } from '../components/ui/primitives';
import './home.css';

export function Home() {
  const { inspectEntity } = useInspector();
  const todayDate = formatDate(new Date());
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'done' | 'error'>('idle');
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isMedLoggerOpen, setIsMedLoggerOpen] = useState(false);

  const currentHour = new Date().getHours();
  const isMorning = currentHour >= 5 && currentHour < 12;
  const isAfternoon = currentHour >= 12 && currentHour < 17;
  const isEvening = currentHour >= 17 || currentHour < 5;

  const instances = useLiveQuery(
    () => db.itemInstances.where('scheduledDate').equals(todayDate).toArray(),
    []
  );

  const itemsWithInstances = useLiveQuery(async () => {
    if (!instances) return [];
    const parentItems = await Promise.all(instances.map(inst => db.items.get(inst.itemId)));
    return instances.map((instance, index) => ({ instance, item: parentItems[index]! })).filter(entry => entry.item !== undefined);
  }, [instances]);

  const allItems = useLiveQuery(() => db.items.toArray());
  const upcomingItems = allItems?.filter(i => i.status === 'active' && i.scheduledDate && i.scheduledDate > todayDate) || [];

  const todayActions = itemsWithInstances || [];
  const meds = itemsWithInstances?.filter(i => i.item.type === 'medication') || [];
  const workouts = itemsWithInstances?.filter(i => i.item.type === 'workout-template') || [];

  // Group actions by timeOfDay
  const anytime = todayActions.filter(i => !i.item.metadata?.timeOfDay || i.item.metadata?.timeOfDay === 'anytime');
  const morning = todayActions.filter(i => i.item.metadata?.timeOfDay === 'morning');
  const afternoon = todayActions.filter(i => i.item.metadata?.timeOfDay === 'afternoon');
  const evening = todayActions.filter(i => i.item.metadata?.timeOfDay === 'evening');
  const greeting = isMorning ? 'Good morning' : isAfternoon ? 'Good afternoon' : 'Good evening';

  return (
    <div className="rka-page home-container">
      <div className="home-hero-row">
        <PageHeader
          kicker="Overview"
          title={greeting}
          subtitle="Your local-first second brain, organized around what needs attention right now."
        />
        <Button
          variant="secondary"
          icon={seedStatus === 'seeding' ? <Loader2 size={16} className="rka-spin" /> : <Database size={16} />}
          disabled={seedStatus === 'seeding'}
          onClick={async () => {
            setSeedStatus('seeding');
            setSeedMessage('Preparing seed...');
            try {
              const { seedMockData } = await import('../db/seed');
              const result = await seedMockData(message => setSeedMessage(message));
              setSeedStatus('done');
              setSeedMessage(
                result.remoteVerified
                  ? `Seeded ${result.localCounts.items} items and confirmed Supabase sync.`
                  : `Seeded locally, but Supabase counts did not match yet. Auth user: ${result.userId.slice(0, 8)}. Sync user: ${result.syncUserId?.slice(0, 8) ?? 'none'}. Suppression: ${result.remoteWriteSuppressionDepth}. Item writes: ${result.remoteWriteStats.items ?? 0}. Instance writes: ${result.remoteWriteStats.itemInstances ?? 0}. Log writes: ${result.remoteWriteStats.activityLogs ?? 0}. Items ${result.remoteCounts?.items ?? 0}/${result.localCounts.items}, instances ${result.remoteCounts?.itemInstances ?? 0}/${result.localCounts.itemInstances}, logs ${result.remoteCounts?.activityLogs ?? 0}/${result.localCounts.activityLogs}.`
              );
            } catch (error) {
              setSeedStatus('error');
              setSeedMessage(error instanceof Error ? error.message : 'Seed failed.');
            }
          }}
        >
          {seedStatus === 'seeding' ? 'Seeding...' : 'Seed'}
        </Button>
      </div>

      {seedMessage && (
        <p className={`home-seed-status is-${seedStatus}`}>
          {seedMessage}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button 
          onClick={() => setIsMedLoggerOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rka-blue-soft)', color: 'var(--rka-blue)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
        >
          <Pill size={16} /> Log Med
        </button>
      </div>

      <div className="rka-stat-grid">
        <StatCard label="Today" value={todayActions.length} trend="scheduled actions" />
        <StatCard label="Upcoming" value={upcomingItems.length} trend="active plans" />
      </div>

      {isMedLoggerOpen && <QuickMedicationLogger onClose={() => setIsMedLoggerOpen(false)} />}

      <div className="home-grid">
        <div className="home-main-col">
          <section className="rka-section">
            <h3 className="rka-section-title">Today</h3>
            <HomeContextBar />
            
            {todayActions.length > 0 ? (
              <div className="time-block-stack">
                <CollapsibleTimeBlock id="anytime" label="Anytime" icon={<Clock size={16} />} items={anytime} defaultExpanded={true} />
                <CollapsibleTimeBlock id="morning" label="Morning" icon={<Sunrise size={16} />} items={morning} defaultExpanded={isMorning} />
                <CollapsibleTimeBlock id="afternoon" label="Afternoon" icon={<Sun size={16} />} items={afternoon} defaultExpanded={isAfternoon} />
                <CollapsibleTimeBlock id="evening" label="Evening" icon={<Moon size={16} />} items={evening} defaultExpanded={isEvening} />
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 size={30} />}
                title="All caught up"
                description="Press New to schedule something for today."
              />
            )}
          </section>
        </div>

        <div className="home-side-col">
          <section className="rka-section">
            <h3 className="rka-section-title">Medication</h3>
            {meds.length > 0 ? (
              <div className="rka-list">
                {meds.map(({ item, instance }) => {
                  const meta = item.metadata as MedicationMetadata;
                  const hoursSince = meta?.lastTakenAt ? Math.floor((Date.now() - meta.lastTakenAt) / (1000 * 60 * 60)) : null;
                  return (
                    <ListRow
                      key={item.id}
                      title={item.title}
                      subtitle={hoursSince !== null ? `Last taken ${hoursSince}h ago` : 'Not taken recently'}
                      leading={<Pill size={18} />}
                      metadata={
                        <>
                          <MetadataPill label={instance.status === 'completed' ? 'Taken' : 'Pending'} tone={instance.status === 'completed' ? 'green' : 'orange'} />
                          <MetadataPill label={`${meta?.stockRemaining || 0} left`} tone="gray" />
                        </>
                      }
                      onClick={() => inspectEntity(item.id, 'medication')}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={<Pill size={24} />} title="No medication today" />
            )}
          </section>

          <section className="rka-section">
            <h3 className="rka-section-title">Workout</h3>
            {workouts.length > 0 ? (
              <div className="rka-list">
                {workouts.map(({ item }) => (
                  <ListRow
                    key={item.id}
                    title={item.title}
                    leading={<Dumbbell size={18} />}
                    trailing={<MetadataPill label="Today" tone="blue" />}
                    onClick={() => inspectEntity(item.id, 'workout-template')}
                  />
                ))}
              </div>
            ) : (
              <EmptyState icon={<Dumbbell size={24} />} title="Rest day" />
            )}
          </section>

          <section className="rka-section">
            <h3 className="rka-section-title">Upcoming</h3>
            {upcomingItems.length > 0 ? (
              <div className="rka-list">
                 {upcomingItems.slice(0, 5).map((item, index) => (
                    <ListRow
                      key={item.id} 
                      title={item.title}
                      subtitle={item.scheduledDate}
                      leading={<CalendarIcon size={18} />}
                      trailing={index === 4 && upcomingItems.length > 5 ? <MetadataPill label={`+${upcomingItems.length - 5}`} tone="gray" /> : undefined}
                      onClick={() => inspectEntity(item.id, item.type)}
                    />
                 ))}
              </div>
            ) : (
              <EmptyState icon={<CalendarIcon size={24} />} title="Nothing on the horizon" />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
