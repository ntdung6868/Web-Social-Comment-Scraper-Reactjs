# Quick Reference: Adding Translations to New Pages

## Step-by-Step Guide

### 1. Define Translation Keys in JSON Files

**File: `src/locales/en.json`**
```json
{
  "yourPage": {
    "title": "Page Title",
    "subtitle": "Page description",
    "buttonLabel": "Click me",
    "inputPlaceholder": "Enter text here",
    "errorMessage": "Something went wrong",
    "successMessage": "Operation successful"
  }
}
```

**File: `src/locales/vi.json`** (Same structure, Vietnamese text)
```json
{
  "yourPage": {
    "title": "Tiêu đề trang",
    "subtitle": "Mô tả trang",
    "buttonLabel": "Nhấp vào tôi",
    "inputPlaceholder": "Nhập văn bản ở đây",
    "errorMessage": "Có lỗi xảy ra",
    "successMessage": "Hoạt động thành công"
  }
}
```

### 2. Import useTranslation in Your Component

```typescript
import { useTranslation } from "react-i18next";

export default function YourPage() {
  const { t } = useTranslation();

  // Now use t() to access translations
}
```

### 3. Replace Hardcoded Strings

**Before:**
```typescript
<Typography>{user?.username}</Typography>
<Button>Save Settings</Button>
<TextField placeholder="Enter email" />
<Alert>{error}</Alert>
```

**After:**
```typescript
<Typography>{t("profile.username")}</Typography>
<Button>{t("common.save")}</Button>
<TextField placeholder={t("profile.emailPlaceholder")} />
<Alert>{t("errors.errorMessage")}</Alert>
```

### 4. Handle Dynamic Strings

**Status Labels:**
```typescript
// Translate dynamic status values
<Chip label={t(`status.${jobStatus.toLowerCase()}`)} />
```

**Plurals/Counts:**
```typescript
// Use template strings for counts
<Typography>
  {t("dashboard.trialScrapes")}: {remaining} / {max}
</Typography>
```

**Conditional Translations:**
```typescript
<Typography>
  {isPaid
    ? t("header.premiumPlan")
    : t("header.freePlan")}
</Typography>
```

## Common Translation Categories

### Form-Related
```
"formSection": {
  "label": "Label text",
  "placeholder": "Placeholder text",
  "required": "This field is required",
  "error": "Validation error message",
  "success": "Form submitted successfully"
}
```

### Button Labels
```
"buttons": {
  "save": "Save",
  "cancel": "Cancel",
  "submit": "Submit",
  "delete": "Delete",
  "edit": "Edit",
  "close": "Close"
}
```

### Messages
```
"messages": {
  "loading": "Loading...",
  "error": "Error occurred",
  "success": "Operation successful",
  "noData": "No data available",
  "confirmation": "Are you sure?"
}
```

### Status Values
```
"status": {
  "success": "Success",
  "failed": "Failed",
  "pending": "Pending",
  "running": "Running",
  "completed": "Completed"
}
```

## Complete Example: ScraperPage

**Add to `en.json`:**
```json
{
  "scraper": {
    "title": "Web Scraper",
    "subtitle": "Extract comments from TikTok and Facebook",
    "enterUrl": "Enter URL",
    "enterUrlPlaceholder": "https://www.tiktok.com/@username/video/...",
    "startScraping": "Start Scraping",
    "cancel": "Cancel",
    "scraping": "Scraping in progress",
    "logs": "Logs",
    "scrapingComplete": "Scraping complete!",
    "totalComments": "Total Comments",
    "duration": "Duration",
    "platform": "Platform",
    "exportCsv": "Export as CSV",
    "exportJson": "Export as JSON",
    "error": "Error occurred during scraping",
    "invalidUrl": "Please enter a valid URL",
    "urlRequired": "URL is required"
  }
}
```

**Use in ScraperPage.tsx:**
```typescript
import { useTranslation } from "react-i18next";

export default function ScraperPage() {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h4">{t("scraper.title")}</Typography>
      <Typography variant="body1">{t("scraper.subtitle")}</Typography>

      <TextField
        placeholder={t("scraper.enterUrlPlaceholder")}
      />

      <Button>{t("scraper.startScraping")}</Button>

      {error && (
        <Alert severity="error">{t("scraper.error")}</Alert>
      )}

      {isLoading && (
        <Typography>{t("scraper.scraping")}</Typography>
      )}

      <Typography>{t("scraper.totalComments")}: {count}</Typography>

      <Button>{t("scraper.exportCsv")}</Button>
      <Button>{t("scraper.exportJson")}</Button>
    </Box>
  );
}
```

## Organizing Translation Keys

**Naming Convention:**
- Use camelCase for keys
- Organize by page/section
- Use descriptive names
- Group related items together

**Good Examples:**
```
dashboard.totalScrapes ✓
dashboard.successRate ✓
scraper.enterUrl ✓
settings.darkMode ✓
errors.invalidEmail ✓

total_scrapes ✗ (use camelCase)
welcomeMessage ✗ (unclear section)
error_msg ✗ (should be organized by section)
```

## Tips for Maintainability

1. **Keep translations close to usage** - Define in the relevant section
2. **Reuse common translations** - Use `common.` keys for repeated strings
3. **Be consistent** - Use same terminology across all translations
4. **Test both languages** - Always verify translations in both languages
5. **Document complex keys** - Add comments for non-obvious translations
6. **Keep similar length** - Translations should be similar length to avoid UI breaking

## Common Pitfalls to Avoid

❌ **Hardcoding strings mixed with translations**
```typescript
<Typography>{t("page.title")} - Dashboard</Typography>
```

✅ **All text is translated**
```typescript
<Typography>{t("dashboard.titleWithDash")}</Typography>
```

❌ **Creating new store for language** (already exists)
```typescript
import { useLanguageStore } from "@/stores/myLanguageStore"; // Wrong!
```

✅ **Using existing i18next hook**
```typescript
const { t } = useTranslation(); // Correct!
```

## Debugging Translation Issues

If translations aren't showing:

1. Check if `useTranslation()` is imported
2. Verify translation key exists in both `en.json` and `vi.json`
3. Check for typos in translation keys (case-sensitive!)
4. Ensure i18n is initialized in `src/main.tsx`
5. Check browser console for i18next warnings

## Performance Considerations

- ✅ `useTranslation()` hook is optimized
- ✅ Components only re-render when language changes
- ✅ Translation objects are cached
- ✅ No performance penalty for using translations

## Testing Translations

```typescript
// Test component renders correctly in both languages
test("Dashboard shows translated text", async () => {
  render(<DashboardPage />);

  // English (default)
  expect(screen.getByText("Welcome back")).toBeInTheDocument();

  // Switch to Vietnamese
  setLanguage("vi");
  expect(screen.getByText("Chào mừng trở lại")).toBeInTheDocument();
});
```
