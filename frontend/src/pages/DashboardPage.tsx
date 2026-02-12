import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Skeleton,
  alpha,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
} from "@mui/material";
import {
  TrendingUp as TrendingUpIcon,
  Comment as CommentIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { scraperService } from "@/services/scraper.service";
import { queryKeys } from "@/lib/query-client";
import { useAuthStore } from "@/stores/auth.store";
import type { ScrapeJob } from "@/types";

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
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: alpha(color, 0.1),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
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
  const navigate = useNavigate();

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
          Welcome back, {user?.username?.split(" ")[0] || "User"}! 👋
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
            value={stats?.stats.totalScrapes ?? 0}
            subtitle="All time"
            icon={<TrendingUpIcon sx={{ color: "#5c6bc0" }} />}
            color="#5c6bc0"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Successful"
            value={stats?.stats.successScrapes ?? 0}
            subtitle="All time"
            icon={<CheckCircleIcon sx={{ color: "#66bb6a" }} />}
            color="#66bb6a"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Comments"
            value={stats?.stats.totalComments?.toLocaleString() ?? 0}
            subtitle="Extracted"
            icon={<CommentIcon sx={{ color: "#42a5f5" }} />}
            color="#42a5f5"
            loading={isLoading}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${stats?.stats.totalScrapes ? Math.round((stats.stats.successScrapes / stats.stats.totalScrapes) * 100) : 0}%`}
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
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  Recent Activity
                </Typography>
                <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate("/history")}>
                  View All
                </Button>
              </Box>

              {isLoading ? (
                <Box>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={56} sx={{ mb: 1 }} />
                  ))}
                </Box>
              ) : stats?.recentScrapes && stats.recentScrapes.length > 0 ? (
                <List disablePadding>
                  {stats.recentScrapes.map((scrape: ScrapeJob) => (
                    <ListItem
                      key={scrape.id}
                      sx={{
                        borderRadius: 1,
                        mb: 1,
                        cursor: "pointer",
                        "&:hover": { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.05) },
                      }}
                      onClick={() => navigate(`/history/${scrape.id}`)}
                      secondaryAction={
                        <Chip
                          label={scrape.status}
                          size="small"
                          color={
                            scrape.status === "SUCCESS"
                              ? "success"
                              : scrape.status === "FAILED"
                                ? "error"
                                : scrape.status === "RUNNING"
                                  ? "primary"
                                  : "default"
                          }
                        />
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <CommentIcon fontSize="small" color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" noWrap sx={{ maxWidth: 350 }}>
                            {scrape.url}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {scrape.platform} &middot; {scrape.totalComments} comments &middot;{" "}
                            {format(new Date(scrape.createdAt), "MMM dd, HH:mm")}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No scraping activity yet. Start your first scrape!
                </Typography>
              )}
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
                  {user?.planType || "FREE"} Plan
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Status: {user?.planStatus || "ACTIVE"}
                </Typography>
                {user?.planType === "FREE" && (
                  <Typography variant="body2" color="text.secondary">
                    Trial scrapes remaining: {user.trialUses} / {user.maxTrialUses}
                  </Typography>
                )}
                {(user?.planType === "PERSONAL" || user?.planType === "PREMIUM") && user.subscriptionEnd && (
                  <Typography variant="body2" color="text.secondary">
                    Expires: {format(new Date(user.subscriptionEnd), "MMM dd, yyyy")}
                  </Typography>
                )}
              </Box>

              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
                onClick={() => navigate("/scraper")}
                startIcon={<CommentIcon />}
              >
                Start Scraping
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
