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
  Link,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import {
  Cookie as CookieIcon,
  Apple as AppleIcon,
  SmartToy as CaptchaIcon,
  OpenInNew as OpenInNewIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";

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
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          User Guide
        </Typography>
        <Typography variant="body1" color="text.secondary">
          How to set up cookies and handle captcha issues when scraping
        </Typography>
      </Box>

      <Stack spacing={4}>
        {/* ════════════════════════════════════════════ */}
        {/* SECTION 1: HOW TO GET COOKIES               */}
        {/* ════════════════════════════════════════════ */}
        <SectionCard
          icon={<CookieIcon sx={{ fontSize: 36 }} />}
          title="How to Get Cookies"
          subtitle="Export cookies from TikTok/Facebook and upload them to the system"
          gradientFrom="#f59e0b"
          gradientTo="#d97706"
        >
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
          >
            <CookieIcon color="warning" />
            Using J2TEAM Cookies Extension
          </Typography>

          <Stepper alternativeLabel sx={{ mb: 3 }}>
            {["Install Extension", "Log in to platform", "Export Cookies", "Upload to Settings"].map((label) => (
              <Step key={label} completed>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box component="ol" sx={{ pl: 2, "& li": { mb: 2, fontSize: "0.875rem", color: "text.secondary" } }}>
            <li>
              <strong>Install the extension:</strong> Download{" "}
              <Link
                href="https://chromewebstore.google.com/detail/j2team-cookies/okpidcojinmlaakglciglbpcpajaibco"
                target="_blank"
                rel="noopener"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
              >
                J2TEAM Cookies <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Link>{" "}
              from the Chrome Web Store.
            </li>
            <li>
              <strong>Log in:</strong> Go to{" "}
              <Link href="https://www.tiktok.com" target="_blank" rel="noopener">
                TikTok
              </Link>{" "}
              or{" "}
              <Link href="https://www.facebook.com" target="_blank" rel="noopener">
                Facebook
              </Link>{" "}
              and log in to your account.
            </li>
            <li>
              <strong>Export cookies:</strong> Click the J2TEAM Cookies icon in the toolbar → select{" "}
              <strong>Export Cookies</strong> → copy the JSON content.
            </li>
            <li>
              <strong>Upload:</strong> Go to <strong>Settings → Cookies</strong> tab in this app → paste or upload the
              JSON file.
            </li>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Security Notice
            </Typography>
            <Typography variant="body2">
              Cookies contain sensitive login data. Never share your cookie files with others. The system encrypts
              cookies when stored and only you can access them.
            </Typography>
          </Alert>
        </SectionCard>

        {/* ════════════════════════════════════════════ */}
        {/* SECTION 2: HANDLE CAPTCHA WITH COOKIEFORGE  */}
        {/* ════════════════════════════════════════════ */}
        <SectionCard
          icon={<CaptchaIcon sx={{ fontSize: 36 }} />}
          title="Handling TikTok Captcha"
          subtitle="How to solve captcha issues when scraping TikTok comments"
          gradientFrom="#ef4444"
          gradientTo="#dc2626"
        >
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              TikTok uses captcha to prevent bots. When captcha appears, the scraping process will pause. Below are
              effective ways to handle it.
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
              Upload Logged-in Cookies
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              The most effective method is using cookies from a logged-in TikTok account. Cookies help the system appear
              as a real user, significantly reducing captcha frequency.
            </Typography>
            <Box sx={{ pl: 4, mt: 1 }}>
              <Stack direction="row" spacing={1}>
                <Chip label="Highly effective" size="small" color="success" variant="outlined" />
                <Chip label="Recommended" size="small" color="primary" variant="outlined" />
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
              Use CookieForge to Solve Captcha
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4, mb: 2 }}>
              CookieForge is a desktop tool that lets you import your cookies and manually solve captcha challenges.
              After solving, the optimized cookies are exported for upload.
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
                    bgcolor: "#1a1a2e",
                    "&:hover": { bgcolor: "#16213e" },
                    textTransform: "none",
                    px: 2.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: "block", lineHeight: 1 }}>
                      Download for
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
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
                    bgcolor: "#0078d4",
                    "&:hover": { bgcolor: "#106ebe" },
                    textTransform: "none",
                    px: 2.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ textAlign: "left" }}>
                    <Typography variant="caption" sx={{ opacity: 0.7, display: "block", lineHeight: 1 }}>
                      Download for
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
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
                      macOS Installation
                    </Typography>
                    <Box
                      component="ul"
                      sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                    >
                      <li>
                        Double-click the <code>.dmg</code> file
                      </li>
                      <li>Drag the app to the Applications folder</li>
                      <li>Open from Applications</li>
                    </Box>
                    <Alert
                      severity="warning"
                      variant="outlined"
                      sx={{ mt: 1.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
                    >
                      <strong>If blocked by macOS:</strong> Right-click the app → Open → click Open again. Or go to{" "}
                      <em>System Settings → Privacy & Security → Open Anyway</em>.
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
                      Windows Installation
                    </Typography>
                    <Box
                      component="ul"
                      sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                    >
                      <li>
                        Download the <code>.exe</code> file
                      </li>
                      <li>Double-click to run</li>
                    </Box>
                    <Alert
                      severity="info"
                      variant="outlined"
                      sx={{ mt: 1.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }}
                    >
                      <strong>If SmartScreen blocks it:</strong> Click <strong>More info</strong> → then{" "}
                      <strong>Run anyway</strong>. This is normal for unsigned apps.
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
                  How to use CookieForge
                </Typography>
                <Box
                  component="ol"
                  sx={{ pl: 2, mb: 0, "& li": { mb: 0.5, fontSize: "0.8rem", color: "text.secondary" } }}
                >
                  <li>Open the CookieForge app.</li>
                  <li>Import your TikTok cookies (from J2TEAM Cookies export).</li>
                  <li>The app will load TikTok with your cookies. Solve the captcha manually when it appears.</li>
                  <li>
                    Export the solved cookies → upload them in <strong>Settings → Cookies</strong>.
                  </li>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Method 3: Non-Headless */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Chip label="3" size="small" color="primary" />
              Run in Non-Headless Mode
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              Disable <strong>Headless Mode</strong> in <strong>Settings → General</strong>. The browser will be visible
              and you can manually solve captcha when it appears.
            </Typography>
            <Box sx={{ pl: 4, mt: 1 }}>
              <Chip label="Requires manual interaction" size="small" color="warning" variant="outlined" />
            </Box>
          </Box>

          {/* Method 4: Spacing */}
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}
            >
              <Chip label="4" size="small" color="primary" />
              Space Out Your Scraping Sessions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
              Scraping too frequently in a short period triggers captcha. Wait at least 5–10 minutes between scraping
              sessions to reduce the risk.
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Tips */}
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
            Tips to Avoid Captcha
          </Typography>
          <Grid container spacing={1.5}>
            {[
              { icon: <CheckIcon color="success" fontSize="small" />, text: "Always upload cookies before scraping" },
              {
                icon: <CheckIcon color="success" fontSize="small" />,
                text: "Use CookieForge to solve captcha and refresh cookies",
              },
              {
                icon: <CheckIcon color="success" fontSize="small" />,
                text: "Don't scrape more than 5 videos in a row",
              },
              {
                icon: <WarningIcon color="warning" fontSize="small" />,
                text: "Avoid scraping videos with millions of comments",
              },
              {
                icon: <WarningIcon color="warning" fontSize="small" />,
                text: "Replace cookies if captcha keeps appearing",
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
