import {
  Menu,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Divider,
  alpha,
} from "@mui/material";
import {
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  DoneAll as DoneAllIcon,
  Delete as DeleteIcon,
  Notifications as NotificationsIcon,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import { useNotificationStore } from "@/stores/notification.store";
import type { Notification } from "@/types";

interface NotificationMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "success":
      return <SuccessIcon sx={{ color: "success.main" }} />;
    case "warning":
      return <WarningIcon sx={{ color: "warning.main" }} />;
    case "error":
      return <ErrorIcon sx={{ color: "error.main" }} />;
    default:
      return <InfoIcon sx={{ color: "info.main" }} />;
  }
};

export default function NotificationMenu({ anchorEl, open, onClose }: NotificationMenuProps) {
  const { notifications, markAsRead, markAllAsRead, removeNotification, clearNotifications } = useNotificationStore();

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
  };

  const handleRemove = (id: string) => {
    removeNotification(id);
  };

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      PaperProps={{
        sx: {
          mt: 1,
          width: 380,
          maxHeight: 480,
          borderRadius: 2,
          boxShadow: "0px 10px 40px rgba(0, 0, 0, 0.3)",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          Notifications
        </Typography>
        {notifications.length > 0 && (
          <Button size="small" startIcon={<DoneAllIcon />} onClick={markAllAsRead} sx={{ textTransform: "none" }}>
            Mark all read
          </Button>
        )}
      </Box>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <Box
          sx={{
            py: 6,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <NotificationsIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">No notifications yet</Typography>
        </Box>
      ) : (
        <List sx={{ py: 0, maxHeight: 340, overflow: "auto" }}>
          {notifications.map((notification) => (
            <ListItem
              key={notification.id}
              onClick={() => handleMarkAsRead(notification.id)}
              sx={{
                cursor: "pointer",
                backgroundColor: notification.read ? "transparent" : (theme) => alpha(theme.palette.primary.main, 0.08),
                "&:hover": {
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                },
              }}
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(notification.id);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{getNotificationIcon(notification.type)}</ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="subtitle2" fontWeight={notification.read ? 400 : 600}>
                    {notification.title}
                  </Typography>
                }
                secondary={
                  <>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
                      {formatDistanceToNow(new Date(notification.timestamp), {
                        addSuffix: true,
                      })}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Footer */}
      {notifications.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: 1 }}>
            <Button fullWidth size="small" color="error" onClick={clearNotifications} sx={{ textTransform: "none" }}>
              Clear all notifications
            </Button>
          </Box>
        </>
      )}
    </Menu>
  );
}
