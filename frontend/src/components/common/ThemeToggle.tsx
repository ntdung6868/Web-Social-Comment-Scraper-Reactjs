import { IconButton, Tooltip } from "@mui/material";
import { Brightness7 as LightModeIcon, Brightness4 as DarkModeIcon } from "@mui/icons-material";
import { useThemeStore } from "@/stores/theme.store";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <Tooltip title={isDark ? "Light Mode" : "Dark Mode"}>
      <IconButton
        color="inherit"
        onClick={toggleTheme}
        sx={{
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "scale(1.1)",
          },
        }}
      >
        {isDark ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
}
