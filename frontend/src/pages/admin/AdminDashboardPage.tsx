import { useQuery } from "@tanstack/react-query";
import { Box, Grid, Card, CardContent, Typography, Skeleton, alpha, LinearProgress, Chip } from "@mui/material";
import {
  People as PeopleIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  CloudQueue as QueueIcon,
  CheckCircle as HealthyIcon,
  Warning as DegradedIcon,
  Error as UnhealthyIcon,
} from "@mui/icons-material";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import type { SystemHealth } from "@/types";

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
        background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            {loading ? (
              <Skeleton width={80} height={40} />
            ) : (
              <Typography variant="h4" fontWeight={700} sx={{ color }}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: alpha(color, 0.1),
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: () => apiRequest.get<{ success: boolean; data: SystemHealth }>("/admin/health"),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: () => apiRequest.get<{ success: boolean; data: any }>("/admin/dashboard"),
  });

  const health = healthData?.data;
  const dashboard = dashboardData?.data;

  const getHealthIcon = (status?: string) => {
    switch (status) {
      case "healthy":
        return <HealthyIcon sx={{ color: "success.main", fontSize: 40 }} />;
      case "degraded":
        return <DegradedIcon sx={{ color: "warning.main", fontSize: 40 }} />;
      default:
        return <UnhealthyIcon sx={{ color: "error.main", fontSize: 40 }} />;
    }
  };

  const getHealthColor = (status?: string) => {
    switch (status) {
      case "healthy":
        return "#66bb6a";
      case "degraded":
        return "#ffa726";
      default:
        return "#f44336";
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          System monitoring and management
        </Typography>
      </Box>

      {/* System Health Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
            {getHealthIcon(health?.status)}
            <Box>
              <Typography variant="h5" fontWeight={600}>
                System Status:{" "}
                <Typography component="span" sx={{ color: getHealthColor(health?.status), fontWeight: 700 }}>
                  {health?.status?.toUpperCase() || "UNKNOWN"}
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Database: {health?.database || "unknown"} | Uptime:{" "}
                {health?.uptime
                  ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
                  : "N/A"}
              </Typography>
            </Box>
          </Box>

          {/* Memory Usage */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Memory Usage</Typography>
              <Typography variant="body2" fontWeight={600}>
                {health?.memory?.percentage?.toFixed(1) || 0}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={health?.memory?.percentage || 0}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>

          {/* Queue Stats */}
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Chip icon={<QueueIcon />} label={`Waiting: ${health?.queue?.waiting || 0}`} variant="outlined" />
            <Chip
              icon={<QueueIcon />}
              label={`Active: ${health?.queue?.active || 0}`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<QueueIcon />}
              label={`Completed: ${health?.queue?.completed || 0}`}
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<QueueIcon />}
              label={`Failed: ${health?.queue?.failed || 0}`}
              color="error"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Users"
            value={dashboard?.totalUsers ?? 0}
            icon={<PeopleIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={dashboardLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Users"
            value={dashboard?.activeUsers ?? 0}
            subtitle="Last 24 hours"
            icon={<PeopleIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={dashboardLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Scrapes"
            value={dashboard?.totalScrapes ?? 0}
            icon={<StorageIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={dashboardLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Scrapes Today"
            value={dashboard?.scrapesToday ?? 0}
            icon={<SpeedIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={dashboardLoading}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
