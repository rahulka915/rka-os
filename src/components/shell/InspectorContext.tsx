import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { EntityInspector } from '../inspector/EntityInspector';
import { DayDrawer } from '../calendar/DayDrawer';

interface InspectorContextType {
  inspectEntity: (id: string, type: string) => void;
  inspectDay: (dateString: string) => void;
  closeInspector: () => void;
}

const InspectorContext = createContext<InspectorContextType | undefined>(undefined);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [inspectedEntity, setInspectedEntity] = useState<{ id: string; type: string } | null>(null);
  const [inspectedDay, setInspectedDay] = useState<string | null>(null);

  const inspectEntity = (id: string, type: string) => {
    setInspectedDay(null);
    setInspectedEntity({ id, type });
  };

  const inspectDay = (dateString: string) => {
    setInspectedEntity(null);
    setInspectedDay(dateString);
  };

  const closeInspector = () => {
    setInspectedEntity(null);
    setInspectedDay(null);
  };

  return (
    <InspectorContext.Provider value={{ inspectEntity, inspectDay, closeInspector }}>
      {children}
      {inspectedEntity && (
        <EntityInspector 
          entityId={inspectedEntity.id} 
          entityType={inspectedEntity.type} 
          onClose={closeInspector} 
        />
      )}
      {inspectedDay && (
        <DayDrawer
          date={inspectedDay}
          onClose={closeInspector}
        />
      )}
    </InspectorContext.Provider>
  );
}

export function useInspector() {
  const context = useContext(InspectorContext);
  if (!context) throw new Error('useInspector must be used within an InspectorProvider');
  return context;
}
