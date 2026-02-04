import { useQuery } from "@tanstack/react-query";
import { Box, Grid, Card, CardContent, Typography, Skeleton, alpha } from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  Comment as CommentIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import { scraperService } from "@/services/scraper.service";
import { queryKeys } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth.store";

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

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: queryKeys.scraper.dashboard(),
    queryFn: () => scraperService.getDashboard(),
  });

  const stats = dashboardData?.data;

  return (
    <Box>
      {/* Welcome Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Welcome back, {user?.name?.split(" ")[0] || "User"}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here&apos;s an overview of your scraping activity
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Scrapes"
            value={stats?.totalScrapes ?? 0}
            subtitle="All time"
            icon={<TrendingUpIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed Today"
            value={stats?.completedToday ?? 0}
            subtitle="Last 24 hours"
            icon={<CheckCircleIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Comments"
            value={stats?.totalComments?.toLocaleString() ?? 0}
            subtitle="Extracted"
            icon={<CommentIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats?.successRate ?? 0}%`}
            subtitle="Average"
            icon={<SpeedIcon sx={{ color: "#ffa726" }} />}
            color="#ffa726"
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Quick Actions & Recent Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your recent scraping activity will appear here.
              </Typography>
              {/* TODO: Add recent activity list */}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Subscription
              </Typography>
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600} color="primary">
                  {user?.subscriptionPlan || "FREE"} Plan
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Status: {user?.subscriptionStatus || "TRIAL"}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
