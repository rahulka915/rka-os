import type { ReactNode } from 'react';
import { X } from 'lucide-react';
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
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button className={`rka-button rka-button-${variant}`} disabled={disabled} onClick={onClick} type={type}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <button className="rka-icon-button" aria-label={label} onClick={onClick} type="button">
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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  metadata?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className="rka-list-row"
      {...(onClick ? { type: 'button' as const, onClick } : {})}
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

export function MetadataPill({ label, icon, tone = 'gray' }: { label: ReactNode; icon?: ReactNode; tone?: Tone }) {
  return (
    <span className={`rka-pill rka-pill-${tone}`}>
      {icon}
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rka-empty-state">
      {icon}
      <div className="rka-empty-title">{title}</div>
      {description && <div className="rka-empty-description">{description}</div>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, trend }: { label: string; value: ReactNode; trend?: ReactNode }) {
  return (
    <div className="rka-stat-card">
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
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="rka-tabs">
      {options.map(option => (
        <button
          key={option.value}
          className={`rka-tab ${option.value === value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BottomSheet({
  open,
  title,
  children,
  primaryAction,
  secondaryAction,
  onDismiss,
}: {
  open: boolean;
  title?: string;
  children: ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  onDismiss: () => void;
}) {
  if (!open) return null;

  return (
    <div className="rka-sheet-overlay" onClick={onDismiss}>
      <div className="rka-sheet" onClick={e => e.stopPropagation()}>
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

export function Drawer({ open, children, onDismiss }: { open: boolean; children: ReactNode; onDismiss: () => void }) {
  if (!open) return null;
  return (
    <div className="rka-drawer-overlay" onClick={onDismiss}>
      <div className="rka-drawer" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rka-inspector-section">
      <h3 className="rka-inspector-section-title">{title}</h3>
      {children}
    </section>
  );
}
