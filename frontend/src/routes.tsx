import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/layouts/index";
import { ProtectedRoute, GuestRoute } from "@/components/common";

// Lazy load pages for code splitting
import { lazy, Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

// Loading fallback
const PageLoader = () => (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "60vh",
    }}
  >
    <CircularProgress />
  </Box>
);

// Wrap lazy components with Suspense
const withSuspense = (Component: React.LazyExoticComponent<() => JSX.Element | null>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

// Auth pages
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));

// Main pages
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ScraperPage = lazy(() => import("@/pages/ScraperPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const HistoryDetailPage = lazy(() => import("@/pages/HistoryDetailPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const GuidePage = lazy(() => import("@/pages/GuidePage"));

// Admin pages
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const UserManagementPage = lazy(() => import("@/pages/admin/UserManagementPage"));
const SystemLogsPage = lazy(() => import("@/pages/admin/SystemLogsPage"));

// Error page
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

const router = createBrowserRouter([
  // Public routes (guest only)
  {
    element: <GuestRoute />,
    children: [
      {
        path: "/login",
        element: withSuspense(LoginPage),
      },
      {
        path: "/register",
        element: withSuspense(RegisterPage),
      },
      {
        path: "/forgot-password",
        element: withSuspense(ForgotPasswordPage),
      },
      {
        path: "/reset-password",
        element: withSuspense(ResetPasswordPage),
      },
    ],
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "/dashboard",
            element: withSuspense(DashboardPage),
          },
          {
            path: "/scraper",
            element: withSuspense(ScraperPage),
          },
          {
            path: "/history",
            element: withSuspense(HistoryPage),
          },
          {
            path: "/history/:id",
            element: withSuspense(HistoryDetailPage),
          },
          {
            path: "/profile",
            element: withSuspense(ProfilePage),
          },
          {
            path: "/settings",
            element: withSuspense(SettingsPage),
          },
          {
            path: "/guide",
            element: withSuspense(GuidePage),
          },
        ],
      },
    ],
  },

  // Admin routes
  {
    element: <ProtectedRoute adminOnly />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/admin",
            element: withSuspense(AdminDashboardPage),
          },
          {
            path: "/admin/users",
            element: withSuspense(UserManagementPage),
          },
          {
            path: "/admin/logs",
            element: withSuspense(SystemLogsPage),
          },
        ],
      },
    ],
  },

  // Catch-all route
  {
    path: "*",
    element: withSuspense(NotFoundPage),
  },
]);

export default router;
