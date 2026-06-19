import './pill.css';

interface PillProps {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  onClick?: () => void;
  className?: string;
}

export function Pill({ label, icon, color, variant = 'solid', onClick, className = '' }: PillProps) {
  const baseStyle = color ? {
    backgroundColor: variant === 'solid' ? `${color}18` : 'transparent',
    color: variant === 'solid' ? color : 'var(--text-muted)',
    borderColor: variant === 'outline' ? `${color}30` : 'transparent',
  } : {};

  return (
    <div 
      className={`ui-pill variant-${variant} ${onClick ? 'clickable' : ''} ${className}`}
      style={baseStyle}
      onClick={onClick}
    >
      {icon && <span className="pill-icon">{icon}</span>}
      <span className="pill-label">{label}</span>
    </div>
  );
}
