import { useQuery } from "@tanstack/react-query";
import {
  Box, Grid, Card, CardContent, Typography, Skeleton, alpha, LinearProgress, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  People as PeopleIcon,
  PersonAdd as PersonAddIcon,
  Block as BanIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  CloudQueue as QueueIcon,
  CheckCircle as SuccessIcon,
  Error as FailedIcon,
  Comment as CommentIcon,
  Schedule as UptimeIcon,
  WorkspacePremium as ProIcon,
  PlayArrow as ActiveIcon,
  Wifi as WifiIcon,
  Computer as ComputerIcon,
  Timer as TimerIcon,
  TrendingUp as RevenueIcon,
  CalendarToday as TodayIcon,
  DateRange as MonthIcon,
  Payments as TotalRevenueIcon,
} from "@mui/icons-material";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import type { SystemHealth } from "@/types";

// ── Types ────────────────────────────────────────
interface RecentTransaction {
  id: string;
  orderCode: number;
  amount: number;
  planType: string;
  paidAt: string | null;
  userId: string;
  username: string;
}

interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    banned: number;
    newToday: number;
    newThisWeek: number;
  };
  subscriptions: {
    free: number;
    pro: number; // paid users (PERSONAL + PREMIUM)
    expired: number;
  };
  scraping: {
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    activeJobs: number;
    queuedJobs: number;
    totalComments: number;
    avgCompletionTime: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  revenue: {
    total: number;
    monthly: number;
    today: number;
    recentTransactions: RecentTransaction[];
  };
}

// ── Stat Card ────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, icon, color, loading }: StatCardProps) {
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, ${alpha(color, 0.03)} 100%)`,
        border: `1px solid ${alpha(color, 0.15)}`,
        transition: "transform 0.25s ease, box-shadow 0.25s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: (theme) => theme.shadows[6],
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={60} height={36} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ color, mt: 0.5, transition: "color 0.3s ease" }}>
                {typeof value === "number" ? value.toLocaleString() : value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: alpha(color, 0.1),
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Section Header ───────────────────────────────
function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
      {icon}
      <Typography variant="h6" fontWeight={600}>
        {title}
      </Typography>
    </Box>
  );
}

// ── Format Currency ──────────────────────────────
const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
function formatVND(amount: number): string {
  return vndFormatter.format(amount);
}

// ── Format Duration ──────────────────────────────
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatAvgTime(seconds: number): string {
  if (seconds <= 0) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ── Main Component ───────────────────────────────
export default function AdminDashboardPage() {
  const { t } = useTranslation();

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: () => apiRequest.get<{ success: boolean; data: SystemHealth }>("/admin/health"),
    refetchInterval: 30000,
  });

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => apiRequest.get<{ success: boolean; data: AdminDashboardStats }>("/admin/dashboard"),
    refetchInterval: 5000,
  });

  const { data: realtimeData } = useQuery({
    queryKey: ["admin", "realtime"],
    queryFn: () =>
      apiRequest.get<{
        success: boolean;
        data: {
          connectedUsers: number;
          connectedSockets: number;
          queueStats: { waiting: number; active: number; completed: number; failed: number; delayed: number };
        };
      }>("/admin/realtime"),
    refetchInterval: 3000,
  });

  const health = healthData?.data;
  const stats = dashboardData?.data;
  const realtime = realtimeData?.data;
  const loading = dashLoading;

  const healthColor = health?.status === "healthy" ? "#66bb6a" : health?.status === "degraded" ? "#ffa726" : "#f44336";

  const successRate =
    stats && stats.scraping.totalJobs > 0
      ? Math.round((stats.scraping.successfulJobs / stats.scraping.totalJobs) * 100)
      : 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {t("admin.dashboard")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t("admin.overview")}
        </Typography>
      </Box>

      {/* ── System Health ── */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 2,
              mb: 3,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: healthColor,
                  boxShadow: `0 0 8px ${healthColor}`,
                }}
              />
              <Typography variant="h6" fontWeight={600}>
                {t("admin.systemStatus")}{" "}
                <Typography component="span" sx={{ color: healthColor, fontWeight: 700 }}>
                  {health?.status?.toUpperCase() || t("admin.checking")}
                </Typography>
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<StorageIcon />}
                label={`${t("admin.database")}: ${health?.services?.database?.status || "..."}`}
                color={health?.services?.database?.status === "up" ? "success" : "error"}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<QueueIcon />}
                label={`${t("admin.redis")}: ${health?.services?.redis?.status || "..."}`}
                color={health?.services?.redis?.status === "up" ? "success" : "error"}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<SpeedIcon />}
                label={`${t("admin.scraperEngine")}: ${health?.services?.scraper?.status || "..."}`}
                color={health?.services?.scraper?.status === "up" ? "success" : "error"}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>

          <Grid container spacing={3}>
            {/* Memory */}
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("admin.memoryUsage")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="h6" fontWeight={600}>
                  {healthLoading ? "..." : `${health?.memory?.percentage ?? 0}%`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {healthLoading
                    ? "..."
                    : `(Used: ${((health?.memory?.used || 0) / 1024 / 1024).toFixed(0)} MB / Total: ${((health?.memory?.total || 0) / 1024 / 1024).toFixed(0)} MB)`}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={health?.memory?.percentage || 0}
                color={
                  (health?.memory?.percentage || 0) > 90
                    ? "error"
                    : (health?.memory?.percentage || 0) > 70
                      ? "warning"
                      : "primary"
                }
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Grid>

            {/* CPU */}
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("admin.cpuLoad")}
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {healthLoading ? "..." : `${stats?.system?.cpuUsage ?? 0}%`}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(stats?.system?.cpuUsage ?? 0, 100)}
                color={
                  (stats?.system?.cpuUsage ?? 0) > 90
                    ? "error"
                    : (stats?.system?.cpuUsage ?? 0) > 70
                      ? "warning"
                      : "primary"
                }
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Grid>

            {/* Uptime */}
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t("admin.uptime")}
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {healthLoading ? "..." : formatUptime(health?.uptime || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t("admin.sinceLastRestart")}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Real-Time Stats ── */}
      <SectionHeader title={t("admin.realTime")} icon={<WifiIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("admin.onlineUsers")}
            value={realtime?.connectedUsers ?? 0}
            icon={<PeopleIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("admin.connections")}
            value={realtime?.connectedSockets ?? 0}
            icon={<ComputerIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("admin.activeJobs")}
            value={realtime?.queueStats?.active ?? 0}
            icon={<ActiveIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title={t("admin.queuedJobs")}
            value={realtime?.queueStats?.waiting ?? 0}
            icon={<QueueIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={!realtime}
          />
        </Grid>
      </Grid>

      {/* ── Users Section ── */}
      <SectionHeader title={t("admin.users")} icon={<PeopleIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title={t("admin.totalUsers")}
            value={stats?.users?.total ?? 0}
            icon={<PeopleIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title={t("admin.active")}
            value={stats?.users?.active ?? 0}
            icon={<SuccessIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title={t("admin.banned")}
            value={stats?.users?.banned ?? 0}
            icon={<BanIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title={t("admin.newToday")}
            value={stats?.users?.newToday ?? 0}
            icon={<PersonAddIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title={t("admin.thisWeek")}
            value={stats?.users?.newThisWeek ?? 0}
            icon={<PersonAddIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Subscriptions Section ── */}
      <SectionHeader title={t("admin.subscriptions")} icon={<ProIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4}>
          <StatCard
            title={t("admin.freePlan")}
            value={stats?.subscriptions?.free ?? 0}
            icon={<PeopleIcon sx={{ color: "#78909c" }} />}
            color="#78909c"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            title={t("admin.paidPlans")}
            value={stats?.subscriptions?.pro ?? 0}
            icon={<ProIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            title={t("admin.expired")}
            value={stats?.subscriptions?.expired ?? 0}
            icon={<UptimeIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Scraping Section ── */}
      <SectionHeader title={t("admin.scraping")} icon={<CommentIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.totalJobs")}
            value={stats?.scraping?.totalJobs ?? 0}
            icon={<StorageIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.successful")}
            value={stats?.scraping?.successfulJobs ?? 0}
            subtitle={`${successRate}% rate`}
            icon={<SuccessIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.failed")}
            value={stats?.scraping?.failedJobs ?? 0}
            icon={<FailedIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.active")}
            value={stats?.scraping?.activeJobs ?? 0}
            icon={<ActiveIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.inQueue")}
            value={stats?.scraping?.queuedJobs ?? 0}
            icon={<QueueIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.totalComments")}
            value={stats?.scraping?.totalComments ?? 0}
            icon={<CommentIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title={t("admin.avgSpeed")}
            value={formatAvgTime(stats?.scraping?.avgCompletionTime ?? 0)}
            subtitle={t("admin.perJob")}
            icon={<TimerIcon sx={{ color: "#26a69a" }} />}
            color="#26a69a"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Revenue Section ── */}
      <SectionHeader title="Doanh thu" icon={<RevenueIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Doanh thu hôm nay"
            value={loading ? "..." : formatVND(stats?.revenue?.today ?? 0)}
            icon={<TodayIcon sx={{ color: "#26a69a" }} />}
            color="#26a69a"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Doanh thu tháng này"
            value={loading ? "..." : formatVND(stats?.revenue?.monthly ?? 0)}
            icon={<MonthIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard
            title="Tổng doanh thu"
            value={loading ? "..." : formatVND(stats?.revenue?.total ?? 0)}
            icon={<TotalRevenueIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Recent Transactions ── */}
      <SectionHeader title="Giao dịch gần đây" icon={<TotalRevenueIcon color="primary" />} />
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06) } }}>
              <TableCell>Mã đơn</TableCell>
              <TableCell>Người dùng</TableCell>
              <TableCell>Gói</TableCell>
              <TableCell align="right">Số tiền</TableCell>
              <TableCell align="right">Thời gian</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}><Skeleton /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (stats?.revenue?.recentTransactions ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.disabled" }}>
                  Chưa có giao dịch nào
                </TableCell>
              </TableRow>
            ) : (
              (stats?.revenue?.recentTransactions ?? []).map((tx) => (
                <TableRow key={tx.id} hover>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "monospace" }}>#{tx.orderCode}</TableCell>
                  <TableCell>{tx.username}</TableCell>
                  <TableCell>
                    <Chip
                      label={tx.planType}
                      size="small"
                      color={tx.planType === "PREMIUM" ? "secondary" : "primary"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                    {formatVND(tx.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                    {tx.paidAt ? new Date(tx.paidAt).toLocaleString("vi-VN") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
