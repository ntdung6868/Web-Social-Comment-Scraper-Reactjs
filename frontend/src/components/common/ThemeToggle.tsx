import { IconButton, Tooltip } from "@mui/material";
import { Brightness7 as LightModeIcon, Brightness4 as DarkModeIcon } from "@mui/icons-material";
import { useThemeStore } from "@/stores/theme.store";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <Tooltip title={isDark ? "Light Mode" : "Dark Mode"}>
      <IconButton
        onClick={toggleTheme}
        sx={{
          color: (theme) => theme.palette.text.primary,
          transition: "all 0.3s ease",
          "&:hover": {
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.12)"
                : "rgba(0, 0, 0, 0.06)",
            transform: "scale(1.1)",
          },
        }}
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
