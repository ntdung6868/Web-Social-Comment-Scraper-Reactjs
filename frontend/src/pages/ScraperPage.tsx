import { useState } from "react";
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
} from "@mui/material";
import { Search as SearchIcon, PlayArrow as PlayIcon } from "@mui/icons-material";
import { scraperService } from "@/services/scraper.service";
import { useScrapeStore } from "@/stores/scrape.store";
import { subscribeToScrape } from '@/lib/socket';
import { queryClient, queryKeys } from '@/lib/query-client';
import toast from "react-hot-toast";

const scrapeSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine(
      (url) => url.includes("tiktok.com") || url.includes("facebook.com"),
      "Only TikTok and Facebook URLs are supported",
    ),
  maxComments: z.number().min(10).max(10000).optional(),
});

type ScrapeFormData = z.infer<typeof scrapeSchema>;

export default function ScraperPage() {
  const [error, setError] = useState<string | null>(null);
  const { activeScrapes, scrapeProgress, addScrape } = useScrapeStore();

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
      const { scrape, position } = response.data;
      addScrape(scrape);
      subscribeToScrape(scrape.id);

      toast.success(`Scrape started! Position in queue: ${position}`);
      reset();
      setError(null);

      // Invalidate dashboard to refresh stats
      queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error || "Failed to start scrape");
    },
  });

  const onSubmit = (data: ScrapeFormData) => {
    startScrapeMutation.mutate(data);
  };

  const activeJobs = Array.from(activeScrapes.values()).filter(
    (s) => s.status === "PENDING" || s.status === "PROCESSING",
  );

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

            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
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
        <Card>
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
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                      {job.url}
                    </Typography>
                    <Chip label={job.status} size="small" color={job.status === "PROCESSING" ? "primary" : "default"} />
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={progress?.progress ?? 0}
                    sx={{ mb: 1, height: 8, borderRadius: 4 }}
                  />

                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="caption" color="text.secondary">
                      {progress?.progress ?? 0}% complete
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {progress?.totalComments ?? 0} comments
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
