import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Avatar, EmptyState, StatusBadge } from "../../components/bits";
import DoubtChat from "../../components/DoubtChat";

export default function TeacherDoubts() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);

  const load = () => api.get("/doubts/threads").then((r) => setThreads(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div data-testid="teacher-doubts-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Doubts</h1>
      <p className="mt-1 text-sm text-steel">Answer student questions in chat.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {threads.map((t) => (
            <button
              key={t.id}
              data-testid={`teacher-thread-${t.id}`}
              onClick={() => setActive(t)}
              className={`card flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:border-ink/20 ${
                active?.id === t.id ? "border-ink/40" : ""
              }`}
            >
              <div>
                <div className="text-sm font-medium text-ink">{t.student_name}</div>
                <div className="text-xs text-steel">{t.subject}</div>
              </div>
              <StatusBadge status={t.status} />
            </button>
          ))}
          {threads.length === 0 && <p className="text-sm text-smoke" data-testid="teacher-threads-empty">No doubts asked yet.</p>}
        </div>

        <div>
          {active ? (
            <DoubtChat key={active.id} thread={active} user={user} onCloseThread={load} />
          ) : (
            <EmptyState
              icon={HelpCircle}
              title="Select a conversation"
              body="Student doubts will appear on the left. Open one to reply."
              testid="teacher-doubts-empty"
            />
          )}
        </div>
      </div>
    </div>
  );
}
