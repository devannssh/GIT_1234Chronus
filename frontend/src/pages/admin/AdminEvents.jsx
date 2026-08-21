import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, MapPin, Clock, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { EmptyState, Modal, fmtDate } from "../../components/bits";

const EMPTY = { name: "", venue: "", details: "", date: "", time: "", faculties: "" };

export default function AdminEvents() {
  const [events, setEvents] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = () => api.get("/events").then((r) => setEvents(r.data)).catch(() => toast.error("Could not load events"));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/events/${editing.id}`, form);
        toast.success("Event updated");
      } else {
        await api.post("/events", form);
        toast.success("Event created and everyone notified");
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const remove = async (id) => {
    await api.delete(`/events/${id}`);
    toast.success("Event deleted");
    load();
  };

  if (!events) return null;

  return (
    <div data-testid="admin-events-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Events</h1>
          <p className="mt-1 text-sm text-steel">Schedule and manage campus events.</p>
        </div>
        <button data-testid="schedule-event-btn" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }} className="btn-primary">
          <Plus size={16} /> Schedule event
        </button>
      </div>

      <div className="space-y-3">
        {events.length === 0 && <EmptyState icon={PartyPopper} title="No events yet" body="Schedule the first campus event." testid="events-empty" />}
        {events.map((ev) => (
          <div key={ev.id} data-testid={`event-card-${ev.id}`} className="card px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg text-ink">{ev.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] text-steel">
                  {ev.venue && <span className="flex items-center gap-1"><MapPin size={13} /> {ev.venue}</span>}
                  {ev.date && <span className="flex items-center gap-1"><Clock size={13} /> {fmtDate(ev.date)} {ev.time && `· ${ev.time}`}</span>}
                </div>
                {ev.details && <p className="mt-2 text-sm text-steel">{ev.details}</p>}
                {ev.faculties && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ev.faculties.split(",").map((f) => f.trim()).filter(Boolean).map((f) => (
                      <span key={f} className="tag">{f}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  data-testid={`edit-event-${ev.id}`}
                  onClick={() => { setEditing(ev); setForm({ name: ev.name, venue: ev.venue, details: ev.details, date: fmtDate(ev.date), time: ev.time, faculties: ev.faculties }); setOpen(true); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-mist hover:text-ink"
                >
                  <Pencil size={16} />
                </button>
                <button data-testid={`delete-event-${ev.id}`} onClick={() => remove(ev.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-steel transition-colors hover:bg-peach hover:text-sienna">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit event" : "Schedule event"} testid="event-modal">
        <form onSubmit={save} className="space-y-3" data-testid="event-form">
          <input data-testid="ev-name" className="input !py-2.5 text-sm" placeholder="Event name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input data-testid="ev-venue" className="input !py-2.5 text-sm" placeholder="Venue details" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <textarea data-testid="ev-details" className="input min-h-20 resize-none !py-2.5 text-sm" placeholder="Details about the event" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input data-testid="ev-date" type="date" className="input !py-2.5 text-sm" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input data-testid="ev-time" type="time" className="input !py-2.5 text-sm" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </div>
          <input data-testid="ev-faculties" className="input !py-2.5 text-sm" placeholder="Faculties involved (comma separated)" value={form.faculties} onChange={(e) => setForm({ ...form, faculties: e.target.value })} />
          <button data-testid="ev-submit" type="submit" className="btn-primary w-full">{editing ? "Save changes" : "Create event"}</button>
        </form>
      </Modal>
    </div>
  );
}
