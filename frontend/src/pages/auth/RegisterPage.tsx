import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  Alert,
  alpha,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";
import { AxiosError } from "axios";

// 1. Cập nhật Schema khớp với Backend (Username không dấu cách)
const registerSchema = (t: (key: string) => string) =>
  z
    .object({
      username: z
        .string()
        .min(3, t("auth.usernameTooShort"))
        .regex(/^[a-zA-Z0-9_]+$/, t("auth.usernameInvalid")),
      email: z.string().email(t("errors.invalidEmail")),
      password: z
        .string()
        .min(8, t("auth.passwordTooShort"))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("auth.passwordWeak"),
        ),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    });

type RegisterFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register: registerUser, isLoading } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema(t)),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError(null);
      // 2. Gửi đúng Username và thêm confirmPassword
      // Lưu ý: Bạn cần chắc chắn auth.store.ts đã cập nhật để nhận 4 tham số này
      await registerUser(data.username, data.email, data.password, data.confirmPassword);

      navigate("/dashboard", { replace: true });
    } catch (err) {
      const axiosError = err as AxiosError<{ error: { message: string } }>;
      // Backend trả về format: { error: { code, message } }
      const rawMessage = axiosError.response?.data?.error?.message || "";
      const statusCode = axiosError.response?.status;

      // Translate known error messages
      let translatedMessage = rawMessage;
      if (statusCode === 429 || rawMessage.includes("Too many requests")) {
        translatedMessage = t("errors.tooManyRequests");
      } else if (rawMessage.includes("Email is already registered") || rawMessage.includes("email_already_exists")) {
        translatedMessage = t("errors.emailAlreadyRegistered");
      } else if (rawMessage.includes("Username is already taken") || rawMessage.includes("username_already_exists")) {
        translatedMessage = t("errors.usernameAlreadyTaken");
      } else {
        translatedMessage = t("auth.registrationFailed");
      }

      setError(translatedMessage);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        p: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 440,
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
          backdropFilter: "blur(10px)",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 2,
              }}
            >
              <SearchIcon sx={{ fontSize: 40, color: "primary.main", mr: 1 }} />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #5c6bc0 0%, #42a5f5 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                CrawlComments
              </Typography>
            </Box>
            <Typography variant="body1" color="text.secondary">
              {t("auth.registerSubtitle")}
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Register Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* 3. Đổi input từ "Name" sang "Username" */}
            <TextField
              {...register("username")}
              fullWidth
              label={t("auth.username")}
              placeholder={t("auth.usernameExample")}
              error={!!errors.username}
              helperText={errors.username?.message}
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
              {...register("email")}
              fullWidth
              label={t("common.email")}
              type="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register("password")}
              fullWidth
              label={t("common.password")}
              type={showPassword ? "text" : "password"}
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              {...register("confirmPassword")}
              fullWidth
              label={t("common.confirmPassword")}
              type={showConfirmPassword ? "text" : "password"}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading} sx={{ mb: 3 }}>
              {isLoading ? t("auth.creatingAccount") : t("auth.createAccountButton")}
            </Button>
          </form>

          {/* Login Link */}
          <Typography variant="body2" align="center" color="text.secondary">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link component={RouterLink} to="/login" sx={{ textDecoration: "none", fontWeight: 600 }}>
              {t("auth.signIn")}
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
