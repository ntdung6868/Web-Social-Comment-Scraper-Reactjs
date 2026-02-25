import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { useLanguageStore } from "@/stores/language.store";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { authService } from "@/services/auth.service";
import { formatDateVi } from "@/utils/helpers";

const passwordSchema = (t: (key: string) => string) =>
  z
    .object({
      currentPassword: z.string().min(1, t("profile.currentPasswordRequired")),
      newPassword: z.string().min(8, t("auth.passwordTooShort")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const isPaid = user?.planType === "PERSONAL" || user?.planType === "PREMIUM";
  const planLabel =
    user?.planType === "PREMIUM" ? t("header.premiumPlan") : user?.planType === "PERSONAL" ? t("header.personalPlan") : t("header.freePlan");

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema(t)),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword, confirmPassword }: PasswordFormData) =>
      authService.changePassword(currentPassword, newPassword, confirmPassword),
    onSuccess: () => {
      resetPassword();
      setPasswordError(null);
      toast.success(t("profile.passwordChangedSuccess"));
    },
    onError: (error: any) => {
      const msg: string =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        t("profile.changePasswordFailed");
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
          {t("profile.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.subtitle")}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Profile Card */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: "100%",
              textAlign: "center",
              bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
              boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
              border: (theme) => theme.palette.mode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <Box
              sx={{
                height: 100,
                background: (theme) => theme.palette.mode === "dark"
                  ? "linear-gradient(135deg, #1a237e 0%, #0d1542 100%)"
                  : "linear-gradient(135deg, #5c6bc0 0%, #3f51b5 100%)",
              }}
            />
            <CardContent sx={{ mt: -6, pt: 0 }}>
              <Avatar
                sx={{
                  width: 90,
                  height: 90,
                  border: (theme) => theme.palette.mode === "dark"
                    ? "4px solid #1e293b"
                    : "4px solid #ffffff",
                  boxShadow: (theme) => theme.palette.mode === "dark"
                    ? "0 4px 12px rgba(0,0,0,0.4)"
                    : "0 4px 12px rgba(0,0,0,0.15)",
                  bgcolor: "primary.main",
                  fontSize: "2.2rem",
                  fontWeight: 600,
                  mx: "auto",
                  mb: 1.5,
                }}
              >
                {user.username?.charAt(0).toUpperCase()}
              </Avatar>

              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {user.email}
              </Typography>

              <Chip
                icon={isPaid ? <StarIcon style={{ fontSize: 14 }} /> : undefined}
                label={planLabel}
                size="small"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  px: 1,
                  bgcolor: (theme) => theme.palette.mode === "dark"
                    ? (isPaid ? "rgba(156, 39, 176, 0.2)" : "rgba(255,255,255,0.08)")
                    : (isPaid ? "rgba(156, 39, 176, 0.1)" : "rgba(0,0,0,0.04)"),
                  color: (theme) => theme.palette.mode === "dark"
                    ? (isPaid ? "#ce93d8" : "rgba(255,255,255,0.7)")
                    : (isPaid ? "#7b1fa2" : "rgba(0,0,0,0.6)"),
                  borderColor: (theme) => theme.palette.mode === "dark"
                    ? (isPaid ? "rgba(156, 39, 176, 0.4)" : "rgba(255,255,255,0.15)")
                    : (isPaid ? "rgba(156, 39, 176, 0.3)" : "rgba(0,0,0,0.12)"),
                  ...(isPaid && { variant: "outlined" as const }),
                }}
              />

              <Divider sx={{ my: 2.5 }} />

              <Box sx={{ textAlign: "left", px: 1 }}>
                {/* Member Since */}
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 500 }}>
                    {t("profile.memberSince")}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CalendarIcon fontSize="small" sx={{ color: "text.secondary", opacity: 0.7 }} />
                    <Typography variant="body2" fontWeight={500} sx={{ color: "text.primary" }}>
                      {language === "vi" ? formatDateVi(user.createdAt) : user.createdAt ? format(new Date(user.createdAt), "MMMM dd, yyyy") : "-"}
                    </Typography>
                  </Box>
                </Box>

                {/* Subscription Status */}
                <Box
                  sx={{
                    mb: isPaid && user.subscriptionEnd ? 2 : 0,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 500 }}>
                    {t("profile.subscriptionStatus")}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SecurityIcon
                      fontSize="small"
                      sx={{
                        color: isPaid
                          ? (theme) => theme.palette.mode === "dark" ? "#81c784" : "#2e7d32"
                          : "text.secondary",
                        opacity: isPaid ? 1 : 0.7,
                      }}
                    />
                    <Typography variant="body2" fontWeight={500} sx={{ color: isPaid ? (theme) => theme.palette.mode === "dark" ? "#e8f5e9" : "#1b5e20" : "text.primary" }}>
                      {user.planStatus === "ACTIVE" ? t("dashboard.active") : t("dashboard.inactive")} ({planLabel})
                    </Typography>
                  </Box>
                </Box>

                {/* Expires On */}
                {isPaid && user.subscriptionEnd && (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (theme) => {
                        const isExpired = user.subscriptionEnd ? new Date(user.subscriptionEnd) < new Date() : false;
                        return theme.palette.mode === "dark"
                          ? (isExpired ? "rgba(244, 67, 54, 0.08)" : "rgba(255, 167, 38, 0.08)")
                          : (isExpired ? "rgba(244, 67, 54, 0.05)" : "rgba(255, 167, 38, 0.05)");
                      },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 500 }}>
                      {t("profile.expiresOn")}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <ExpireIcon
                        fontSize="small"
                        sx={{
                          color: user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()
                            ? (theme) => theme.palette.mode === "dark" ? "#ef5350" : "#c62828"
                            : (theme) => theme.palette.mode === "dark" ? "#ffb74d" : "#f57c00",
                        }}
                      />
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          color: user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()
                            ? (theme) => theme.palette.mode === "dark" ? "#ef9a9a" : "#c62828"
                            : (theme) => theme.palette.mode === "dark" ? "#ffe0b2" : "#f57c00",
                        }}
                      >
                        {language === "vi" ? formatDateVi(user.subscriptionEnd) : user.subscriptionEnd ? format(new Date(user.subscriptionEnd), "MMMM dd, yyyy") : "-"}
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
          <Card
            sx={{
              mb: 3,
              bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
              boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
              border: (theme) => theme.palette.mode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                {t("profile.accountInformation")}
              </Typography>

              <TextField
                fullWidth
                label={t("common.username")}
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
                label={t("common.email")}
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
          <Card
            sx={{
              bgcolor: (theme) => theme.palette.mode === "dark" ? "background.paper" : "#ffffff",
              boxShadow: (theme) => theme.palette.mode === "dark" ? "none" : "0 4px 20px rgba(0,0,0,0.08)",
              border: (theme) => theme.palette.mode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                {t("profile.changePasswordSection")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t("profile.passwordRestriction")}
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
                  label={t("auth.currentPassword")}
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
                  label={t("auth.newPassword")}
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
                  label={t("auth.confirmNewPassword")}
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
                    {updatePasswordMutation.isPending ? t("auth.changingPassword") : t("profile.changePasswordButton")}
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
