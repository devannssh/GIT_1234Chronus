import { useEffect, useState } from "react";
import { ClipboardList, Download, Eye, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import api, { apiError, fileUrl } from "../../lib/api";
import { EmptyState, Modal, StatusBadge, fmtDate } from "../../components/bits";

export default function StudentAssignments() {
  const [items, setItems] = useState(null);
  const [view, setView] = useState(null);
  const [submitFor, setSubmitFor] = useState(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);

  const load = () => api.get("/assignments").then((r) => setItems(r.data)).catch(() => toast.error("Could not load assignments"));
  useEffect(() => { load(); }, []);

  const submit = async () => {
    const fd = new FormData();
    fd.append("note", note);
    if (file) fd.append("file", file);
    try {
      await api.post(`/assignments/${submitFor.id}/submit`, fd);
      toast.success("Assignment submitted");
      setSubmitFor(null);
      setNote("");
      setFile(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!items) return null;

  return (
    <div data-testid="student-assignments-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Assignments</h1>
      <p className="mt-1 text-sm text-steel">View and submit your assignment work.</p>

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <EmptyState icon={ClipboardList} title="No assignments yet" body="When a teacher posts an assignment it will appear here." testid="assignments-empty" />
        )}
        {items.map((a) => (
          <div
            key={a.id}
            data-testid={`assignment-card-${a.id}`}
            className="card flex flex-wrap items-center gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag">{a.subject}</span>
                {a.unit && <span className="tag">{a.unit}</span>}
                <StatusBadge status={a.status} />
                {a.my_submission && <StatusBadge status={a.my_submission.status === "done" ? "done" : "turned_in"} label={a.my_submission.status === "done" ? `Evaluated · ${a.my_submission.marks} marks` : "Turned in"} />}
              </div>
              <div className="mt-2 font-serif text-lg text-ink">{a.title}</div>
              <div className="mt-0.5 text-[13px] text-steel">
                Due {fmtDate(a.due_date)} · {a.teacher_name}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button data-testid={`view-assignment-${a.id}`} onClick={() => setView(a)} className="btn-ghost !py-2 text-xs">
                <Eye size={14} /> View assignment
              </button>
              {a.status === "active" && (
                <button data-testid={`submit-assignment-${a.id}`} onClick={() => setSubmitFor(a)} className="btn-primary !py-2 text-xs">
                  <UploadCloud size={14} /> {a.my_submission ? "Resubmit" : "Submit assignment"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.title || ""} testid="view-assignment-modal">
        {view && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="tag">{view.subject}</span>
              {view.unit && <span className="tag">{view.unit}</span>}
            </div>
            <p className="text-steel">{view.description || "No description provided."}</p>
            <p className="text-[13px] text-ash">Due {fmtDate(view.due_date)} · Posted by {view.teacher_name}</p>
            {view.file && (
              <a data-testid="assignment-file-download" href={fileUrl(view.file)} target="_blank" rel="noreferrer" className="btn-ghost !py-2 text-xs">
                <Download size={14} /> Download attachment
              </a>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!submitFor} onClose={() => setSubmitFor(null)} title={`Submit — ${submitFor?.title || ""}`} testid="submit-assignment-modal">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ash">Your work (PDF / file)</label>
            <input
              data-testid="submission-file-input"
              type="file"
              className="input !py-2.5 text-sm"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ash">Note for the teacher</label>
            <textarea
              data-testid="submission-note-input"
              className="input min-h-24 resize-none"
              placeholder="Anything you'd like to add…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button data-testid="submission-submit-btn" onClick={submit} className="btn-primary w-full">
            <UploadCloud size={16} /> Turn in
          </button>
        </div>
      </Modal>
    </div>
  );
}
