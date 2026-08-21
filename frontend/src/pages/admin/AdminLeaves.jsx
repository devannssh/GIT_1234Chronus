import { useEffect, useState } from "react";
import { Check, X, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { Avatar, EmptyState, StatusBadge, fmtDate } from "../../components/bits";

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState(null);

  const load = () => api.get("/leaves").then((r) => setLeaves(r.data)).catch(() => toast.error("Could not load leaves"));
  useEffect(() => { load(); }, []);

  const decide = async (id, action) => {
    try {
      await api.post(`/leaves/${id}/decision`, { action });
      toast.success(`Leave ${action === "approve" ? "approved" : "denied"}`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!leaves) return null;

  return (
    <div data-testid="admin-leaves-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Leave Approval</h1>
      <p className="mt-1 text-sm text-steel">Review faculty leave requests.</p>

      <div className="mt-6 space-y-3">
        {leaves.length === 0 && <EmptyState icon={CalendarOff} title="No leave requests" body="Faculty leave requests will appear here for review." testid="admin-leaves-empty" />}
        {leaves.map((l) => (
          <div key={l.id} data-testid={`leave-request-${l.id}`} className="card flex flex-wrap items-center gap-4 px-5 py-4">
            <Avatar src={l.teacher_pic} name={l.teacher_name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-ink">{l.teacher_name} <span className="text-xs text-ash">{l.department}</span></div>
              <div className="text-sm text-steel">{l.reason}</div>
              <div className="mt-0.5 text-[13px] text-ash">
                {fmtDate(l.date)} {l.type === "half" && <span className="text-steel">(Half Day)</span>}
              </div>
            </div>
            {l.status === "pending" ? (
              <div className="flex items-center gap-2">
                <button data-testid={`approve-leave-${l.id}`} onClick={() => decide(l.id, "approve")} className="btn-primary !py-2 text-xs">
                  <Check size={14} /> Approve
                </button>
                <button data-testid={`deny-leave-${l.id}`} onClick={() => decide(l.id, "deny")} className="btn-ghost !py-2 text-xs">
                  <X size={14} /> Deny
                </button>
              </div>
            ) : (
              <StatusBadge status={l.status} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
