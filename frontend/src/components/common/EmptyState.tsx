import { Box, Typography, alpha } from "@mui/material";
import { FolderOff as EmptyIcon } from "@mui/icons-material";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = "No data",
  message = "There is nothing to display here.",
  icon,
  action,
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 4,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
          mb: 2,
        }}
      >
        {icon || <EmptyIcon sx={{ fontSize: 40, color: "primary.main" }} />}
      </Box>

      <Typography variant="h6" fontWeight={600} gutterBottom>
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: action ? 3 : 0 }}>
        {message}
      </Typography>

      {action}
    </Box>
  );
}
