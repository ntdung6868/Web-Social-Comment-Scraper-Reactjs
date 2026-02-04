import { createTheme, alpha } from "@mui/material/styles";

// Define custom colors
const primaryMain = "#5c6bc0"; // Indigo 400
const secondaryMain = "#42a5f5"; // Blue 400
const backgroundDefault = "#0f0f0f";
const backgroundPaper = "#1a1a2e";
const surfaceColor = "#16213e";

// Create the dark theme
const theme = createTheme({
  palette: {
    mode: "dark",
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
      contrastText: "#000000",
    },
    background: {
      default: backgroundDefault,
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
      primary: "#ffffff",
      secondary: "rgba(255, 255, 255, 0.7)",
      disabled: "rgba(255, 255, 255, 0.5)",
    },
    divider: "rgba(255, 255, 255, 0.12)",
    action: {
      active: "#ffffff",
      hover: "rgba(255, 255, 255, 0.08)",
      selected: "rgba(255, 255, 255, 0.16)",
      disabled: "rgba(255, 255, 255, 0.3)",
      disabledBackground: "rgba(255, 255, 255, 0.12)",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: 1.5,
    },
    subtitle1: {
      fontSize: "1rem",
      fontWeight: 500,
      lineHeight: 1.75,
    },
    subtitle2: {
      fontSize: "0.875rem",
      fontWeight: 500,
      lineHeight: 1.57,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.43,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
    caption: {
      fontSize: "0.75rem",
      fontWeight: 400,
      lineHeight: 1.66,
    },
    overline: {
      fontSize: "0.75rem",
      fontWeight: 600,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
  },
  shape: {
    borderRadius: 12,
  },
  shadows: [
    "none",
    "0px 2px 4px rgba(0, 0, 0, 0.2)",
    "0px 4px 8px rgba(0, 0, 0, 0.2)",
    "0px 6px 12px rgba(0, 0, 0, 0.2)",
    "0px 8px 16px rgba(0, 0, 0, 0.2)",
    "0px 10px 20px rgba(0, 0, 0, 0.2)",
    "0px 12px 24px rgba(0, 0, 0, 0.2)",
    "0px 14px 28px rgba(0, 0, 0, 0.2)",
    "0px 16px 32px rgba(0, 0, 0, 0.2)",
    "0px 18px 36px rgba(0, 0, 0, 0.2)",
    "0px 20px 40px rgba(0, 0, 0, 0.2)",
    "0px 22px 44px rgba(0, 0, 0, 0.2)",
    "0px 24px 48px rgba(0, 0, 0, 0.2)",
    "0px 26px 52px rgba(0, 0, 0, 0.2)",
    "0px 28px 56px rgba(0, 0, 0, 0.2)",
    "0px 30px 60px rgba(0, 0, 0, 0.2)",
    "0px 32px 64px rgba(0, 0, 0, 0.2)",
    "0px 34px 68px rgba(0, 0, 0, 0.2)",
    "0px 36px 72px rgba(0, 0, 0, 0.2)",
    "0px 38px 76px rgba(0, 0, 0, 0.2)",
    "0px 40px 80px rgba(0, 0, 0, 0.2)",
    "0px 42px 84px rgba(0, 0, 0, 0.2)",
    "0px 44px 88px rgba(0, 0, 0, 0.2)",
    "0px 46px 92px rgba(0, 0, 0, 0.2)",
    "0px 48px 96px rgba(0, 0, 0, 0.2)",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${alpha(primaryMain, 0.5)} ${backgroundPaper}`,
          "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
            width: 8,
            height: 8,
          },
          "&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb": {
            borderRadius: 4,
            backgroundColor: alpha(primaryMain, 0.5),
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
          background: `linear-gradient(135deg, ${primaryMain} 0%, ${alpha(primaryMain, 0.8)} 100%)`,
          "&:hover": {
            background: `linear-gradient(135deg, ${alpha(primaryMain, 0.9)} 0%, ${alpha(primaryMain, 0.7)} 100%)`,
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${secondaryMain} 0%, ${alpha(secondaryMain, 0.8)} 100%)`,
          "&:hover": {
            background: `linear-gradient(135deg, ${alpha(secondaryMain, 0.9)} 0%, ${alpha(secondaryMain, 0.7)} 100%)`,
          },
        },
        outlined: {
          borderWidth: 2,
          "&:hover": {
            borderWidth: 2,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: surfaceColor,
          border: `1px solid ${alpha("#ffffff", 0.08)}`,
          borderRadius: 16,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.25)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: alpha(backgroundPaper, 0.95),
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${alpha("#ffffff", 0.08)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: backgroundPaper,
          borderRight: `1px solid ${alpha("#ffffff", 0.08)}`,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 4,
          "&.Mui-selected": {
            backgroundColor: alpha(primaryMain, 0.15),
            "&:hover": {
              backgroundColor: alpha(primaryMain, 0.2),
            },
          },
          "&:hover": {
            backgroundColor: alpha("#ffffff", 0.08),
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "& fieldset": {
              borderColor: alpha("#ffffff", 0.2),
            },
            "&:hover fieldset": {
              borderColor: alpha("#ffffff", 0.4),
            },
            "&.Mui-focused fieldset": {
              borderColor: primaryMain,
            },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "& fieldset": {
            borderColor: alpha("#ffffff", 0.2),
          },
          "&:hover fieldset": {
            borderColor: alpha("#ffffff", 0.4),
          },
          "&.Mui-focused fieldset": {
            borderColor: primaryMain,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        filled: {
          backgroundColor: alpha(primaryMain, 0.2),
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: alpha(backgroundPaper, 0.95),
          backdropFilter: "blur(10px)",
          border: `1px solid ${alpha("#ffffff", 0.1)}`,
          borderRadius: 8,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundColor: backgroundPaper,
          border: `1px solid ${alpha("#ffffff", 0.1)}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        standardSuccess: {
          backgroundColor: alpha("#66bb6a", 0.15),
          border: `1px solid ${alpha("#66bb6a", 0.3)}`,
        },
        standardError: {
          backgroundColor: alpha("#f44336", 0.15),
          border: `1px solid ${alpha("#f44336", 0.3)}`,
        },
        standardWarning: {
          backgroundColor: alpha("#ffa726", 0.15),
          border: `1px solid ${alpha("#ffa726", 0.3)}`,
        },
        standardInfo: {
          backgroundColor: alpha("#29b6f6", 0.15),
          border: `1px solid ${alpha("#29b6f6", 0.3)}`,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          backgroundColor: alpha(primaryMain, 0.2),
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha("#ffffff", 0.08)}`,
        },
        head: {
          fontWeight: 600,
          backgroundColor: alpha("#ffffff", 0.05),
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:hover": {
            backgroundColor: alpha("#ffffff", 0.05),
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: "3px 3px 0 0",
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          textTransform: "none",
          minWidth: 100,
        },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(primaryMain, 0.3),
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontSize: "0.65rem",
        },
      },
    },
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#ffffff", 0.1),
        },
      },
    },
  },
});

export default theme;
