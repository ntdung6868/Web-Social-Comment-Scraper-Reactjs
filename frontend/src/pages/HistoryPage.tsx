import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import { Delete as DeleteIcon, Search as SearchIcon, FilterList as FilterIcon } from "@mui/icons-material";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { scraperService } from "@/services/scraper.service";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, EmptyState } from "@/components/common";
import type { ScrapeJob, ScrapeStatus, Platform } from "@/types";

const statusColors: Record<string, "default" | "primary" | "success" | "error" | "warning"> = {
  PENDING: "default",
  RUNNING: "primary",
  SUCCESS: "success",
  FAILED: "error",
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<ScrapeJob | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.history.list({
      page: page + 1,
      limit: rowsPerPage,
      status: statusFilter || undefined,
      platform: platformFilter || undefined,
    }),
    queryFn: () =>
      scraperService.getHistory({
        page: page + 1,
        limit: rowsPerPage,
        status: (statusFilter || undefined) as ScrapeStatus | undefined,
        platform: (platformFilter || undefined) as Platform | undefined,
      }),
    placeholderData: (prev) => prev, // Keep previous data while fetching next page
  });

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewDetail = (id: string | number) => {
    navigate(`/history/${id}`);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => scraperService.deleteHistory(id),
    onSuccess: () => {
      toast.success("Scrape history deleted");
      setDeleteTarget(null);
      // Invalidate all history queries + dashboard
      queryClient.invalidateQueries({ queryKey: ["history"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.scraper.dashboard() });
    },
    onError: () => {
      toast.error("Failed to delete. Please try again.");
    },
  });

  const handleDelete = (e: React.MouseEvent, scrape: ScrapeJob) => {
    e.stopPropagation(); // Don't navigate when clicking delete
    setDeleteTarget(scrape);
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading history..." />;
  }

  // API response: { success: true, data: { data: [...], pagination: { totalItems, ... } } }
  // apiRequest unwraps axios .data, so useQuery data = { success, data: { data, pagination } }
  const historyResponse = data?.data as any;
  const scrapes: ScrapeJob[] = historyResponse?.data ?? [];
  const total = historyResponse?.pagination?.totalItems ?? 0;

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
            <MenuItem value="RUNNING">Running</MenuItem>
            <MenuItem value="SUCCESS">Success</MenuItem>
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
                    <TableRow
                      key={scrape.id}
                      hover
                      onClick={() => handleViewDetail(scrape.id)}
                      sx={{ cursor: "pointer" }}
                    >
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
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={(e) => handleDelete(e, scrape)}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Scrape History</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this scrape? This will permanently remove all associated comments and cannot
            be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
