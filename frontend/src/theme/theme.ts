import { createTheme, alpha } from "@mui/material/styles";

// Define custom colors
const primaryMain = "#5c6bc0"; // Indigo 400
const secondaryMain = "#42a5f5"; // Blue 400

// Dark mode colors - using deep charcoal/navy (WCAG AA compliant)
const darkBackgroundDefault = "#121212"; // Deep charcoal instead of pure black
const darkBackgroundPaper = "#1e1e2e"; // Slightly lighter for paper surfaces
const darkSurfaceColor = "#2a2a3e"; // Elevated surface with better contrast

// Light mode colors - using soft whites to reduce eye strain
const lightBackgroundDefault = "#fafafa"; // Off-white background
const lightBackgroundPaper = "#f8f9fa"; // Subtle warm white
const lightSurfaceColor = "#ffffff"; // Pure white for elevated surfaces

const createThemeConfig = (isDark: boolean) => {
  const backgroundColor = isDark ? darkBackgroundDefault : lightBackgroundDefault;
  const backgroundPaper = isDark ? darkBackgroundPaper : lightBackgroundPaper;
  const surfaceColor = isDark ? darkSurfaceColor : lightSurfaceColor;
  // WCAG AA compliant contrast ratios: 4.5:1 for normal text, 3:1 for large text
  const textPrimary = isDark ? "#f5f5f5" : "#1a1a1a"; // Better contrast than pure white/black
  const textSecondary = isDark ? "rgba(255, 255, 255, 0.75)" : "rgba(0, 0, 0, 0.65)"; // Improved secondary text contrast
  const textMuted = isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.45)"; // Muted text for less important information
  const borderColor = isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)"; // More visible borders for dark mode
  const dividerColor = isDark ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.14)"; // Improved divider visibility

  return createTheme({
    palette: {
      mode: isDark ? "dark" : "light",
      primary: {
        main: primaryMain,
        light: "#8e99f3",
        dark: "#26418f",
        contrastText: "#ffffff",
      },
      secondary: {
        main: secondaryMain,
        light: "#80d6ff",
        dark: "#0077c2",
        contrastText: "#ffffff",
      },
      background: {
        default: backgroundColor,
        paper: backgroundPaper,
      },
      error: {
        main: "#f44336",
        light: "#e57373",
        dark: "#d32f2f",
      },
      warning: {
        main: "#ffa726",
        light: "#ffb74d",
        dark: "#f57c00",
      },
      info: {
        main: "#29b6f6",
        light: "#4fc3f7",
        dark: "#0288d1",
      },
      success: {
        main: "#66bb6a",
        light: "#81c784",
        dark: "#388e3c",
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
        disabled: isDark
          ? "rgba(255, 255, 255, 0.4)"
          : "rgba(0, 0, 0, 0.35)",
      },
      divider: dividerColor,
      action: {
        active: textPrimary,
        hover: isDark
          ? "rgba(255, 255, 255, 0.12)"
          : "rgba(0, 0, 0, 0.06)",
        selected: isDark
          ? "rgba(255, 255, 255, 0.2)"
          : "rgba(0, 0, 0, 0.1)",
        disabled: isDark
          ? "rgba(255, 255, 255, 0.35)"
          : "rgba(0, 0, 0, 0.35)",
        disabledBackground: isDark
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(0, 0, 0, 0.12)",
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: "2.5rem",
        fontWeight: 700,
        lineHeight: 1.2,
        color: textPrimary,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 600,
        lineHeight: 1.3,
        color: textPrimary,
      },
      h3: {
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1.3,
        color: textPrimary,
      },
      h4: {
        fontSize: "1.5rem",
        fontWeight: 600,
        lineHeight: 1.4,
        color: textPrimary,
      },
      h5: {
        fontSize: "1.25rem",
        fontWeight: 600,
        lineHeight: 1.4,
        color: textPrimary,
      },
      h6: {
        fontSize: "1rem",
        fontWeight: 600,
        lineHeight: 1.5,
        color: textPrimary,
      },
      subtitle1: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.75,
        color: textSecondary,
      },
      subtitle2: {
        fontSize: "0.875rem",
        fontWeight: 500,
        lineHeight: 1.57,
        color: textSecondary,
      },
      body1: {
        fontSize: "1rem",
        fontWeight: 400,
        lineHeight: 1.5,
        color: textPrimary,
      },
      body2: {
        fontSize: "0.875rem",
        fontWeight: 400,
        lineHeight: 1.43,
        color: textSecondary,
      },
      button: {
        fontWeight: 600,
        textTransform: "none",
      },
      caption: {
        fontSize: "0.75rem",
        fontWeight: 400,
        lineHeight: 1.66,
        color: textMuted,
      },
      overline: {
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: textMuted,
      },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: [
      "none",
      isDark
        ? "0px 2px 4px rgba(0, 0, 0, 0.3)"
        : "0px 2px 4px rgba(0, 0, 0, 0.08)",
      isDark
        ? "0px 4px 8px rgba(0, 0, 0, 0.3)"
        : "0px 4px 8px rgba(0, 0, 0, 0.08)",
      isDark
        ? "0px 6px 12px rgba(0, 0, 0, 0.35)"
        : "0px 6px 12px rgba(0, 0, 0, 0.1)",
      isDark
        ? "0px 8px 16px rgba(0, 0, 0, 0.35)"
        : "0px 8px 16px rgba(0, 0, 0, 0.1)",
      isDark
        ? "0px 10px 20px rgba(0, 0, 0, 0.4)"
        : "0px 10px 20px rgba(0, 0, 0, 0.12)",
      isDark
        ? "0px 12px 24px rgba(0, 0, 0, 0.4)"
        : "0px 12px 24px rgba(0, 0, 0, 0.12)",
      isDark
        ? "0px 14px 28px rgba(0, 0, 0, 0.4)"
        : "0px 14px 28px rgba(0, 0, 0, 0.12)",
      isDark
        ? "0px 16px 32px rgba(0, 0, 0, 0.45)"
        : "0px 16px 32px rgba(0, 0, 0, 0.14)",
      isDark
        ? "0px 18px 36px rgba(0, 0, 0, 0.45)"
        : "0px 18px 36px rgba(0, 0, 0, 0.14)",
      isDark
        ? "0px 20px 40px rgba(0, 0, 0, 0.45)"
        : "0px 20px 40px rgba(0, 0, 0, 0.14)",
      isDark
        ? "0px 22px 44px rgba(0, 0, 0, 0.5)"
        : "0px 22px 44px rgba(0, 0, 0, 0.16)",
      isDark
        ? "0px 24px 48px rgba(0, 0, 0, 0.5)"
        : "0px 24px 48px rgba(0, 0, 0, 0.16)",
      isDark
        ? "0px 26px 52px rgba(0, 0, 0, 0.5)"
        : "0px 26px 52px rgba(0, 0, 0, 0.16)",
      isDark
        ? "0px 28px 56px rgba(0, 0, 0, 0.5)"
        : "0px 28px 56px rgba(0, 0, 0, 0.16)",
      isDark
        ? "0px 30px 60px rgba(0, 0, 0, 0.55)"
        : "0px 30px 60px rgba(0, 0, 0, 0.18)",
      isDark
        ? "0px 32px 64px rgba(0, 0, 0, 0.55)"
        : "0px 32px 64px rgba(0, 0, 0, 0.18)",
      isDark
        ? "0px 34px 68px rgba(0, 0, 0, 0.55)"
        : "0px 34px 68px rgba(0, 0, 0, 0.18)",
      isDark
        ? "0px 36px 72px rgba(0, 0, 0, 0.55)"
        : "0px 36px 72px rgba(0, 0, 0, 0.18)",
      isDark
        ? "0px 38px 76px rgba(0, 0, 0, 0.6)"
        : "0px 38px 76px rgba(0, 0, 0, 0.2)",
      isDark
        ? "0px 40px 80px rgba(0, 0, 0, 0.6)"
        : "0px 40px 80px rgba(0, 0, 0, 0.2)",
      isDark
        ? "0px 42px 84px rgba(0, 0, 0, 0.6)"
        : "0px 42px 84px rgba(0, 0, 0, 0.2)",
      isDark
        ? "0px 44px 88px rgba(0, 0, 0, 0.65)"
        : "0px 44px 88px rgba(0, 0, 0, 0.2)",
      isDark
        ? "0px 46px 92px rgba(0, 0, 0, 0.65)"
        : "0px 46px 92px rgba(0, 0, 0, 0.22)",
      isDark
        ? "0px 48px 96px rgba(0, 0, 0, 0.65)"
        : "0px 48px 96px rgba(0, 0, 0, 0.22)",
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: `${alpha(primaryMain, 0.6)}${backgroundPaper}`,
            "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
              width: 8,
              height: 8,
            },
            "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
              borderRadius: 4,
              backgroundColor: alpha(primaryMain, 0.6),
            },
            "&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track": {
              backgroundColor: backgroundPaper,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: "10px 20px",
            fontWeight: 600,
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${primaryMain}0%, ${alpha(
              primaryMain,
              0.8
            )} 100%)`,
            color: "#ffffff",
            "&:hover": {
              background: `linear-gradient(135deg, ${alpha(
                primaryMain,
                0.9
              )} 0%, ${alpha(primaryMain, 0.7)} 100%)`,
            },
          },
          containedSecondary: {
            background: `linear-gradient(135deg, ${secondaryMain} 0%, ${alpha(
              secondaryMain,
              0.8
            )} 100%)`,
            color: "#ffffff",
            "&:hover": {
              background: `linear-gradient(135deg, ${alpha(
                secondaryMain,
                0.9
              )}0%, ${alpha(secondaryMain, 0.7)}100%)`,
            },
          },
          outlined: {
            borderWidth: 2,
            borderColor: borderColor,
            "&:hover": {
              borderWidth: 2,
              borderColor: primaryMain,
              backgroundColor: alpha(primaryMain, 0.08),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: surfaceColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 16,
            transition: "border-color 0.2s ease",
            "&:hover": {
              borderColor: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.18)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: surfaceColor,
          },
          elevation1: {
            boxShadow: isDark
              ? "0px 4px 20px rgba(0, 0, 0, 0.3)"
              : "0px 4px 20px rgba(0, 0, 0, 0.08)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: alpha(backgroundPaper, 0.95),
            backdropFilter: "blur(10px)",
            borderBottom: `1px solid ${dividerColor}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: backgroundPaper,
            borderRight: `1px solid ${borderColor}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            marginBottom: 4,
            transition: "background-color 0.2s ease, color 0.2s ease",
            color: textPrimary,
            "&.Mui-selected": {
              backgroundColor: alpha(primaryMain, 0.2),
              color: primaryMain,
              fontWeight: 600,
              "& .MuiListItemIcon-root": {
                color: primaryMain,
              },
              "& .MuiListItemText-primary": {
                color: primaryMain,
              },
              "&:hover": {
                backgroundColor: alpha(primaryMain, 0.25),
              },
            },
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(0, 0, 0, 0.06)",
            },
            "& .MuiListItemIcon-root": {
              color: textSecondary,
              transition: "color 0.2s ease",
            },
            "& .MuiListItemText-primary": {
              color: textPrimary,
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
              backgroundColor: isDark ? alpha("#ffffff", 0.05) : "transparent",
              transition: "background-color 0.2s ease, border-color 0.2s ease",
              "& fieldset": {
                borderColor: borderColor,
              },
              "&:hover fieldset": {
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.35)"
                  : "rgba(0, 0, 0, 0.3)",
              },
              "&.Mui-focused fieldset": {
                borderColor: primaryMain,
                borderWidth: 2,
              },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? alpha("#ffffff", 0.05) : "transparent",
            transition: "background-color 0.2s ease, border-color 0.2s ease",
            "& fieldset": {
              borderColor: borderColor,
            },
            "&:hover fieldset": {
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.35)"
                : "rgba(0, 0, 0, 0.3)",
            },
            "&.Mui-focused fieldset": {
              borderColor: primaryMain,
              borderWidth: 2,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
          filled: {
            backgroundColor: alpha(primaryMain, 0.2),
            color: textPrimary,
          },
          outlined: {
            borderColor: borderColor,
            color: textSecondary,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? "#2a2a3e" : "#1a1a1a",
            color: isDark ? "#f5f5f5" : "#ffffff",
            backdropFilter: "blur(10px)",
            border: `1px solid ${alpha(textPrimary, isDark ? 0.15 : 0.15)}`,
            borderRadius: 8,
            fontSize: "0.875rem",
            padding: "8px 12px",
            fontWeight: 500,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            backgroundColor: backgroundPaper,
            border: `1px solid ${borderColor}`,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500,
          },
          standardSuccess: {
            backgroundColor: alpha("#66bb6a", 0.15),
            border: `1px solid ${alpha("#66bb6a", 0.4)}`,
            color: isDark ? "#a8e6ad" : "#2e7d32",
          },
          standardError: {
            backgroundColor: alpha("#f44336", 0.15),
            border: `1px solid ${alpha("#f44336", 0.4)}`,
            color: isDark ? "#ef9a9a" : "#c62828",
          },
          standardWarning: {
            backgroundColor: alpha("#ffa726", 0.15),
            border: `1px solid ${alpha("#ffa726", 0.4)}`,
            color: isDark ? "#ffb74d" : "#e65100",
          },
          standardInfo: {
            backgroundColor: alpha("#29b6f6", 0.15),
            border: `1px solid ${alpha("#29b6f6", 0.4)}`,
            color: isDark ? "#80deea" : "#0277bd",
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: alpha(primaryMain, 0.15),
            height: 6,
          },
          bar: {
            borderRadius: 4,
            background: `linear-gradient(90deg, ${primaryMain} 0%, ${alpha(
              primaryMain,
              0.8
            )}100%)`,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${dividerColor}`,
            color: textPrimary,
          },
          head: {
            fontWeight: 600,
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.06)",
            color: textPrimary,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: "background-color 0.2s ease",
            "&:hover": {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.04)",
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: "3px 3px 0 0",
            backgroundColor: primaryMain,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            textTransform: "none",
            minWidth: 100,
            color: textSecondary,
            transition: "color 0.2s ease",
            "&.Mui-selected": {
              color: primaryMain,
            },
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: alpha(primaryMain, 0.9),
            color: "#ffffff",
            fontWeight: 700,
            fontSize: "1rem",
          },
        },
      },
      MuiBadge: {
        styleOverrides: {
          badge: {
            fontSize: "0.65rem",
            fontWeight: 600,
            backgroundColor: alpha("#f44336", 0.9),
            color: "#ffffff",
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(0, 0, 0, 0.12)",
          },
        },
      },
      MuiSvgIcon: {
        styleOverrides: {
          root: {
            // Để icon giữ màu từ parent, không override
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 40,
            transition: "color 0.2s ease",
            // Color is controlled by parent component (Sidebar ListItemButton)
          },
        },
      },
    },
  });
};

// Export a function to get theme based on mode
export const getTheme = (isDark: boolean = true) => {
  return createThemeConfig(isDark);
};

// Default export (dark theme for backward compatibility)
export default getTheme(true);
