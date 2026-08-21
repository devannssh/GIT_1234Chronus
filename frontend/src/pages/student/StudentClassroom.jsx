import { useEffect, useState } from "react";
import { Video as VideoIcon, Clock } from "lucide-react";
import { toast } from "sonner";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Avatar, EmptyState, fmtDate } from "../../components/bits";
import MeetingRoom from "../../components/MeetingRoom";

export default function StudentClassroom() {
  const { user } = useAuth();
  const [classes, setClasses] = useState(null);
  const [meeting, setMeeting] = useState(null);

  useEffect(() => {
    api.get("/classes").then((r) => setClasses(r.data)).catch(() => toast.error("Could not load classes"));
  }, []);

  if (meeting) return <MeetingRoom cls={meeting} user={user} onLeave={() => setMeeting(null)} />;
  if (!classes) return null;

  return (
    <div data-testid="student-classroom-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Classroom</h1>
      <p className="mt-1 text-sm text-steel">Join your scheduled live classes.</p>

      <div className="mt-6 space-y-3">
        {classes.length === 0 && (
          <EmptyState icon={VideoIcon} title="No classes due" body="Scheduled classes will appear here with a join button." testid="classes-empty" />
        )}
        {classes.map((c) => (
          <div key={c.id} data-testid={`class-card-${c.id}`} className="card flex flex-wrap items-center gap-4 px-5 py-4">
            <Avatar src={c.teacher_pic} name={c.teacher_name} size={52} />
            <div className="min-w-0 flex-1">
              <div className="font-serif text-lg text-ink">{c.subject}</div>
              <div className="text-sm text-steel">{c.teacher_name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ash">
                <Clock size={13} /> {fmtDate(c.date)} · {c.time} · {c.duration_min} min
              </div>
            </div>
            <button data-testid={`join-class-${c.id}`} onClick={() => setMeeting(c)} className="btn-primary">
              <VideoIcon size={16} /> Join
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
