import csv
import io
import logging
import os
import random
import secrets
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import (APIRouter, Depends, FastAPI, File, Form, HTTPException,
                     UploadFile)
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI()
api = APIRouter(prefix="/api")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def uid():
    return uuid.uuid4().hex


# ---------------- auth ----------------

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def pub_user(u):
    return {k: u.get(k) for k in ("id", "name", "email", "role", "branch", "roll_no", "department", "majors", "pic")}


async def get_current_user(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require(*roles):
    async def dep(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return dep


from fastapi import Request


async def current_user(request: Request):
    return await get_current_user(request)


class LoginIn(BaseModel):
    email: str
    password: str


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()}, {"_id": 0})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_token(user), "user": pub_user(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return pub_user(user)


# ---------------- helpers ----------------

async def notify(audience: str, title: str, body: str = ""):
    await db.notifications.insert_one({
        "id": uid(), "audience": audience, "title": title, "body": body,
        "created_at": now_iso(), "read_by": [],
    })


def save_upload(file: UploadFile) -> str:
    ext = Path(file.filename or "file").suffix
    name = f"{uuid.uuid4().hex}{ext}"
    with open(UPLOAD_DIR / name, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return name


# ---------------- notifications ----------------

@api.get("/notifications")
async def get_notifications(user=Depends(current_user)):
    cur = db.notifications.find(
        {"$or": [{"audience": "all"}, {"audience": user["role"]}, {"audience": user["id"]}]},
        {"_id": 0},
    ).sort("created_at", -1).limit(50)
    items = await cur.to_list(50)
    for n in items:
        n["read"] = user["id"] in n.get("read_by", [])
        n.pop("read_by", None)
    return items


@api.post("/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many(
        {"$or": [{"audience": "all"}, {"audience": user["role"]}, {"audience": user["id"]}]},
        {"$addToSet": {"read_by": user["id"]}},
    )
    return {"ok": True}


# ---------------- timetable ----------------

def sort_entries(entries):
    return sorted(entries, key=lambda e: (DAYS.index(e["day"]) if e["day"] in DAYS else 99, e["period"]))


@api.get("/timetable")
async def get_timetable(user=Depends(current_user)):
    if user["role"] == "student":
        entries = await db.timetable.find({"branch": user.get("branch", "CSE")}, {"_id": 0}).to_list(1000)
    elif user["role"] == "teacher":
        entries = await db.timetable.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(1000)
    else:
        entries = await db.timetable.find({}, {"_id": 0}).to_list(5000)
    meta = await db.timetable_meta.find_one({"id": "meta"}, {"_id": 0})
    return {"entries": sort_entries(entries), "meta": meta or {}}


def entries_csv(entries) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Day", "Period", "Start", "End", "Subject", "Teacher", "Room", "Branch"])
    for e in sort_entries(entries):
        w.writerow([e["day"], e["period"], e.get("start", ""), e.get("end", ""),
                    e["subject"], e.get("teacher_name", ""), e.get("room", ""), e.get("branch", "")])
    return buf.getvalue()


@api.get("/timetable/csv")
async def timetable_csv(user=Depends(current_user)):
    if user["role"] == "student":
        entries = await db.timetable.find({"branch": user.get("branch", "CSE")}, {"_id": 0}).to_list(1000)
    elif user["role"] == "teacher":
        entries = await db.timetable.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(1000)
    else:
        entries = await db.timetable.find({}, {"_id": 0}).to_list(5000)
    return Response(
        content=entries_csv(entries),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=timetable.csv"},
    )


async def bump_meta():
    await db.timetable_meta.update_one(
        {"id": "meta"}, {"$set": {"last_updated": now_iso()}, "$inc": {"version": 1}}, upsert=True
    )


@api.post("/admin/timetable/upload")
async def upload_timetable(file: UploadFile = File(...), user=Depends(require("admin"))):
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    docs = []
    teachers = {t["name"].lower(): t for t in await db.users.find({"role": "teacher"}, {"_id": 0}).to_list(500)}
    for row in reader:
        def g(*keys):
            for k in keys:
                for rk, rv in row.items():
                    if rk and rk.strip().lower() == k and rv:
                        return rv.strip()
            return ""
        day = g("day")
        period = g("period")
        subject = g("subject")
        if not day or not period or not subject:
            continue
        tname = g("teacher", "teacher_name")
        teacher = teachers.get(tname.lower())
        docs.append({
            "id": uid(), "day": day, "period": int(period),
            "start": g("start"), "end": g("end"), "subject": subject,
            "teacher_name": tname, "teacher_id": teacher["id"] if teacher else "",
            "room": g("room"), "branch": (g("branch") or "CSE"),
        })
    if not docs:
        raise HTTPException(400, "No valid rows found. Expected columns: day, period, start, end, subject, teacher, room, branch")
    await db.timetable.delete_many({})
    await db.timetable.insert_many(docs)
    await bump_meta()
    return {"inserted": len(docs)}


class EntryUpdate(BaseModel):
    subject: Optional[str] = None
    room: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    teacher_name: Optional[str] = None


@api.put("/admin/timetable/entry/{entry_id}")
async def update_entry(entry_id: str, body: EntryUpdate, user=Depends(require("admin"))):
    update = {k: v for k, v in body.model_dump().items() if v is not None and v != ""}
    if not update:
        raise HTTPException(400, "Nothing to update")
    res = await db.timetable.update_one({"id": entry_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Entry not found")
    await bump_meta()
    return {"ok": True}


@api.post("/admin/timetable/notify")
async def timetable_notify(user=Depends(require("admin"))):
    meta = await db.timetable_meta.find_one({"id": "meta"}, {"_id": 0}) or {}
    await notify("all", "Timetable updated", f"The default timetable (v{meta.get('version', 1)}) has been updated by admin.")
    return {"ok": True}


# ---------------- assignments ----------------

@api.get("/assignments")
async def list_assignments(user=Depends(current_user)):
    if user["role"] == "student":
        items = await db.assignments.find({"branch": user.get("branch", "CSE")}, {"_id": 0}).to_list(500)
        subs = await db.submissions.find({"student_id": user["id"]}, {"_id": 0}).to_list(500)
        sub_map = {s["assignment_id"]: s for s in subs}
        for a in items:
            a["my_submission"] = sub_map.get(a["id"])
    elif user["role"] == "teacher":
        items = await db.assignments.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(500)
        for a in items:
            subs = await db.submissions.find({"assignment_id": a["id"]}, {"_id": 0}).to_list(500)
            a["submissions_count"] = len(subs)
            a["evaluated_count"] = len([s for s in subs if s["status"] == "done"])
    else:
        items = await db.assignments.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda a: a.get("due_date", ""))


@api.post("/assignments")
async def create_assignment(
    title: str = Form(...), subject: str = Form(...), unit: str = Form(""),
    description: str = Form(""), branch: str = Form("CSE"), due_date: str = Form(...),
    file: Optional[UploadFile] = File(None), user=Depends(require("teacher")),
):
    doc = {
        "id": uid(), "title": title, "subject": subject, "unit": unit,
        "description": description, "branch": branch, "due_date": due_date,
        "status": "active", "teacher_id": user["id"], "teacher_name": user["name"],
        "file": save_upload(file) if file and file.filename else None,
        "created_at": now_iso(),
    }
    await db.assignments.insert_one(doc)
    await notify("student", f"New assignment: {title}", f"{subject} · due {due_date[:10]}")
    doc.pop("_id", None)
    return doc


class PostponeIn(BaseModel):
    due_date: str


@api.post("/assignments/{aid}/postpone")
async def postpone_assignment(aid: str, body: PostponeIn, user=Depends(require("teacher"))):
    res = await db.assignments.update_one({"id": aid, "teacher_id": user["id"]}, {"$set": {"due_date": body.due_date, "status": "active"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Assignment not found")
    await notify("student", "Assignment postponed", f"New due date: {body.due_date[:10]}")
    return {"ok": True}


@api.post("/assignments/{aid}/end")
async def end_assignment(aid: str, user=Depends(require("teacher"))):
    res = await db.assignments.update_one({"id": aid, "teacher_id": user["id"]}, {"$set": {"status": "ended"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Assignment not found")
    return {"ok": True}


@api.post("/assignments/{aid}/submit")
async def submit_assignment(aid: str, note: str = Form(""), file: Optional[UploadFile] = File(None), user=Depends(require("student"))):
    a = await db.assignments.find_one({"id": aid}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Assignment not found")
    if a["status"] != "active":
        raise HTTPException(400, "Assignment is closed")
    doc = {
        "id": uid(), "assignment_id": aid, "student_id": user["id"],
        "student_name": user["name"], "roll_no": user.get("roll_no", ""),
        "note": note, "file": save_upload(file) if file and file.filename else None,
        "submitted_at": now_iso(), "status": "turned_in", "marks": None, "feedback": "",
    }
    await db.submissions.update_one(
        {"assignment_id": aid, "student_id": user["id"]},
        {"$set": doc}, upsert=True,
    )
    await notify(a["teacher_id"], "Assignment turned in", f"{user['name']} submitted {a['title']}")
    doc.pop("_id", None)
    return doc


@api.get("/assignments/{aid}/submissions")
async def list_submissions(aid: str, user=Depends(require("teacher", "admin"))):
    subs = await db.submissions.find({"assignment_id": aid}, {"_id": 0}).to_list(500)
    return sorted(subs, key=lambda s: s.get("submitted_at", ""))


class EvaluateIn(BaseModel):
    marks: int
    feedback: str = ""


@api.post("/submissions/{sid}/evaluate")
async def evaluate_submission(sid: str, body: EvaluateIn, user=Depends(require("teacher"))):
    res = await db.submissions.update_one(
        {"id": sid}, {"$set": {"status": "done", "marks": body.marks, "feedback": body.feedback, "evaluated_by": user["id"]}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Submission not found")
    sub = await db.submissions.find_one({"id": sid}, {"_id": 0})
    await notify(sub["student_id"], "Assignment evaluated", f"Marks: {body.marks}")
    return {"ok": True}


# ---------------- classes (classroom) ----------------

@api.get("/classes")
async def list_classes(user=Depends(current_user)):
    if user["role"] == "student":
        items = await db.classes.find({"branch": user.get("branch", "CSE")}, {"_id": 0}).to_list(500)
    elif user["role"] == "teacher":
        items = await db.classes.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(500)
    else:
        items = await db.classes.find({}, {"_id": 0}).to_list(500)
    for c in items:
        c.pop("room_name", None)
    return sorted(items, key=lambda c: (c.get("date", ""), c.get("time", "")))


class ClassCreate(BaseModel):
    subject: str
    date: str
    time: str
    duration_min: int = 60
    branch: str = "CSE"


@api.post("/classes")
async def create_class(body: ClassCreate, user=Depends(require("teacher"))):
    doc = {
        "id": uid(), "subject": body.subject, "date": body.date, "time": body.time,
        "duration_min": body.duration_min, "branch": body.branch,
        "teacher_id": user["id"], "teacher_name": user["name"], "teacher_pic": user.get("pic", ""),
        "room_name": "campusone-" + secrets.token_urlsafe(16),
        "created_at": now_iso(),
    }
    await db.classes.insert_one(doc)
    await notify("student", f"Class scheduled: {body.subject}", f"{user['name']} · {body.date} at {body.time}")
    out = dict(doc)
    out.pop("_id", None)
    return out


@api.post("/classes/{cid}/join")
async def join_class(cid: str, user=Depends(current_user)):
    cls = await db.classes.find_one({"id": cid}, {"_id": 0})
    if not cls:
        raise HTTPException(404, "Class not found")
    if user["role"] == "student" and cls.get("branch") != user.get("branch"):
        raise HTTPException(403, "Not enrolled in this class")
    return {"room_name": cls["room_name"], "subject": cls["subject"], "teacher_name": cls["teacher_name"]}


class AttendanceIn(BaseModel):
    participants: list[str]


@api.post("/classes/{cid}/attendance")
async def auto_attendance(cid: str, body: AttendanceIn, user=Depends(require("teacher"))):
    cls = await db.classes.find_one({"id": cid}, {"_id": 0})
    if not cls:
        raise HTTPException(404, "Class not found")
    if cls["teacher_id"] != user["id"]:
        raise HTTPException(403, "Only the class teacher can take attendance")
    present_names = {n.strip().lower() for n in body.participants}
    students = await db.users.find({"role": "student", "branch": cls.get("branch", "CSE")}, {"_id": 0}).to_list(1000)
    marked = []
    for s in students:
        if s["name"].strip().lower() in present_names:
            await db.attendance.update_one(
                {"class_id": cid, "student_id": s["id"]},
                {"$set": {"class_id": cid, "student_id": s["id"], "student_name": s["name"],
                          "roll_no": s.get("roll_no", ""), "status": "present", "marked_at": now_iso()}},
                upsert=True,
            )
            marked.append(s["name"])
    return {"present": marked, "count": len(marked)}


@api.get("/classes/{cid}/attendance")
async def get_attendance(cid: str, user=Depends(require("teacher", "admin"))):
    return await db.attendance.find({"class_id": cid}, {"_id": 0}).to_list(1000)


# ---------------- doubts ----------------

@api.get("/doubts/subjects")
async def doubt_subjects(user=Depends(require("student"))):
    entries = await db.timetable.find({"branch": user.get("branch", "CSE")}, {"_id": 0}).to_list(1000)
    seen = {}
    for e in entries:
        if e["subject"] not in seen and e.get("teacher_id"):
            seen[e["subject"]] = {"subject": e["subject"], "teacher_id": e["teacher_id"], "teacher_name": e.get("teacher_name", "")}
    if not seen:
        teachers = await db.users.find({"role": "teacher"}, {"_id": 0}).to_list(100)
        for t in teachers:
            seen[t.get("department", "General")] = {"subject": t.get("department", "General"), "teacher_id": t["id"], "teacher_name": t["name"]}
    return list(seen.values())


@api.post("/doubts/ask")
async def ask_doubt(body: dict, user=Depends(require("student"))):
    subject = body.get("subject", "")
    sub = await db.timetable.find_one({"branch": user.get("branch", "CSE"), "subject": subject}, {"_id": 0})
    teacher_id = sub.get("teacher_id") if sub else None
    if not teacher_id:
        t = await db.users.find_one({"role": "teacher"}, {"_id": 0})
        teacher_id = t["id"] if t else ""
    teacher = await db.users.find_one({"id": teacher_id}, {"_id": 0})
    existing = await db.doubt_threads.find_one(
        {"student_id": user["id"], "subject": subject, "status": "open"}, {"_id": 0})
    if existing:
        return existing
    doc = {
        "id": uid(), "student_id": user["id"], "student_name": user["name"],
        "subject": subject, "teacher_id": teacher_id,
        "teacher_name": teacher["name"] if teacher else "Faculty",
        "teacher_pic": teacher.get("pic", "") if teacher else "",
        "status": "open", "created_at": now_iso(),
    }
    await db.doubt_threads.insert_one(doc)
    await notify(teacher_id, "New doubt asked", f"{user['name']} · {subject}")
    doc.pop("_id", None)
    return doc


@api.get("/doubts/threads")
async def list_threads(user=Depends(current_user)):
    if user["role"] == "student":
        items = await db.doubt_threads.find({"student_id": user["id"]}, {"_id": 0}).to_list(500)
    elif user["role"] == "teacher":
        items = await db.doubt_threads.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(500)
    else:
        items = await db.doubt_threads.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda t: t.get("created_at", ""), reverse=True)


@api.get("/doubts/threads/{tid}/messages")
async def thread_messages(tid: str, user=Depends(current_user)):
    msgs = await db.doubt_messages.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@api.post("/doubts/threads/{tid}/messages")
async def post_message(tid: str, text: str = Form(""), file: Optional[UploadFile] = File(None), user=Depends(current_user)):
    thread = await db.doubt_threads.find_one({"id": tid}, {"_id": 0})
    if not thread:
        raise HTTPException(404, "Thread not found")
    if thread["status"] != "open":
        raise HTTPException(400, "Chat is closed")
    if user["id"] not in (thread["student_id"], thread["teacher_id"]):
        raise HTTPException(403, "Not a participant")
    doc = {
        "id": uid(), "thread_id": tid, "sender_id": user["id"], "sender_name": user["name"],
        "sender_role": user["role"], "text": text,
        "file": save_upload(file) if file and file.filename else None,
        "file_name": file.filename if file and file.filename else None,
        "created_at": now_iso(),
    }
    await db.doubt_messages.insert_one(doc)
    other = thread["teacher_id"] if user["id"] == thread["student_id"] else thread["student_id"]
    await notify(other, "New doubt message", f"{user['name']} · {thread['subject']}")
    doc.pop("_id", None)
    return doc


@api.post("/doubts/threads/{tid}/close")
async def close_thread(tid: str, user=Depends(current_user)):
    res = await db.doubt_threads.update_one({"id": tid}, {"$set": {"status": "closed"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Thread not found")
    return {"ok": True}


@api.get("/doubts/threads/{tid}/transcript")
async def transcript(tid: str, user=Depends(current_user)):
    thread = await db.doubt_threads.find_one({"id": tid}, {"_id": 0})
    if not thread:
        raise HTTPException(404, "Thread not found")
    msgs = await db.doubt_messages.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    lines = [f"Doubt chat — {thread['subject']}", f"Student: {thread['student_name']}  Faculty: {thread['teacher_name']}", ""]
    for m in msgs:
        ts = m["created_at"][:16].replace("T", " ")
        lines.append(f"[{ts}] {m['sender_name']}: {m['text']}" + (f" (attachment: {m['file_name']})" if m.get("file_name") else ""))
    return Response(
        content="\n".join(lines), media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=doubt-{thread['subject']}.txt"},
    )


# ---------------- leaves ----------------

class LeaveIn(BaseModel):
    date: str
    type: str = "full"  # full | half
    reason: str


@api.post("/leaves")
async def apply_leave(body: LeaveIn, user=Depends(require("teacher"))):
    doc = {
        "id": uid(), "teacher_id": user["id"], "teacher_name": user["name"],
        "teacher_pic": user.get("pic", ""), "department": user.get("department", ""),
        "date": body.date, "type": body.type, "reason": body.reason,
        "status": "pending", "created_at": now_iso(),
    }
    await db.leaves.insert_one(doc)
    await notify("admin", "Leave request", f"{user['name']} · {body.date} ({body.type} day)")
    doc.pop("_id", None)
    return doc


@api.get("/leaves")
async def list_leaves(user=Depends(current_user)):
    if user["role"] == "teacher":
        items = await db.leaves.find({"teacher_id": user["id"]}, {"_id": 0}).to_list(500)
    else:
        items = await db.leaves.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda l: l.get("created_at", ""), reverse=True)


class LeaveDecision(BaseModel):
    action: str  # approve | deny


@api.post("/leaves/{lid}/decision")
async def decide_leave(lid: str, body: LeaveDecision, user=Depends(require("admin"))):
    status = "approved" if body.action == "approve" else "denied"
    res = await db.leaves.update_one({"id": lid, "status": "pending"}, {"$set": {"status": status, "decided_by": user["id"]}})
    if res.matched_count == 0:
        raise HTTPException(404, "Pending leave not found")
    leave = await db.leaves.find_one({"id": lid}, {"_id": 0})
    await notify(leave["teacher_id"], f"Leave {status}", f"{leave['date']} ({leave['type']} day)")
    return {"ok": True, "status": status}


# ---------------- admin data: faculty / students / rooms ----------------

@api.get("/admin/faculty")
async def list_faculty(search: str = "", user=Depends(require("admin"))):
    q = {"role": "teacher"}
    items = await db.users.find(q, {"_id": 0}).to_list(1000)
    if search:
        s = search.lower()
        items = [u for u in items if s in u["name"].lower() or s in u.get("department", "").lower() or s in u.get("majors", "").lower()]
    return [pub_user(u) for u in items]


class FacultyIn(BaseModel):
    name: str
    email: str
    department: str = ""
    majors: str = ""
    password: str = "teacher123"


@api.post("/admin/faculty")
async def add_faculty(body: FacultyIn, user=Depends(require("admin"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    doc = {
        "id": uid(), "name": body.name, "email": email, "role": "teacher",
        "department": body.department, "majors": body.majors,
        "pic": f"https://i.pravatar.cc/150?u={email}",
        "password_hash": hash_password(body.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return pub_user(doc)


@api.delete("/admin/faculty/{fid}")
async def remove_faculty(fid: str, user=Depends(require("admin"))):
    await db.users.delete_one({"id": fid, "role": "teacher"})
    return {"ok": True}


@api.get("/admin/students")
async def list_students(search: str = "", user=Depends(require("admin"))):
    items = await db.users.find({"role": "student"}, {"_id": 0}).to_list(2000)
    if search:
        s = search.lower()
        items = [u for u in items if s in u["name"].lower() or s in u.get("roll_no", "").lower() or s in u.get("branch", "").lower()]
    return [pub_user(u) for u in items]


class StudentIn(BaseModel):
    name: str
    email: str
    branch: str = "CSE"
    roll_no: str = ""
    password: str = "student123"


@api.post("/admin/students")
async def add_student(body: StudentIn, user=Depends(require("admin"))):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    doc = {
        "id": uid(), "name": body.name, "email": email, "role": "student",
        "branch": body.branch, "roll_no": body.roll_no,
        "pic": f"https://i.pravatar.cc/150?u={email}",
        "password_hash": hash_password(body.password), "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return pub_user(doc)


@api.delete("/admin/students/{sid}")
async def remove_student(sid: str, user=Depends(require("admin"))):
    await db.users.delete_one({"id": sid, "role": "student"})
    return {"ok": True}


@api.get("/admin/rooms")
async def list_rooms(user=Depends(require("admin"))):
    return await db.rooms.find({}, {"_id": 0}).to_list(500)


class RoomIn(BaseModel):
    name: str
    type: str = "Lecture"
    capacity: int = 60


@api.post("/admin/rooms")
async def add_room(body: RoomIn, user=Depends(require("admin"))):
    if await db.rooms.find_one({"name": body.name}):
        raise HTTPException(400, "Room already exists")
    doc = {"id": uid(), **body.model_dump()}
    await db.rooms.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/admin/rooms/{rid}")
async def remove_room(rid: str, user=Depends(require("admin"))):
    await db.rooms.delete_one({"id": rid})
    return {"ok": True}


@api.post("/admin/rooms/allocate")
async def allocate_rooms(user=Depends(require("admin"))):
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(500)
    entries = await db.timetable.find({}, {"_id": 0}).to_list(5000)
    if not rooms or not entries:
        raise HTTPException(400, "Need rooms and timetable entries to allocate")
    room_names = [r["name"] for r in rooms]
    used = set()
    changed = 0
    for e in entries:
        choices = [rn for rn in room_names if (e["day"], e["period"], rn) not in used]
        if not choices:
            continue
        rn = random.choice(choices)
        used.add((e["day"], e["period"], rn))
        if e.get("room") != rn:
            await db.timetable.update_one({"id": e["id"]}, {"$set": {"room": rn}})
            changed += 1
    await bump_meta()
    await notify("all", "Room allocation updated", f"{changed} timetable entries re-allocated across {len(room_names)} rooms.")
    return {"changed": changed, "rooms": len(room_names)}


# ---------------- events ----------------

@api.get("/events")
async def list_events(user=Depends(current_user)):
    items = await db.events.find({}, {"_id": 0}).to_list(500)
    return sorted(items, key=lambda e: e.get("date", ""))


class EventIn(BaseModel):
    name: str
    venue: str = ""
    details: str = ""
    date: str = ""
    time: str = ""
    faculties: str = ""


@api.post("/events")
async def create_event(body: EventIn, user=Depends(require("admin"))):
    doc = {"id": uid(), **body.model_dump(), "created_at": now_iso()}
    await db.events.insert_one(doc)
    await notify("all", f"Event scheduled: {body.name}", f"{body.venue} · {body.date}")
    doc.pop("_id", None)
    return doc


@api.put("/events/{eid}")
async def update_event(eid: str, body: EventIn, user=Depends(require("admin"))):
    res = await db.events.update_one({"id": eid}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Event not found")
    return {"ok": True}


@api.delete("/events/{eid}")
async def delete_event(eid: str, user=Depends(require("admin"))):
    await db.events.delete_one({"id": eid})
    return {"ok": True}


# ---------------- admin stats ----------------

@api.get("/admin/stats")
async def admin_stats(user=Depends(require("admin"))):
    return {
        "faculty": await db.users.count_documents({"role": "teacher"}),
        "students": await db.users.count_documents({"role": "student"}),
        "rooms": await db.rooms.count_documents({}),
        "pending_leaves": await db.leaves.count_documents({"status": "pending"}),
        "active_assignments": await db.assignments.count_documents({"status": "active"}),
        "events": await db.events.count_documents({}),
    }


# ---------------- seed ----------------

def pic(email):
    return f"https://i.pravatar.cc/150?u={email}"


async def seed():
    # admin from env, idempotent
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@college.edu").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": uid(), "name": "Devansh", "email": admin_email, "role": "admin",
            "pic": pic(admin_email), "password_hash": hash_password(admin_password),
            "created_at": now_iso(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    if await db.users.count_documents({"role": "teacher"}) > 0:
        return

    teachers = [
        {"name": "Ananya Sharma", "email": "teacher@college.edu", "department": "Computer Science", "majors": "DBMS, Operating Systems"},
        {"name": "Ravi Verma", "email": "ravi.verma@college.edu", "department": "Mathematics", "majors": "Linear Algebra, Calculus"},
        {"name": "Meera Iyer", "email": "meera.iyer@college.edu", "department": "Physics", "majors": "Quantum Mechanics, Optics"},
        {"name": "Arjun Nair", "email": "arjun.nair@college.edu", "department": "Humanities", "majors": "Technical Writing, Communication"},
    ]
    for t in teachers:
        t.update({"id": uid(), "role": "teacher", "pic": pic(t["email"]),
                  "password_hash": hash_password("teacher123"), "created_at": now_iso()})
    await db.users.insert_many(teachers)

    students = [
        {"name": "Aarav Patel", "email": "student@college.edu", "roll_no": "CS23-001"},
        {"name": "Diya Shah", "email": "diya.shah@college.edu", "roll_no": "CS23-002"},
        {"name": "Rohan Mehta", "email": "rohan.mehta@college.edu", "roll_no": "CS23-003"},
        {"name": "Sneha Kulkarni", "email": "sneha.k@college.edu", "roll_no": "CS23-004"},
        {"name": "Kabir Singh", "email": "kabir.singh@college.edu", "roll_no": "CS23-005"},
    ]
    for s in students:
        s.update({"id": uid(), "role": "student", "branch": "CSE", "pic": pic(s["email"]),
                  "password_hash": hash_password("student123"), "created_at": now_iso()})
    await db.users.insert_many(students)

    t_ananya, t_ravi, t_meera, t_arjun = teachers

    def tt(day, period, start, end, subject, teacher, room):
        return {"id": uid(), "day": day, "period": period, "start": start, "end": end,
                "subject": subject, "teacher_id": teacher["id"], "teacher_name": teacher["name"],
                "room": room, "branch": "CSE"}

    slots = [("09:00", "09:55"), ("10:00", "10:55"), ("11:15", "12:10"), ("13:00", "13:55"), ("14:00", "14:55")]
    grid = {
        "Monday": [("DBMS", t_ananya, "R-101"), ("Mathematics", t_ravi, "R-102"), ("Physics", t_meera, "R-103"), ("English", t_arjun, "R-101"), ("DBMS Lab", t_ananya, "L-201")],
        "Tuesday": [("Mathematics", t_ravi, "R-102"), ("DBMS", t_ananya, "R-101"), ("English", t_arjun, "R-104"), ("Physics", t_meera, "R-103"), ("Free", None, "")],
        "Wednesday": [("Physics", t_meera, "R-103"), ("English", t_arjun, "R-104"), ("Mathematics", t_ravi, "R-102"), ("DBMS", t_ananya, "R-101"), ("Physics Lab", t_meera, "L-202")],
        "Thursday": [("English", t_arjun, "R-104"), ("Physics", t_meera, "R-103"), ("DBMS", t_ananya, "R-101"), ("Mathematics", t_ravi, "R-102"), ("Free", None, "")],
        "Friday": [("Mathematics", t_ravi, "R-102"), ("DBMS", t_ananya, "R-101"), ("Physics", t_meera, "R-103"), ("English", t_arjun, "R-104"), ("Seminar", t_ananya, "R-104")],
    }
    entries = []
    for day, periods in grid.items():
        for i, (subject, teacher, room) in enumerate(periods, start=1):
            if teacher is None:
                entries.append({"id": uid(), "day": day, "period": i, "start": slots[i-1][0], "end": slots[i-1][1],
                                "subject": "Free", "teacher_id": "", "teacher_name": "", "room": "", "branch": "CSE"})
            else:
                entries.append(tt(day, i, slots[i-1][0], slots[i-1][1], subject, teacher, room))
    await db.timetable.insert_many(entries)
    await db.timetable_meta.insert_one({"id": "meta", "last_updated": now_iso(), "version": 1})

    rooms = [
        {"id": uid(), "name": "R-101", "type": "Lecture", "capacity": 60},
        {"id": uid(), "name": "R-102", "type": "Lecture", "capacity": 60},
        {"id": uid(), "name": "R-103", "type": "Lecture", "capacity": 45},
        {"id": uid(), "name": "R-104", "type": "Lecture", "capacity": 45},
        {"id": uid(), "name": "L-201", "type": "Lab", "capacity": 30},
        {"id": uid(), "name": "L-202", "type": "Lab", "capacity": 30},
    ]
    await db.rooms.insert_many(rooms)

    today = datetime.now(timezone.utc).date()
    assignments = [
        {"id": uid(), "title": "Normalisation Worksheet", "subject": "DBMS", "unit": "Unit 3",
         "description": "Normalize the given schema up to 3NF. Show each step clearly.", "branch": "CSE",
         "due_date": (today + timedelta(days=3)).isoformat(), "status": "active",
         "teacher_id": t_ananya["id"], "teacher_name": t_ananya["name"], "file": None, "created_at": now_iso()},
        {"id": uid(), "title": "Linear Algebra Problem Set", "subject": "Mathematics", "unit": "Unit 2",
         "description": "Solve problems 1–15 on eigenvalues and eigenvectors.", "branch": "CSE",
         "due_date": (today + timedelta(days=5)).isoformat(), "status": "active",
         "teacher_id": t_ravi["id"], "teacher_name": t_ravi["name"], "file": None, "created_at": now_iso()},
        {"id": uid(), "title": "Wave Optics Essay", "subject": "Physics", "unit": "Unit 1",
         "description": "Write a short essay on interference and diffraction.", "branch": "CSE",
         "due_date": (today - timedelta(days=2)).isoformat(), "status": "ended",
         "teacher_id": t_meera["id"], "teacher_name": t_meera["name"], "file": None, "created_at": now_iso()},
    ]
    await db.assignments.insert_many(assignments)

    s_diya = students[1]
    await db.submissions.insert_one({
        "id": uid(), "assignment_id": assignments[0]["id"], "student_id": s_diya["id"],
        "student_name": s_diya["name"], "roll_no": s_diya["roll_no"], "note": "Done all parts.",
        "file": None, "submitted_at": now_iso(), "status": "turned_in", "marks": None, "feedback": "",
    })

    classes = [
        {"id": uid(), "subject": "DBMS", "date": (today + timedelta(days=1)).isoformat(), "time": "10:00",
         "duration_min": 60, "branch": "CSE", "teacher_id": t_ananya["id"], "teacher_name": t_ananya["name"],
         "teacher_pic": t_ananya["pic"], "room_name": "campusone-" + secrets.token_urlsafe(16), "created_at": now_iso()},
        {"id": uid(), "subject": "Mathematics", "date": (today + timedelta(days=2)).isoformat(), "time": "09:00",
         "duration_min": 45, "branch": "CSE", "teacher_id": t_ravi["id"], "teacher_name": t_ravi["name"],
         "teacher_pic": t_ravi["pic"], "room_name": "campusone-" + secrets.token_urlsafe(16), "created_at": now_iso()},
    ]
    await db.classes.insert_many(classes)

    await db.leaves.insert_one({
        "id": uid(), "teacher_id": t_meera["id"], "teacher_name": t_meera["name"],
        "teacher_pic": t_meera["pic"], "department": t_meera["department"],
        "date": (today + timedelta(days=4)).isoformat(), "type": "half",
        "reason": "Medical appointment in the afternoon.", "status": "pending", "created_at": now_iso(),
    })

    await db.events.insert_one({
        "id": uid(), "name": "TechFest 2026", "venue": "Main Auditorium",
        "details": "Annual technical festival with hackathon, robotics and paper presentation.",
        "date": (today + timedelta(days=14)).isoformat(), "time": "09:30",
        "faculties": "Ananya Sharma, Arjun Nair", "created_at": now_iso(),
    })

    await notify("all", "Welcome to CampusOne", "Your dashboards are set up. Check the timetable for this week's schedule.")
    await notify("student", "New assignment: Normalisation Worksheet", "DBMS · due soon")


@api.get("/")
async def root():
    return {"message": "CampusOne API"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await seed()
    logger.info("Seed complete")


app.include_router(api)
app.mount("/api/files", StaticFiles(directory=str(UPLOAD_DIR)), name="files")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
