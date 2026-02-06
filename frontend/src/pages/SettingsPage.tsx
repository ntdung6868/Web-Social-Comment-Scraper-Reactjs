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
} from "@mui/icons-material";
import toast from "react-hot-toast";

// Interface cho Props của TabPanel
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
  const { user, updateUser } = useAuthStore();
  const [tabValue, setTabValue] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState<"TIKTOK" | "FACEBOOK" | null>(null);

  // State cục bộ để lưu thông tin hiển thị (Optimistic UI)
  const [cookieStats, setCookieStats] = useState<{
    tiktok: { count: number; date: string; active: boolean };
    facebook: { count: number; date: string; active: boolean };
  }>({
    tiktok: { count: 0, date: "", active: false },
    facebook: { count: 0, date: "", active: false },
  });

  const tiktokInputRef = useRef<HTMLInputElement>(null);
  const facebookInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState({
    headless: true,
    concurrency: 2,
    proxyEnabled: false,
    proxyList: "",
  });

  // Đồng bộ User Store vào State cục bộ khi trang load
  useEffect(() => {
    if (user) {
      setCookieStats((prev) => ({
        tiktok: {
          active: user.tiktokCookieStatus === "active" || prev.tiktok.active,
          count: Array.isArray(user.tiktokCookieData) ? user.tiktokCookieData.length : prev.tiktok.count,
          date: new Date().toISOString().split("T")[0],
        },
        facebook: {
          active: user.facebookCookieStatus === "active" || prev.facebook.active,
          count: Array.isArray(user.facebookCookieData) ? user.facebookCookieData.length : prev.facebook.count,
          date: new Date().toISOString().split("T")[0],
        },
      }));
    }
  }, [user]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // --- XỬ LÝ UPLOAD COOKIE ---
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
        } catch {
          toast.error("Failed to parse JSON.");
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

        // Gọi API
        try {
          const response = await userService.updateCookies(platform, cookies);

          // Cập nhật Store (nếu có data trả về)
          const body = (response as any).data && (response as any).status ? (response as any).data : response;
          const payload = body.data || body;
          const updatedUser = payload.user || payload;
          if (updatedUser) updateUser(updatedUser);

          // Cập nhật State cục bộ ngay lập tức để UI hiển thị luôn
          const key = platform === "TIKTOK" ? "tiktok" : "facebook";
          setCookieStats((prev) => ({
            ...prev,
            [key]: {
              active: true,
              count: cookies.length,
              date: new Date().toISOString().split("T")[0],
            },
          }));

          toast.success(`${platform === "TIKTOK" ? "TikTok" : "Facebook"} cookies updated successfully!`);
        } catch (apiError: any) {
          toast.error("Failed to update cookies on server.");
        }
      } catch (error) {
        toast.error("An unexpected error occurred.");
      } finally {
        setLoadingPlatform(null);
      }
    };

    reader.readAsText(file);
  };

  // --- XỬ LÝ XÓA COOKIE ---
  const handleClearCookies = async (platform: "TIKTOK" | "FACEBOOK") => {
    if (!confirm(`Are you sure you want to clear ${platform === "TIKTOK" ? "TikTok" : "Facebook"} cookies?`)) return;

    setLoadingPlatform(platform);
    try {
      const response = await userService.updateCookies(platform, null);
      const body = (response as any).data || response;
      const updatedUser = body.data?.user || body.data || body;
      updateUser(updatedUser);

      // Reset state cục bộ
      const key = platform === "TIKTOK" ? "tiktok" : "facebook";
      setCookieStats((prev) => ({
        ...prev,
        [key]: { active: false, count: 0, date: "" },
      }));

      toast.success("Cookies cleared successfully.");
    } catch (error) {
      toast.error("Failed to clear cookies.");
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Settings saved successfully!");
    }, 1000);
  };

  // --- COMPONENT HIỂN THỊ THÔNG TIN COOKIE ---
  const renderCookieInfo = (stats: { count: number; date: string; active: boolean }) => {
    if (!stats.active) return null;

    return (
      <Box
        sx={{
          mb: 3,
          p: 2,
          bgcolor: "rgba(255, 152, 0, 0.08)", // Màu nền cam nhẹ
          borderRadius: 1,
          border: "1px solid rgba(255, 152, 0, 0.2)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <CookieIcon sx={{ color: "#ed6c02", fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            {stats.count} cookies loaded
          </Typography>
        </Stack>
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

      {/* Inputs File Ẩn */}
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
            <Tab icon={<GeneralIcon />} iconPosition="start" label="General" />
            <Tab icon={<CookieIcon />} iconPosition="start" label="Cookies" />
            <Tab icon={<ProxyIcon />} iconPosition="start" label="Proxies" />
          </Tabs>
        </Box>

        <CardContent>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={8}>
                <Typography variant="h6" gutterBottom>
                  Scraper Behavior
                </Typography>
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
                          Run browser in background (Recommended)
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
                />
              </Grid>
            </Grid>
          </TabPanel>

          {/* COOKIES SETTINGS */}
          <TabPanel value={tabValue} index={1}>
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
                      Upload cookies to access age-restricted content and improve stability.
                    </Typography>

                    {/* HIỂN THỊ INFO BOX */}
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

                    {/* HIỂN THỊ INFO BOX */}
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

          {/* PROXY SETTINGS */}
          <TabPanel value={tabValue} index={2}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={8}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.proxyEnabled}
                      onChange={(e) => setSettings({ ...settings, proxyEnabled: e.target.checked })}
                    />
                  }
                  label="Enable Proxy Rotation"
                  sx={{ mb: 3 }}
                />
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  label="Proxy List"
                  placeholder="http://user:pass@ip:port&#10;http://ip:port"
                  value={settings.proxyList}
                  onChange={(e) => setSettings({ ...settings, proxyList: e.target.value })}
                  disabled={!settings.proxyEnabled}
                  helperText="One proxy per line."
                />
              </Grid>
            </Grid>
          </TabPanel>

          <Box sx={{ mt: 4, display: "flex", justifyContent: "flex-end" }}>
            <Button variant="contained" size="large" startIcon={<SaveIcon />} onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
