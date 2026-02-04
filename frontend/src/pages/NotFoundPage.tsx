import { Link as RouterLink } from "react-router-dom";
import { Box, Typography, Button, alpha } from "@mui/material";
import { Home as HomeIcon, Search as SearchIcon } from "@mui/icons-material";

export default function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        p: 3,
        textAlign: "center",
      }}
    >
      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 4 }}>
        <SearchIcon sx={{ fontSize: 40, color: "primary.main", mr: 1 }} />
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #5c6bc0 0%, #42a5f5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          CrawlComments
        </Typography>
      </Box>

      {/* 404 */}
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: "6rem", md: "10rem" },
          fontWeight: 700,
          color: (theme) => alpha(theme.palette.primary.main, 0.2),
          lineHeight: 1,
          mb: 2,
        }}
      >
        404
      </Typography>

      <Typography variant="h4" fontWeight={600} gutterBottom>
        Page Not Found
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </Typography>

      <Button component={RouterLink} to="/dashboard" variant="contained" size="large" startIcon={<HomeIcon />}>
        Go to Dashboard
      </Button>
    </Box>
  );
}
