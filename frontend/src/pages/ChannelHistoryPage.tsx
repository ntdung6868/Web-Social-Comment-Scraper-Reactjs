import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Card,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  IconButton,
  Tooltip,
  Pagination,
  Alert,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  VideoLibrary as VideoLibraryIcon,
  OpenInNew as OpenInNewIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { channelService } from "@/services/channel.service";
import { queryKeys } from "@/lib/query-client";
import type { ChannelCrawlJob } from "@/types/channel.types";

const statusColor: Record<string, "default" | "info" | "success" | "error" | "warning"> = {
  PENDING: "default",
  RUNNING: "info",
  COMPLETED: "success",
  FAILED: "error",
};

export default function ChannelHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.channel.history({ page, limit }),
    queryFn: () => channelService.getHistory(page, limit),
  });

  const history = data?.data?.data ?? [];
  const pagination = data?.data?.pagination;

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t("channel.confirmDelete", "Xóa job này và toàn bộ dữ liệu liên quan?"))) return;
    await channelService.deleteJob(id);
    refetch();
  };

  const handleRowClick = (job: ChannelCrawlJob) => {
    // Navigate to channel crawl page with the job's data pre-loaded
    navigate("/channel", { state: { resumeJobId: job.id } });
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto", p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <VideoLibraryIcon sx={{ fontSize: 28, color: "primary.main" }} />
          <Typography variant="h5" fontWeight={700}>
            {t("channel.historyTitle", "Lịch sử crawl kênh")}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/channel")}
        >
          {t("channel.newCrawl", "Crawl mới")}
        </Button>
      </Box>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{t("common.error", "Lỗi tải dữ liệu")}</Alert>}

      {!isLoading && !error && (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("channel.channel", "Kênh")}</TableCell>
                <TableCell align="right">{t("channel.minViews", "Min Views")}</TableCell>
                <TableCell align="right">{t("channel.totalVideos", "Videos")}</TableCell>
                <TableCell align="right">{t("channel.filteredVideos", "Đạt lọc")}</TableCell>
                <TableCell>{t("common.status", "Trạng thái")}</TableCell>
                <TableCell>{t("common.createdAt", "Ngày tạo")}</TableCell>
                <TableCell align="right">{t("common.actions", "Hành động")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                    <Typography color="text.secondary">{t("common.noData", "Không có dữ liệu")}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                history.map((job) => (
                  <TableRow
                    key={job.id}
                    hover
                    onClick={() => handleRowClick(job)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {job.channelUsername}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: "block" }}>
                        {job.channelUrl}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">
                        {job.minViews >= 1_000_000
                          ? `${(job.minViews / 1_000_000).toFixed(1)}M`
                          : job.minViews >= 1000
                          ? `${(job.minViews / 1000).toFixed(1)}K`
                          : job.minViews}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{job.totalVideos}</TableCell>
                    <TableCell align="right">{job.filteredVideos}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={job.status}
                        color={statusColor[job.status] ?? "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(job.createdAt).toLocaleDateString("vi-VN")}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t("channel.openJob", "Mở")}>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); handleRowClick(job); }}
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete", "Xóa")}>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => handleDelete(job.id, e)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Pagination
            count={pagination.totalPages}
            page={page}
            onChange={(_, val) => setPage(val)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
