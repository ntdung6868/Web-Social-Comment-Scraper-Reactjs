import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const scrapeSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (url) =>
        url.includes("tiktok.com") ||
        url.includes("facebook.com") ||
        url.includes("fb.watch") ||
        url.includes("fb.com"),
      "Only TikTok and Facebook URLs are supported",
    ),
  maxComments: z.number().min(10).max(50000).optional(),
});

type ScrapeFormData = z.infer<typeof scrapeSchema>;

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "progress" | "success" | "error" | "queue";
  message: string;
}

interface CompletedScrape {
  historyId: number;
  totalComments: number;
  duration: number;
  platform: string;
  url: string;
}

export default function ScraperPage() {
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
          userId: 0,
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
        addLog(
          "progress",
          `📊 #${data.historyId} — ${data.message} (${data.commentsFound} comments, ${data.progress}%)`,
        );
      },
      [updateProgress, addLog],
    ),
    onCompleted: useCallback(
      (data: ScrapeCompletedEvent) => {
        updateScrape(data.historyId, { status: "SUCCESS", totalComments: data.totalComments });
        addLog(
          "success",
          `✅ #${data.historyId} completed — ${data.totalComments} comments in ${Math.round(data.duration / 1000)}s`,
        );
        toast.success(`Scrape completed! ${data.totalComments} comments extracted.`);

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
        addLog("error", `❌ #${data.historyId} failed — ${data.error}${data.retryable ? " (retryable)" : ""}`);
        toast.error(`Scrape failed: ${data.error}`);

        // Auto-remove from active after 8 seconds
        setTimeout(() => removeScrape(data.historyId), 8000);

        // Refresh dashboard stats & user info
        queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
        useAuthStore.getState().refreshUser();
      },
      [updateScrape, addLog, removeScrape],
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
      maxComments: 500,
    },
  });

  const startScrapeMutation = useMutation({
    mutationFn: scraperService.startScrape,
    onSuccess: (response) => {
      const { historyId, queuePosition } = response.data!;
      // NOTE: Don't call subscribeToScrape here — useSocket(undefined) already
      // listens on the user room which receives all events for this user.
      // Subscribing to the scrape room would cause duplicate events.

      // Optimistically add to active scrapes so the card shows immediately
      // (don't rely solely on socket scrape:started which may arrive later)
      const urlValue = document.querySelector<HTMLInputElement>('input[name="url"]')?.value || "";
      const platform = urlValue.includes("tiktok.com") ? "TIKTOK" : "FACEBOOK";
      addScrape({
        id: historyId,
        userId: 0,
        platform: platform as "TIKTOK" | "FACEBOOK",
        url: urlValue,
        totalComments: 0,
        status: "PENDING",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        commentCount: 0,
      });

      addLog("info", `📨 Scrape job submitted — ID: ${historyId}, Queue Position: ${queuePosition}`);
      toast.success(`Scrape started! Position in queue: ${queuePosition}`);
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

  const onSubmit = (data: ScrapeFormData) => {
    startScrapeMutation.mutate(data);
  };

  const handleCancel = (historyId: number) => {
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
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed. Please try from History page.");
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
          Comment Scraper
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Enter a TikTok or Facebook post URL to extract comments
        </Typography>
      </Box>

      {/* Scrape Form */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              {...register("url")}
              fullWidth
              label="Post URL"
              placeholder="https://www.tiktok.com/@username/video/..."
              error={!!errors.url}
              helperText={errors.url?.message}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
              }}
            />

            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
              <TextField
                {...register("maxComments", { valueAsNumber: true })}
                type="number"
                label="Max Comments"
                error={!!errors.maxComments}
                helperText={errors.maxComments?.message || "Limit: 10 - 50,000"}
                sx={{ width: 200 }}
                inputProps={{ min: 10, max: 50000 }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<PlayIcon />}
                disabled={startScrapeMutation.isPending}
                sx={{ height: 56 }}
              >
                {startScrapeMutation.isPending ? "Starting..." : "Start Scrape"}
              </Button>
            </Box>
          </form>

          {/* Supported platforms */}
          <Box sx={{ mt: 3, display: "flex", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Supported:
            </Typography>
            <Chip label="TikTok" size="small" color="primary" variant="outlined" />
            <Chip label="Facebook" size="small" color="primary" variant="outlined" />
          </Box>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Active Scrapes
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
                        <Tooltip title="Cancel scrape">
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
                      {progress?.message || (job.status === "PENDING" ? "Waiting in queue..." : "Initializing...")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {progress?.commentsFound ?? 0} comments
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
                Live Logs
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
                  Waiting for scrape events...
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
              Scrape Completed!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {completedScrape?.totalComments} comments extracted in{" "}
              {completedScrape ? Math.round(completedScrape.duration / 1000) : 0}s
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
            Download Results
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
              Download Excel (.xlsx)
            </Button>
            <Button variant="outlined" fullWidth startIcon={<DownloadIcon />} onClick={() => handleExport("csv")}>
              Download CSV
            </Button>
            <Button variant="outlined" fullWidth startIcon={<DownloadIcon />} onClick={() => handleExport("json")}>
              Download JSON
            </Button>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompletedScrape(null)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
