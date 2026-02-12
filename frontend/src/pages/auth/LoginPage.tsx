import { useState } from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
const loginSchema = z.object({
  email: z.string().min(1, "Username or Email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Chỉ lấy hàm login và isLoading, bỏ setUser (vì không còn mock)
  const { login, isLoading } = useAuthStore();

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError(null);
      setBanReason(null);
      await login(data.email, data.password, data.rememberMe);
      navigate(from, { replace: true });
    } catch (err: any) {
      const respData = err?.response?.data;
      const code = respData?.error?.code;
      const message =
        respData?.error?.message || respData?.message || err?.message || "Login failed. Please check your credentials.";
      if (code === "USER_BANNED") {
        const reason = message.replace(/^Account is banned:\s*/i, "") || "No reason provided";
        setBanReason(reason);
      } else {
        setError(message);
      }
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
              Sign in to continue to your account
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
                Account Banned
              </Typography>
              <Typography variant="body2">Reason: {banReason}</Typography>
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
              label="Username or Email"
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
              label="Password"
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
                    Remember me
                  </Typography>
                }
              />
              <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ textDecoration: "none" }}>
                Forgot password?
              </Link>
            </Box>

            <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading} sx={{ mb: 3 }}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Register Link */}
          <Typography variant="body2" align="center" color="text.secondary">
            Don&apos;t have an account?{" "}
            <Link component={RouterLink} to="/register" sx={{ textDecoration: "none", fontWeight: 600 }}>
              Sign up
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
