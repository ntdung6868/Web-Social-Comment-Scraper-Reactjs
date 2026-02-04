import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  Tooltip,
  alpha,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Search as SearchIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  BugReport as BugIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  drawerWidth: number;
  collapsedWidth: number;
  isMobile: boolean;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { title: "Scraper", path: "/scraper", icon: <SearchIcon /> },
  { title: "History", path: "/history", icon: <HistoryIcon /> },
  { title: "Profile", path: "/profile", icon: <PersonIcon /> },
  { title: "Settings", path: "/settings", icon: <SettingsIcon /> },
];

const adminItems: NavItem[] = [
  { title: "Admin Dashboard", path: "/admin", icon: <AdminIcon />, adminOnly: true },
  { title: "User Management", path: "/admin/users", icon: <PersonIcon />, adminOnly: true },
  { title: "System Logs", path: "/admin/logs", icon: <BugIcon />, adminOnly: true },
];

export default function Sidebar({ open, collapsed, onClose, drawerWidth, collapsedWidth, isMobile }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const isAdmin = user?.role === "ADMIN";
  const currentWidth = collapsed ? collapsedWidth : drawerWidth;

  const filteredNavItems = useMemo(() => {
    const items = [...navItems];
    if (isAdmin) {
      items.push(...adminItems);
    }
    return items;
  }, [isAdmin]);

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const drawerContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        py: 2,
      }}
    >
      {/* Logo / Brand */}
      <Box
        sx={{
          px: collapsed ? 1 : 3,
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
        }}
      >
        <SearchIcon
          sx={{
            fontSize: 32,
            color: "primary.main",
            mr: collapsed ? 0 : 1.5,
          }}
        />
        {!collapsed && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: "linear-gradient(135deg, #5c6bc0 0%, #42a5f5 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CrawlComments
          </Typography>
        )}
      </Box>

      <Divider sx={{ mx: collapsed ? 1 : 2, mb: 2 }} />

      {/* Navigation */}
      <List sx={{ px: collapsed ? 0.5 : 1.5, flexGrow: 1 }}>
        {filteredNavItems.map((item) => {
          const isActive =
            location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <Tooltip title={collapsed ? item.title : ""} placement="right" arrow>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    borderRadius: 2,
                    minHeight: 48,
                    px: collapsed ? 2 : 2.5,
                    justifyContent: collapsed ? "center" : "flex-start",
                    "&.Mui-selected": {
                      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.15),
                      "&:hover": {
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                      },
                      "& .MuiListItemIcon-root": {
                        color: "primary.main",
                      },
                      "& .MuiListItemText-primary": {
                        color: "primary.main",
                        fontWeight: 600,
                      },
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 40,
                      justifyContent: "center",
                      color: isActive ? "primary.main" : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <ListItemText
                      primary={item.title}
                      primaryTypographyProps={{
                        fontSize: "0.9rem",
                        fontWeight: isActive ? 600 : 500,
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ mx: collapsed ? 1 : 2, mb: 2 }} />

      {/* User info & Logout */}
      <Box sx={{ px: collapsed ? 1 : 2 }}>
        {!collapsed && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1.5,
              borderRadius: 2,
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              mb: 1,
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                mr: 1.5,
                backgroundColor: "primary.main",
                fontSize: "0.9rem",
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </Avatar>
            <Box sx={{ overflow: "hidden" }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.name || "User"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                }}
              >
                {user?.subscriptionPlan || "FREE"} Plan
              </Typography>
            </Box>
          </Box>
        )}

        <Tooltip title={collapsed ? "Logout" : ""} placement="right" arrow>
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              minHeight: 44,
              px: collapsed ? 2 : 2.5,
              justifyContent: collapsed ? "center" : "flex-start",
              color: "error.main",
              "&:hover": {
                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 40,
                justifyContent: "center",
                color: "error.main",
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontSize: "0.9rem",
                  fontWeight: 500,
                }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      sx={{
        width: currentWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: isMobile ? drawerWidth : currentWidth,
          boxSizing: "border-box",
          backgroundColor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
