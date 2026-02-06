import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import {
  Visibility as ViewIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { scraperService } from "@/services/scraper.service";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, EmptyState } from "@/components/common";
import type { ScrapeJob } from "@/types";

const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  PENDING: "default",
  PROCESSING: "primary",
  COMPLETED: "success",
  FAILED: "error",
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.scraper.history({
      page: page + 1,
      limit: rowsPerPage,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
    }),
    queryFn: () =>
      scraperService.getHistory({
        page: page + 1,
        limit: rowsPerPage,
        status: statusFilter || undefined,
        platform: platformFilter || undefined,
      }),
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetail = (id: string) => {
    navigate(`/history/${id}`);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading history..." />;
  }

  // --- SỬA LỖI TẠI ĐÂY ---
  // API trả về: { success: true, data: { data: [...], pagination: {...} } }
  // data (từ useQuery) = Response Body
  // data.data = PaginatedResponse ({ data: Array, pagination: Object })
  const historyResponse = data?.data as any;
  const scrapes: ScrapeJob[] = historyResponse?.data ?? []; // Lấy mảng data bên trong
  const total = historyResponse?.pagination?.total ?? 0;
  // -----------------------

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Scrape History
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View and manage your previous scraping jobs
        </Typography>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            select
            label="Status"
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
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="PROCESSING">Processing</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
          </TextField>

          <TextField
            select
            label="Platform"
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Platforms</MenuItem>
            <MenuItem value="TIKTOK">TikTok</MenuItem>
            <MenuItem value="FACEBOOK">Facebook</MenuItem>
          </TextField>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        {scrapes.length === 0 ? (
          <EmptyState
            title="No scrapes found"
            message="You haven't performed any scrapes yet, or no results match your filters."
            icon={<SearchIcon sx={{ fontSize: 40, color: "primary.main" }} />}
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>URL</TableCell>
                    <TableCell>Platform</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Comments</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scrapes.map((scrape: ScrapeJob) => (
                    <TableRow key={scrape.id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 300,
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
                      <TableCell>{format(new Date(scrape.createdAt), "MMM dd, yyyy HH:mm")}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small" onClick={() => handleViewDetail(scrape.id)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={total}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Card>
    </Box>
  );
}
