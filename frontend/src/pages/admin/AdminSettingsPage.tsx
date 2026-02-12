import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  TextField,
  Button,
  alpha,
  Alert,
  Chip,
  Stack,
  CircularProgress,
} from "@mui/material";
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Engineering as MaintenanceIcon,
  PersonAdd as RegistrationIcon,
  Speed as PerformanceIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  AttachMoney as PricingIcon,
  DeleteSweep as RetentionIcon,
} from "@mui/icons-material";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner } from "@/components/common";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────
interface SettingsMap {
  [key: string]: string | null;
}

// ── Settings config definition ───────────────────
interface SettingDef {
  key: string;
  label: string;
  description: string;
  type: "toggle" | "number" | "text";
  defaultValue: string;
  category: string;
  icon: React.ReactNode;
  dangerous?: boolean;
}

const SETTINGS_DEFS: SettingDef[] = [
  {
    key: "maintenanceMode",
    label: "Maintenance Mode",
    description: "When enabled, all non-admin users will see a maintenance page. Only admins can access the system.",
    type: "toggle",
    defaultValue: "false",
    category: "System",
    icon: <MaintenanceIcon />,
    dangerous: true,
  },
  {
    key: "registrationEnabled",
    label: "User Registration",
    description: "Allow new users to register. Disable to prevent new sign-ups while keeping existing users active.",
    type: "toggle",
    defaultValue: "true",
    category: "System",
    icon: <RegistrationIcon />,
  },
  {
    key: "maxTrialUses",
    label: "Max Trial Scrapes",
    description: "Number of free scrape attempts for new users on the FREE plan.",
    type: "number",
    defaultValue: "3",
    category: "Limits",
    icon: <PerformanceIcon />,
  },
  {
    key: "freeMaxComments",
    label: "Free Plan Comment Limit",
    description: "Maximum comments per scrape for FREE plan users.",
    type: "number",
    defaultValue: "100",
    category: "Limits",
    icon: <PerformanceIcon />,
  },
  {
    key: "personalMaxComments",
    label: "Personal Plan Comment Limit",
    description: "Maximum comments per scrape for PERSONAL plan users.",
    type: "number",
    defaultValue: "5000",
    category: "Limits",
    icon: <PerformanceIcon />,
  },
  {
    key: "premiumMaxComments",
    label: "Premium Plan Comment Limit",
    description: "Maximum comments per scrape for PREMIUM plan users.",
    type: "number",
    defaultValue: "50000",
    category: "Limits",
    icon: <PerformanceIcon />,
  },
  {
    key: "freeConcurrency",
    label: "Free Queue Concurrency",
    description: "Max simultaneous scrape jobs for FREE plan users. (Paid plans have unlimited concurrency.)",
    type: "number",
    defaultValue: "1",
    category: "Performance",
    icon: <PerformanceIcon />,
  },
  {
    key: "jobTimeout",
    label: "Job Timeout (seconds)",
    description: "Maximum time in seconds before a scrape job is automatically terminated.",
    type: "number",
    defaultValue: "300",
    category: "Performance",
    icon: <PerformanceIcon />,
  },
  {
    key: "sessionMaxAge",
    label: "Session Max Age (days)",
    description: "How many days a login session (refresh token) stays valid before expiring.",
    type: "number",
    defaultValue: "7",
    category: "Security",
    icon: <SecurityIcon />,
  },
  {
    key: "contactEmail",
    label: "Admin Contact Email",
    description: "Email displayed to users when they need to contact admin for plan upgrades or support.",
    type: "text",
    defaultValue: "",
    category: "General",
    icon: <InfoIcon />,
  },
  {
    key: "contactPhone",
    label: "Admin Contact Phone",
    description: "Phone number displayed to users for contacting support.",
    type: "text",
    defaultValue: "",
    category: "General",
    icon: <InfoIcon />,
  },
  // ── Pricing ──
  {
    key: "freePrice",
    label: "Free Plan Price ($)",
    description: "Display price for the FREE plan (usually 0).",
    type: "number",
    defaultValue: "0",
    category: "Pricing",
    icon: <PricingIcon />,
  },
  {
    key: "personalPrice",
    label: "Personal Plan Price ($)",
    description: "Price in USD for the PERSONAL plan.",
    type: "number",
    defaultValue: "23",
    category: "Pricing",
    icon: <PricingIcon />,
  },
  {
    key: "premiumPrice",
    label: "Premium Plan Price ($)",
    description: "Price in USD for the PREMIUM plan.",
    type: "number",
    defaultValue: "45",
    category: "Pricing",
    icon: <PricingIcon />,
  },
  {
    key: "personalDuration",
    label: "Personal Plan Duration (days)",
    description: "How many days the PERSONAL plan lasts after purchase.",
    type: "number",
    defaultValue: "3",
    category: "Pricing",
    icon: <PricingIcon />,
  },
  {
    key: "premiumDuration",
    label: "Premium Plan Duration (days)",
    description: "How many days the PREMIUM plan lasts after purchase (0 = monthly subscription).",
    type: "number",
    defaultValue: "30",
    category: "Pricing",
    icon: <PricingIcon />,
  },
  // ── Data Retention ──
  {
    key: "freeRetentionDays",
    label: "Free Plan Retention (days)",
    description: "Number of days to keep scrape history for FREE plan users before auto-deletion.",
    type: "number",
    defaultValue: "1",
    category: "Data Retention",
    icon: <RetentionIcon />,
  },
  {
    key: "personalRetentionDays",
    label: "Personal Plan Retention (days)",
    description: "Number of days to keep scrape history for PERSONAL plan users.",
    type: "number",
    defaultValue: "3",
    category: "Data Retention",
    icon: <RetentionIcon />,
  },
  {
    key: "premiumRetentionDays",
    label: "Premium Plan Retention (days)",
    description: "Number of days to keep scrape history for PREMIUM plan users.",
    type: "number",
    defaultValue: "5",
    category: "Data Retention",
    icon: <RetentionIcon />,
  },
];

// ── Setting Card ─────────────────────────────────
function SettingCard({
  def,
  value,
  onChange,
  saving,
}: {
  def: SettingDef;
  value: string;
  onChange: (key: string, value: string) => void;
  saving: boolean;
}) {
  const isToggle = def.type === "toggle";
  const checked = value === "true";

  return (
    <Card
      sx={{
        border: def.dangerous ? "1px solid" : "1px solid",
        borderColor: def.dangerous ? (theme) => alpha(theme.palette.warning.main, 0.3) : "divider",
        background: def.dangerous ? (theme) => alpha(theme.palette.warning.main, 0.02) : undefined,
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flex: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: def.dangerous
                  ? (theme) => alpha(theme.palette.warning.main, 0.1)
                  : (theme) => alpha(theme.palette.primary.main, 0.1),
                color: def.dangerous ? "warning.main" : "primary.main",
                flexShrink: 0,
              }}
            >
              {def.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {def.label}
                </Typography>
                {def.dangerous && (
                  <Chip
                    label="Caution"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: isToggle ? 0 : 1.5 }}>
                {def.description}
              </Typography>

              {/* Non-toggle inputs */}
              {def.type === "number" && (
                <TextField
                  size="small"
                  type="number"
                  value={value}
                  onChange={(e) => onChange(def.key, e.target.value)}
                  sx={{ maxWidth: 200, mt: 0.5 }}
                  inputProps={{ min: 0 }}
                  disabled={saving}
                />
              )}
              {def.type === "text" && (
                <TextField
                  size="small"
                  value={value}
                  onChange={(e) => onChange(def.key, e.target.value)}
                  placeholder={def.defaultValue || "Not set"}
                  sx={{ maxWidth: 400, mt: 0.5 }}
                  fullWidth
                  disabled={saving}
                />
              )}
            </Box>
          </Box>

          {/* Toggle switch */}
          {isToggle && (
            <Switch
              checked={checked}
              onChange={(e) => onChange(def.key, e.target.checked ? "true" : "false")}
              color={def.dangerous ? "warning" : "primary"}
              disabled={saving}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────
export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<SettingsMap>({});

  // Fetch current settings
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.admin.settings?.() ?? ["admin", "settings"],
    queryFn: () => apiRequest.get<{ success: boolean; data: { settings: SettingsMap } }>("/admin/settings"),
  });

  const serverSettings = data?.data?.settings ?? {};

  // Compute hasChanges by comparing local vs server values
  const hasChanges = useMemo(() => {
    return SETTINGS_DEFS.some((def) => {
      const localVal = localSettings[def.key] ?? def.defaultValue;
      const serverVal = serverSettings[def.key] ?? def.defaultValue;
      return localVal !== serverVal;
    });
  }, [localSettings, serverSettings]);

  // Initialize local settings from server
  useEffect(() => {
    if (data?.data?.settings) {
      const merged: SettingsMap = {};
      SETTINGS_DEFS.forEach((def) => {
        merged[def.key] = data.data.settings[def.key] ?? def.defaultValue;
      });
      setLocalSettings(merged);
    }
  }, [data]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (changes: { key: string; value: string | null }[]) => {
      // Save each changed setting
      for (const change of changes) {
        await apiRequest.patch("/admin/settings", { key: change.key, value: change.value });
      }
    },
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings?.() ?? ["admin", "settings"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });

  // Handle value change
  const handleChange = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Save all changes
  const handleSave = () => {
    const changes: { key: string; value: string | null }[] = [];

    SETTINGS_DEFS.forEach((def) => {
      const localVal = localSettings[def.key] ?? def.defaultValue;
      const serverVal = serverSettings[def.key] ?? def.defaultValue;
      if (localVal !== serverVal) {
        changes.push({ key: def.key, value: localVal });
      }
    });

    if (changes.length === 0) {
      toast("No changes to save");
      return;
    }

    saveMutation.mutate(changes);
  };

  // Reset to server values
  const handleReset = () => {
    if (data?.data?.settings) {
      const merged: SettingsMap = {};
      SETTINGS_DEFS.forEach((def) => {
        merged[def.key] = data.data.settings[def.key] ?? def.defaultValue;
      });
      setLocalSettings(merged);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  // Group settings by category
  const categories = [...new Set(SETTINGS_DEFS.map((d) => d.category))];

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            System Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Configure global system behavior, limits, and features
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetch();
              handleReset();
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
          >
            Save Changes
          </Button>
        </Stack>
      </Box>

      {/* Unsaved Changes Alert */}
      {hasChanges && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleReset}>
              Discard
            </Button>
          }
        >
          You have unsaved changes. Click <strong>Save Changes</strong> to apply.
        </Alert>
      )}

      {/* Settings by category */}
      {categories.map((category) => (
        <Box key={category} sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            {category}
          </Typography>
          <Stack spacing={2}>
            {SETTINGS_DEFS.filter((d) => d.category === category).map((def) => (
              <SettingCard
                key={def.key}
                def={def}
                value={localSettings[def.key] ?? def.defaultValue}
                onChange={handleChange}
                saving={saveMutation.isPending}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
