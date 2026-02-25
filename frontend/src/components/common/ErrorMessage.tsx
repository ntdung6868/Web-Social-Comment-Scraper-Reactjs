import { Box, Typography, Button, alpha } from "@mui/material";
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorMessage({
  title,
  message,
  onRetry,
}: ErrorMessageProps) {
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
          width: 64,
          height: 64,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
          mb: 2,
        }}
      >
        <ErrorIcon sx={{ fontSize: 32, color: "error.main" }} />
      </Box>

      <Typography variant="h6" fontWeight={600} gutterBottom>
        {title || t("components.errorTitle")}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: onRetry ? 3 : 0 }}>
        {message || t("components.errorMessage")}
      </Typography>

      {onRetry && (
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
          {t("components.tryAgain")}
        </Button>
      )}
    </Box>
  );
}
