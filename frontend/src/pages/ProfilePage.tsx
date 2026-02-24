import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Grid,
  Chip,
  InputAdornment,
  IconButton,
  Alert,
} from "@mui/material";
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Star as StarIcon,
  CalendarToday as CalendarIcon,
  VerifiedUser as SecurityIcon,
  Visibility,
  VisibilityOff,
  EventBusy as ExpireIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { authService } from "@/services/auth.service";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isPaid = user?.planType === "PERSONAL" || user?.planType === "PREMIUM";
  const planLabel =
    user?.planType === "PREMIUM" ? "Premium" : user?.planType === "PERSONAL" ? "Personal" : "Free Member";
  const planColor = user?.planType === "PREMIUM" ? "secondary" : isPaid ? "primary" : "default";

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword, confirmPassword }: PasswordFormData) =>
      authService.changePassword(currentPassword, newPassword, confirmPassword),
    onSuccess: () => {
      resetPassword();
      setPasswordError(null);
      toast.success("Password changed successfully");
    },
    onError: (error: any) => {
      const msg: string =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Failed to change password";
      setPasswordError(msg);
    },
  });

  const onPasswordSubmit = (data: PasswordFormData) => {
    setPasswordError(null);
    updatePasswordMutation.mutate(data);
  };

  if (!user) return null;

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Profile
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account information
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Profile Card */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%", textAlign: "center" }}>
            <Box sx={{ height: 120, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }} />
            <CardContent sx={{ mt: -6 }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  border: "4px solid #1e293b",
                  bgcolor: "primary.main",
                  fontSize: "2.5rem",
                  mx: "auto",
                  mb: 2,
                }}
              >
                {user.username?.charAt(0).toUpperCase()}
              </Avatar>

              <Typography variant="h5" fontWeight={700}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user.email}
              </Typography>

              <Chip
                icon={isPaid ? <StarIcon style={{ fontSize: 16 }}/> : undefined}
                label={planLabel}
                color={planColor}
                variant={isPaid ? "filled" : "outlined"}
                sx={{ mt: 1, fontWeight: 600 }}
              />

              <Divider sx={{ my: 3 }} />

              <Box sx={{ textAlign: "left", px: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Member Since
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {user.createdAt ? format(new Date(user.createdAt), "MMMM dd, yyyy") : "-"}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: isPaid && user.subscriptionEnd ? 2 : 0 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Subscription Status
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SecurityIcon fontSize="small" color={isPaid ? "success" : "action"} />
                    <Typography variant="body2" fontWeight={500} color={isPaid ? "success.main" : "text.primary"}>
                      {user.planStatus === "ACTIVE" ? "Active" : "Inactive"} ({planLabel})
                    </Typography>
                  </Box>
                </Box>

                {isPaid && user.subscriptionEnd && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Expires On
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ExpireIcon
                        fontSize="small"
                        color={new Date(user.subscriptionEnd) < new Date() ? "error" : "warning"}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        color={new Date(user.subscriptionEnd) < new Date() ? "error.main" : "warning.main"}
                      >
                        {format(new Date(user.subscriptionEnd), "MMMM dd, yyyy")}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={8}>
          {/* Account Info (read-only) */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                Account Information
              </Typography>

              <TextField
                fullWidth
                label="Username"
                value={user.username || ""}
                disabled
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Email"
                value={user.email || ""}
                disabled
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600}gutterBottom sx={{ mb: 1 }}>
                Change Password
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                You can only change your password once every 7 days.
              </Typography>

              {passwordError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {passwordError}
                </Alert>
              )}

              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                <TextField
                  {...registerPassword("currentPassword")}
                  fullWidth
                  type={showCurrent ? "text" : "password"}
                  label="Current Password"
                  error={!!passwordErrors.currentPassword}
                  helperText={passwordErrors.currentPassword?.message}
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowCurrent((v) => !v)} edge="end" size="small">
                          {showCurrent ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  {...registerPassword("newPassword")}
                  fullWidth
                  type={showNew ? "text" : "password"}
                  label="New Password"
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                  sx={{ mb: 2 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowNew((v) => !v)} edge="end" size="small">
                          {showNew ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  {...registerPassword("confirmPassword")}
                  fullWidth
                  type={showConfirm ? "text" : "password"}
                  label="Confirm New Password"
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword?.message}
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end" size="small">
                          {showConfirm ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button type="submit" variant="contained" disabled={updatePasswordMutation.isPending}>
                    {updatePasswordMutation.isPending ? "Changing..." : "Change Password"}
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
