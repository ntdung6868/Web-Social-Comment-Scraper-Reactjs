import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  MenuItem,
  Button,
  Divider,
  Alert,
} from "@mui/material";
import { Save as SaveIcon } from "@mui/icons-material";
import { userService } from "@/services/user.service";
import { queryKeys, queryClient } from "@/lib/query-client";
import { LoadingSpinner } from "@/components/common";
import toast from "react-hot-toast";

const languages = [
  { value: "en", label: "English" },
  { value: "vi", label: "Vietnamese" },
];

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho Chi Minh (GMT+7)" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
];

export default function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.user.settings(),
    queryFn: () => userService.getSettings(),
  });

  const [settings, setSettings] = useState({
    emailNotifications: true,
    language: "en",
    timezone: "UTC",
  });

  // Update local state when data loads
  useState(() => {
    if (data?.data) {
      setSettings(data.data);
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: userService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.settings() });
      toast.success("Settings saved successfully");
    },
    onError: () => {
      toast.error("Failed to save settings");
    },
  });

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading settings..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your preferences and notifications
        </Typography>
      </Box>

      {/* Notification Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure how you want to receive notifications
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
              />
            }
            label="Email Notifications"
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 6 }}>
            Receive email notifications when your scraping jobs complete
          </Typography>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Preferences
          </Typography>

          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <TextField
              select
              label="Language"
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
              sx={{ minWidth: 200 }}
            >
              {languages.map((lang) => (
                <MenuItem key={lang.value} value={lang.value}>
                  {lang.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Timezone"
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              sx={{ minWidth: 250 }}
            >
              {timezones.map((tz) => (
                <MenuItem key={tz.value} value={tz.value}>
                  {tz.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card sx={{ border: "1px solid", borderColor: "error.main" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} color="error" gutterBottom>
            Danger Zone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Irreversible and destructive actions
          </Typography>

          <Alert severity="warning" sx={{ mb: 2 }}>
            Deleting your account will permanently remove all your data including scraping history and settings.
          </Alert>

          <Button variant="outlined" color="error">
            Delete Account
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={updateSettingsMutation.isPending}
        >
          {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </Box>
    </Box>
  );
}
