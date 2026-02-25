import { Link as RouterLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Box, Typography, Button, alpha } from "@mui/material";
import { Home as HomeIcon, Search as SearchIcon } from "@mui/icons-material";

export default function NotFoundPage() {
  const { t } = useTranslation();

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
          variant="h6"
          sx={{
            fontWeight: 700,
            background: "linear-gradient(135deg, #5c6bc0 0%, #42a5f5 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {t("common.crawlComments")}
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
        {t("notFound.title")}
      </Typography>

      <Typography variant="h4" fontWeight={600} gutterBottom>
        {t("notFound.heading")}
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
        {t("notFound.message")}
      </Typography>

      <Button component={RouterLink} to="/dashboard" variant="contained" size="large" startIcon={<HomeIcon />}>
        {t("notFound.goToDashboard")}
      </Button>
    </Box>
  );
}
