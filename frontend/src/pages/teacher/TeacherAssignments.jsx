import { useEffect, useState } from "react";
import { Plus, CalendarClock, StopCircle, Download, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import api, { apiError, fileUrl } from "../../lib/api";
import { EmptyState, Modal, StatusBadge, fmtDate } from "../../components/bits";

export default function TeacherAssignments() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ title: "", subject: "", unit: "", description: "", branch: "CSE", due_date: "" });
  const [file, setFile] = useState(null);
  const [subsFor, setSubsFor] = useState(null);
  const [subs, setSubs] = useState([]);
  const [marks, setMarks] = useState({});
  const [postponeFor, setPostponeFor] = useState(null);
  const [newDate, setNewDate] = useState("");

  const load = () => api.get("/assignments").then((r) => setItems(r.data)).catch(() => toast.error("Could not load assignments"));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (file) fd.append("file", file);
    try {
      await api.post("/assignments", fd);
      toast.success("Assignment created and students notified");
      setForm({ title: "", subject: "", unit: "", description: "", branch: "CSE", due_date: "" });
      setFile(null);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const openSubs = async (a) => {
    setSubsFor(a);
    const { data } = await api.get(`/assignments/${a.id}/submissions`);
    setSubs(data);
    const m = {};
    data.forEach((s) => { if (s.marks != null) m[s.id] = s.marks; });
    setMarks(m);
  };

  const evaluate = async (sid) => {
    try {
      await api.post(`/submissions/${sid}/evaluate`, { marks: Number(marks[sid] ?? 0) });
      toast.success("Marked as done");
      openSubs(subsFor);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const postpone = async () => {
    try {
      await api.post(`/assignments/${postponeFor.id}/postpone`, { due_date: newDate });
      toast.success("Due date postponed");
      setPostponeFor(null);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const end = async (a) => {
    await api.post(`/assignments/${a.id}/end`);
    toast.success("Assignment ended");
    load();
  };

  if (!items) return null;

  return (
    <div data-testid="teacher-assignments-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Assignments</h1>
      <p className="mt-1 text-sm text-steel">Create new work and review what students turned in.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={create} className="card h-fit space-y-3 p-5" data-testid="create-assignment-form">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink"><Plus size={15} /> Create a new assignment</h2>
          <input data-testid="ca-title" className="input !py-2.5 text-sm" placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="ca-subject" className="input !py-2.5 text-sm" placeholder="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <input data-testid="ca-unit" className="input !py-2.5 text-sm" placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <textarea data-testid="ca-description" className="input min-h-20 resize-none !py-2.5 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="ca-branch" className="input !py-2.5 text-sm" placeholder="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
            <input data-testid="ca-due-date" type="date" required className="input !py-2.5 text-sm" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ash">Upload PDF (optional)</label>
            <input data-testid="ca-file" type="file" accept=".pdf" className="input !py-2 text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <button data-testid="ca-submit-btn" type="submit" className="btn-primary w-full">Create assignment</button>
        </form>

        <div>
          <h2 className="mb-3 text-sm font-medium text-ink">Previous assignments</h2>
          <div className="space-y-3">
            {items.length === 0 && <EmptyState icon={ClipboardList} title="Nothing posted yet" testid="teacher-assignments-empty" />}
            {items.map((a) => (
              <div
                key={a.id}
                data-testid={`teacher-assignment-card-${a.id}`}
                onClick={() => openSubs(a)}
                className="card relative flex cursor-pointer flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:border-ink/20"
              >
                {a.status === "active" && (
                  <span data-testid={`active-dot-${a.id}`} className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-green-500" title="Active" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tag">{a.subject}</span>
                    {a.unit && <span className="tag">{a.unit}</span>}
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-1.5 font-serif text-lg text-ink">{a.title}</div>
                  <div className="text-[13px] text-steel">
                    Due {fmtDate(a.due_date)} · {a.submissions_count ?? 0} turned in · {a.evaluated_count ?? 0} evaluated
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    data-testid={`postpone-${a.id}`}
                    onClick={() => { setPostponeFor(a); setNewDate(fmtDate(a.due_date)); }}
                    className="btn-ghost !py-2 text-xs"
                  >
                    <CalendarClock size={14} /> Postpone
                  </button>
                  {a.status === "active" && (
                    <button data-testid={`end-${a.id}`} onClick={() => end(a)} className="btn-ghost !py-2 text-xs">
                      <StopCircle size={14} /> End
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={!!subsFor} onClose={() => setSubsFor(null)} title={`Turned in — ${subsFor?.title || ""}`} wide testid="submissions-modal">
        {subs.length === 0 ? (
          <p className="py-6 text-center text-sm text-smoke" data-testid="no-submissions">No student has turned in this assignment yet.</p>
        ) : (
          <div className="space-y-3" data-testid="submissions-list">
            {subs.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-fog px-4 py-3" data-testid={`submission-row-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink">{s.student_name} <span className="text-xs text-ash">{s.roll_no}</span></div>
                  <div className="text-xs text-steel">{(s.submitted_at || "").slice(0, 16).replace("T", " ")} {s.note && `· “${s.note}”`}</div>
                </div>
                {s.file && (
                  <a href={fileUrl(s.file)} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-1.5 text-xs" data-testid={`submission-file-${s.id}`}>
                    <Download size={13} /> File
                  </a>
                )}
                {s.status === "done" ? (
                  <StatusBadge status="done" label={`Done · ${s.marks} marks`} />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      data-testid={`marks-input-${s.id}`}
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Marks"
                      className="input w-24 !rounded-xl !py-1.5 text-sm"
                      value={marks[s.id] ?? ""}
                      onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })}
                    />
                    <button data-testid={`mark-done-${s.id}`} onClick={() => evaluate(s.id)} className="btn-primary !px-4 !py-1.5 text-xs">
                      Mark done
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!postponeFor} onClose={() => setPostponeFor(null)} title="Postpone assignment" testid="postpone-modal">
        <div className="space-y-4">
          <label className="block text-xs font-medium text-ash">New due date</label>
          <input data-testid="postpone-date-input" type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <button data-testid="postpone-confirm-btn" onClick={postpone} className="btn-primary w-full">Postpone</button>
        </div>
      </Modal>
    </div>
  );
}
