import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, getRoleHome } from "./context/AuthContext";
import Auth from "./pages/Auth";

// Shared pages
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import AuditLog from "./pages/AuditLog";
import AssessmentExecution from "./pages/AssessmentExecution";

// Patient-only pages
import PatientDashboard from "./pages/PatientDashboard";
import MyProgress from "./pages/MyProgress";

// Admin-only pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";

/* ─── Role-specific guard ─── */
const RoleRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return children;
};

/* ─── Redirect "/" to role home ─── */
const RoleRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={getRoleHome(user.role)} replace />;
};

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        color: "#0ea5e9",
        fontFamily: "Nunito, DM Sans, sans-serif",
      }}
    >
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<Auth />} />

          {/* Root → redirect based on role */}
          <Route path="/" element={<RoleRedirect />} />

          {/* ── ADMIN routes ── */}
          <Route
            path="/admin-dashboard"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AdminUsers />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/patients"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <Patients />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/patients/:id/assessment"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AssessmentExecution />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/patients/:id"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <PatientDetail />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <RoleRoute allowedRoles={["admin"]}>
                <AuditLog />
              </RoleRoute>
            }
          />

          {/* ── PATIENT routes ── */}
          <Route
            path="/my-dashboard"
            element={
              <RoleRoute allowedRoles={["patient"]}>
                <PatientDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/my-progress"
            element={
              <RoleRoute allowedRoles={["patient"]}>
                <MyProgress />
              </RoleRoute>
            }
          />

          {/* Catch-all → role home */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
