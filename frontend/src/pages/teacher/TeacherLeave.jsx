import { useEffect, useState } from "react";
import { CalendarOff, Send } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { EmptyState, StatusBadge, fmtDate } from "../../components/bits";

export default function TeacherLeave() {
  const [leaves, setLeaves] = useState(null);
  const [form, setForm] = useState({ date: "", type: "full", reason: "" });

  const load = () => api.get("/leaves").then((r) => setLeaves(r.data)).catch(() => toast.error("Could not load leaves"));
  useEffect(() => { load(); }, []);

  const apply = async (e) => {
    e.preventDefault();
    try {
      await api.post("/leaves", form);
      toast.success("Leave request sent to admin");
      setForm({ date: "", type: "full", reason: "" });
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  if (!leaves) return null;

  return (
    <div data-testid="teacher-leave-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Leave</h1>
      <p className="mt-1 text-sm text-steel">Request a day off or half day. Admin approves it.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={apply} className="card h-fit space-y-3 p-5" data-testid="apply-leave-form">
          <h2 className="text-sm font-medium text-ink">Apply for leave</h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-ash">Date</label>
            <input data-testid="leave-date" type="date" required className="input !py-2.5 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ash">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {["full", "half"].map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`leave-type-${t}`}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    form.type === t ? "border-ink bg-ink text-white" : "border-ink/15 text-steel hover:text-ink"
                  }`}
                >
                  {t === "full" ? "Full day" : "Half day"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ash">Reason</label>
            <textarea data-testid="leave-reason" required className="input min-h-20 resize-none !py-2.5 text-sm" placeholder="Why do you need the leave?" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button data-testid="apply-leave-btn" type="submit" className="btn-primary w-full"><Send size={15} /> Apply for leave</button>
        </form>

        <div className="space-y-3">
          {leaves.length === 0 && <EmptyState icon={CalendarOff} title="No leave requests" body="Your requests and their status will appear here." testid="leaves-empty" />}
          {leaves.map((l) => (
            <div key={l.id} data-testid={`leave-card-${l.id}`} className="card flex items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-ink">
                  {fmtDate(l.date)} {l.type === "half" && <span className="text-steel">(Half Day)</span>}
                </div>
                <div className="text-sm text-steel">{l.reason}</div>
              </div>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
