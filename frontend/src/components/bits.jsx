import { X } from "lucide-react";

const STATUS_STYLES = {
  active: "bg-ink text-white",
  published: "bg-ink text-white",
  done: "bg-ink text-white",
  approved: "border border-ink text-ink bg-transparent",
  pending: "bg-peach text-sienna",
  open: "bg-peach text-sienna",
  turned_in: "bg-peach text-sienna",
  draft: "bg-mist text-ink border border-ink/10",
  denied: "bg-smoke/30 text-steel",
  rejected: "bg-smoke/30 text-steel",
  ended: "bg-smoke/30 text-steel",
  closed: "bg-smoke/30 text-steel",
};

export function StatusBadge({ status, label }) {
  const style = STATUS_STYLES[status] || "bg-mist text-ink";
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {label || status.replace("_", " ")}
    </span>
  );
}

export function Avatar({ src, name, size = 40 }) {
  const initials = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-mist text-sm font-medium text-ink"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, testid }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid={testid || "modal"}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        className={`relative max-h-[85vh] w-full overflow-y-auto rounded-[20px] bg-white p-6 shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-xl text-ink">{title}</h3>
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            className="rounded-full p-1.5 text-steel transition-colors hover:bg-mist hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, testid }) {
  return (
    <div data-testid={testid || "empty-state"} className="card flex flex-col items-center justify-center px-8 py-16 text-center">
      {Icon && <Icon size={32} className="mb-4 text-smoke" strokeWidth={1.5} />}
      <h3 className="font-serif text-2xl text-ink">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-sm text-steel">{body}</p>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center" data-testid="loading-spinner">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-mist border-t-ink" />
    </div>
  );
}

export const fmtDate = (d) => (d || "").slice(0, 10);
