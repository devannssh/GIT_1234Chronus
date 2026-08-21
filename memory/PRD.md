# CampusOne — PRD

## Original Problem Statement
End-to-end college management web app with three role logins (student / teacher / admin, username + password). Home page: top navbar (profile left, app name center, notifications top-right), left sidebar tabs.

- **Student:** Timetable (downloadable CSV), Assignment (horizontal cards: due date, subject, unit + View / Submit), Classroom (due classes as horizontal cards with teacher pic/name, subject, time & date + Join → Google Meet-like interface with screen share, mic, video, end call), Doubt (select subject → Ask a doubt → chat with faculty with file attachment, save chat, close chat).
- **Teacher:** Timetable; Assignment (previous assignments horizontal cards with green dot for active; click → popup of turned-in students, evaluate & mark done; create new assignment with PDF upload, postpone & end buttons); Classroom (schedule + notify students, Auto attendance button marks meeting participants present); Leave (full/half day off, admin approves).
- **Admin:** Data (faculty/students/rooms — search bar with filter icon, horizontal cards with profile pic, add/remove; rooms with random allocation); Timetable (upload default timetable, edit, download, notify, last updated date); Events (schedule event: name, venue, details, faculties involved, edit); Leave Approval (horizontal cards with profile, name, reason, date, (Half Day) marker, approve/deny).

Theme: provided "Steep for Timetable" spec — light warm-paper editorial theme, Source Serif 4 (Signifier stand-in) + Instrument Sans (Sohne stand-in), palette ink #17191c / mist #f2f2f3 / fog #fafafb / steel #777b86 / ash #979799 / smoke #a3a6af / peach #fbe1d1 + sienna #5d2a1a (peach = pending/attention, ink = primary/closed-positive, monochrome closed states).

## User Choices
- JWT custom auth with pre-seeded demo accounts (no OAuth).
- Real video calls via Jitsi Meet (`@jitsi/react-sdk`, public meet.jit.si, zero API keys).
- DB-backed doubt chat with file attachments + save transcript + close.
- Seeded demo dataset, all CRUD functional against MongoDB.

## Architecture
- **Backend:** FastAPI (`/app/backend/server.py`), Motor (async MongoDB), bcrypt + PyJWT Bearer tokens, local disk uploads at `/app/backend/uploads` served via `/api/files/`. Startup seeding (idempotent). Regression suite: `/app/backend/tests/backend_test.py`.
- **Frontend:** React 19 + CRA/craco, Tailwind (custom palette), react-router-dom 7, axios instance with Bearer interceptor (`src/lib/api.js`), sonner toasts, lucide icons.
- **Video:** Jitsi External API via `@jitsi/react-sdk`; teacher auto-attendance posts participant display names to `/api/classes/{id}/attendance`, matched to enrolled students.

## User Personas
- Student (Aarav Patel, CSE): views timetable, submits assignments, joins classes, asks doubts.
- Teacher (Ananya Sharma, CS): creates/evaluates assignments, schedules classes, takes auto attendance, applies for leave, answers doubts.
- Admin (Devansh): manages faculty/students/rooms, timetable, events, leave approvals.

## Credentials (see /app/memory/test_credentials.md)
- admin: devannssh.work@gmail.com / admin123
- teacher: teacher@college.edu / teacher123 (+3 more teachers)
- student: student@college.edu / student123 (+4 more students)

## Implemented (2026-08-21)
- Login page with role selector (student/teacher/admin) + JWT auth, seeded users.
- Layout: topbar (profile left, CampusOne center, bell + unread peach badge right), role-scoped sidebar.
- Student: Timetable grid + CSV download; Assignments view/submit with file upload; Classroom join → real Jitsi meeting (mic/video/screen share/end call); Doubt chat (subjects from timetable, attachments, save transcript .txt, close).
- Teacher: Assignments (create with PDF, previous list with green active dot, submissions popup, marks + mark done, postpone, end); Classroom (schedule + auto-notify, join, auto attendance, attendance viewer); Leave (apply full/half, status tracking); Doubts (reply to student threads).
- Admin: Data (stats cards, faculty/student/room CRUD, search, random room allocation); Timetable (CSV upload, per-cell edit, download, notify, version + last-updated); Events (create/edit/delete, notify); Leave approval (approve/deny with half-day marker).
- Notifications engine (audience-scoped, unread tracking, mark-all-read).

## Test Status
- Backend: 23/23 pytest pass. Frontend: all tested Playwright flows pass (iteration_1). Jitsi iframe loads externally — moderator console warnings on public meet.jit.si are expected and non-blocking.

## Known Limitations
- Public meet.jit.si: all participants are moderators (no enforced teacher-only moderation); production would need self-hosted Jitsi/JaaS with JWT.
- Doubt chat polls every 5s (not websockets).
- File uploads stored on local disk (not object storage).
- CORS open (`*`) for demo.

## Backlog
- P0: none.
- P1: Real-time chat via websockets; object storage for uploads; attendance history view per student; teacher-only Jitsi moderation (JaaS).
- P2: Audit log UI; multi-branch support in admin UI; password reset flow; mobile bottom-nav refinement.
