import { Box, Typography, alpha } from "@mui/material";
import { FolderOff as EmptyIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title = "",
  message = "",
  icon,
  action,
}: EmptyStateProps) {
  const { t } = useTranslation();
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
        {title || t("components.noData")}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: action ? 3 : 0 }}>
        {message || t("components.noDataMessage")}
      </Typography>

      {action}
    </Box>
  );
}
