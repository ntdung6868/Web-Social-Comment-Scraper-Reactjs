import { useQuery } from "@tanstack/react-query";
import { Box, Grid, Card, CardContent, Typography, Skeleton, alpha, LinearProgress, Chip, Stack } from "@mui/material";
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
} from "@mui/icons-material";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import type { SystemHealth } from "@/types";

// ── Types ────────────────────────────────────────
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
        background: `linear-gradient(135deg, ${alpha(color, 0.12)} 0%, ${alpha(color, 0.03)} 100%)`,
        border: `1px solid ${alpha(color, 0.15)}`,
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 4px 20px ${alpha(color, 0.15)}`,
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
              <Typography variant="h4" fontWeight={700} sx={{ color, mt: 0.5 }}>
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
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: () => apiRequest.get<{ success: boolean; data: SystemHealth }>("/admin/health"),
    refetchInterval: 30000,
  });

  const { data: dashboardData, isLoading: dashLoading } = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => apiRequest.get<{ success: boolean; data: AdminDashboardStats }>("/admin/dashboard"),
    refetchInterval: 60000,
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
    refetchInterval: 10000,
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
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          System overview and monitoring
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
                System{" "}
                <Typography component="span" sx={{ color: healthColor, fontWeight: 700 }}>
                  {health?.status?.toUpperCase() || "CHECKING..."}
                </Typography>
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<StorageIcon />}
                label={`DB: ${health?.services?.database?.status || "..."}`}
                color={health?.services?.database?.status === "up" ? "success" : "error"}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<QueueIcon />}
                label={`Redis: ${health?.services?.redis?.status || "..."}`}
                color={health?.services?.redis?.status === "up" ? "success" : "error"}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<SpeedIcon />}
                label={`Scraper: ${health?.services?.scraper?.status || "..."}`}
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
                Memory Usage
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="h6" fontWeight={600}>
                  {healthLoading ? "..." : `${health?.memory?.percentage?.toFixed(1) || 0}%`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({healthLoading ? "..." : `${((health?.memory?.used || 0) / 1024 / 1024).toFixed(0)} MB`})
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
                CPU Load
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
                Uptime
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {healthLoading ? "..." : formatUptime(health?.uptime || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Since last restart
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* ── Real-Time Stats ── */}
      <SectionHeader title="Real-Time" icon={<WifiIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Online Users"
            value={realtime?.connectedUsers ?? 0}
            icon={<PeopleIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Connections"
            value={realtime?.connectedSockets ?? 0}
            icon={<ComputerIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Active Jobs"
            value={realtime?.queueStats?.active ?? 0}
            icon={<ActiveIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={!realtime}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Queued Jobs"
            value={realtime?.queueStats?.waiting ?? 0}
            icon={<QueueIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={!realtime}
          />
        </Grid>
      </Grid>

      {/* ── Users Section ── */}
      <SectionHeader title="Users" icon={<PeopleIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title="Total Users"
            value={stats?.users?.total ?? 0}
            icon={<PeopleIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title="Active"
            value={stats?.users?.active ?? 0}
            icon={<SuccessIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title="Banned"
            value={stats?.users?.banned ?? 0}
            icon={<BanIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title="New Today"
            value={stats?.users?.newToday ?? 0}
            icon={<PersonAddIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <StatCard
            title="This Week"
            value={stats?.users?.newThisWeek ?? 0}
            icon={<PersonAddIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Subscriptions Section ── */}
      <SectionHeader title="Subscriptions" icon={<ProIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4}>
          <StatCard
            title="Free Plan"
            value={stats?.subscriptions?.free ?? 0}
            icon={<PeopleIcon sx={{ color: "#78909c" }} />}
            color="#78909c"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            title="Paid Plans"
            value={stats?.subscriptions?.pro ?? 0}
            icon={<ProIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4}>
          <StatCard
            title="Expired"
            value={stats?.subscriptions?.expired ?? 0}
            icon={<UptimeIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
      </Grid>

      {/* ── Scraping Section ── */}
      <SectionHeader title="Scraping" icon={<CommentIcon color="primary" />} />
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Total Jobs"
            value={stats?.scraping?.totalJobs ?? 0}
            icon={<StorageIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Successful"
            value={stats?.scraping?.successfulJobs ?? 0}
            subtitle={`${successRate}% rate`}
            icon={<SuccessIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Failed"
            value={stats?.scraping?.failedJobs ?? 0}
            icon={<FailedIcon sx={{ color: "#ef5350" }} />}
            color="#ef5350"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Active"
            value={stats?.scraping?.activeJobs ?? 0}
            icon={<ActiveIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="In Queue"
            value={stats?.scraping?.queuedJobs ?? 0}
            icon={<QueueIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Comments"
            value={stats?.scraping?.totalComments ?? 0}
            icon={<CommentIcon sx={{ color: "#ab47bc" }} />}
            color="#ab47bc"
            loading={loading}
          />
        </Grid>
        <Grid item xs={6} sm={4} md={2}>
          <StatCard
            title="Avg Speed"
            value={formatAvgTime(stats?.scraping?.avgCompletionTime ?? 0)}
            subtitle="per job"
            icon={<TimerIcon sx={{ color: "#26a69a" }} />}
            color="#26a69a"
            loading={loading}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
