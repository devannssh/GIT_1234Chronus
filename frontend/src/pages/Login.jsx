import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Presentation, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiError } from "../lib/api";

const ROLES = [
  { key: "student", label: "Student", icon: GraduationCap, hint: "student@college.edu · student123" },
  { key: "teacher", label: "Teacher", icon: Presentation, hint: "teacher@college.edu · teacher123" },
  { key: "admin", label: "Admin", icon: ShieldCheck, hint: "devannssh.work@gmail.com · admin123" },
];

export default function Login() {
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      navigate(`/${user.role}`, { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const selected = ROLES.find((r) => r.key === role);

  return (
    <div className="flex min-h-screen bg-white" data-testid="login-page">
      <div className="hidden w-[42%] flex-col justify-between bg-mist p-12 lg:flex">
        <div className="text-sm font-medium tracking-wide text-ash">CAMPUS MANAGEMENT</div>
        <div>
          <h1 className="font-serif text-[72px] leading-[1.05] tracking-[-1.5px] text-ink">
            Campus
            <br />
            One<span className="text-sienna">.</span>
          </h1>
          <p className="mt-6 max-w-xs text-[15px] leading-relaxed text-steel">
            Timetables, assignments, classrooms and doubts — one quiet place for students, teachers and admins.
          </p>
        </div>
        <div className="text-xs text-ash">Timetable · Assignment · Classroom · Doubt</div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="font-serif text-[32px] tracking-[-0.4px] text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-steel">Choose your role and continue.</p>

          <div className="mt-8 grid grid-cols-3 gap-3" data-testid="role-selector">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                data-testid={`role-${r.key}-btn`}
                onClick={() => setRole(r.key)}
                className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-5 transition-all ${
                  role === r.key
                    ? "border-ink bg-ink text-white"
                    : "border-ink/10 bg-white text-steel hover:border-ink/30 hover:text-ink"
                }`}
              >
                <r.icon size={22} strokeWidth={1.6} />
                <span className="text-sm font-medium">{r.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="login-form">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ash">Username / Email</label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                className="input"
                placeholder={`${role}@college.edu`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ash">Password</label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div data-testid="login-error" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-sienna">
                {error}
              </div>
            )}
            <button data-testid="login-submit-btn" type="submit" disabled={busy} className="btn-primary w-full !py-3.5">
              {busy ? "Signing in…" : `Sign in as ${selected.label}`}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ash" data-testid="demo-hint">
            Demo — {selected.hint}
          </p>
        </div>
      </div>
    </div>
  );
}
