import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  FormHelperText,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ExpandMore as ExpandMoreIcon,
  VideoLibrary as VideoLibraryIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  SmartToy as AIIcon,
  Article as ArticleIcon,
} from "@mui/icons-material";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth.store";
import { channelService } from "@/services/channel.service";
import { getSocket } from "@/lib/socket";
import type {
  ChannelVideo,
  VideoScriptResult,
  ChannelCrawlProgressEvent,
  ChannelCrawlCompletedEvent,
  ChannelCrawlFailedEvent,
  ChannelExtractProgressEvent,
  ChannelExtractCompletedEvent,
  ChannelExtractFailedEvent,
} from "@/types/channel.types";

// ===========================================
// Log Types
// ===========================================

interface LogEntry {
  id: number;
  type: "info" | "success" | "error" | "progress";
  message: string;
  time: string;
}

// ===========================================
// Main Page Component
// ===========================================

export default function ChannelCrawlPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.user?.isAdmin ?? false);

  // Stepper
  const [step, setStep] = useState(0);

  // Step 1 — Crawl Form
  const [channelUrl, setChannelUrl] = useState("");
  const [minViews, setMinViews] = useState(0);
  const [maxVideos, setMaxVideos] = useState(100);
  const [urlError, setUrlError] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlJobId, setCrawlJobId] = useState<string | null>(null);
  const crawlJobIdRef = useRef<string | null>(null);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [crawlMessage, setCrawlMessage] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  // Step 2 — Video Selection
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractMessage, setExtractMessage] = useState("");

  // Step 3 — Scripts
  const [scripts, setScripts] = useState<VideoScriptResult[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const id = ++logIdRef.current;
    const time = new Date().toLocaleTimeString("vi-VN");
    setLogs((prev) => [...prev.slice(-99), { id, type, message, time }]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCrawlProgress = (data: ChannelCrawlProgressEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      setCrawlMessage(data.message);
      setCrawlProgress((prev) => Math.min(90, prev + 10));
      addLog("progress", `[Crawl] ${data.message} (${data.videosFound} video)`);
    };

    const onCrawlCompleted = (data: ChannelCrawlCompletedEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      setCrawlProgress(100);
      setCrawlMessage(data.message);
      setIsCrawling(false);
      addLog("success", `✅ ${data.message}`);
      const jobId = crawlJobIdRef.current;
      if (jobId) {
        channelService.getVideos(jobId).then((res) => {
          setVideos(res.data ?? []);
          setStep(1);
        });
      }
    };

    const onCrawlFailed = (data: ChannelCrawlFailedEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      setIsCrawling(false);
      const isCaptcha = data.error === "captcha_detected_msg";
      const captchaMsg = t("scraper.captcha_detected_msg");
      const errMsg = isCaptcha ? captchaMsg : data.error;
      setCrawlMessage(errMsg);
      addLog("error", `❌ ${errMsg}`);

      if (isCaptcha) {
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
        toast.error(errMsg, { duration: 6000 });
      }
    };

    const onExtractProgress = (data: ChannelExtractProgressEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      const pct = Math.round((data.processed / data.total) * 100);
      setExtractProgress(pct);
      setExtractMessage(data.message);
      addLog("progress", `[Extract] ${data.message}`);
    };

    const onExtractCompleted = (data: ChannelExtractCompletedEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      setExtractProgress(100);
      setExtractMessage(data.message);
      setIsExtracting(false);
      addLog("success", `✅ ${data.message}`);
      const jobId = crawlJobIdRef.current;
      if (jobId) {
        channelService.getScripts(jobId).then((res) => {
          setScripts(res.data ?? []);
          setStep(2);
        });
      }
    };

    const onExtractFailed = (data: ChannelExtractFailedEvent) => {
      if (data.crawlJobId !== crawlJobIdRef.current) return;
      setIsExtracting(false);
      setExtractMessage(`Lỗi: ${data.error}`);
      addLog("error", `❌ ${data.error}`);
    };

    socket.on("channel:crawl:progress", onCrawlProgress);
    socket.on("channel:crawl:completed", onCrawlCompleted);
    socket.on("channel:crawl:failed", onCrawlFailed);
    socket.on("channel:extract:progress", onExtractProgress);
    socket.on("channel:extract:completed", onExtractCompleted);
    socket.on("channel:extract:failed", onExtractFailed);

    return () => {
      socket.off("channel:crawl:progress", onCrawlProgress);
      socket.off("channel:crawl:completed", onCrawlCompleted);
      socket.off("channel:crawl:failed", onCrawlFailed);
      socket.off("channel:extract:progress", onExtractProgress);
      socket.off("channel:extract:completed", onExtractCompleted);
      socket.off("channel:extract:failed", onExtractFailed);
    };
  }, [addLog]);

  // ===========================================
  // Handlers
  // ===========================================

  const validateUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/?(\?.*)?$/;
    return pattern.test(url);
  };

  const handleStartCrawl = async () => {
    if (!validateUrl(channelUrl)) {
      setUrlError(t("channel.invalidChannelUrl", "URL kênh TikTok không hợp lệ (vd: https://www.tiktok.com/@username)"));
      return;
    }
    setUrlError("");
    setIsCrawling(true);
    setCrawlProgress(5);
    setLogs([]);
    addLog("info", `🚀 Bắt đầu crawl kênh: ${channelUrl}`);
    addLog("info", `⚙️ Min views: ${minViews.toLocaleString()} | Max videos: ${maxVideos}`);

    try {
      const res = await channelService.startCrawl({ channelUrl, minViews, maxVideos });
      const jobId = res.data?.crawlJobId;
      if (jobId) {
        crawlJobIdRef.current = jobId;
        setCrawlJobId(jobId);
        addLog("info", `📋 Job ID: ${jobId}`);
        setCrawlMessage("Đang crawl kênh...");
      }
    } catch (err: unknown) {
      setIsCrawling(false);
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Lỗi không xác định";
      addLog("error", `❌ ${msg}`);
      setCrawlMessage(msg);
    }
  };

  const handleToggleVideo = (videoId: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(videoId) ? prev.filter((id) => id !== videoId) : prev.length < 20 ? [...prev, videoId] : prev,
    );
  };

  const handleSelectAll = () => {
    const filteredIds = videos.slice(0, 20).map((v) => v.id);
    setSelectedVideoIds((prev) => (prev.length === filteredIds.length ? [] : filteredIds));
  };

  const handleStartExtract = async () => {
    if (!crawlJobId || selectedVideoIds.length === 0) return;
    setIsExtracting(true);
    setExtractProgress(0);
    addLog("info", `🤖 Bắt đầu trích xuất ${selectedVideoIds.length} kịch bản...`);

    try {
      await channelService.startExtract(crawlJobId, { videoIds: selectedVideoIds });
      setExtractMessage("Đang trích xuất kịch bản...");
    } catch (err: unknown) {
      setIsExtracting(false);
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Lỗi không xác định";
      addLog("error", `❌ ${msg}`);
    }
  };

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    if (!crawlJobId) return;
    setIsExporting(true);
    try {
      const data = await channelService.exportScripts(crawlJobId, format);
      const url = URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `scripts-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // handle silently
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setStep(0);
    setCrawlJobId(null);
    setChannelUrl("");
    setMinViews(0);
    setMaxVideos(100);
    setVideos([]);
    setSelectedVideoIds([]);
    setScripts([]);
    setLogs([]);
    setIsCrawling(false);
    setIsExtracting(false);
    setCrawlProgress(0);
    setExtractProgress(0);
  };

  const formatViews = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
  };

  // ===========================================
  // Render
  // ===========================================

  const steps = [
    t("channel.step1", "Crawl kênh"),
    t("channel.step2", "Chọn video"),
    t("channel.step3", "Kịch bản & Xuất"),
  ];

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <VideoLibraryIcon sx={{ fontSize: 32, color: "primary.main" }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t("channel.title", "Crawl kênh TikTok")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("channel.subtitle", "Crawl danh sách video từ kênh → trích xuất kịch bản bằng Gemini AI")}
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 1: Crawl Form */}
      {step === 0 && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>
                {t("channel.crawlSettings", "Cài đặt crawl")}
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <TextField
                    fullWidth
                    label={t("channel.channelUrl", "URL kênh TikTok")}
                    placeholder="https://www.tiktok.com/@username"
                    value={channelUrl}
                    onChange={(e) => { setChannelUrl(e.target.value); setUrlError(""); }}
                    error={!!urlError}
                    disabled={isCrawling}
                  />
                  {urlError && <FormHelperText error>{urlError}</FormHelperText>}
                </Box>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    type="number"
                    label={t("channel.minViews", "Min views")}
                    value={minViews}
                    onChange={(e) => setMinViews(Math.max(0, parseInt(e.target.value) || 0))}
                    disabled={isCrawling}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 0 }}
                  />
                  <TextField
                    type="number"
                    label={t("channel.maxVideos", "Max videos")}
                    value={maxVideos}
                    onChange={(e) => setMaxVideos(Math.max(1, Math.min(500, parseInt(e.target.value) || 100)))}
                    disabled={isCrawling}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 1, max: 500 }}
                  />
                </Box>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleStartCrawl}
                  disabled={isCrawling || !channelUrl}
                  startIcon={isCrawling ? <CircularProgress size={16} color="inherit" /> : <VideoLibraryIcon />}
                >
                  {isCrawling ? t("channel.crawling", "Đang crawl...") : t("channel.startCrawl", "Bắt đầu crawl")}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Progress */}
          {isCrawling && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" mb={1}>{crawlMessage || "Đang xử lý..."}</Typography>
                <LinearProgress variant="determinate" value={crawlProgress} sx={{ mb: 1 }} />
                <Typography variant="caption" color="text.secondary">{crawlProgress}%</Typography>
              </CardContent>
            </Card>
          )}

          {/* Log Console */}
          {logs.length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: "#1a1a2e",
                maxHeight: 200,
                overflowY: "auto",
                fontFamily: "monospace",
                fontSize: "0.75rem",
              }}
            >
              {logs.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    mb: 0.3,
                  }}
                >
                  <Box component="span" sx={{ color: "#666", whiteSpace: "nowrap" }}>[{log.time}]</Box>
                  <Box
                    component="span"
                    sx={{
                      color: log.type === "error" ? "error.light" : log.type === "success" ? "success.light" : log.type === "progress" ? "info.light" : "#c8c8d4",
                      wordBreak: "break-all",
                    }}
                  >
                    {log.message}
                  </Box>
                </Box>
              ))}
              <div ref={logsEndRef} />
            </Paper>
          )}
        </Stack>
      )}

      {/* Step 2: Video Selection */}
      {step === 1 && (
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="h6">
                {t("channel.selectVideos", "Chọn video để trích xuất kịch bản")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("channel.selectedCount", "Đã chọn {{count}}/{{max}} video (tối đa 20)", {
                  count: selectedVideoIds.length,
                  max: Math.min(videos.length, 20),
                })}
              </Typography>
            </Box>
            <Chip
              label={`${videos.length} ${t("channel.videosFound", "video tìm thấy")}`}
              color="primary"
              variant="outlined"
            />
          </Box>

          <Card>
            <Box sx={{ maxHeight: 450, overflowY: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow
                    sx={{
                      "& th": {
                        fontWeight: 700,
                        backgroundColor: (theme) => theme.palette.background.paper,
                        borderBottom: "2px solid",
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selectedVideoIds.length > 0 && selectedVideoIds.length < Math.min(videos.length, 20)}
                        checked={selectedVideoIds.length === Math.min(videos.length, 20) && videos.length > 0}
                        onChange={handleSelectAll}
                      />
                    </TableCell>
                    <TableCell>{t("channel.description", "Mô tả")}</TableCell>
                    <TableCell align="right">{t("channel.views", "Views")}</TableCell>
                    <TableCell align="right">{t("channel.likes", "Likes")}</TableCell>
                    <TableCell>{t("channel.postDate", "Ngày đăng")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {videos.map((video) => (
                    <TableRow
                      key={video.id}
                      hover
                      selected={selectedVideoIds.includes(video.id)}
                      onClick={() => handleToggleVideo(video.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox checked={selectedVideoIds.includes(video.id)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 350 }}>
                          {video.description || t("channel.noDescription", "(Không có mô tả)")}
                        </Typography>
                        <Typography variant="caption" color="primary.main" component="a" href={video.videoUrl} target="_blank" onClick={(e) => e.stopPropagation()}>
                          {video.videoUrl.slice(0, 50)}...
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600}>{formatViews(video.views)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{formatViews(video.likes)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {video.postDate ? new Date(video.postDate).toLocaleDateString("vi-VN") : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>

          {/* Extract Progress */}
          {isExtracting && (
            <Card>
              <CardContent>
                <Typography variant="subtitle2" mb={1}>{extractMessage}</Typography>
                <LinearProgress variant="determinate" value={extractProgress} />
              </CardContent>
            </Card>
          )}

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="outlined" onClick={() => setStep(0)} disabled={isExtracting}>
              {t("common.back", "Quay lại")}
            </Button>
            <Button
              variant="contained"
              onClick={handleStartExtract}
              disabled={selectedVideoIds.length === 0 || isExtracting}
              startIcon={isExtracting ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
            >
              {isExtracting
                ? t("channel.extracting", "Đang trích xuất...")
                : t("channel.extractScripts", { count: selectedVideoIds.length })}
            </Button>
          </Box>
        </Stack>
      )}

      {/* Step 3: Scripts & Export */}
      {step === 2 && (
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="h6">
              {t("channel.scripts", "Kịch bản")} ({scripts.length})
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport("xlsx")}
                disabled={isExporting}
              >
                XLSX
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport("csv")}
                disabled={isExporting}
              >
                CSV
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport("json")}
                disabled={isExporting}
              >
                JSON
              </Button>
            </Stack>
          </Box>

          {scripts.map((sr) => (
            <Accordion key={sr.id} variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, mr: 2, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {sr.video.description || sr.video.videoUrl}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
                    <Chip
                      size="small"
                      label={formatViews(sr.video.views) + " views"}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      icon={sr.sourceMethod === "GEMINI_API" ? <AIIcon fontSize="small" /> : <ArticleIcon fontSize="small" />}
                      label={sr.sourceMethod === "GEMINI_API" ? "Gemini AI" : "Fallback"}
                      color={sr.sourceMethod === "GEMINI_API" ? "success" : "default"}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Divider sx={{ mb: 2 }} />
                <Typography
                  variant="body2"
                  component="pre"
                  sx={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.8 }}
                >
                  {sr.scriptText || t("channel.noScript", "(Không có kịch bản)")}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}

          {scripts.length === 0 && (
            <Alert severity="info">{t("channel.noScriptsYet", "Chưa có kịch bản nào được trích xuất")}</Alert>
          )}

          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleReset}>
            {t("channel.crawlNew", "Crawl kênh mới")}
          </Button>
        </Stack>
      )}
    </Box>
  );
}
