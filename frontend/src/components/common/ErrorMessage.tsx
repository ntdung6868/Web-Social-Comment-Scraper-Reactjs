import { Box, Typography, Button, alpha } from "@mui/material";
import { ErrorOutline as ErrorIcon, Refresh as RefreshIcon } from "@mui/icons-material";

interface ErrorMessageProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export default function ErrorMessage({
  title = "Something went wrong",
  message = "An error occurred. Please try again.",
  onRetry,
}: ErrorMessageProps) {
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
        {title}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: onRetry ? 3 : 0 }}>
        {message}
      </Typography>

      {onRetry && (
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry}>
          Try Again
        </Button>
      )}
    </Box>
  );
}
