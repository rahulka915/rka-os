import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';
import { haptics } from '../../utils/haptics';
import './primitives.css';

type Tone = 'gray' | 'blue' | 'green' | 'red' | 'orange';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Action {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function PageHeader({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <header className="rka-page-header">
      {kicker && <div className="rka-page-kicker">{kicker}</div>}
      <h1 className="rka-page-title">{title}</h1>
      {subtitle && <p className="rka-page-subtitle">{subtitle}</p>}
    </header>
  );
}

export function Button({
  children,
  variant = 'secondary',
  icon,
  disabled,
  onClick,
  type = 'button',
  className = '',
  style,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}) {
  const handleClick = () => {
    haptics.light();
    if (onClick) onClick();
  };

  return (
    <button className={`rka-button rka-button-${variant} active-scale ${className}`.trim()} disabled={disabled} onClick={handleClick} type={type} style={style}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  className = '',
  style,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const handleClick = () => {
    haptics.light();
    if (onClick) onClick();
  };

  return (
    <button className={`rka-icon-button active-scale ${className}`.trim()} aria-label={label} title={label} disabled={disabled} onClick={handleClick} type="button" style={style}>
      {icon}
    </button>
  );
}

export function ListRow({
  title,
  subtitle,
  metadata,
  leading,
  trailing,
  onClick,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  metadata?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  
  const handleClick = onClick ? () => {
    haptics.light();
    onClick();
  } : undefined;

  return (
    <Tag
      className={`rka-list-row ${onClick ? 'active-scale' : ''} ${className}`.trim()}
      {...(onClick ? { type: 'button' as const, onClick: handleClick } : {})}
    >
      {leading && <span className="rka-list-leading">{leading}</span>}
      <div className="rka-list-main">
        <div className="rka-list-title">{title}</div>
        {subtitle && <span className="rka-list-subtitle">{subtitle}</span>}
        {metadata && <div className="rka-list-meta">{metadata}</div>}
      </div>
      {trailing && <span className="rka-list-trailing">{trailing}</span>}
    </Tag>
  );
}

export function MetadataPill({
  label,
  icon,
  tone = 'gray',
  className = '',
  onClick,
  style,
  title,
}: {
  label: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
}) {
  const Tag = onClick ? 'button' : 'span';
  const pillClassName = `rka-pill rka-pill-${tone} ${onClick ? 'rka-pill-clickable' : ''} ${className}`.trim();
  return (
    <Tag
      className={pillClassName}
      style={style}
      title={title}
      {...(onClick ? { type: 'button' as const, onClick } : {})}
    >
      {icon && <span className="rka-pill-icon">{icon}</span>}
      {label}
    </Tag>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rka-empty-state ${className}`.trim()}>
      {icon}
      <div className="rka-empty-title">{title}</div>
      {description && <div className="rka-empty-description">{description}</div>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, trend, className = '' }: { label: string; value: ReactNode; trend?: ReactNode; className?: string }) {
  return (
    <div className={`rka-stat-card ${className}`.trim()}>
      <div className="rka-stat-label">{label}</div>
      <div className="rka-stat-value">{value}</div>
      {trend && <div className="rka-stat-trend">{trend}</div>}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="rka-segmented">
      {options.map(option => (
        <button
          key={option.value}
          className={`rka-segment ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabelPrefix,
  testIdPrefix,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabelPrefix?: string;
  testIdPrefix?: string;
}) {
  return (
    <div className="rka-tabs">
      {options.map(option => (
        <button
          key={option.value}
          className={`rka-tab ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
          aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} ${option.label}` : option.label}
          data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

import { Drawer as VaulDrawer } from 'vaul';

export function BottomSheet({
  open,
  title,
  children,
  primaryAction,
  secondaryAction,
  onDismiss,
  className = '',
  overlayClassName = '',
  keepMounted = false,
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  onDismiss: () => void;
  className?: string;
  overlayClassName?: string;
  keepMounted?: boolean;
}) {
  if (!open && !keepMounted) return null;

  // For focus to work before it becomes visible, we temporarily remove visibility hidden during the click tick.
  // Actually, opacity: 0 and pointerEvents: none is enough, we don't need top/left if it's pointerEvents none, but let's just use opacity 0.
  const overlayStyle: React.CSSProperties = (!open && keepMounted) ? {
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  } : {};

  return (
    <div className={`rka-sheet-overlay ${overlayClassName}`.trim()} onClick={onDismiss} style={overlayStyle}>
      <div 
        className={`rka-sheet ${className}`.trim()} 
        onClick={e => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true" 
        aria-label={title}
        style={(!open && keepMounted) ? { transform: 'translateY(100%)' } : {}}
      >
        <div className="rka-sheet-header">
          <div className="rka-sheet-title">{title}</div>
          <IconButton label="Close" icon={<X size={20} />} onClick={onDismiss} />
        </div>
        <div className="rka-sheet-body">{children}</div>
        {(primaryAction || secondaryAction) && (
          <div className="rka-sheet-footer">
            {secondaryAction && (
              <Button variant="secondary" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>
                {secondaryAction.label}
              </Button>
            )}
            {primaryAction && (
              <Button variant="primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                {primaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function NativeBottomSheet({
  open,
  onOpenChange,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
  children,
  className = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapPoints?: (string | number)[];
  activeSnapPoint?: string | number | null;
  setActiveSnapPoint?: (snapPoint: string | number | null) => void;
  children: ReactNode;
  className?: string;
}) {
  const Root = VaulDrawer.Root as any;
  
  return (
    <Root 
      open={open} 
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={snapPoints ? 0 : undefined}
    >
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="rka-sheet-overlay" />
        <VaulDrawer.Content className={`rka-vaul-sheet ${className}`.trim()}>
          <div className="rka-vaul-handle" />
          {children}
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </Root>
  );
}

export function Drawer({
  open,
  children,
  onDismiss,
  className = '',
  overlayClassName = '',
}: {
  open: boolean;
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
  overlayClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className={`rka-drawer-overlay ${overlayClassName}`.trim()} onClick={onDismiss}>
      <div className={`rka-drawer ${className}`.trim()} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="rka-drawer-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

export function InspectorSection({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rka-inspector-section ${className}`.trim()}>
      <h3 className="rka-inspector-section-title">{title}</h3>
      {children}
    </section>
  );
}
