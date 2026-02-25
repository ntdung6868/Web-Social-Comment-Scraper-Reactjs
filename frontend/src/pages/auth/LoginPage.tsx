import { useState } from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
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
  Checkbox,
  FormControlLabel,
  Alert,
  alpha,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Search as SearchIcon,
  Block as BlockIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";

// Schema cho phép nhập Username hoặc Email
const loginSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().min(1, t("auth.usernameOrEmailRequired")),
    password: z.string().min(1, t("auth.passwordRequired")),
    rememberMe: z.boolean().optional(),
  });

type LoginFormData = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  // Chỉ lấy hàm login và isLoading, bỏ setUser (vì không còn mock)
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema(t)),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      setBanReason(null);
      await login(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    }catch (err: any) {
      const respData = err?.response?.data;
      const code: string | undefined = respData?.error?.code ?? respData?.code;
      const statusCode = err?.response?.status;
      const rawMessage: string =
        respData?.error?.message ??
        respData?.message ??
        err?.message ??
        "";

      // Translate known error messages
      let translatedMessage = rawMessage;
      if (statusCode === 429 || rawMessage.includes("Too many requests") || code === "RATE_LIMITED") {
        translatedMessage = t("errors.tooManyRequests");
      } else if (!rawMessage) {
        translatedMessage = t("auth.connectionError");
      }

      if (code === "USER_BANNED") {
        const reason = rawMessage.replace(/^Account is banned:\s*/i, "").trim() || t("auth.noReasonProvided");
        setBanReason(reason);
      } else if (!err?.response) {
        setError(t("auth.connectionError"));
      } else {
        setError(translatedMessage);
      }
    } finally {
      setIsLoading(false);
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
              {t("auth.loginSubtitle")}
            </Typography>
          </Box>

          {/* Error Alert */}
          {banReason && (
            <Alert
              severity="error"
              icon={<BlockIcon />}
              sx={{
                mb: 3,
                border: (theme) => `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.08),
              }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                {t("auth.accountBanned")}
              </Typography>
              <Typography variant="body2">{t("auth.reason")}: {banReason}</Typography>
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register("email")}
              fullWidth
              label={t("auth.usernameLabel")}
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
              sx={{ mb: 1 }}
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

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
              }}
            >
              <FormControlLabel
                control={<Checkbox {...register("rememberMe")} size="small" />}
                label={
                  <Typography variant="body2" color="text.secondary">
                    {t("auth.rememberMe")}
                  </Typography>
                }
              />
              <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ textDecoration: "none" }}>
                {t("auth.forgotPassword")}
              </Link>
            </Box>

            <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading} sx={{ mb: 3 }}>
              {isLoading ? t("auth.signing") : t("auth.signIn")}
            </Button>
          </form>

          {/* Register Link */}
          <Typography variant="body2" align="center" color="text.secondary">
            {t("auth.dontHaveAccount")}{" "}
            <Link component={RouterLink} to="/register" sx={{ textDecoration: "none", fontWeight: 600 }}>
              {t("auth.signUp")}
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
