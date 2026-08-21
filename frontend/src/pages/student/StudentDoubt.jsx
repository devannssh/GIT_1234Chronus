import { useEffect, useState } from "react";
import { HelpCircle, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, StatusBadge } from "../../components/bits";
import DoubtChat from "../../components/DoubtChat";

export default function StudentDoubt() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);

  const loadThreads = () =>
    api.get("/doubts/threads").then((r) => setThreads(r.data)).catch(() => {});

  useEffect(() => {
    api.get("/doubts/subjects").then((r) => setSubjects(r.data)).catch(() => toast.error("Could not load subjects"));
    loadThreads();
  }, []);

  const ask = async (subject) => {
    try {
      const { data } = await api.post("/doubts/ask", { subject });
      setActive(data);
      loadThreads();
      toast.success(`Chat opened with ${data.teacher_name}`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div data-testid="student-doubt-page">
      <h1 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Doubt</h1>
      <p className="mt-1 text-sm text-steel">Pick a subject and ask the faculty directly.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-medium text-ink">Select a subject</h2>
            <div className="space-y-2">
              {subjects.map((s) => (
                <div key={s.subject} data-testid={`subject-card-${s.subject}`} className="card flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-ink">{s.subject}</div>
                    <div className="text-xs text-steel">{s.teacher_name}</div>
                  </div>
                  <button data-testid={`ask-doubt-${s.subject}`} onClick={() => ask(s.subject)} className="btn-ghost !px-3.5 !py-1.5 text-xs">
                    <MessageSquarePlus size={13} /> Ask a doubt
                  </button>
                </div>
              ))}
              {subjects.length === 0 && <p className="text-sm text-smoke">No subjects found.</p>}
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium text-ink">Your chats</h2>
            <div className="space-y-2">
              {threads.map((t) => (
                <button
                  key={t.id}
                  data-testid={`thread-${t.id}`}
                  onClick={() => setActive(t)}
                  className={`card flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:border-ink/20 ${
                    active?.id === t.id ? "border-ink/40" : ""
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-ink">{t.subject}</div>
                    <div className="text-xs text-steel">{t.teacher_name}</div>
                  </div>
                  <StatusBadge status={t.status} />
                </button>
              ))}
              {threads.length === 0 && <p className="text-sm text-smoke">No chats yet.</p>}
            </div>
          </div>
        </div>

        <div>
          {active ? (
            <DoubtChat key={active.id} thread={active} user={user} onCloseThread={loadThreads} />
          ) : (
            <EmptyState
              icon={HelpCircle}
              title="No doubt is too small"
              body="Select a subject on the left and press “Ask a doubt” to open a chat with the faculty."
              testid="doubt-empty"
            />
          )}
        </div>
      </div>
    </div>
  );
}
