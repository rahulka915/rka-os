import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './sectionchip.css';

interface SectionChipProps {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  isExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  className?: string;
}

export function SectionChip({ 
  label, 
  icon, 
  count = 0, 
  isExpanded: defaultExpanded = true,
  onToggle,
  className = '' 
}: SectionChipProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    onToggle?.(next);
  };

  return (
    <button className={`section-chip ${className}`} onClick={handleToggle}>
      <div className="section-chip-left">
        {icon && <span className="section-chip-icon">{icon}</span>}
        <span className="section-chip-label">{label.toUpperCase()}</span>
        <span className="section-chip-count">({count})</span>
      </div>
      <div className="section-chip-right">
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>
    </button>
  );
}
