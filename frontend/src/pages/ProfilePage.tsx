import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Grid,
  Chip,
  alpha,
} from "@mui/material";
import { Edit as EditIcon, Save as SaveIcon } from "@mui/icons-material";
import { userService } from "@/services/user.service";
import { useAuthStore } from "@/stores/auth.store";
import { queryKeys, queryClient } from "@/lib/query-client";
import toast from "react-hot-toast";
import { format } from "date-fns";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      ),
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

  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
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
      updateUser(response.data);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      userService.updateProfile({ currentPassword, newPassword }),
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
    });
  };

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
        {/* Profile Info Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 100,
                  height: 100,
                  mx: "auto",
                  mb: 2,
                  backgroundColor: "primary.main",
                  fontSize: "2.5rem",
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </Avatar>
              <Typography variant="h6" fontWeight={600}>
                {user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>
              <Chip label={user?.subscriptionPlan || "FREE"} color="primary" sx={{ mt: 1 }} />

              <Divider sx={{ my: 3 }} />

              <Box sx={{ textAlign: "left" }}>
                <Typography variant="caption" color="text.secondary">
                  Member Since
                </Typography>
                <Typography variant="body2" gutterBottom>
                  {user?.createdAt ? format(new Date(user.createdAt), "MMMM dd, yyyy") : "-"}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  Subscription Status
                </Typography>
                <Typography variant="body2">{user?.subscriptionStatus || "N/A"}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Edit Profile Card */}
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
                  {...registerProfile("name")}
                  fullWidth
                  label="Full Name"
                  disabled={!isEditing}
                  error={!!profileErrors.name}
                  helperText={profileErrors.name?.message}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  label="Email"
                  value={user?.email || ""}
                  disabled
                  helperText="Email cannot be changed"
                />
              </form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
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
                />

                <TextField
                  {...registerPassword("newPassword")}
                  fullWidth
                  type="password"
                  label="New Password"
                  error={!!passwordErrors.newPassword}
                  helperText={passwordErrors.newPassword?.message}
                  sx={{ mb: 2 }}
                />

                <TextField
                  {...registerPassword("confirmPassword")}
                  fullWidth
                  type="password"
                  label="Confirm New Password"
                  error={!!passwordErrors.confirmPassword}
                  helperText={passwordErrors.confirmPassword?.message}
                  sx={{ mb: 3 }}
                />

                <Button type="submit" variant="contained" disabled={updatePasswordMutation.isPending}>
                  {updatePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
