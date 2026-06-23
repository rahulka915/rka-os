import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatDate } from '../db/actions';
import type { Item, ItemInstance } from '../db/db';
import { Clock, Sunrise, Sun, Moon } from 'lucide-react';
import { CollapsibleTimeBlock } from '../components/ui/CollapsibleTimeBlock';
import { HomeContextBar } from '../components/home/HomeContextBar';
import { QuickMedicationLogger } from '../components/medications/QuickMedicationLogger';
import { InboxWidget } from '../components/home/InboxWidget';
import { PageHeader, StatCard } from '../components/ui/primitives';
import './home.css';

import { generateDailyInstances } from '../db/actions';

export function Home() {
  const todayDate = formatDate(new Date());
  const [isMedLoggerOpen, setIsMedLoggerOpen] = useState(false);

  useEffect(() => {
    generateDailyInstances().catch(console.error);
  }, []);

  const currentHour = new Date().getHours();
  const isMorning = currentHour < 12;
  const isAfternoon = currentHour >= 12 && currentHour < 17;
  const isEvening = currentHour >= 17;

  const instances = useLiveQuery(
    () => db.itemInstances.where('scheduledDate').equals(todayDate).toArray(),
    []
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todaysLogs = useLiveQuery(
    () => db.activityLogs.where('timestamp').between(startOfDay.getTime(), endOfDay.getTime()).toArray(),
    []
  );

  const itemsWithInstances = useLiveQuery(async () => {
    const actions: { item: Item, instance: ItemInstance }[] = [];
    
    // 1. Add scheduled instances
    if (instances) {
      const parentItems = await Promise.all(instances.map(inst => db.items.get(inst.itemId)));
      instances.forEach((instance, index) => {
        if (parentItems[index]) {
          actions.push({ instance, item: parentItems[index]! });
        }
      });
    }

    // 2. Add ad-hoc logs (medications/workouts) that don't have a matching completed instance
    if (todaysLogs) {
      for (const log of todaysLogs) {
        if (log.actionType === 'medication-taken' || log.actionType === 'workout-logged') {
          // Check if we already have an instance that covers this (to avoid duplicates for daily meds)
          const hasMatchingInstance = actions.some(a => a.item.id === log.entityId && a.instance.status === 'completed' && Math.abs((a.instance.completedAt || 0) - log.timestamp) < 60000);
          
          if (!hasMatchingInstance) {
            const item = await db.items.get(log.entityId);
            if (item) {
              actions.push({
                item,
                instance: {
                  id: log.id,
                  itemId: log.entityId,
                  scheduledDate: todayDate,
                  status: 'completed',
                  completedAt: log.timestamp,
                  createdAt: log.timestamp,
                  updatedAt: log.timestamp
                }
              });
            }
          }
        }
      }
    }
    
    return actions;
  }, [instances, todaysLogs]);

  const allItems = useLiveQuery(() => db.items.toArray());
  const upcomingItems = allItems?.filter(i => i.status === 'active' && i.scheduledDate && i.scheduledDate > todayDate) || [];

  // Group actions by timeOfDay
  const getEffectiveTimeOfDay = (entry: { item: Item, instance: ItemInstance }) => {
    const { item, instance } = entry;
    const meta = item.metadata || {};
    
    // 1. If completed, use exact completion time to group
    if (instance.status === 'completed' && instance.completedAt) {
      const h = new Date(instance.completedAt).getHours();
      if (h < 12) return 'morning';
      if (h >= 12 && h < 17) return 'afternoon';
      if (h >= 17) return 'evening';
    }

    // 2. If it has an exact time, use that to group
    if (meta.time) {
      const [hStr] = meta.time.split(':');
      const h = parseInt(hStr, 10);
      if (!isNaN(h)) {
        if (h < 12) return 'morning';
        if (h >= 12 && h < 17) return 'afternoon';
        if (h >= 17) return 'evening';
      }
    }

    // 3. Fallback to explicit timeOfDay
    return meta.timeOfDay || 'anytime';
  };

  const todayActions = itemsWithInstances || [];
  
  // Sort within blocks by exact time (if available)
  const sortByTime = (a: { item: Item, instance: ItemInstance }, b: { item: Item, instance: ItemInstance }) => {
    const timeA = (a.instance.status === 'completed' && a.instance.completedAt) 
      ? new Date(a.instance.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
      : a.item.metadata?.time || '99:99';
    const timeB = (b.instance.status === 'completed' && b.instance.completedAt) 
      ? new Date(b.instance.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
      : b.item.metadata?.time || '99:99';
    return timeA.localeCompare(timeB);
  };

  const anytime = todayActions.filter(i => getEffectiveTimeOfDay(i) === 'anytime').sort(sortByTime);
  const morning = todayActions.filter(i => getEffectiveTimeOfDay(i) === 'morning').sort(sortByTime);
  const afternoon = todayActions.filter(i => getEffectiveTimeOfDay(i) === 'afternoon').sort(sortByTime);
  const evening = todayActions.filter(i => getEffectiveTimeOfDay(i) === 'evening').sort(sortByTime);
  
  const greeting = isMorning ? 'Good morning' : isAfternoon ? 'Good afternoon' : 'Good evening';

  return (
    <div className="rka-page home-container">
      <div className="home-hero-row">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-4px', paddingTop: '8px' }}>
          <div 
            style={{ fontSize: '18px', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.02em', color: 'var(--rka-text)' }}
            onClick={() => { alert('Version 2.6.1') }}
          >
            RKA OS
          </div>
        </div>
        <PageHeader
          kicker="Overview"
          title={greeting}
          subtitle="Your local-first second brain, organized around what needs attention right now."
        />
        
        <InboxWidget />
      </div>

      <div className="rka-stat-grid">
        <StatCard label="Today" value={todayActions.length} trend="scheduled actions" />
        <StatCard label="Upcoming" value={upcomingItems.length} trend="active plans" />
      </div>

      {isMedLoggerOpen && <QuickMedicationLogger onClose={() => setIsMedLoggerOpen(false)} />}

      <div className="home-grid" style={{ display: 'block' }}>
        <div className="home-main-col" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <section className="rka-section">
            <h3 className="rka-section-title">Timeline</h3>
            <HomeContextBar />
            
            <div className="time-block-stack" style={{ marginTop: '24px' }}>
              <CollapsibleTimeBlock id="anytime" label="Anytime" icon={<Clock size={16} />} items={anytime} defaultExpanded={true} />
              <CollapsibleTimeBlock id="morning" label="Morning" icon={<Sunrise size={16} />} items={morning} defaultExpanded={isMorning} isActiveBlock={isMorning} />
              <CollapsibleTimeBlock id="afternoon" label="Afternoon" icon={<Sun size={16} />} items={afternoon} defaultExpanded={isAfternoon} isActiveBlock={isAfternoon} />
              <CollapsibleTimeBlock id="evening" label="Evening" icon={<Moon size={16} />} items={evening} defaultExpanded={isEvening} isActiveBlock={isEvening} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
