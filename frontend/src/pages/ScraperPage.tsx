import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  LinearProgress,
  Chip,
  alpha,
  IconButton,
  Tooltip,
  Collapse,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
} from "@mui/material";
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Terminal as TerminalIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  WarningAmber as WarningIcon,
} from "@mui/icons-material";
import { scraperService } from "@/services/scraper.service";
import { useScrapeStore } from "@/stores/scrape.store";
import { useAuthStore } from "@/stores/auth.store";
import { cancelScrape } from "@/lib/socket";
import { useSocket } from "@/hooks/useSocket";
import { queryClient, queryKeys } from "@/lib/query-client";
import toast from "react-hot-toast";
import type {
  ScrapeStartedEvent,
  ScrapeProgress,
  ScrapeCompletedEvent,
  ScrapeFailedEvent,
  QueuePositionEvent,
} from "@/types";

// Schema needs static strings for validation, will be handled in component
const scrapeSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (url) =>
        url.includes("tiktok.com") ||
        url.includes("facebook.com") ||
        url.includes("fb.watch") ||
        url.includes("fb.com"),
    ),
});

type ScrapeFormData = z.infer<typeof scrapeSchema>;

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "progress" | "success" | "error" | "queue";
  message: string;
}

interface CompletedScrape {
  historyId: string;
  totalComments: number;
  duration: number;
  platform: string;
  url: string;
}

// i18n keys emitted by the backend instead of hardcoded strings
const CAPTCHA_KEY = "captcha_detected_msg";

export default function ScraperPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [completedScrape, setCompletedScrape] = useState<CompletedScrape | null>(null);
  const exportingRef = useRef(false);
  const logIdCounter = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { activeScrapes, scrapeProgress, addScrape, updateScrape, updateProgress, removeScrape } = useScrapeStore();

  // Reconcile stale active scrapes on mount — check their real status
  // (handles case where user navigated away, scrape completed, then came back)
  useEffect(() => {
    const staleJobs = Array.from(activeScrapes.values()).filter(
      (s) => s.status === "PENDING" || s.status === "RUNNING",
    );
    if (staleJobs.length === 0) return;

    staleJobs.forEach(async (job) => {
      try {
        const res = await scraperService.getJobStatus(job.id);
        const status = res.data?.history?.status;
        if (status === "SUCCESS") {
          updateScrape(job.id, { status: "SUCCESS", totalComments: res.data!.history.totalComments });
          setCompletedScrape({
            historyId: job.id,
            totalComments: res.data!.history.totalComments,
            duration: 0,
            platform: job.platform,
            url: job.url,
          });
          setTimeout(() => removeScrape(job.id), 5000);
        } else if (status === "FAILED") {
          updateScrape(job.id, { status: "FAILED", errorMessage: res.data!.history.errorMessage });
          setTimeout(() => removeScrape(job.id), 5000);
        }
        // If still RUNNING/PENDING, leave it — socket will update
      } catch {
        // API error — remove stale entry
        removeScrape(job.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => {
      const newLogs = [...prev, { id: ++logIdCounter.current, timestamp: new Date(), type, message }];
      // Keep last 100 logs
      return newLogs.slice(-100);
    });
  }, []);

  // Wire socket events to store and logs
  useSocket(undefined, {
    onStarted: useCallback(
      (data: ScrapeStartedEvent) => {
        addScrape({
          id: data.historyId,
          userId: "",
          platform: data.platform as "TIKTOK" | "FACEBOOK",
          url: data.url,
          totalComments: 0,
          status: "RUNNING",
          errorMessage: null,
          createdAt: new Date().toISOString(),
          commentCount: 0,
        });
        addLog("info", `🚀 Scrape #${data.historyId} started — ${data.platform} — ${data.url}`);
      },
      [addScrape, addLog],
    ),
    onProgress: useCallback(
      (data: ScrapeProgress) => {
        updateProgress(data);
        // Translate known i18n keys emitted by the backend (e.g. captcha detection)
        const displayMessage = data.message === CAPTCHA_KEY ? t(`scraper.${CAPTCHA_KEY}`) : data.message;
        addLog(
          data.message === CAPTCHA_KEY ? "error" : "progress",
          `${data.message === CAPTCHA_KEY ? "🔒" : "📊"} #${data.historyId} — ${displayMessage}${data.message === CAPTCHA_KEY ? "" : ` (${data.commentsFound} comments, ${data.progress}%)`}`,
        );
      },
      [updateProgress, addLog, t],
    ),
    onCompleted: useCallback(
      (data: ScrapeCompletedEvent) => {
        updateScrape(data.historyId, { status: "SUCCESS", totalComments: data.totalComments });
        addLog(
          "success",
          `✅ #${data.historyId} completed — ${data.totalComments} comments in ${Math.round(data.duration / 1000)}s`,
        );
        toast.success(t("scraper.scrapeCompletedToast", { count: data.totalComments }));

        // Show download dialog with scrape details
        const scrapeJob = useScrapeStore.getState().activeScrapes.get(data.historyId);
        setCompletedScrape({
          historyId: data.historyId,
          totalComments: data.totalComments,
          duration: data.duration,
          platform: scrapeJob?.platform || "Unknown",
          url: scrapeJob?.url || "",
        });

        // Auto-remove from active after 5 seconds
        setTimeout(() => removeScrape(data.historyId), 5000);

        // Refresh dashboard & history
        queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
        // Silently refresh user info (updates trialUses counter on dashboard)
        useAuthStore.getState().refreshUser();
      },
      [updateScrape, addLog, removeScrape],
    ),
    onFailed: useCallback(
      (data: ScrapeFailedEvent) => {
        updateScrape(data.historyId, { status: "FAILED", errorMessage: data.error });

        const isCaptcha = data.error === CAPTCHA_KEY;

        if (isCaptcha) {
          const captchaMsg = t(`scraper.${CAPTCHA_KEY}`);
          addLog("error", `🔒 #${data.historyId} — ${captchaMsg}`);
          if (isAdmin) {
            addLog("info", t("scraper.captcha_admin_note_desc"));
          }

          // Rich captcha toast — persists 12 s so user can read it
          toast.custom(
            (toastObj) => (
              <div
                style={{
                  background: "#1e1e1e",
                  color: "#fff",
                  borderLeft: "4px solid #f44336",
                  borderRadius: 8,
                  padding: "12px 16px",
                  maxWidth: 400,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  opacity: toastObj.visible ? 1 : 0,
                  transition: "opacity 0.3s",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6, color: "#f44336" }}>
                  {t("scraper.captchaToastTitle")}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 10 }}>{captchaMsg}</div>
                {isAdmin && (
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>
                    {t("scraper.captcha_admin_note_desc")}
                  </div>
                )}
                <button
                  onClick={() => {
                    toast.dismiss(toastObj.id);
                    navigate("/guide");
                  }}
                  style={{
                    background: "#f44336",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {t("scraper.captchaGoToGuide")}
                </button>
              </div>
            ),
            { duration: 12000 },
          );
        } else {
          addLog("error", `❌ #${data.historyId} failed — ${data.error}${data.retryable ? " (retryable)" : ""}`);
          toast.error(t("scraper.scrapeFailedToast", { error: data.error }));
        }

        // Auto-remove from active after 8 seconds
        setTimeout(() => removeScrape(data.historyId), 8000);

        // Refresh dashboard stats & user info
        queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
        useAuthStore.getState().refreshUser();
      },
      [updateScrape, addLog, removeScrape, t, isAdmin, navigate],
    ),
    onQueuePosition: useCallback(
      (data: QueuePositionEvent) => {
        addLog("queue", `⏳ #${data.historyId} — Queue position: ${data.position} (est. wait: ${data.estimatedWait}s)`);
      },
      [addLog],
    ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScrapeFormData>({
    resolver: zodResolver(scrapeSchema),
    defaultValues: {
      url: "",
    },
  });

  const startScrapeMutation = useMutation({
    mutationFn: scraperService.startScrape,
    onSuccess: (response) => {
      const { historyId, queuePosition, isPaid } = response.data!;
      // NOTE: Don't call subscribeToScrape here — useSocket(undefined) already
      // listens on the user room which receives all events for this user.
      // Subscribing to the scrape room would cause duplicate events.

      // Optimistically add to active scrapes so the card shows immediately
      // (don't rely solely on socket scrape:started which may arrive later)
      const urlValue = document.querySelector<HTMLInputElement>('input[name="url"]')?.value || "";
      const platform = urlValue.includes("tiktok.com") ? "TIKTOK" : "FACEBOOK";
      addScrape({
        id: String(historyId),
        userId: "",
        platform: platform as "TIKTOK" | "FACEBOOK",
        url: urlValue,
        totalComments: 0,
        status: "PENDING",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        commentCount: 0,
      });

      addLog(
        "info",
        isPaid
          ? `🚀 Scrape job started — ID: ${historyId}`
          : `📨 Scrape job submitted — ID: ${historyId}, Queue Position: ${queuePosition}`,
      );
      toast.success(isPaid ? t("scraper.scrapeStartedSuccess") : t("scraper.scrapeStartedQueue", { position: queuePosition }));
      reset();
      setError(null);

      queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
      // Silently refresh user info — trialUses decremented on job creation
      useAuthStore.getState().refreshUser();
    },
    onError: (err: any) => {
      const errorMessage =
        err.response?.data?.error?.message || err.response?.data?.message || err.message || "Failed to start scrape";

      console.error("Scrape Error:", err);
      setError(errorMessage);
      addLog("error", `❌ Failed to start scrape: ${errorMessage}`);
    },
  });

  const resetMutation = useMutation({
    mutationFn: scraperService.resetScraper,
    onSuccess: (response) => {
      const { dbRecordsFixed = 0, queueJobsCleared = 0 } = response.data ?? {};
      // Clear all active entries from the local store so the UI unlocks immediately
      useScrapeStore.getState().clearAllScrapes();
      setError(null);
      toast.success(t("scraper.resetScraperSuccess"));
      addLog("info", `🔄 Reset complete — ${dbRecordsFixed} DB record(s) fixed, ${queueJobsCleared} queue slot(s) cleared`);
      queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
    },
    onError: () => {
      toast.error(t("scraper.resetScraperError"));
    },
  });

  const handleReset = () => {
    if (window.confirm(t("scraper.resetScraperConfirm"))) {
      resetMutation.mutate();
    }
  };

  const onSubmit = (data: ScrapeFormData) => {
    startScrapeMutation.mutate(data);
  };

  const handleCancel = (historyId: string) => {
    cancelScrape(historyId);
    addLog("info", `🚫 Cancel requested for scrape #${historyId}`);
  };

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    if (!completedScrape || exportingRef.current) return;
    exportingRef.current = true;
    try {
      const blob = await scraperService.exportComments(completedScrape.historyId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const time = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
      a.download = `comments-${completedScrape.platform}-${time}.${format}`;
      a.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      toast.success(t("scraper.downloadedAs", { format: format.toUpperCase() }));
    } catch (err) {
      console.error("Export failed:", err);
      toast.error(t("scraper.exportFailed"));
    } finally {
      exportingRef.current = false;
    }
  };

  const activeJobs = Array.from(activeScrapes.values()).filter((s) => s.status === "PENDING" || s.status === "RUNNING");

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return "#66bb6a";
      case "error":
        return "#ef5350";
      case "progress":
        return "#42a5f5";
      case "queue":
        return "#ffa726";
      default:
        return "#b0bec5";
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t("scraper.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("scraper.subtitle")}
        </Typography>
      </Box>

      {/* Scrape Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3 }}
              onClose={() => setError(null)}
              action={
                error.toLowerCase().includes("already") || error.toLowerCase().includes("running") ? (
                  <Tooltip title={t("scraper.resetScraperTooltip")}>
                    <Button
                      color="warning"
                      size="small"
                      variant="outlined"
                      startIcon={<WarningIcon />}
                      onClick={handleReset}
                      disabled={resetMutation.isPending}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {resetMutation.isPending ? "..." : t("scraper.resetScraperButton")}
                    </Button>
                  </Tooltip>
                ) : undefined
              }
            >
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <TextField
                {...register("url")}
                fullWidth
                label={t("scraper.postUrl")}
                placeholder={t("scraper.enterUrlPlaceholder")}
                error={!!errors.url}
                helperText={errors.url ? t("errors.validUrl") : ""}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }}/>,
                }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<PlayIcon />}
                disabled={startScrapeMutation.isPending}
                sx={{ height: 56, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {startScrapeMutation.isPending ? t("scraper.starting") : t("scraper.startScraping")}
              </Button>
            </Box>
          </form>

          {/* Supported platforms */}
          <Box sx={{ mt: 3, display: "flex", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t("scraper.supported")}
            </Typography>
            <Chip label={t("scraper.tiktok")} size="small" color="primary" variant="outlined" />
            <Chip label={t("scraper.facebook")} size="small" color="primary" variant="outlined" />
          </Box>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              {t("scraper.activeScrapes")}
            </Typography>

            {activeJobs.map((job) => {
              const progress = scrapeProgress.get(job.id);
              return (
                <Box
                  key={job.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.05),
                    border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-all", flex: 1, mr: 1 }}>
                      {job.url}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Chip label={job.status} size="small" color={job.status === "RUNNING" ? "primary" : "default"} />
                      {job.status === "PENDING" && (
                        <Tooltip title={t("scraper.cancelScrape")}>
                          <IconButton size="small" onClick={() => handleCancel(job.id)} color="error">
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </Box>

                  <LinearProgress
                    variant={
                      job.status === "RUNNING" && (progress?.progress ?? 0) > 0 ? "determinate" : "indeterminate"
                    }
                    value={progress?.progress ?? 0}
                    sx={{ mb: 1, height: 8, borderRadius: 4 }}
                  />

                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">
                      {progress?.message || (job.status === "PENDING" ? t("scraper.waitingInQueue") : t("scraper.initializing"))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {progress?.commentsFound ?? 0} {t("dashboard.comments")}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Live Log Console */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 2,
              borderBottom: showLogs ? 1 : 0,
              borderColor: "divider",
              cursor: "pointer",
            }}
            onClick={() => setShowLogs(!showLogs)}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TerminalIcon fontSize="small" />
              <Typography variant="h6" fontWeight={600}>
                {t("scraper.logs")}
              </Typography>
              <Chip label={logs.length} size="small" variant="outlined" />
            </Box>
            <IconButton size="small">{showLogs ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
          </Box>

          <Collapse in={showLogs}>
            <Paper
              ref={logContainerRef}
              sx={{
                maxHeight: 300,
                overflow: "auto",
                backgroundColor: "#1a1a2e",
                borderRadius: 0,
                p: 2,
              }}
            >
              {logs.length === 0 ? (
                <Typography variant="body2" sx={{ color: "#666", fontFamily: "monospace" }}>
                  {t("scraper.waitingForEvents")}
                </Typography>
              ) : (
                logs.map((log) => (
                  <Box key={log.id} sx={{ mb: 0.5, display: "flex", gap: 1.5 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: "#666", fontFamily: "monospace", whiteSpace: "nowrap", minWidth: 60 }}
                    >
                      {log.timestamp.toLocaleTimeString()}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: getLogColor(log.type), fontFamily: "monospace", wordBreak: "break-all" }}
                    >
                      {log.message}
                    </Typography>
                  </Box>
                ))
              )}
            </Paper>
          </Collapse>
        </CardContent>
      </Card>

      {/* Download Dialog — shown when a scrape completes */}
      <Dialog
        open={!!completedScrape}
        onClose={() => setCompletedScrape(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            backgroundImage: "none",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            pb: 1,
          }}
        >
          <CheckCircleIcon color="success" fontSize="large" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={700}>
              {t("scraper.scrapingComplete")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {completedScrape?.totalComments} {t("dashboard.comments")} · {completedScrape ? Math.round(completedScrape.duration / 1000) : 0}s
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setCompletedScrape(null)} sx={{ alignSelf: "flex-start" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.08),
              border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            }}
          >
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {completedScrape?.platform} &middot; Scrape #{completedScrape?.historyId}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {completedScrape?.url}
            </Typography>
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            {t("scraper.downloadResults")}
          </Typography>
          <Stack spacing={1.5}>
            <Button
              variant="contained"
              color="success"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={() => handleExport("xlsx")}
              size="large"
            >
              {t("scraper.downloadExcel")}
            </Button>
            <Button variant="outlined" fullWidth startIcon={<DownloadIcon />} onClick={() => handleExport("csv")}>
              {t("scraper.downloadCSV")}
            </Button>
            <Button variant="outlined" fullWidth startIcon={<DownloadIcon />} onClick={() => handleExport("json")}>
              {t("scraper.downloadJSON")}
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompletedScrape(null)} color="inherit">
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
