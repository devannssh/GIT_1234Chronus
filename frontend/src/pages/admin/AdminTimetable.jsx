import { useEffect, useRef, useState } from "react";
import { Upload, Download, BellRing, Pencil } from "lucide-react";
import { toast } from "sonner";
import api, { apiError, downloadBlob } from "../../lib/api";
import TimetableGrid from "../../components/TimetableGrid";
import { Modal, Spinner } from "../../components/bits";

export default function AdminTimetable() {
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  const load = () => api.get("/timetable").then((r) => setData(r.data)).catch(() => toast.error("Could not load timetable"));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data: res } = await api.post("/admin/timetable/upload", fd);
      toast.success(`Default timetable uploaded — ${res.inserted} rows`);
      load();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const download = async () => {
    const res = await api.get("/timetable/csv", { responseType: "blob" });
    downloadBlob(res.data, "default-timetable.csv");
  };

  const notifyAll = async () => {
    await api.post("/admin/timetable/notify");
    toast.success("Everyone has been notified");
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ subject: entry.subject, room: entry.room, start: entry.start, end: entry.end, teacher_name: entry.teacher_name });
  };

  const saveEdit = async () => {
    try {
      await api.put(`/admin/timetable/entry/${editing.id}`, form);
      toast.success("Entry updated");
      setEditing(null);
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!data) return <Spinner />;

  return (
    <div data-testid="admin-timetable-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Default Timetable</h1>
          <p className="mt-1 text-sm text-steel">
            Version {data.meta?.version ?? 1}
            {data.meta?.last_updated && <span className="text-ash"> · Last updated {data.meta.last_updated.slice(0, 16).replace("T", " ")}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" data-testid="tt-upload-input" onChange={(e) => upload(e.target.files?.[0])} />
          <button data-testid="tt-upload-btn" onClick={() => fileRef.current?.click()} className="btn-primary !py-2 text-xs">
            <Upload size={14} /> Upload CSV
          </button>
          <button data-testid="tt-download-btn" onClick={download} className="btn-ghost !py-2 text-xs">
            <Download size={14} /> Download
          </button>
          <button data-testid="tt-notify-btn" onClick={notifyAll} className="btn-ghost !py-2 text-xs">
            <BellRing size={14} /> Notify
          </button>
        </div>
      </div>

      <p className="mb-3 flex items-center gap-1.5 text-xs text-ash">
        <Pencil size={12} /> Click any cell to edit it. CSV format: day, period, start, end, subject, teacher, room, branch.
      </p>

      <TimetableGrid entries={data.entries} onCellClick={openEdit} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit — ${editing?.day} P${editing?.period}`} testid="edit-entry-modal">
        <div className="space-y-3">
          <input data-testid="ee-subject" className="input !py-2.5 text-sm" placeholder="Subject" value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <input data-testid="ee-teacher" className="input !py-2.5 text-sm" placeholder="Teacher" value={form.teacher_name || ""} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <input data-testid="ee-start" className="input !py-2.5 text-sm" placeholder="Start" value={form.start || ""} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            <input data-testid="ee-end" className="input !py-2.5 text-sm" placeholder="End" value={form.end || ""} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            <input data-testid="ee-room" className="input !py-2.5 text-sm" placeholder="Room" value={form.room || ""} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          <button data-testid="ee-save-btn" onClick={saveEdit} className="btn-primary w-full">Save changes</button>
        </div>
      </Modal>
    </div>
  );
}
