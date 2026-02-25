import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    proxyEnabled: false,
    proxyList: "",
  });

  const [originalSettings, setOriginalSettings] = useState({
    headless: true,
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
      toast.error(t("settings.invalidFileFormat"));
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
          toast.error(t("settings.parseJsonFailed"));
          setLoadingPlatform(null);
          return;
        }

        let cookies: any[] = [];
        if (Array.isArray(parsedData)) cookies = parsedData;
        else if (parsedData && Array.isArray(parsedData.cookies)) cookies = parsedData.cookies;
        else {
          toast.error(t("settings.invalidJsonStructure"));
          setLoadingPlatform(null);
          return;
        }

        if (!validateCookieDomain(cookies, platform)) {
          toast.error(t("settings.cookiesDomainMismatch", { platform }));
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
            toast.error(t("settings.uploadSuccessButParseFailed"));
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

          toast.success(t("settings.cookiesUploadedSuccess", { platform: platform === "TIKTOK" ? "TikTok" : "Facebook" }));
        } catch (apiError: any) {
          const msg = apiError.response?.data?.error?.message || apiError.message || t("settings.uploadFailed");
          toast.error(`${t("common.error")}: ${msg}`);
        }
      } catch (error) {
        toast.error(t("settings.unexpectedError"));
      } finally {
        setLoadingPlatform(null);
      }
    };

    reader.readAsText(file);
  };

  const handleClearCookies = async (platform: "TIKTOK" | "FACEBOOK") => {
    if (!confirm(t("settings.clearConfirm", { platform: platform === "TIKTOK" ? "TikTok" : "Facebook" }))) return;

    setLoadingPlatform(platform);
    try {
      await userService.deleteCookie(platform.toLowerCase() as "tiktok" | "facebook");
      const key = platform === "TIKTOK" ? "tiktok" : "facebook";
      setCookieStats((prev) => ({
        ...prev,
        [key]: { active: false, count: 0, date: "", filename: "" },
      }));

      toast.success(t("settings.cookiesCleared"));
    } catch (error) {
      toast.error(t("settings.clearCookiesFailed"));
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

      toast.success(t("settings.settingsSaved"));
      setOriginalSettings(settings);
    } catch (error: any) {
      console.error("Save Error Details:", error);
      const errorMsg =
        error.response?.data?.error?.message || error.response?.data?.message || t("settings.saveFailed");
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
          bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.12)" : "rgba(46, 125, 50, 0.08)",
          borderRadius: 2,
          border: "1px solid",
          borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.3)" : "rgba(46, 125, 50, 0.2)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
          <CheckCircleIcon sx={{ color: (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32", fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e8f5e9" : "#1b5e20" }}>
            {t("settings.cookiesLoaded", { count: stats.count })}
          </Typography>
        </Stack>
        {stats.filename && (
          <Typography
            variant="caption"
            sx={{
              color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
              pl: 3.5,
              display: "block",
              fontStyle: "italic",
            }}
          >
            {t("settings.file")}: {stats.filename}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)", pl: 3.5, display: "block" }}>
          {t("settings.lastUpdated")}: {stats.date}
        </Typography>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t("settings.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("settings.subtitle")}
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

      <Card
        sx={{
          bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
          boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 2px 16px rgba(0,0,0,0.08)",
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="settings tabs"
            sx={{
              px: 2,
              "& .MuiTab-root": {
                minHeight: 56,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
              },
            }}
          >
            {/* Tab General chỉ dành cho Admin */}
            {isAdmin && <Tab icon={<GeneralIcon />} iconPosition="start" label={t("settings.generalTab")} />}
            <Tab icon={<CookieIcon />} iconPosition="start" label={t("settings.cookiesTab")} />
            <Tab icon={<ProxyIcon />} iconPosition="start" label={t("settings.proxiesTab")} />
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
                    <Typography variant="h6">{t("settings.scraperBehavior")}</Typography>
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
                          <Typography variant="body1">{t("settings.headlessMode")}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t("settings.headlessModeHelper")}
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                </Grid>
              </Grid>
            </TabPanel>
          )}

          {/* --- TAB COOKIES (Index 1 cho Admin, Index 0 cho User) --- */}
          <TabPanel value={tabValue} index={isAdmin ? 1 : 0}>
            <Grid container spacing={3}>
              {/* TikTok Cookie Card */}
              <Grid item xs={12} md={6}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
                    borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                    boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 2px 12px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: (theme) => theme.palette.primary.main,
                      boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 4px 20px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.04)",
                          }}
                        >
                          <CookieIcon sx={{ color: "primary.main", fontSize: 24 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={600}>{t("settings.tiktokCookies")}</Typography>
                      </Box>
                      {cookieStats.tiktok.active ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={t("settings.active")}
                          size="small"
                          sx={{
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.2)" : "rgba(46, 125, 50, 0.1)",
                            color: (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32",
                            borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.4)" : "rgba(46, 125, 50, 0.3)",
                            fontWeight: 600,
                            "& .MuiChip-icon": {
                              color: (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32",
                            },
                          }}
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<ErrorIcon />}
                          label={t("settings.missing")}
                          size="small"
                          sx={{
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                            color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.38)",
                            borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                            fontWeight: 500,
                            "& .MuiChip-icon": {
                              color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)",
                            },
                          }}
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
                      {t("settings.tiktokCookiesHelper")}
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
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                        }}
                      >
                        {t("settings.uploadJson")}
                      </Button>

                      {cookieStats.tiktok.active && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleClearCookies("TIKTOK")}
                          disabled={loadingPlatform === "TIKTOK"}
                          sx={{
                            textTransform: "none",
                            fontWeight: 500,
                            borderRadius: 2,
                          }}
                        >
                          {t("settings.clearCookies")}
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Facebook Cookie Card */}
              <Grid item xs={12} md={6}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
                    borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                    boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 2px 12px rgba(0,0,0,0.08)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      borderColor: (theme) => theme.palette.primary.main,
                      boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 4px 20px rgba(0,0,0,0.12)",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.04)",
                          }}
                        >
                          <CookieIcon sx={{ color: "primary.main", fontSize: 24 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={600}>{t("settings.facebookCookies")}</Typography>
                      </Box>
                      {cookieStats.facebook.active ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={t("settings.active")}
                          size="small"
                          sx={{
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.2)" : "rgba(46, 125, 50, 0.1)",
                            color: (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32",
                            borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(46, 125, 50, 0.4)" : "rgba(46, 125, 50, 0.3)",
                            fontWeight: 600,
                            "& .MuiChip-icon": {
                              color: (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32",
                            },
                          }}
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<ErrorIcon />}
                          label={t("settings.missing")}
                          size="small"
                          sx={{
                            bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                            color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.38)",
                            borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                            fontWeight: 500,
                            "& .MuiChip-icon": {
                              color: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.38)",
                            },
                          }}
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <Typography variant="body2" color="text.secondary" paragraph sx={{ mb: 3 }}>
                      {t("settings.facebookCookiesHelper")}
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
                        sx={{
                          textTransform: "none",
                          fontWeight: 600,
                          px: 3,
                          py: 1,
                          borderRadius: 2,
                        }}
                      >
                        {t("settings.uploadJson")}
                      </Button>

                      {cookieStats.facebook.active && (
                        <Button
                          variant="outlined"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleClearCookies("FACEBOOK")}
                          disabled={loadingPlatform === "FACEBOOK"}
                          sx={{
                            textTransform: "none",
                            fontWeight: 500,
                            borderRadius: 2,
                          }}
                        >
                          {t("settings.clearCookies")}
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
                bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.08)" : "rgba(33, 150, 243, 0.04)",
                borderRadius: 3,
                border: "1px dashed",
                borderColor: (theme) => theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.3)" : "rgba(33, 150, 243, 0.3)",
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
                  mx: "auto",
                  mb: 3,
                  bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.15)" : "rgba(33, 150, 243, 0.1)",
                }}
              >
                <ConstructionIcon sx={{ fontSize: 40, color: (theme) => theme.palette.mode === "dark" ? "#64b5f6" : "#1976d2", opacity: 0.9 }} />
              </Box>
              <Typography variant="h5" fontWeight={600} gutterBottom sx={{ color: "text.primary" }}>
                {t("settings.advancedProxy")}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: "auto", mb: 3 }}>
                {t("settings.proxyMessage")}
              </Typography>
              <Chip
                label={t("settings.comingSoon")}
                size="small"
                sx={{
                  bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(33, 150, 243, 0.2)" : "rgba(33, 150, 243, 0.1)",
                  color: (theme) => theme.palette.mode === "dark" ? "#90caf9" : "#1976d2",
                  fontWeight: 600,
                  px: 1,
                }}
              />
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
                label={t("settings.enableProxy")}
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
              {isSaving ? t("settings.saving") : t("settings.saveSettings")}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
