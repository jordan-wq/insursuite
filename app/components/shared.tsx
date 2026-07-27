"use client";

export function ticketCode(id: string | undefined | null): string {
  return String(id || "").replace(/-/g, "").slice(0, 6).toUpperCase() || "PENDING";
}

export function Panel({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <section className={`panel ${className}`} style={style}>{children}</section>;
}

export function PanelHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {action && <button className="text-button" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function ViewHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="view-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action && <div className="view-heading-actions">{action}</div>}</div>;
}
