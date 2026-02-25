import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Divider,
  alpha,
  Chip,
  Stack,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import {
  Cookie as CookieIcon,
  Apple as AppleIcon,
  SmartToy as CaptchaIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import toast from "react-hot-toast";

// ── Copy helper ──
const copyToClipboard = (text: string, t: ReturnType<typeof useTranslation>["t"]) => {
  navigator.clipboard.writeText(text);
  toast.success(t("common.copied"));
};

// ── Code Block Component ──
function CodeBlock({ code, t }: { code: string; t: ReturnType<typeof useTranslation>["t"] }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        mt: 1,
        p: 1.5,
        borderRadius: 1.5,
        backgroundColor: (theme) => alpha(theme.palette.common.black, 0.6),
        fontFamily: "monospace",
        fontSize: "0.8rem",
        color: "#e0e0e0",
        overflowX: "auto",
      }}
    >
      <Box sx={{ flex: 1, whiteSpace: "nowrap" }}>{code}</Box>
      <Button size="small" onClick={() => copyToClipboard(code, t)} sx={{ minWidth: 32, p: 0.5, color: "grey.400" }}>
        <CopyIcon fontSize="small" />
      </Button>
    </Box>
  );
}

// ── Section Card Component ──
function SectionCard({
  icon,
  title,
  subtitle,
  gradientFrom,
  gradientTo,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
          color: "white",
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          {icon}
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {subtitle}
            </Typography>
          </Box>
        </Stack>
      </Box>
      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════
// MAIN GUIDE PAGE
// ══════════════════════════════════════════════════
export default function GuidePage() {
  const { t } = useTranslation();

  const guideSteps = [
    t("guide.step1"),
    t("guide.step2"),
    t("guide.step3"),
    t("guide.step4"),
  ];

  const guideTips = [
    t("guide.tip1"),
    t("guide.tip2"),
    t("guide.tip3"),
    t("guide.tip4"),
    t("guide.tip5"),
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t("guide.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("guide.subtitle")}
        </Typography>
      </Box>

      <Stack spacing={4}>
        {/* ════════════════════════════════════════════ */}
        {/* SECTION 1: HOW TO GET COOKIES               */}
        {/* ════════════════════════════════════════════ */}
        <SectionCard
          icon={<CookieIcon sx={{ fontSize: 36 }} />}
          title={t("guide.howToGetCookies")}
          subtitle={t("guide.exportCookies")}
          gradientFrom="#f59e0b"
          gradientTo="#d97706"
        >
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
          >
            <CookieIcon color="warning" />
            {t("guide.usingJ2Team")}
          </Typography>

          <Stepper alternativeLabel sx={{ mb: 3 }}>
            {guideSteps.map((label) => (
              <Step key={label} completed>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box component="ol" sx={{ pl: 2, "& li": { mb: 2, fontSize: "0.875rem", color: "text.secondary" } }}>
            <li>
              <strong>{t("guide.step1")}:</strong> {t("guide.step1Description")}
            </li>
            <li>
              <strong>{t("guide.step2")}:</strong> {t("guide.step2Description")}
            </li>
            <li>
              <strong>{t("guide.step3")}:</strong> {t("guide.step3Description")}
            </li>
            <li>
              <strong>{t("guide.step4")}:</strong> {t("guide.step4Description")}
            </li>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              {t("guide.securityNotice")}
            </Typography>
            <Typography variant="body2">
              {t("guide.securityMessage")}
            </Typography>
          </Alert>
        </SectionCard>

        {/* ════════════════════════════════════════════ */}
        {/* SECTION 2: HANDLE CAPTCHA WITH COOKIEFORGE  */}
        {/* ════════════════════════════════════════════ */}
        <SectionCard
          icon={<CaptchaIcon sx={{ fontSize: 36 }} />}
          title={t("guide.handlingCaptcha")}
          subtitle={t("guide.captchaDescription")}
          gradientFrom="#ef4444"
          gradientTo="#dc2626"
        >
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              {t("guide.captchaWarning")}
            </Typography>
          </Alert>

          {/* Method 1: Upload Cookie */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Chip label="1" size="small" color="primary" />
              {t("guide.uploadLoggedInCookies")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              {t("guide.uploadCookiesDescription")}
            </Typography>
            <Box sx={{ pl: 4, mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <Chip label={t("guide.highlyEffective")} size="small" color="success" variant="outlined" />
                <Chip label={t("guide.recommended")} size="small" color="primary" variant="outlined" />
              </Stack>
            </Box>
          </Box>

          {/* Method 2: CookieForge */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Chip label="2" size="small" color="primary" />
              {t("guide.useCookieForge")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4, mb: 2 }}>
              {t("guide.cookieForgeDescription")}
            </Typography>

            {/* Download buttons */}
            <Box sx={{ pl: 4 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AppleIcon />}
                  href="/downloads/CookieForge-arm64.dmg"
                  download
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "#1a1a2e" : "#1a1a2e",
                    color: "#fff",
                    "&:hover": { bgcolor: (theme) => theme.palette.mode === "dark" ? "#16213e" : "#2d2d4a" },
                    textTransform: "none",
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 2,
                    boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 2px 8px rgba(26,26,46,0.3)",
                  }}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: "block", lineHeight: 1, color: "#fff" }}>
                      {t("guide.downloadFor")}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                      macOS (Apple Silicon)
                    </Typography>
                  </Box>
                </Button>

                <Button
                  variant="contained"
                  size="small"
                  startIcon={
                    <Box component="svg" sx={{ width: 18, height: 18, fill: "currentColor" }} viewBox="0 0 24 24">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                    </Box>
                  }
                  href="/downloads/CookieForge.exe"
                  download
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "#0078d4" : "#0078d4",
                    color: "#fff",
                    "&:hover": { bgcolor: (theme) => theme.palette.mode === "dark" ? "#106ebe" : "#005a9e" },
                    textTransform: "none",
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 2,
                    boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 2px 8px rgba(0,120,212,0.3)",
                  }}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: "block", lineHeight: 1, color: "#fff" }}>
                      {t("guide.downloadFor")}
                    </Typography>
                    <Typography variant="body2" fontWeight={700} sx={{ color: "#fff" }}>
                      Windows
                    </Typography>
                  </Box>
                </Button>
              </Stack>

              {/* Install instructions */}
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                      backgroundColor: (theme) => alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                      {t("guide.macOSInstallation")}
                    </Typography>
                    <Box
                      component="ul"
                      sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                    >
                      <li>{t("guide.macOSStep1")}</li>
                      <li>{t("guide.macOSStep2")}</li>
                      <li>{t("guide.macOSStep3")}</li>
                    </Box>
                    <Alert
                      severity="warning"
                      variant="outlined"
                      sx={{ mt: 1.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
                    >
                      <strong>{t("guide.macOSBlocked")}</strong>
                      <Box component="ol" sx={{ pl: 2, mt: 0.5, mb: 0, "& li": { mb: 0.5 } }}>
                        <li>
                          <strong>{t("guide.recommended")}</strong> {t("guide.macOSSolution1")}
                        </li>
                        <li>
                          {t("guide.macOSSolution2")}
                        </li>
                        <li>
                          {t("guide.terminal")}:
                          <CodeBlock code="sudo spctl --master-disable" t={t} />
                        </li>
                        <li>
                          {t("guide.resignApp")}
                          <CodeBlock code="sudo codesign --force --deep --sign - /path/to/App.app" t={t} />
                          <CodeBlock code="sudo xattr -r -c /path/to/App.app" t={t} />
                        </li>
                      </Box>
                    </Alert>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                      backgroundColor: (theme) => alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                      {t("guide.windowsInstallation")}
                    </Typography>
                    <Box
                      component="ul"
                      sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                    >
                      <li>{t("guide.windowsStep1")}</li>
                      <li>{t("guide.windowsStep2")}</li>
                    </Box>
                    <Alert
                      severity="info"
                      variant="outlined"
                      sx={{ mt: 1.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
                    >
                      {t("guide.smartScreenWarning")}
                    </Alert>
                  </Box>
                </Grid>
              </Grid>

              {/* How to use */}
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: (theme) => alpha(theme.palette.background.default, 0.5),
                  border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}
              >
                <Typography variant="caption" fontWeight={700} display="block" gutterBottom>
                  {t("guide.howToUseCookieForge")}
                </Typography>
                <Box
                  component="ol"
                  sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                >
                  <li>{t("guide.cookieForgeStep1")}</li>
                  <li>{t("guide.cookieForgeStep2")}</li>
                  <li>{t("guide.cookieForgeStep3")}</li>
                  <li>{t("guide.cookieForgeStep4")}</li>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Method 3: Spacing */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Chip label="3" size="small" color="primary" />
              {t("guide.spaceOutScraping")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              {t("guide.spaceOutDescription")}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Tips */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            {t("guide.tipsToAvoidCaptcha")}
          </Typography>
          <Grid container spacing={1.5}>
            {[
              { icon: <CheckIcon color="success" fontSize="small" />, text: guideTips[0] },
              {
                icon: <CheckIcon color="success" fontSize="small" />,
                text: guideTips[1],
              },
              {
                icon: <CheckIcon color="success" fontSize="small" />,
                text: guideTips[2],
              },
              {
                icon: <WarningIcon color="warning" fontSize="small" />,
                text: guideTips[3],
              },
              {
                icon: <WarningIcon color="warning" fontSize="small" />,
                text: guideTips[4],
              },
            ].map((tip, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {tip.icon}
                  <Typography variant="body2" color="text.secondary">
                    {tip.text}
                  </Typography>
                </Stack>
              </Grid>
            ))}
          </Grid>
        </SectionCard>
      </Stack>
    </Box>
  );
}
