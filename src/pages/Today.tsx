import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ActionList } from '../components/actions/ActionList';
import { formatDate } from '../db/actions';

export function Today() {
  const todayDate = formatDate(new Date());

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
    <div className="p-4 pb-20">
      <h1 className="mt-4 mb-6">Today</h1>
      
      {itemsWithInstances && itemsWithInstances.length > 0 ? (
        <ActionList items={itemsWithInstances} emptyMessage="" />
      ) : (
        <p className="text-muted empty-state">No actions scheduled for today.</p>
      )}
    </div>
  );
}
