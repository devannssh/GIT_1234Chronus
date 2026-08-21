import { useEffect, useState } from "react";
import { Plus, Video as VideoIcon, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Avatar, EmptyState, Modal, fmtDate } from "../../components/bits";
import MeetingRoom from "../../components/MeetingRoom";

export default function TeacherClassroom() {
  const { user } = useAuth();
  const [classes, setClasses] = useState(null);
  const [meeting, setMeeting] = useState(null);
  const [form, setForm] = useState({ subject: "", date: "", time: "", duration_min: 60, branch: "CSE" });
  const [attFor, setAttFor] = useState(null);
  const [att, setAtt] = useState([]);

  const load = () => api.get("/classes").then((r) => setClasses(r.data)).catch(() => toast.error("Could not load classes"));
  useEffect(() => { load(); }, []);

  const schedule = async (e) => {
    e.preventDefault();
    try {
      await api.post("/classes", { ...form, duration_min: Number(form.duration_min) });
      toast.success("Class scheduled and students notified");
      setForm({ subject: "", date: "", time: "", duration_min: 60, branch: "CSE" });
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const openAttendance = async (c) => {
    setAttFor(c);
    const { data } = await api.get(`/classes/${c.id}/attendance`);
    setAtt(data);
  };

  if (meeting) return <MeetingRoom cls={meeting} user={user} onLeave={() => { setMeeting(null); load(); }} />;
  if (!classes) return null;

  return (
    <div data-testid="teacher-classroom-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Classroom</h1>
      <p className="mt-1 text-sm text-steel">Schedule a class, notify students and take auto attendance.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        <form onSubmit={schedule} className="card h-fit space-y-3 p-5" data-testid="schedule-class-form">
          <h2 className="flex items-center gap-2 text-sm font-medium text-ink"><Plus size={15} /> Schedule a class</h2>
          <input data-testid="sc-subject" className="input !py-2.5 text-sm" placeholder="Subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="sc-date" type="date" required className="input !py-2.5 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input data-testid="sc-time" type="time" required className="input !py-2.5 text-sm" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="sc-duration" type="number" min="15" step="15" className="input !py-2.5 text-sm" placeholder="Duration (min)" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            <input data-testid="sc-branch" className="input !py-2.5 text-sm" placeholder="Branch" value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} />
          </div>
          <button data-testid="sc-submit-btn" type="submit" className="btn-primary w-full">Schedule & notify</button>
        </form>

        <div className="space-y-3">
          {classes.length === 0 && <EmptyState icon={VideoIcon} title="No classes scheduled" testid="teacher-classes-empty" />}
          {classes.map((c) => (
            <div key={c.id} data-testid={`teacher-class-card-${c.id}`} className="card flex flex-wrap items-center gap-4 px-5 py-4">
              <Avatar src={c.teacher_pic} name={c.teacher_name} size={52} />
              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg text-ink">{c.subject}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ash">
                  <Clock size={13} /> {fmtDate(c.date)} · {c.time} · {c.duration_min} min · {c.branch}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button data-testid={`attendance-${c.id}`} onClick={() => openAttendance(c)} className="btn-ghost !py-2 text-xs">
                  <Users size={14} /> Attendance
                </button>
                <button data-testid={`teacher-join-${c.id}`} onClick={() => setMeeting(c)} className="btn-primary">
                  <VideoIcon size={16} /> Join
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!attFor} onClose={() => setAttFor(null)} title={`Attendance — ${attFor?.subject || ""}`} testid="attendance-modal">
        {att.length === 0 ? (
          <p className="py-6 text-center text-sm text-smoke" data-testid="attendance-empty">No attendance marked yet. Use “Auto attendance” inside the meeting.</p>
        ) : (
          <div className="space-y-2" data-testid="attendance-list">
            {att.map((a) => (
              <div key={a.student_id} className="flex items-center justify-between rounded-2xl bg-fog px-4 py-3">
                <div className="text-sm font-medium text-ink">{a.student_name} <span className="text-xs text-ash">{a.roll_no}</span></div>
                <span className="tag">Present</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
