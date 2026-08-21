import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, Plus, Trash2, Shuffle, Database } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { Avatar, Modal } from "../../components/bits";

const TABS = ["Faculty", "Students", "Rooms"];

export default function AdminData() {
  const [tab, setTab] = useState("Faculty");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [fForm, setFForm] = useState({ name: "", email: "", department: "", majors: "", password: "teacher123" });
  const [sForm, setSForm] = useState({ name: "", email: "", branch: "CSE", roll_no: "", password: "student123" });
  const [rForm, setRForm] = useState({ name: "", type: "Lecture", capacity: 60 });

  const loadStats = () => api.get("/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  const loadFaculty = (s = search) => api.get(`/admin/faculty?search=${encodeURIComponent(s)}`).then((r) => setFaculty(r.data)).catch(() => {});
  const loadStudents = (s = search) => api.get(`/admin/students?search=${encodeURIComponent(s)}`).then((r) => setStudents(r.data)).catch(() => {});
  const loadRooms = () => api.get("/admin/rooms").then((r) => setRooms(r.data)).catch(() => {});

  useEffect(() => { loadStats(); }, []);
  useEffect(() => {
    if (tab === "Faculty") loadFaculty();
    if (tab === "Students") loadStudents();
    if (tab === "Rooms") loadRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  const addFaculty = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/faculty", fForm);
      toast.success("Faculty added");
      setAddOpen(false);
      setFForm({ name: "", email: "", department: "", majors: "", password: "teacher123" });
      loadFaculty(); loadStats();
    } catch (err) { toast.error(apiError(err)); }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/students", sForm);
      toast.success("Student added");
      setAddOpen(false);
      setSForm({ name: "", email: "", branch: "CSE", roll_no: "", password: "student123" });
      loadStudents(); loadStats();
    } catch (err) { toast.error(apiError(err)); }
  };

  const addRoom = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/rooms", { ...rForm, capacity: Number(rForm.capacity) });
      toast.success("Room added");
      setAddOpen(false);
      setRForm({ name: "", type: "Lecture", capacity: 60 });
      loadRooms(); loadStats();
    } catch (err) { toast.error(apiError(err)); }
  };

  const remove = async (kind, id) => {
    await api.delete(`/admin/${kind}/${id}`);
    toast.success("Removed");
    if (kind === "faculty") loadFaculty();
    if (kind === "students") loadStudents();
    if (kind === "rooms") loadRooms();
    loadStats();
  };

  const allocate = async () => {
    try {
      const { data } = await api.post("/admin/rooms/allocate");
      toast.success(`Random allocation done — ${data.changed} entries updated`);
    } catch (err) { toast.error(apiError(err)); }
  };

  return (
    <div data-testid="admin-data-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Data</h1>
      <p className="mt-1 text-sm text-steel">Manage faculty, students and rooms.</p>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="admin-stats">
          {[["Faculty", stats.faculty], ["Students", stats.students], ["Rooms", stats.rooms], ["Pending leaves", stats.pending_leaves]].map(([label, val]) => (
            <div key={label} className="card p-5" data-testid={`stat-${label.toLowerCase().replace(" ", "-")}`}>
              <div className="font-serif text-3xl text-ink">{val}</div>
              <div className="mt-1 text-xs text-steel">{label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-mist p-1" data-testid="data-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              data-testid={`tab-${t.toLowerCase()}`}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${tab === t ? "bg-ink text-white" : "text-steel hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "Rooms" && (
          <div className="flex min-w-56 flex-1 items-center gap-2 rounded-full bg-mist px-4 py-2.5">
            <Search size={16} className="shrink-0 text-ash" />
            <input
              data-testid="data-search-input"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-smoke"
              placeholder={`Search ${tab.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <SlidersHorizontal size={16} className="shrink-0 text-ash" data-testid="filter-icon" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {tab === "Rooms" && (
            <button data-testid="random-allocate-btn" onClick={allocate} className="btn-ghost !py-2 text-xs">
              <Shuffle size={14} /> Random allocation
            </button>
          )}
          <button data-testid="add-entry-btn" onClick={() => setAddOpen(true)} className="btn-primary !py-2 text-xs">
            <Plus size={14} /> Add {tab === "Faculty" ? "faculty" : tab === "Students" ? "student" : "room"}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {tab === "Faculty" && faculty.map((f) => (
          <div key={f.id} data-testid={`faculty-card-${f.id}`} className="card flex items-center gap-4 px-5 py-4">
            <Avatar src={f.pic} name={f.name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-ink">{f.name}</div>
              <div className="text-[13px] text-steel">{f.department} {f.majors && `· ${f.majors}`}</div>
              <div className="text-xs text-ash">{f.email}</div>
            </div>
            <button data-testid={`remove-faculty-${f.id}`} onClick={() => remove("faculty", f.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-peach hover:text-sienna">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {tab === "Students" && students.map((s) => (
          <div key={s.id} data-testid={`student-card-${s.id}`} className="card flex items-center gap-4 px-5 py-4">
            <Avatar src={s.pic} name={s.name} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-ink">{s.name} <span className="text-xs text-ash">{s.roll_no}</span></div>
              <div className="text-[13px] text-steel">{s.branch}</div>
              <div className="text-xs text-ash">{s.email}</div>
            </div>
            <button data-testid={`remove-student-${s.id}`} onClick={() => remove("students", s.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-peach hover:text-sienna">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {tab === "Rooms" && rooms.map((r) => (
          <div key={r.id} data-testid={`room-card-${r.id}`} className="card flex items-center gap-4 px-5 py-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mist font-serif text-lg text-ink">{r.name.slice(0, 2)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium text-ink">{r.name}</div>
              <div className="text-[13px] text-steel">{r.type} · Capacity {r.capacity}</div>
            </div>
            <button data-testid={`remove-room-${r.id}`} onClick={() => remove("rooms", r.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-peach hover:text-sienna">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {((tab === "Faculty" && faculty.length === 0) || (tab === "Students" && students.length === 0) || (tab === "Rooms" && rooms.length === 0)) && (
          <p className="py-10 text-center text-sm text-smoke" data-testid="data-empty"><Database size={20} className="mx-auto mb-2" />Nothing found.</p>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={`Add ${tab === "Faculty" ? "faculty" : tab === "Students" ? "student" : "room"}`} testid="add-modal">
        {tab === "Faculty" && (
          <form onSubmit={addFaculty} className="space-y-3" data-testid="add-faculty-form">
            <input data-testid="af-name" className="input !py-2.5 text-sm" placeholder="Full name" required value={fForm.name} onChange={(e) => setFForm({ ...fForm, name: e.target.value })} />
            <input data-testid="af-email" type="email" className="input !py-2.5 text-sm" placeholder="Email" required value={fForm.email} onChange={(e) => setFForm({ ...fForm, email: e.target.value })} />
            <input data-testid="af-department" className="input !py-2.5 text-sm" placeholder="Department" value={fForm.department} onChange={(e) => setFForm({ ...fForm, department: e.target.value })} />
            <input data-testid="af-majors" className="input !py-2.5 text-sm" placeholder="Majors (comma separated)" value={fForm.majors} onChange={(e) => setFForm({ ...fForm, majors: e.target.value })} />
            <input data-testid="af-password" className="input !py-2.5 text-sm" placeholder="Password" value={fForm.password} onChange={(e) => setFForm({ ...fForm, password: e.target.value })} />
            <button data-testid="af-submit" type="submit" className="btn-primary w-full">Add faculty</button>
          </form>
        )}
        {tab === "Students" && (
          <form onSubmit={addStudent} className="space-y-3" data-testid="add-student-form">
            <input data-testid="as-name" className="input !py-2.5 text-sm" placeholder="Full name" required value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} />
            <input data-testid="as-email" type="email" className="input !py-2.5 text-sm" placeholder="Email" required value={sForm.email} onChange={(e) => setSForm({ ...sForm, email: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input data-testid="as-branch" className="input !py-2.5 text-sm" placeholder="Branch" value={sForm.branch} onChange={(e) => setSForm({ ...sForm, branch: e.target.value })} />
              <input data-testid="as-rollno" className="input !py-2.5 text-sm" placeholder="Roll no." value={sForm.roll_no} onChange={(e) => setSForm({ ...sForm, roll_no: e.target.value })} />
            </div>
            <input data-testid="as-password" className="input !py-2.5 text-sm" placeholder="Password" value={sForm.password} onChange={(e) => setSForm({ ...sForm, password: e.target.value })} />
            <button data-testid="as-submit" type="submit" className="btn-primary w-full">Add student</button>
          </form>
        )}
        {tab === "Rooms" && (
          <form onSubmit={addRoom} className="space-y-3" data-testid="add-room-form">
            <input data-testid="ar-name" className="input !py-2.5 text-sm" placeholder="Room name (e.g. R-105)" required value={rForm.name} onChange={(e) => setRForm({ ...rForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select data-testid="ar-type" className="input !py-2.5 text-sm" value={rForm.type} onChange={(e) => setRForm({ ...rForm, type: e.target.value })}>
                <option>Lecture</option>
                <option>Lab</option>
                <option>Seminar</option>
              </select>
              <input data-testid="ar-capacity" type="number" min="1" className="input !py-2.5 text-sm" placeholder="Capacity" value={rForm.capacity} onChange={(e) => setRForm({ ...rForm, capacity: e.target.value })} />
            </div>
            <button data-testid="ar-submit" type="submit" className="btn-primary w-full">Add room</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
