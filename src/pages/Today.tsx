import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ActionList } from '../components/actions/ActionList';
import { formatDate } from '../db/actions';
import { CalendarCheck } from 'lucide-react';
import { EmptyState, PageHeader } from '../components/ui/primitives';

export function Today() {
  const todayDate = formatDate(new Date());
  const readableDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const instances = useLiveQuery(
    () => db.itemInstances.where('scheduledDate').equals(todayDate).toArray(),
    []
  );

  const itemsWithInstances = useLiveQuery(async () => {
    if (!instances) return [];
    const parentItems = await Promise.all(instances.map(inst => db.items.get(inst.itemId)));
    return instances.map((instance, index) => ({ instance, item: parentItems[index]! })).filter(entry => entry.item !== undefined);
  }, [instances]);

  return (
    <div className="rka-page">
      <PageHeader
        kicker={readableDate}
        title="Today"
        subtitle="The few things that matter right now."
      />

      {itemsWithInstances && itemsWithInstances.length > 0 ? (
        <ActionList items={itemsWithInstances} emptyMessage="" />
      ) : (
        <EmptyState
          icon={<CalendarCheck size={28} />}
          title="Nothing scheduled"
          description="Today is clear. Add a task or plan from Calendar when something needs attention."
        />
      )}
    </div>
  );
}
