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
} from "@mui/material";
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Star as StarIcon,
  CalendarToday as CalendarIcon,
  VerifiedUser as SecurityIcon,
} from "@mui/icons-material";
import { userService } from "@/services/user.service";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { authService } from "@/services/auth.service";

// 1. Sửa Schema: Username thay vì Name
const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
});

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

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);

  // Logic hiển thị gói cước
  const isPaid = user?.planType === "PERSONAL" || user?.planType === "PREMIUM";
  const planLabel =
    user?.planType === "PREMIUM" ? "Premium" : user?.planType === "PERSONAL" ? "Personal" : "Free Member";
  const planColor = user?.planType === "PREMIUM" ? "secondary" : isPaid ? "primary" : "default";

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: userService.updateProfile,
    onSuccess: (response) => {
      // Backend trả về user object đã update
      updateUser(response.data?.user || (response as any).user);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
      confirmPassword,
    }: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }) => authService.changePassword(currentPassword, newPassword, confirmPassword),
    onSuccess: () => {
      resetPassword();
      toast.success("Password changed successfully");
    },
    onError: () => {
      toast.error("Failed to change password");
    },
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormData) => {
    updatePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });
  };

  if (!user) return null;

  return (
    <Box>
      {/* Header */}
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
            <Box
              sx={{
                height: 120,
                background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              }}
            />
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

              {/* HIỂN THỊ USERNAME THẬT */}
              <Typography variant="h5" fontWeight={700}>
                {user.username}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user.email}
              </Typography>

              <Chip
                icon={isPaid ? <StarIcon style={{ fontSize: 16 }} /> : undefined}
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

                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Subscription Status
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <SecurityIcon fontSize="small" color={isPaid ? "success" : "action"} />
                    <Typography variant="body2" fontWeight={500} color={isPaid ? "success.main" : "text.primary"}>
                      {/* HIỂN THỊ TRẠNG THÁI GÓI CƯỚC THẬT */}
                      {user.planStatus === "ACTIVE" ? "Active" : "Inactive"} ({planLabel})
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Edit Forms */}
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>
                  Edit Profile
                </Typography>
                <Button
                  variant={isEditing ? "contained" : "outlined"}
                  startIcon={isEditing ? <SaveIcon /> : <EditIcon />}
                  onClick={() => {
                    if (isEditing) {
                      handleProfileSubmit(onProfileSubmit)();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  disabled={updateProfileMutation.isPending}
                >
                  {isEditing ? "Save" : "Edit"}
                </Button>
              </Box>

              <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
                <TextField
                  {...registerProfile("username")}
                  fullWidth
                  label="Username"
                  disabled={!isEditing}
                  error={!!profileErrors.username}
                  helperText={profileErrors.username?.message}
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
                  helperText="Email cannot be changed"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mb: 3 }}>
                Change Password
              </Typography>

              <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                <TextField
                  {...registerPassword("currentPassword")}
                  fullWidth
                  type="password"
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
                  }}
                />

                <TextField
                  {...registerPassword("newPassword")}
                  fullWidth
                  type="password"
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
                  }}
                />

                <TextField
                  {...registerPassword("confirmPassword")}
                  fullWidth
                  type="password"
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
