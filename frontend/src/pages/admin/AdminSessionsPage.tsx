import { useState } from "react";
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
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  Refresh as RefreshIcon,
  Delete as RevokeIcon,
  Computer as DeviceIcon,
  AdminPanelSettings as AdminIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/services/api";
import { LoadingSpinner, EmptyState } from "@/components/common";
import toast from "react-hot-toast";

// ── Types ────────────────────────────────────────
interface Session {
  id: number;
  userId: number;
  username: string;
  email: string;
  isAdmin: boolean;
  planType: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceInfo: string | null;
  createdAt: string;
  expiresAt: string;
}

// ── Parse User Agent ─────────────────────────────
function parseDevice(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Mobile")) return "Mobile";
  if (ua.includes("Tablet")) return "Tablet";
  return "Desktop";
}

function parseBrowser(ua: string | null): string {
  if (!ua) return "Unknown";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Other";
}

// ── Main Component ───────────────────────────────
export default function AdminSessionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: number; username: string } | null>(null);

  // Fetch sessions
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "sessions", page, rowsPerPage],
    queryFn: () =>
      apiRequest.get<{
        success: boolean;
        data: {
          data: Session[];
          pagination: { currentPage: number; totalPages: number; totalItems: number };
        };
      }>(`/admin/sessions?page=${page + 1}&limit=${rowsPerPage}`),
  });

  // Revoke session mutation
  const revokeMutation = useMutation({
    mutationFn: (sessionId: number) => apiRequest.delete(`/admin/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success("Session revoked");
      queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] });
      setConfirmRevoke(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke session");
    },
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading sessions..." />;
  }

  const sessions = data?.data?.data ?? [];
  const total = data?.data?.pagination?.totalItems ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Active Sessions
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor and manage user login sessions ({total} active)
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {/* Table */}
      <Card>
        {sessions.length === 0 ? (
          <EmptyState title="No active sessions" message="There are no active sessions at this time." />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>IP Address</TableCell>
                    <TableCell>Device</TableCell>
                    <TableCell>Browser</TableCell>
                    <TableCell>Login Time</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id} hover>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {session.username}
                              {session.isAdmin && (
                                <AdminIcon
                                  sx={{ fontSize: 14, ml: 0.5, color: "warning.main", verticalAlign: "middle" }}
                                />
                              )}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {session.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={session.planType}
                          size="small"
                          color={
                            session.planType === "PREMIUM"
                              ? "secondary"
                              : session.planType === "PERSONAL"
                                ? "primary"
                                : "default"
                          }
                          variant="outlined"
                          sx={{ fontSize: "0.7rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                          {session.ipAddress || "-"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<DeviceIcon sx={{ fontSize: "14px !important" }} />}
                          label={parseDevice(session.userAgent)}
                          size="small"
                          variant="outlined"
                          sx={{ fontSize: "0.7rem" }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize="0.8rem">
                          {parseBrowser(session.userAgent)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={format(new Date(session.createdAt), "PPpp")}>
                          <Typography variant="body2" fontSize="0.8rem">
                            {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={format(new Date(session.expiresAt), "PPpp")}>
                          <Typography variant="body2" fontSize="0.8rem">
                            {formatDistanceToNow(new Date(session.expiresAt), { addSuffix: true })}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Revoke session">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirmRevoke({ id: session.id, username: session.username })}
                          >
                            <RevokeIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 20, 50]}
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

      {/* Confirm Revoke Dialog */}
      <Dialog open={!!confirmRevoke} onClose={() => setConfirmRevoke(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningIcon color="warning" />
          Revoke Session
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            This will force <strong>{confirmRevoke?.username}</strong> to log in again. Their current session will be
            terminated immediately.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRevoke(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => confirmRevoke && revokeMutation.mutate(confirmRevoke.id)}
            disabled={revokeMutation.isPending}
          >
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
