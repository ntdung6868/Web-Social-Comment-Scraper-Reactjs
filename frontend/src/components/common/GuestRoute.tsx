import { Navigate, Outlet } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuthStore } from "@/stores/auth.store";

/**
 * GuestRoute - Only accessible when NOT authenticated
 * Redirects to dashboard if user is already logged in
 */
export default function GuestRoute() {
  const { isAuthenticated, isInitialized } = useAuthStore();

  // Show loading while checking initial authentication only
  if (!isInitialized) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "background.default",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
