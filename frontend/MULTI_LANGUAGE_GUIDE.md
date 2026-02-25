# Multi-Language Support Implementation

## Overview
The application now supports multiple languages (English and Vietnamese) with a language switcher component integrated into the header.

## Features

### 1. **Language Support**
- **English (en)** - Default language
- **Vietnamese (vi)** - Alternative language
- Automatic language detection based on browser settings
- Language preference persisted in localStorage

### 2. **Translation Files**
Translation files are located in `src/locales/`:
- `en.json` - English translations
- `vi.json` - Vietnamese translations

Each file is organized by sections:
- `common` - Common UI elements (buttons, labels)
- `nav` - Navigation items
- `header` - Header-specific text
- `sidebar` - Sidebar-specific text
- `auth` - Authentication-related text
- `errors` - Error messages

### 3. **Language Switcher Component**
A new `LanguageSwitcher` component is available at:
```
src/components/common/LanguageSwitcher.tsx
```

Features:
- Located in the header next to the theme toggle
- Shows current language with flag emoji
- Dropdown menu with language options
- Theme-aware styling (supports light/dark modes)

### 4. **i18n Configuration**
The i18next configuration is set up in:
```
src/i18n/config.ts
```

This handles:
- Language initialization
- Resource loading
- Locale detection

### 5. **Language Store**
A Zustand store manages language state:
```
src/stores/language.store.ts
```

This provides:
- `useLanguageStore()` hook
- `language` - Current language
- `setLanguage(language)` - Function to change language

## Usage

### Using Translations in Components

```typescript
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("common.dashboard")}</h1>
      <button>{t("common.logout")}</button>
    </div>
  );
}
```

### Key Translation Keys

**Common Keys:**
- `common.dashboard` - Dashboard
- `common.scraper` - Scraper
- `common.history` - History
- `common.settings` - Settings
- `common.profile` - Profile
- `common.logout` - Logout
- `common.notifications` - Notifications
- `common.account` - Account

**Navigation Keys:**
- `nav.dashboard` - Dashboard
- `nav.scraper` - Scraper
- `nav.history` - History
- `nav.settings` - Settings
- `nav.guide` - Guide
- `nav.pricing` - Pricing
- `nav.admin` - Admin Dashboard
- `nav.adminUsers` - User Management
- `nav.adminLogs` - System Logs
- `nav.adminSessions` - Sessions
- `nav.adminSettings` - System Settings

**Header Keys:**
- `header.systemHealthy` - System Healthy
- `header.systemDegraded` - System Degraded
- `header.systemDown` - System Down
- `header.premiumPlan` - Premium
- `header.personalPlan` - Personal
- `header.freePlan` - Free Plan

## Integration Points

### Header (`src/layouts/Header.tsx`)
- Menu, Notifications, and Profile icons use translated tooltips
- Profile menu items (Settings, Profile, Logout) are translated
- Health status labels are translated
- Plan labels are translated

### Sidebar (`src/layouts/Sidebar.tsx`)
- All navigation items are dynamically translated
- Admin items are translated
- Logout button tooltip is translated
- Plan labels are translated

### Main App (`src/main.tsx`)
- i18n is initialized on app startup
- Must be imported before app rendering

## Adding New Languages

To add a new language:

1. Create a new translation file in `src/locales/` (e.g., `fr.json`)
2. Add the language resource in `src/i18n/config.ts`:
   ```typescript
   import frTranslations from "@/locales/fr.json";

   resources: {
     en: { translation: enTranslations },
     vi: { translation: viTranslations },
     fr: { translation: frTranslations }, // Add this
   }
   ```
3. Update `LanguageSwitcher.tsx` to include the new language option:
   ```typescript
   <MenuItem
     onClick={() => handleSelectLanguage("fr")}
     selected={language === "fr"}
   >
     <ListItemIcon sx={{ mr: 1 }}>
       <span style={{ fontSize: "1.2rem" }}>🇫🇷</span>
     </ListItemIcon>
     <Typography variant="body2">Français</Typography>
   </MenuItem>
   ```

## Adding New Translation Keys

1. Add the key to both `src/locales/en.json` and `src/locales/vi.json`:
   ```json
   {
     "newSection": {
       "newKey": "English text"
     }
   }
   ```

2. Use the key in components:
   ```typescript
   t("newSection.newKey")
   ```

## Styling Consistency

The language switcher follows the same design pattern as other header components:
- Theme-aware colors (dark mode: light text, light mode: dark text)
- Hover effects matching the theme
- Consistent tooltip positioning
- Flag emojis for visual language identification

## Storage

- Language preference is stored in `localStorage` under the key `app-language`
- Theme preference is stored under `app-theme`
- Both are synced with Zustand stores for reactive state management

## Browser Compatibility

- Supports all modern browsers with localStorage API
- Falls back to English if browser language is not supported
- System language preference is detected automatically on first visit
