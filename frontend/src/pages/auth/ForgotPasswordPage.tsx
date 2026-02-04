import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
  Alert,
  alpha,
} from "@mui/material";
import {
  Email as EmailIcon,
  Search as SearchIcon,
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { authService } from "@/services/auth.service";
import { AxiosError } from "axios";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);
      setError(null);
      await authService.forgotPassword(data.email);
      setIsSuccess(true);
    } catch (err) {
      const axiosError = err as AxiosError<{ error: string }>;
      setError(axiosError.response?.data?.error || "Failed to send reset email. Please try again.");
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
              {isSuccess ? "Check your email" : "Reset your password"}
            </Typography>
          </Box>

          {isSuccess ? (
            // Success state
            <Box sx={{ textAlign: "center" }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  backgroundColor: (theme) => alpha(theme.palette.success.main, 0.1),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mx: "auto",
                  mb: 2,
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 32, color: "success.main" }} />
              </Box>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We&apos;ve sent a password reset link to your email address. Please check your inbox.
              </Typography>
              <Button component={RouterLink} to="/login" startIcon={<ArrowBackIcon />} fullWidth variant="outlined">
                Back to Login
              </Button>
            </Box>
          ) : (
            // Form state
            <>
              {/* Error Alert */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Enter your email address and we&apos;ll send you a link to reset your password.
              </Typography>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <TextField
                  {...register("email")}
                  fullWidth
                  label="Email"
                  type="email"
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />

                <Button type="submit" fullWidth variant="contained" size="large" disabled={isLoading} sx={{ mb: 2 }}>
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>

                <Button component={RouterLink} to="/login" fullWidth variant="text" startIcon={<ArrowBackIcon />}>
                  Back to Login
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
