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
  Chip,
  IconButton,
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
  Star as StarIcon,
  MenuBook as GuideIcon,
  Paid as PaidIcon,
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
  { title: "Settings", path: "/settings", icon: <SettingsIcon /> },
  { title: "Guide", path: "/guide", icon: <GuideIcon /> },
  { title: "Pricing", path: "/pricing", icon: <PaidIcon /> },
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

  const isAdmin = user?.isAdmin ?? false;
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

  const isPaid = user?.planType === "PERSONAL" || user?.planType === "PREMIUM";
  const planLabel = user?.planType === "PREMIUM" ? "Premium" : user?.planType === "PERSONAL" ? "Personal" : "Free Plan";
  const planColor = user?.planType === "PREMIUM" ? "secondary" : isPaid ? "primary" : "default";

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

      {/* User Info & Logout Area */}
      <Box sx={{ px: collapsed ? 1 : 2 }}>
        {!collapsed ? (
          // GIAO DIỆN KHI MỞ RỘNG (User Info + Nút Logout nhỏ bên phải)
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1.5,
              borderRadius: 2, // Bo tròn nhiều hơn chút cho giống card
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
              mb: 1,
              position: "relative", // Để định vị nếu cần
            }}
          >
            {/* Avatar */}
            <Avatar
              sx={{
                width: 40,
                height: 40,
                mr: 1.5,
                bgcolor: "primary.main",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              {user?.username?.charAt(0)?.toUpperCase() || "U"}
            </Avatar>

            {/* Thông tin User */}
            <Box sx={{ overflow: "hidden", flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "90px", // Giới hạn width để không đè lên nút logout
                }}
              >
                {user?.username || "Guest"}
              </Typography>

              <Box sx={{ mt: 0.5 }}>
                <Chip
                  icon={isPaid ? <StarIcon style={{ fontSize: 12 }} /> : undefined}
                  label={planLabel}
                  size="small"
                  color={planColor}
                  variant={isPaid ? "filled" : "outlined"}
                  sx={{
                    height: 20,
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    "& .MuiChip-label": { px: 1 },
                  }}
                />
              </Box>
            </Box>

            {/* NÚT LOGOUT ICON BÊN PHẢI */}
            <Tooltip title="Logout">
              <IconButton
                onClick={handleLogout}
                size="small"
                sx={{
                  color: "error.main",
                  ml: 0.5,
                  "&:hover": { bgcolor: (theme) => alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          // GIAO DIỆN KHI THU GỌN (Chỉ hiện icon Logout to bên dưới)
          <Tooltip title="Logout" placement="right" arrow>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                minHeight: 44,
                px: 2,
                justifyContent: "center",
                color: "error.main",
                "&:hover": {
                  backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: "center", color: "error.main" }}>
                <LogoutIcon />
              </ListItemIcon>
            </ListItemButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
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
