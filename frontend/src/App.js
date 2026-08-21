import "@/App.css";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/bits";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import TimetablePage from "@/pages/TimetablePage";
import StudentAssignments from "@/pages/student/StudentAssignments";
import StudentClassroom from "@/pages/student/StudentClassroom";
import StudentDoubt from "@/pages/student/StudentDoubt";
import TeacherAssignments from "@/pages/teacher/TeacherAssignments";
import TeacherClassroom from "@/pages/teacher/TeacherClassroom";
import TeacherDoubts from "@/pages/teacher/TeacherDoubts";
import TeacherLeave from "@/pages/teacher/TeacherLeave";
import AdminData from "@/pages/admin/AdminData";
import AdminTimetable from "@/pages/admin/AdminTimetable";
import AdminEvents from "@/pages/admin/AdminEvents";
import AdminLeaves from "@/pages/admin/AdminLeaves";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function RoleGate({ role, children }) {
  const { user } = useAuth();
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 14 } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route element={<Layout />}>
              <Route path="/student" element={<RoleGate role="student"><TimetablePage /></RoleGate>} />
              <Route path="/student/assignments" element={<RoleGate role="student"><StudentAssignments /></RoleGate>} />
              <Route path="/student/classroom" element={<RoleGate role="student"><StudentClassroom /></RoleGate>} />
              <Route path="/student/doubt" element={<RoleGate role="student"><StudentDoubt /></RoleGate>} />
              <Route path="/teacher" element={<RoleGate role="teacher"><TimetablePage /></RoleGate>} />
              <Route path="/teacher/assignments" element={<RoleGate role="teacher"><TeacherAssignments /></RoleGate>} />
              <Route path="/teacher/classroom" element={<RoleGate role="teacher"><TeacherClassroom /></RoleGate>} />
              <Route path="/teacher/doubts" element={<RoleGate role="teacher"><TeacherDoubts /></RoleGate>} />
              <Route path="/teacher/leave" element={<RoleGate role="teacher"><TeacherLeave /></RoleGate>} />
              <Route path="/admin" element={<RoleGate role="admin"><AdminData /></RoleGate>} />
              <Route path="/admin/timetable" element={<RoleGate role="admin"><AdminTimetable /></RoleGate>} />
              <Route path="/admin/events" element={<RoleGate role="admin"><AdminEvents /></RoleGate>} />
              <Route path="/admin/leaves" element={<RoleGate role="admin"><AdminLeaves /></RoleGate>} />
            </Route>
          </Route>
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
