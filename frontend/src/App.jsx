/**
 * App Router
 *
 * Defines all application routes with role-based access control.
 * Routes are grouped by audience:
 * - Public: login page
 * - Admin-only: dashboard, users, patients, audit log
 * - Patient-only: dashboard, progress
 * - Shared: settings, patient detail, assessment execution
 *
 * Performance: All page components are lazy-loaded to reduce initial bundle size.
 */
import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, getRoleHome } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Auth from "./pages/Auth";

// Lazy-loaded page components for code splitting
const PatientDetail = React.lazy(() => import("./pages/PatientDetail"));
const Patients = React.lazy(() => import("./pages/Patients"));
const AuditLog = React.lazy(() => import("./pages/AuditLog"));
const AssessmentExecution = React.lazy(() => import("./pages/AssessmentExecution"));
const Settings = React.lazy(() => import("./pages/Settings"));
const PatientDashboard = React.lazy(() => import("./pages/PatientDashboard"));
const MyProgress = React.lazy(() => import("./pages/MyProgress"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminUsers = React.lazy(() => import("./pages/AdminUsers"));

// Minimal loading fallback for lazy route chunks
const PageLoader = () => (
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

// Route guard: only allow access if user has an allowed role
const RoleRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }
  return children;
};

// Redirect root path to the user's role-appropriate home page
const RoleRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={getRoleHome(user.role)} replace />;
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/auth" element={<Auth />} />

              {/* Root redirect based on role */}
              <Route path="/" element={<RoleRedirect />} />

              {/* Admin routes */}
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

              {/* Patient routes */}
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

              {/* Shared routes */}
              <Route
                path="/settings"
                element={
                  <RoleRoute allowedRoles={["admin", "patient"]}>
                    <Settings />
                  </RoleRoute>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<RoleRedirect />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
