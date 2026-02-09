import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { userService } from "@/services/user.service";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Tabs,
  Tab,
  alpha,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  Save as SaveIcon,
  Cookie as CookieIcon,
  VpnKey as ProxyIcon,
  Settings as GeneralIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Construction as ConstructionIcon, // Icon cho Coming Soon
  AdminPanelSettings as AdminIcon,
} from "@mui/icons-material";
import toast from "react-hot-toast";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other} style={{ padding: "24px 0" }}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Validate Domain
const validateCookieDomain = (cookies: any[], platform: "TIKTOK" | "FACEBOOK"): boolean => {
  if (!Array.isArray(cookies) || cookies.length === 0) return false;
  const targetDomain = platform === "TIKTOK" ? "tiktok.com" : "facebook.com";
  return cookies.some((c) => c.domain && c.domain.includes(targetDomain));
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.isAdmin || false;

  // Nếu là Admin, tab đầu tiên là General (0). Nếu là User, tab đầu tiên là Cookies (0 - nhưng logic hiển thị sẽ khác)
  // Để đơn giản, ta quy ước:
  // Admin: 0=General, 1=Cookies, 2=Proxies
  // User:  0=Cookies, 1=Proxies
  const [tabValue, setTabValue] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState<"TIKTOK" | "FACEBOOK" | null>(null);

  const [cookieStats, setCookieStats] = useState<{
    tiktok: { count: number; date: string; active: boolean; filename: string };
    facebook: { count: number; date: string; active: boolean; filename: string };
  }>({
    tiktok: { count: 0, date: "", active: false, filename: "" },
    facebook: { count: 0, date: "", active: false, filename: "" },
  });

  const tiktokInputRef = useRef<HTMLInputElement>(null);
  const facebookInputRef = useRef<HTMLInputElement>(null);

  // State Settings
  const [settings, setSettings] = useState({
    headless: true,
    concurrency: 2,
    proxyEnabled: false,
    proxyList: "",
  });

  const [originalSettings, setOriginalSettings] = useState({
    headless: true,
    concurrency: 2,
    proxyEnabled: false,
    proxyList: "",
  });

  // Kiểm tra thay đổi
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await userService.getSettings();
      const responseData = res.data as any;
      const s = responseData.data?.settings || responseData.settings;

      if (s) {
        const loadedSettings = {
          headless: s.headlessMode,
          concurrency: 2,
          proxyEnabled: s.proxyEnabled,
          proxyList: s.proxyList || "",
        };

        setSettings(loadedSettings);
        setOriginalSettings(loadedSettings);

        setCookieStats({
          tiktok: {
            active: s.hasTiktokCookie,
            count: s.tiktokCookieCount,
            date: new Date().toLocaleDateString(),
            filename: s.tiktokCookieFile || "",
          },
          facebook: {
            active: s.hasFacebookCookie,
            count: s.facebookCookieCount,
            date: new Date().toLocaleDateString(),
            filename: s.facebookCookieFile || "",
          },
        });
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // --- UPLOAD HANDLER ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, platform: "TIKTOK" | "FACEBOOK") => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";

    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Invalid file format. Please upload a JSON file.");
      return;
    }

    setLoadingPlatform(platform);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const jsonContent = e.target?.result as string;

        let parsedData;
        try {
          parsedData = JSON.parse(jsonContent);
        } catch (err) {
          toast.error("Failed to parse JSON file.");
          setLoadingPlatform(null);
          return;
        }

        let cookies: any[] = [];
        if (Array.isArray(parsedData)) cookies = parsedData;
        else if (parsedData && Array.isArray(parsedData.cookies)) cookies = parsedData.cookies;
        else {
          toast.error("Invalid JSON structure.");
          setLoadingPlatform(null);
          return;
        }

        if (!validateCookieDomain(cookies, platform)) {
          toast.error(`Invalid cookies! Domain mismatch for ${platform}.`);
          setLoadingPlatform(null);
          return;
        }

        try {
          const res = await userService.uploadCookie(
            platform.toLowerCase() as "tiktok" | "facebook",
            jsonContent,
            file.name,
          );
          const responseData = res.data as any;
          const newCookieInfo = responseData.data?.cookie || responseData.cookie;

          if (!newCookieInfo) {
            toast.error("Upload successful but failed to parse response.");
            setLoadingPlatform(null);
            return;
          }

          const key = platform === "TIKTOK" ? "tiktok" : "facebook";
          setCookieStats((prev) => ({
            ...prev,
            [key]: {
              active: true,
              count: newCookieInfo.cookieCount,
              date: new Date().toLocaleDateString(),
              filename: newCookieInfo.filename || file.name,
            },
          }));

          toast.success(`${platform === "TIKTOK" ? "TikTok" : "Facebook"} cookies uploaded!`);
        } catch (apiError: any) {
          const msg = apiError.response?.data?.error?.message || apiError.message || "Upload failed";
          toast.error(`Error: ${msg}`);
        }
      } catch (error) {
        toast.error("An unexpected error occurred.");
      } finally {
        setLoadingPlatform(null);
      }
    };

    reader.readAsText(file);
  };

  const handleClearCookies = async (platform: "TIKTOK" | "FACEBOOK") => {
    if (!confirm(`Are you sure you want to clear ${platform === "TIKTOK" ? "TikTok" : "Facebook"} cookies?`)) return;

    setLoadingPlatform(platform);
    try {
      await userService.deleteCookie(platform.toLowerCase() as "tiktok" | "facebook");
      const key = platform === "TIKTOK" ? "tiktok" : "facebook";
      setCookieStats((prev) => ({
        ...prev,
        [key]: { active: false, count: 0, date: "", filename: "" },
      }));

      toast.success("Cookies cleared successfully.");
    } catch (error) {
      toast.error("Failed to clear cookies.");
    } finally {
      setLoadingPlatform(null);
    }
  };

  // --- SAVE HANDLER ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isAdmin) {
        await userService.updateScraperSettings(settings.headless);
      }

      // Proxies logic (Coming soon nhưng vẫn call API nếu có data)
      await userService.updateProxies(settings.proxyList, "RANDOM");
      await userService.toggleProxy(settings.proxyEnabled);

      toast.success("Settings saved successfully!");
      setOriginalSettings(settings);
    } catch (error: any) {
      console.error("Save Error Details:", error);
      const errorMsg =
        error.response?.data?.error?.message || error.response?.data?.message || "Failed to save settings";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const renderCookieInfo = (stats: { count: number; date: string; active: boolean; filename: string }) => {
    if (!stats.active) return null;

    return (
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: "rgba(76, 175, 80, 0.08)",
          borderRadius: 1,
          border: "1px solid rgba(76, 175, 80, 0.2)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <CookieIcon sx={{ color: "#2e7d32", fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            {stats.count} cookies loaded
          </Typography>
        </Stack>
        {stats.filename && (
          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.8)",
              pl: 3.5,
              display: "block",
              fontStyle: "italic",
            }}
          >
            File: {stats.filename}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", pl: 3.5, display: "block" }}>
          Last updated: {stats.date}
        </Typography>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your scraper configuration, cookies, and proxies.
        </Typography>
      </Box>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={tiktokInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={(e) => handleFileUpload(e, "TIKTOK")}
      />
      <input
        type="file"
        ref={facebookInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={(e) => handleFileUpload(e, "FACEBOOK")}
      />

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
            {/* Tab General chỉ dành cho Admin */}
            {isAdmin && <Tab icon={<GeneralIcon />} iconPosition="start" label="General" />}
            <Tab icon={<CookieIcon />} iconPosition="start" label="Cookies" />
            <Tab icon={<ProxyIcon />} iconPosition="start" label="Proxies" />
          </Tabs>
        </Box>

        <CardContent>
          {/* LOGIC HIỂN THỊ TAB:
            - Nếu Admin: General (0), Cookies (1), Proxies (2)
            - Nếu User: Cookies (0), Proxies (1)
          */}

          {/* --- TAB GENERAL (ADMIN ONLY - Index 0) --- */}
          {isAdmin && (
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={4}>
                <Grid item xs={12} md={8}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                    <AdminIcon color="primary" />
                    <Typography variant="h6">Scraper Behavior (Admin Only)</Typography>
                  </Stack>
                  <Box sx={{ mb: 3 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={settings.headless}
                          onChange={(e) => setSettings({ ...settings, headless: e.target.checked })}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body1">Headless Mode</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Run browser in background (Recommended for performance)
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Concurrency
                  </Typography>
                  <TextField
                    type="number"
                    label="Max Concurrent Jobs"
                    value={settings.concurrency}
                    onChange={(e) => setSettings({ ...settings, concurrency: Number(e.target.value) })}
                    size="small"
                    sx={{ maxWidth: 200 }}
                    helperText="Controls how many scraping tabs run at the same time."
                  />
                </Grid>
              </Grid>
            </TabPanel>
          )}

          {/* --- TAB COOKIES (Index 1 cho Admin, Index 0 cho User) --- */}
          <TabPanel value={tabValue} index={isAdmin ? 1 : 0}>
            <Grid container spacing={3}>
              {/* TikTok Cookie Card */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: "100%", bgcolor: alpha("#000", 0.2) }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">TikTok Cookies</Typography>
                      {cookieStats.tiktok.active ? (
                        <Chip icon={<CheckCircleIcon />} label="Active" color="success" size="small" variant="filled" />
                      ) : (
                        <Chip icon={<ErrorIcon />} label="Missing" color="default" size="small" variant="outlined" />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      Upload cookies to access age-restricted content.
                    </Typography>

                    {renderCookieInfo(cookieStats.tiktok)}

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button
                        variant="contained"
                        startIcon={
                          loadingPlatform === "TIKTOK" ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />
                        }
                        onClick={() => tiktokInputRef.current?.click()}
                        disabled={loadingPlatform === "TIKTOK"}
                        sx={{ bgcolor: "#3f51b5", textTransform: "none" }}
                      >
                        Upload JSON
                      </Button>

                      {cookieStats.tiktok.active && (
                        <Button
                          variant="text"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleClearCookies("TIKTOK")}
                          disabled={loadingPlatform === "TIKTOK"}
                          sx={{ textTransform: "none" }}
                        >
                          Clear
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Facebook Cookie Card */}
              <Grid item xs={12} md={6}>
                <Card variant="outlined" sx={{ height: "100%", bgcolor: alpha("#000", 0.2) }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Typography variant="h6">Facebook Cookies</Typography>
                      {cookieStats.facebook.active ? (
                        <Chip icon={<CheckCircleIcon />} label="Active" color="success" size="small" variant="filled" />
                      ) : (
                        <Chip icon={<ErrorIcon />} label="Missing" color="default" size="small" variant="outlined" />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" paragraph>
                      Required for scraping Facebook comments.
                    </Typography>

                    {renderCookieInfo(cookieStats.facebook)}

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button
                        variant="contained"
                        startIcon={
                          loadingPlatform === "FACEBOOK" ? (
                            <CircularProgress size={20} color="inherit" />
                          ) : (
                            <UploadIcon />
                          )
                        }
                        onClick={() => facebookInputRef.current?.click()}
                        disabled={loadingPlatform === "FACEBOOK"}
                        sx={{ bgcolor: "#3f51b5", textTransform: "none" }}
                      >
                        Upload JSON
                      </Button>

                      {cookieStats.facebook.active && (
                        <Button
                          variant="text"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleClearCookies("FACEBOOK")}
                          disabled={loadingPlatform === "FACEBOOK"}
                          sx={{ textTransform: "none" }}
                        >
                          Clear
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* --- TAB PROXIES (Index 2 cho Admin, Index 1 cho User) --- */}
          <TabPanel value={tabValue} index={isAdmin ? 2 : 1}>
            {/* Giao diện "Coming Soon" */}
            <Box
              sx={{
                p: 6,
                textAlign: "center",
                bgcolor: alpha("#2196f3", 0.08),
                borderRadius: 3,
                border: "1px dashed",
                borderColor: "primary.main",
              }}
            >
              <ConstructionIcon sx={{ fontSize: 60, color: "primary.main", mb: 2, opacity: 0.8 }} />
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Advanced Proxy Management
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: "auto", mb: 3 }}>
                We are building a powerful proxy rotation engine to help you bypass restrictions effortlessly. This
                feature will be available in the next update.
              </Typography>
              <Chip label="Coming Soon" color="primary" size="small" />
            </Box>

            {/* Hidden Logic */}
            <Box sx={{ display: "none" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.proxyEnabled}
                    onChange={(e) => setSettings({ ...settings, proxyEnabled: e.target.checked })}
                  />
                }
                label="Enable Proxy Rotation"
              />
              <TextField
                fullWidth
                multiline
                rows={6}
                value={settings.proxyList}
                onChange={(e) => setSettings({ ...settings, proxyList: e.target.value })}
              />
            </Box>
          </TabPanel>

          {/* NÚT SAVE */}
          <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              sx={{
                opacity: hasChanges ? 1 : 0.5,
                transition: "opacity 0.2s",
                fontWeight: 600,
              }}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
