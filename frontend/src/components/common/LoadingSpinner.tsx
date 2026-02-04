import { Box, CircularProgress, Typography, alpha } from "@mui/material";

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
  size?: number;
}

export default function LoadingSpinner({ message = "Loading...", fullScreen = false, size = 40 }: LoadingSpinnerProps) {
  const content = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        p: 4,
      }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: (theme) => alpha(theme.palette.background.default, 0.9),
          backdropFilter: "blur(4px)",
          zIndex: 9999,
        }}
      >
        {content}
      </Box>
    );
  }

  return content;
}
