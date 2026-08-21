import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell, CalendarDays, ClipboardList, Video, HelpCircle, CalendarOff,
  Database, PartyPopper, CheckCheck, LogOut,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./bits";

const NAV = {
  student: [
    { to: "/student", label: "Timetable", icon: CalendarDays, end: true },
    { to: "/student/assignments", label: "Assignment", icon: ClipboardList },
    { to: "/student/classroom", label: "Classroom", icon: Video },
    { to: "/student/doubt", label: "Doubt", icon: HelpCircle },
  ],
  teacher: [
    { to: "/teacher", label: "Timetable", icon: CalendarDays, end: true },
    { to: "/teacher/assignments", label: "Assignment", icon: ClipboardList },
    { to: "/teacher/classroom", label: "Classroom", icon: Video },
    { to: "/teacher/doubts", label: "Doubts", icon: HelpCircle },
    { to: "/teacher/leave", label: "Leave", icon: CalendarOff },
  ],
  admin: [
    { to: "/admin", label: "Data", icon: Database, end: true },
    { to: "/admin/timetable", label: "Timetable", icon: CalendarDays },
    { to: "/admin/events", label: "Events", icon: PartyPopper },
    { to: "/admin/leaves", label: "Leave Approval", icon: CheckCheck },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const items = NAV[user.role] || [];

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 border-l-2 px-5 py-3 text-sm transition-colors ${
      isActive
        ? "border-ink bg-white font-medium text-ink"
        : "border-transparent text-steel hover:bg-fog hover:text-ink"
    }`;

  return (
    <div className="min-h-screen bg-white">
      <header className="relative flex h-16 items-center justify-between border-b border-[#ececec] bg-white px-5">
        <div className="flex items-center gap-3" data-testid="profile-section">
          <Avatar src={user.pic} name={user.name} size={38} />
          <div className="leading-tight">
            <div className="text-sm font-medium text-ink" data-testid="profile-name">{user.name}</div>
            <div className="text-xs capitalize text-steel" data-testid="profile-role">{user.role}</div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 font-serif text-[22px] tracking-tight text-ink" data-testid="app-name">
          CampusOne
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              data-testid="notifications-bell"
              onClick={() => setOpen((o) => !o)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-mist"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span
                  data-testid="notifications-unread-count"
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-peach px-1 text-[11px] font-semibold text-sienna"
                >
                  {unread}
                </span>
              )}
            </button>
            {open && (
              <div
                data-testid="notifications-panel"
                className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-[#ececec] bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-[#ececec] px-4 py-3">
                  <span className="text-sm font-medium text-ink">Notifications</span>
                  <button data-testid="mark-all-read-btn" onClick={markAll} className="text-xs text-steel hover:text-ink">
                    Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-smoke">No notifications yet.</p>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-start gap-3 border-b border-[#ececec] px-4 py-3 last:border-0">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-peach"}`} />
                      <div className="min-w-0">
                        <div className="text-sm text-ink">{n.title}</div>
                        {n.body && <div className="text-xs text-steel">{n.body}</div>}
                        <div className="mt-0.5 text-[11px] text-ash">{(n.created_at || "").slice(0, 16).replace("T", " ")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            data-testid="logout-btn"
            onClick={() => { logout(); navigate("/login"); toast.success("Logged out"); }}
            className="flex h-10 w-10 items-center justify-center rounded-full text-steel transition-colors hover:bg-mist hover:text-ink"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-60 shrink-0 flex-col gap-1 bg-mist py-6 md:flex" data-testid="sidebar">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className={linkCls} data-testid={`nav-${it.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <it.icon size={17} strokeWidth={1.8} />
              {it.label}
            </NavLink>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex gap-1 overflow-x-auto border-b border-[#ececec] bg-mist px-3 py-2 md:hidden">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                data-testid={`nav-mobile-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm ${
                    isActive ? "bg-ink text-white" : "text-steel"
                  }`
                }
              >
                <it.icon size={15} /> {it.label}
              </NavLink>
            ))}
          </div>
          <main className="mx-auto max-w-6xl px-5 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
