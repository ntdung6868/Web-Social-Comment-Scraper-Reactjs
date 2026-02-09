import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuthStore } from "@/stores/auth.store";
import { initializeSocket, connectSocket, disconnectSocket } from "@/lib/socket";

const DRAWER_WIDTH = 260;
const COLLAPSED_DRAWER_WIDTH = 72;

export default function DashboardLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();
  const { isAuthenticated, accessToken } = useAuthStore();

  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize socket on mount
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      initializeSocket(accessToken);
      connectSocket();

      return () => {
        disconnectSocket();
      };
    }
  }, [isAuthenticated, accessToken]);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Handle responsive sidebar
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
      setSidebarCollapsed(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Không cần biến drawerWidth ở đây nữa vì không dùng cho margin

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={closeSidebar}
        drawerWidth={DRAWER_WIDTH}
        collapsedWidth={COLLAPSED_DRAWER_WIDTH}
        isMobile={isMobile}
      />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          width: "100%", // Đảm bảo chiếm hết không gian còn lại

          // --- ĐÃ XÓA DÒNG ml (Margin Left) GÂY LỖI ---
          // ml: isMobile ? 0 : `${drawerWidth}px`,

          transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        {/* Header */}
        <Header onMenuClick={toggleSidebar} />

        {/* Page content */}
        <Box
          sx={{
            flexGrow: 1,
            p: 3,
            backgroundColor: "background.default",
            overflow: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
