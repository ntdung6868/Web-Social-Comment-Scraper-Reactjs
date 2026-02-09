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
} from "@mui/material";
import {
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Terminal as TerminalIcon,
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
  maxComments: z.number().min(10).max(10000).optional(),
});

type ScrapeFormData = z.infer<typeof scrapeSchema>;

interface LogEntry {
  id: number;
  timestamp: Date;
  type: "info" | "progress" | "success" | "error" | "queue";
  message: string;
}

export default function ScraperPage() {
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logIdCounter = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { activeScrapes, scrapeProgress, addScrape, updateScrape, updateProgress, removeScrape } = useScrapeStore();

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

        // Auto-remove from active after 5 seconds
        setTimeout(() => removeScrape(data.historyId), 5000);

        // Refresh dashboard & history
        queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
        // Refresh user info (updates trialUses counter on dashboard)
        useAuthStore.getState().checkAuth();
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
        useAuthStore.getState().checkAuth();
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

      addLog("info", `📨 Scrape job submitted — ID: ${historyId}, Queue Position: ${queuePosition}`);
      toast.success(`Scrape started! Position in queue: ${queuePosition}`);
      reset();
      setError(null);

      queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
      // Refresh user info — trialUses decremented on job creation
      useAuthStore.getState().checkAuth();
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
                helperText={errors.maxComments?.message || "Limit: 10 - 10,000"}
                sx={{ width: 200 }}
                inputProps={{ min: 10, max: 10000 }}
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
    </Box>
  );
}
