import { IconButton, Menu, MenuItem, Tooltip, ListItemIcon, Typography } from "@mui/material";
import { Language as LanguageIcon } from "@mui/icons-material";
import { useState } from "react";
import { useLanguageStore } from "@/stores/language.store";

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelectLanguage = (lang: "en" | "vi") => {
    setLanguage(lang);
    handleClose();
  };

  const languageLabel = language === "en" ? "English" : "Tiếng Việt";

  return (
    <>
      <Tooltip title={languageLabel}>
        <IconButton
          onClick={handleOpen}
          sx={{
            color: (theme) => theme.palette.text.primary,
            "&:hover": {
              backgroundColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.06)",
            },
          }}
        >
          <LanguageIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 150,
            borderRadius: 2,
            boxShadow: "0px 10px 40px rgba(0, 0, 0, 0.3)",
          },
        }}
      >
        <MenuItem
          onClick={() => handleSelectLanguage("en")}
          selected={language === "en"}
        >
          <ListItemIcon sx={{ mr: 1 }}>
            <span style={{ fontSize: "1.2rem" }}>🇬🇧</span>
          </ListItemIcon>
          <Typography variant="body2">English</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => handleSelectLanguage("vi")}
          selected={language === "vi"}
        >
          <ListItemIcon sx={{ mr: 1 }}>
            <span style={{ fontSize: "1.2rem" }}>🇻🇳</span>
          </ListItemIcon>
          <Typography variant="body2">Tiếng Việt</Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
