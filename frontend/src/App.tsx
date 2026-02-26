import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { Toaster, toast } from "react-hot-toast";
import { RouterProvider } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getTheme } from "@/theme";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth.store";
import { useThemeStore } from "@/stores/theme.store";
import router from "./routes";

function App() {
  const { t } = useTranslation();
  const { checkAuth } = useAuthStore();
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === "dark";

  // Check authentication status on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Apply dark/light class to root element
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  // Global rate limit error handler
  useEffect(() => {
    const handleRateLimitError = (event: Event) => {
      const customEvent = event as CustomEvent;
      toast.error(customEvent.detail?.message || t("errors.tooManyRequests"));
    };

    window.addEventListener("rate-limit-error", handleRateLimitError);
    return () => window.removeEventListener("rate-limit-error", handleRateLimitError);
  }, [t]);

  // Global session revoked handler (admin revoked session mid-session)
  useEffect(() => {
    const handleSessionRevoked = () => {
      toast.error(
        "Phiên đăng nhập của bạn đã bị quản trị viên thu hồi. Vui lòng đăng nhập lại.",
        { duration: 6000 },
      );
    };

    window.addEventListener("session-revoked", handleSessionRevoked);
    return () => window.removeEventListener("session-revoked", handleSessionRevoked);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={getTheme(isDark)}>
        <CssBaseline />
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: isDark ? "#1a1a2e" : "#ffffff",
              color: isDark ? "#fff" : "#000",
              borderRadius: "12px",
              border: isDark
                ? "1px solid rgba(255, 255, 255, 0.1)"
                : "1px solid rgba(0, 0, 0, 0.1)",
            },
            success: {
              iconTheme: {
                primary: "#66bb6a",
                secondary: "#fff",
              },
            },
            error: {
              iconTheme: {
                primary: "#f44336",
                secondary: "#fff",
              },
            },
          }}
        />
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
