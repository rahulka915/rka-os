import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate } from '../db/actions';
import type { MedicationMetadata } from '../db/db';
import { CheckCircle2, Pill, Dumbbell, Calendar as CalendarIcon, Sunrise, Sun, Moon, Clock } from 'lucide-react';
import { CollapsibleTimeBlock } from '../components/ui/CollapsibleTimeBlock';
import { HomeContextBar } from '../components/home/HomeContextBar';
import { useInspector } from '../components/shell/InspectorContext';
import './home.css';

export function Home() {
  const { inspectEntity } = useInspector();
  const todayDate = formatDate(new Date());

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

  return (
    <div className="home-container">
      <h1 className="mt-8" style={{ fontSize: '1.6rem', fontWeight: 600 }}>Good Morning</h1>

      <div className="home-grid">
        <div className="home-main-col">
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title" style={{ display: 'none' }}>Today</h3>
              <button 
                onClick={async () => {
                  const { seedMockData } = await import('../db/seed');
                  await seedMockData();
                }}
                style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#fff', cursor: 'pointer' }}
              >
                Seed Mock Data
              </button>
            </div>
            
            <HomeContextBar />
            
            {todayActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CollapsibleTimeBlock id="anytime" label="Anytime" icon={<Clock size={16} />} items={anytime} defaultExpanded={true} />
                <CollapsibleTimeBlock id="morning" label="Morning" icon={<Sunrise size={16} />} items={morning} defaultExpanded={isMorning} />
                <CollapsibleTimeBlock id="afternoon" label="Afternoon" icon={<Sun size={16} />} items={afternoon} defaultExpanded={isAfternoon} />
                <CollapsibleTimeBlock id="evening" label="Evening" icon={<Moon size={16} />} items={evening} defaultExpanded={isEvening} />
              </div>
            ) : (
              <div className="empty-state">
                <CheckCircle2 size={32} className="empty-state-icon" />
                <div className="empty-state-text">You're all caught up for today.<br/>Press New to schedule something.</div>
              </div>
            )}
          </section>
        </div>

        <div className="home-side-col">
          <section>
            <h3 className="section-title">Medication</h3>
            {meds.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {meds.map(({ item, instance }) => {
                  const meta = item.metadata as MedicationMetadata;
                  const hoursSince = meta?.lastTakenAt ? Math.floor((Date.now() - meta.lastTakenAt) / (1000 * 60 * 60)) : null;
                  return (
                    <div 
                      key={item.id} 
                      className="dashboard-card"
                      style={{ cursor: 'pointer' }}
                      onClick={() => inspectEntity(item.id, 'medication')}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold" style={{ fontSize: '14px' }}>{item.title}</span>
                        <span style={{ fontSize: '12px', color: instance.status === 'completed' ? 'var(--accent-color)' : 'var(--warning)' }}>
                          {instance.status === 'completed' ? 'Taken' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {hoursSince !== null ? `Last taken: ${hoursSince}h ago` : 'Not taken recently'} • Stock: {meta?.stockRemaining || 0} left
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <Pill size={24} className="empty-state-icon" />
                <div className="empty-state-text">No medication today.</div>
              </div>
            )}
          </section>

          <section>
            <h3 className="section-title">Workout</h3>
            {workouts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {workouts.map(({ item }) => (
                  <div 
                    key={item.id} 
                    className="dashboard-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => inspectEntity(item.id, 'workout')}
                  >
                    <span className="font-semibold" style={{ fontSize: '14px' }}>{item.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <Dumbbell size={24} className="empty-state-icon" />
                <div className="empty-state-text">Rest day.</div>
              </div>
            )}
          </section>

          <section>
            <h3 className="section-title">Upcoming</h3>
            {upcomingItems.length > 0 ? (
              <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
                 {upcomingItems.slice(0, 5).map((item, index) => (
                    <div 
                      key={item.id} 
                      style={{ padding: '12px 16px', borderBottom: index < 4 ? '1px solid var(--border-color)' : 'none', fontSize: '14px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                      onClick={() => inspectEntity(item.id, item.type)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{item.title}</span>
                      <span className="text-muted" style={{ fontSize: '12px' }}>{item.scheduledDate}</span>
                    </div>
                 ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '24px 16px' }}>
                <CalendarIcon size={24} className="empty-state-icon" />
                <div className="empty-state-text">Nothing on the horizon.</div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
