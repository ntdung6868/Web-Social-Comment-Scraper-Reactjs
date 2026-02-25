import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Box,
  Chip,
  Tooltip,
  alpha,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Circle as CircleIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";
import { useNotificationStore } from "@/stores/notification.store";
import NotificationMenu from "@/components/common/NotificationMenu";
import ThemeToggle from "@/components/common/ThemeToggle";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const { unreadCount, systemHealth } = useNotificationStore();

  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);

  const handleProfileOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchor(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileAnchor(null);
  };

  const handleNotificationOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleLogout = async () => {
    handleProfileClose();
    await logout();
    navigate("/login");
  };

  const handleNavigate = (path: string) => {
    handleProfileClose();
    navigate(path);
  };

  const getHealthColor = () => {
    switch (systemHealth?.status) {
      case "healthy":
        return "success";
      case "degraded":
        return "warning";
      case "unhealthy":
        return "error";
      default:
        return "default";
    }
  };

  const getHealthLabel = () => {
    switch (systemHealth?.status) {
      case "healthy":
        return t("header.systemHealthy");
      case "degraded":
        return t("header.systemDegraded");
      case "unhealthy":
        return t("header.systemDown");
      default:
        return t("common.unknown");
    }
  };

  // Logic hiển thị Plan
  const isPaid = user?.planType === "PERSONAL" || user?.planType === "PREMIUM";
  const planLabel = user?.planType === "PREMIUM" ? t("header.premiumPlan") : user?.planType === "PERSONAL" ? t("header.personalPlan") : t("header.freePlan");
  const planColor = user?.planType === "PREMIUM" ? "secondary" : isPaid ? "primary" : "default";

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.95),
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Left side */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            edge="start"
            onClick={onMenuClick}
            sx={{
              mr: 2,
              color: (theme) => theme.palette.text.primary,
              "&:hover": {
                backgroundColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.12)"
                    : "rgba(0, 0, 0, 0.06)",
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontWeight: 600,
              display: { xs: "none", sm: "block" },
            }}
          >
            {/* Page title placeholder */}
          </Typography>
        </Box>

        {/* Right side */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* System Health Status */}
          {systemHealth && (
            <Tooltip title={getHealthLabel()}>
              <Chip
                icon={
                  <CircleIcon
                    sx={{
                      fontSize: "12px !important",
                      color: `${getHealthColor()}.main`,
                    }}
                  />
                }
                label={getHealthLabel()}
                size="small"
                variant="outlined"
                color={getHealthColor()}
                sx={{
                  display: { xs: "none", md: "flex" },
                  borderRadius: 2,
                }}
              />
            </Tooltip>
          )}

          {/* Notifications */}
          <Tooltip title={t("common.notifications")}>
            <IconButton
              onClick={handleNotificationOpen}
              sx={{
                color: (theme) => theme.palette.text.primary,
                "&:hover": {
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.06)",
                },
              }}
            >
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Profile */}
          <Tooltip title={t("common.account")}>
            <IconButton
              onClick={handleProfileOpen}
              sx={{
                ml: 1,
                color: (theme) => theme.palette.text.primary,
                "&:hover": {
                  backgroundColor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.12)"
                      : "rgba(0, 0, 0, 0.06)",
                },
              }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  backgroundColor: "primary.main",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                {/* HIỂN THỊ KÝ TỰ ĐẦU CỦA USERNAME */}
                {user?.username?.charAt(0)?.toUpperCase() || "U"}
              </Avatar>
            </IconButton>
          </Tooltip>
        </Box>

        {/* Profile Menu */}
        <Menu
          anchorEl={profileAnchor}
          open={Boolean(profileAnchor)}
          onClose={handleProfileClose}
          onClick={handleProfileClose}
          transformOrigin={{ horizontal: "right", vertical: "top" }}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          PaperProps={{
            sx: {
              mt: 1,
              minWidth: 200,
              borderRadius: 2,
              boxShadow: "0px 10px 40px rgba(0, 0, 0, 0.3)",
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              {/* HIỂN THỊ USERNAME */}
              {user?.username || t("common.guest")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>

            {/* HIỂN THỊ GÓI CƯỚC CHÍNH XÁC */}
            <Chip
              icon={isPaid ? <StarIcon style={{ fontSize: 16 }} /> : undefined}
              label={planLabel}
              size="small"
              color={planColor}
              variant={isPaid ? "filled" : "outlined"}
              sx={{ mt: 1, borderRadius: 1, fontWeight: 600 }}
            />
          </Box>

          <Divider sx={{ my: 1 }} />

          <MenuItem onClick={() => handleNavigate("/profile")}>
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            {t("common.profile")}
          </MenuItem>

          <MenuItem onClick={() => handleNavigate("/settings")}>
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            {t("common.settings")}
          </MenuItem>

          <Divider sx={{ my: 1 }} />

          <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" sx={{ color: "error.main" }} />
            </ListItemIcon>
            {t("common.logout")}
          </MenuItem>
        </Menu>

        {/* Notification Menu */}
        <NotificationMenu
          anchorEl={notificationAnchor}
          open={Boolean(notificationAnchor)}
          onClose={handleNotificationClose}
        />
      </Toolbar>
    </AppBar>
  );
}
