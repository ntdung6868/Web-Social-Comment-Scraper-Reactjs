import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  TextField,
  MenuItem,
  InputAdornment,
  Button,
} from "@mui/material";
import { FilterList as FilterIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import { format } from "date-fns";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, EmptyState } from "@/components/common";
import type { ScrapeJob } from "@/types";
import { useLanguageStore } from "@/stores/language.store";
import { formatDateTimeVi } from "@/utils/helpers";

const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  PENDING: "default",
  RUNNING: "primary",
  SUCCESS: "success",
  FAILED: "error",
};

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return "-";
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function SystemLogsPage() {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.admin.scrapes({ page: page + 1, limit: rowsPerPage, status: statusFilter }),
    queryFn: () =>
      apiRequest.get<{
        success: boolean;
        data: {
          data: (ScrapeJob & { username?: string; errorMessage?: string | null })[];
          pagination: { currentPage: number; totalPages: number; totalItems: number };
        };
      }>(`/admin/scrapes?page=${page + 1}&limit=${rowsPerPage}${statusFilter ? `&status=${statusFilter}` : ""}`),
  });

  if (isLoading) {
    return <LoadingSpinner message={t("common.loading")} />;
  }

  const scrapes = data?.data?.data ?? [];
  const total = data?.data?.pagination?.totalItems ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t("nav.adminLogs")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("admin.logsDescription")}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
          {t("common.refresh")}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            select
            label={t("common.status")}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <FilterIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          >
            <MenuItem value="">{t("history.allStatuses")}</MenuItem>
            <MenuItem value="PENDING">{t("history.pending")}</MenuItem>
            <MenuItem value="RUNNING">{t("history.running")}</MenuItem>
            <MenuItem value="SUCCESS">{t("history.success")}</MenuItem>
            <MenuItem value="FAILED">{t("history.failed")}</MenuItem>
          </TextField>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        {scrapes.length === 0 ? (
          <EmptyState title={t("admin.noLogs")} message={t("admin.noLogsMessage")} />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("admin.id")}</TableCell>
                    <TableCell>{t("common.user")}</TableCell>
                    <TableCell>{t("history.url")}</TableCell>
                    <TableCell>{t("history.platform")}</TableCell>
                    <TableCell>{t("common.status")}</TableCell>
                    <TableCell align="right">{t("admin.comments")}</TableCell>
                    <TableCell>{t("admin.created")}</TableCell>
                    <TableCell>{t("admin.completed")}</TableCell>
                    <TableCell>{t("admin.duration")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scrapes.map((scrape) => (
                    <TableRow key={scrape.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace">
                          {String(scrape.id)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {scrape.username || t("common.unknown")}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t("admin.id")}: {scrape.userId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 200,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scrape.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={scrape.platform} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip label={scrape.status} size="small" color={statusColors[scrape.status]} />
                      </TableCell>
                      <TableCell align="right">{scrape.totalComments.toLocaleString()}</TableCell>
                      <TableCell>
                        {scrape.createdAt ? (language === "vi" ? formatDateTimeVi(scrape.createdAt) : format(new Date(scrape.createdAt), "MMM dd, HH:mm:ss")) : "-"}
                      </TableCell>
                      <TableCell>
                        {scrape.updatedAt && (scrape.status === "SUCCESS" || scrape.status === "FAILED")
                          ? (language === "vi" ? formatDateTimeVi(scrape.updatedAt) : format(new Date(scrape.updatedAt), "MMM dd, HH:mm:ss"))
                          : scrape.status === "RUNNING"
                            ? t("admin.inProgress")
                            : "-"}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {scrape.updatedAt &&
                          scrape.createdAt &&
                          (scrape.status === "SUCCESS" || scrape.status === "FAILED")
                            ? formatDuration(new Date(scrape.createdAt), new Date(scrape.updatedAt))
                            : scrape.status === "RUNNING"
                              ? "..."
                              : "-"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 20, 50, 100]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Card>
    </Box>
  );
}
