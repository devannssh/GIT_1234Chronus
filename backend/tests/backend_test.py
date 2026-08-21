"""CampusOne backend regression tests"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("devannssh.work@gmail.com", "admin123"),
    "teacher": ("teacher@college.edu", "teacher123"),
    "student": ("student@college.edu", "student123"),
    "diya": ("diya.shah@college.edu", "student123"),
}


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def _h(tok_pkg):
    return {"Authorization": f"Bearer {tok_pkg['token']}"}


# ---------- auth ----------
class TestAuth:
    def test_admin_login(self, tokens):
        assert tokens["admin"]["user"]["role"] == "admin"

    def test_teacher_login(self, tokens):
        assert tokens["teacher"]["user"]["role"] == "teacher"

    def test_student_login(self, tokens):
        assert tokens["student"]["user"]["role"] == "student"

    def test_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": CREDS["admin"][0], "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_me(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_h(tokens["student"]))
        assert r.status_code == 200
        assert r.json()["email"] == CREDS["student"][0]


# ---------- timetable ----------
class TestTimetable:
    def test_student_timetable(self, tokens):
        r = requests.get(f"{API}/timetable", headers=_h(tokens["student"]))
        assert r.status_code == 200
        data = r.json()
        entries = data.get("entries", data) if isinstance(data, dict) else data
        assert len(entries) >= 20

    def test_csv(self, tokens):
        r = requests.get(f"{API}/timetable/csv", headers=_h(tokens["student"]))
        assert r.status_code == 200
        assert "day" in r.text.lower() or "monday" in r.text.lower()


# ---------- assignments ----------
class TestAssignments:
    def test_list(self, tokens):
        r = requests.get(f"{API}/assignments", headers=_h(tokens["student"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_teacher_create_submit_flow(self, tokens):
        # Teacher creates (multipart form)
        form = {"title": "TEST_pytest_asg", "subject": "DBMS", "unit": "U1",
                "due_date": "2026-12-31", "description": "pytest", "branch": "CSE"}
        r = requests.post(f"{API}/assignments", data=form, headers=_h(tokens["teacher"]))
        assert r.status_code in (200, 201), r.text
        aid = r.json()["id"]

        # Student submits (multipart form)
        r2 = requests.post(f"{API}/assignments/{aid}/submit",
                           data={"note": "pytest submission"},
                           headers=_h(tokens["student"]))
        assert r2.status_code in (200, 201), r2.text

        # Teacher lists submissions
        r3 = requests.get(f"{API}/assignments/{aid}/submissions", headers=_h(tokens["teacher"]))
        assert r3.status_code == 200
        subs = r3.json()
        assert any(s.get("student_name") for s in subs)

        # Postpone
        r4 = requests.post(f"{API}/assignments/{aid}/postpone",
                           json={"due_date": "2027-01-15"},
                           headers=_h(tokens["teacher"]))
        assert r4.status_code == 200

        # End
        r5 = requests.post(f"{API}/assignments/{aid}/end", headers=_h(tokens["teacher"]))
        assert r5.status_code == 200

    def test_seeded_diya_submission(self, tokens):
        # find "Normalisation Worksheet"
        r = requests.get(f"{API}/assignments", headers=_h(tokens["teacher"]))
        assert r.status_code == 200
        norm = [a for a in r.json() if "normalis" in a["title"].lower()]
        assert norm, "Seeded 'Normalisation Worksheet' missing"
        aid = norm[0]["id"]
        subs = requests.get(f"{API}/assignments/{aid}/submissions",
                            headers=_h(tokens["teacher"])).json()
        assert any("diya" in (s.get("student_name", "").lower()) for s in subs)


# ---------- classes ----------
class TestClasses:
    def test_list(self, tokens):
        r = requests.get(f"{API}/classes", headers=_h(tokens["student"]))
        assert r.status_code == 200

    def test_teacher_schedule(self, tokens):
        r = requests.post(f"{API}/classes",
                          json={"subject": "DBMS", "date": "2026-12-30", "time": "10:00",
                                "duration": 60, "room": "R101"},
                          headers=_h(tokens["teacher"]))
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]

        r2 = requests.post(f"{API}/classes/{cid}/join", headers=_h(tokens["teacher"]))
        assert r2.status_code == 200


# ---------- doubts ----------
class TestDoubts:
    def test_subjects_and_thread(self, tokens):
        r = requests.get(f"{API}/doubts/subjects", headers=_h(tokens["student"]))
        assert r.status_code == 200
        subs = r.json()
        assert subs, "no doubt subjects"
        subject = subs[0]["subject"]

        r2 = requests.post(f"{API}/doubts/ask",
                           json={"subject": subject},
                           headers=_h(tokens["student"]))
        assert r2.status_code in (200, 201), r2.text
        tid = r2.json()["id"]

        r3 = requests.post(f"{API}/doubts/threads/{tid}/messages",
                           data={"text": "pytest question"},
                           headers=_h(tokens["student"]))
        assert r3.status_code in (200, 201)

        r4 = requests.get(f"{API}/doubts/threads/{tid}/transcript",
                          headers=_h(tokens["student"]))
        assert r4.status_code == 200
        assert "pytest question" in r4.text

        r5 = requests.post(f"{API}/doubts/threads/{tid}/close",
                           headers=_h(tokens["student"]))
        assert r5.status_code == 200


# ---------- leaves ----------
class TestLeaves:
    def test_apply_and_list(self, tokens):
        r = requests.post(f"{API}/leaves",
                          json={"date": "2026-12-25", "type": "half",
                                "reason": "TEST_pytest leave"},
                          headers=_h(tokens["teacher"]))
        assert r.status_code in (200, 201), r.text

        r2 = requests.get(f"{API}/leaves", headers=_h(tokens["admin"]))
        assert r2.status_code == 200
        assert any("pytest" in (l.get("reason", "").lower()) for l in r2.json())

    def test_seeded_meera_half_day(self, tokens):
        r = requests.get(f"{API}/leaves", headers=_h(tokens["admin"]))
        leaves = r.json()
        meera = [l for l in leaves if "meera" in (l.get("teacher_name", "").lower())]
        assert meera, "seeded Meera leave missing"
        assert meera[0].get("type") == "half"


# ---------- admin ----------
class TestAdmin:
    def test_stats(self, tokens):
        r = requests.get(f"{API}/admin/stats", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        s = r.json()
        assert s.get("faculty", 0) >= 4
        assert s.get("students", 0) >= 5
        assert s.get("rooms", 0) >= 6

    def test_faculty_crud(self, tokens):
        payload = {"name": "TEST_Prof X", "email": "test_profx@college.edu",
                   "password": "pass123", "department": "CS", "majors": "AI"}
        r = requests.post(f"{API}/admin/faculty", json=payload, headers=_h(tokens["admin"]))
        assert r.status_code in (200, 201), r.text
        fid = r.json()["id"]
        r2 = requests.delete(f"{API}/admin/faculty/{fid}", headers=_h(tokens["admin"]))
        assert r2.status_code in (200, 204)

    def test_student_crud(self, tokens):
        payload = {"name": "TEST_Stu Y", "email": "test_stuy@college.edu",
                   "password": "pass123", "branch": "CSE", "roll_no": "TEST-001"}
        r = requests.post(f"{API}/admin/students", json=payload, headers=_h(tokens["admin"]))
        assert r.status_code in (200, 201), r.text
        sid = r.json()["id"]
        r2 = requests.delete(f"{API}/admin/students/{sid}", headers=_h(tokens["admin"]))
        assert r2.status_code in (200, 204)

    def test_rooms_and_alloc(self, tokens):
        import uuid
        rname = f"TEST_R{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/admin/rooms", json={"name": rname, "capacity": 30},
                          headers=_h(tokens["admin"]))
        assert r.status_code in (200, 201), r.text
        rid = r.json()["id"]

        r2 = requests.post(f"{API}/admin/rooms/allocate", headers=_h(tokens["admin"]))
        assert r2.status_code == 200

        requests.delete(f"{API}/admin/rooms/{rid}", headers=_h(tokens["admin"]))

    def test_notify(self, tokens):
        r = requests.post(f"{API}/admin/timetable/notify", headers=_h(tokens["admin"]))
        assert r.status_code == 200


# ---------- events ----------
class TestEvents:
    def test_crud(self, tokens):
        r = requests.post(f"{API}/events",
                          json={"name": "TEST_evt", "venue": "Hall A",
                                "details": "pytest", "date": "2026-12-20",
                                "time": "10:00", "faculty_ids": []},
                          headers=_h(tokens["admin"]))
        assert r.status_code in (200, 201), r.text
        eid = r.json()["id"]

        r2 = requests.put(f"{API}/events/{eid}",
                          json={"name": "TEST_evt", "venue": "Hall B",
                                "details": "pytest", "date": "2026-12-20",
                                "time": "10:00"},
                          headers=_h(tokens["admin"]))
        assert r2.status_code == 200

        r3 = requests.delete(f"{API}/events/{eid}", headers=_h(tokens["admin"]))
        assert r3.status_code in (200, 204)

    def test_seeded_techfest(self, tokens):
        r = requests.get(f"{API}/events", headers=_h(tokens["admin"]))
        assert r.status_code == 200
        assert any("techfest" in e["name"].lower() for e in r.json())


# ---------- notifications ----------
class TestNotifications:
    def test_list_and_mark(self, tokens):
        r = requests.get(f"{API}/notifications", headers=_h(tokens["student"]))
        assert r.status_code == 200
        r2 = requests.post(f"{API}/notifications/read-all", headers=_h(tokens["student"]))
        assert r2.status_code == 200
