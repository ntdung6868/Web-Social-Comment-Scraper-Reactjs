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
  TextField,
  MenuItem,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Grid,
  Divider,
  alpha,
  Stack,
  CircularProgress,
  IconButton,
} from "@mui/material";
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Block as BanIcon,
  CheckCircle as UnbanIcon,
  Star as ProIcon,
  Delete as DeleteIcon,
  RestartAlt as ResetIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, EmptyState } from "@/components/common";
import toast from "react-hot-toast";
import type { User } from "@/types";

// ── Types for admin user detail ──────────────────
interface AdminUserDetail extends User {
  scrapeCount?: number;
  lastLogin?: string | null;
  proxyEnabled?: boolean;
  headlessMode?: boolean;
  hasTiktokCookie?: boolean;
  hasFacebookCookie?: boolean;
  bannedAt?: string | null;
}

// ── Info Row Component ───────────────────────────
function InfoRow({ label, value, chip }: { label: string; value?: React.ReactNode; chip?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {chip || (
        <Typography variant="body2" fontWeight={500}>
          {value ?? "N/A"}
        </Typography>
      )}
    </Box>
  );
}

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════
export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Detail dialog state
  const [detailUserId, setDetailUserId] = useState<number | null>(null);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "ban" | "unban" | "delete" | "reset-trial" | "grant-pro";
    userId: number;
    username: string;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [proDays, setProDays] = useState(30);

  // ── List Query ──
  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.admin.users({ page: page + 1, limit: rowsPerPage, search: searchQuery, role: roleFilter }),
    queryFn: () =>
      apiRequest.get<{
        success: boolean;
        data: {
          data: User[];
          pagination: { currentPage: number; totalPages: number; totalItems: number };
        };
      }>(
        `/admin/users?page=${page + 1}&limit=${rowsPerPage}${searchQuery ? `&search=${searchQuery}` : ""}${roleFilter ? `&role=${roleFilter}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });

  // ── Detail Query ──
  const {
    data: detailData,
    isLoading: detailLoading,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["admin", "user-detail", detailUserId],
    queryFn: () =>
      apiRequest.get<{ success: boolean; data: { user: AdminUserDetail } }>(`/admin/users/${detailUserId}`),
    enabled: detailUserId !== null,
  });

  const detailUser = detailData?.data?.user;

  // ── Mutations ──
  const refreshAll = () => {
    refetch();
    if (detailUserId) refetchDetail();
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
  };

  const banMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      apiRequest.post(`/admin/users/${userId}/ban`, { reason }),
    onSuccess: () => {
      toast.success("User banned");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to ban user"),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.post(`/admin/users/${userId}/unban`),
    onSuccess: () => {
      toast.success("User unbanned");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to unban user"),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      toast.success("User deleted");
      closeConfirm();
      setDetailUserId(null);
      refreshAll();
    },
    onError: () => toast.error("Failed to delete user"),
  });

  const resetTrialMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.post(`/admin/users/${userId}/reset-trial`, { trialCount: 3 }),
    onSuccess: () => {
      toast.success("Trial uses reset");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to reset trial"),
  });

  const grantProMutation = useMutation({
    mutationFn: ({ userId, durationDays }: { userId: number; durationDays: number }) =>
      apiRequest.post(`/admin/users/${userId}/grant-pro`, { durationDays }),
    onSuccess: () => {
      toast.success("Pro subscription granted");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to grant Pro"),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Record<string, unknown> }) =>
      apiRequest.patch(`/admin/users/${userId}`, data),
    onSuccess: () => {
      toast.success("User updated");
      refreshAll();
    },
    onError: () => toast.error("Failed to update user"),
  });

  // ── Handlers ──
  const closeConfirm = () => {
    setConfirmAction(null);
    setBanReason("");
    setProDays(30);
  };

  const openConfirm = (
    type: "ban" | "unban" | "delete" | "reset-trial" | "grant-pro",
    userId: number,
    username: string,
  ) => {
    setConfirmAction({ type, userId, username });
  };

  const executeConfirm = () => {
    if (!confirmAction) return;
    const { type, userId } = confirmAction;

    switch (type) {
      case "ban":
        banMutation.mutate({ userId, reason: banReason || "Banned by admin" });
        break;
      case "unban":
        unbanMutation.mutate(userId);
        break;
      case "delete":
        deleteMutation.mutate(userId);
        break;
      case "reset-trial":
        resetTrialMutation.mutate(userId);
        break;
      case "grant-pro":
        grantProMutation.mutate({ userId, durationDays: proDays });
        break;
    }
  };

  const isConfirmPending =
    banMutation.isPending ||
    unbanMutation.isPending ||
    deleteMutation.isPending ||
    resetTrialMutation.isPending ||
    grantProMutation.isPending;

  if (isLoading) {
    return <LoadingSpinner message="Loading users..." />;
  }

  const users = data?.data?.data ?? [];
  const total = data?.data?.pagination?.totalItems ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            User Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user accounts and permissions
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            select
            label="Role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Roles</MenuItem>
            <MenuItem value="USER">User</MenuItem>
            <MenuItem value="ADMIN">Admin</MenuItem>
          </TextField>
        </Box>
      </Card>

      {/* Table */}
      <Card>
        {users.length === 0 ? (
          <EmptyState title="No users found" message="No users match your search criteria." />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Plan</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Trial Uses</TableCell>
                    <TableCell>Joined</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id} hover onClick={() => setDetailUserId(user.id)} sx={{ cursor: "pointer" }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {user.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.isAdmin ? "Admin" : "User"}
                          size="small"
                          color={user.isAdmin ? "primary" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.planType}
                          size="small"
                          color={user.planType === "PRO" ? "success" : "default"}
                        />
                      </TableCell>
                      <TableCell>
                        {user.isBanned ? (
                          <Chip label="Banned" size="small" color="error" />
                        ) : (
                          <Chip label={user.planStatus} size="small" color="success" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.trialUses} / {user.maxTrialUses}
                        </Typography>
                      </TableCell>
                      <TableCell>{format(new Date(user.createdAt), "MMM dd, yyyy")}</TableCell>
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
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Card>

      {/* ════════════════════════════════════════════════ */}
      {/* USER DETAIL DIALOG                              */}
      {/* ════════════════════════════════════════════════ */}
      <Dialog
        open={detailUserId !== null}
        onClose={() => setDetailUserId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, backgroundImage: "none" } }}
      >
        {detailLoading || !detailUser ? (
          <Box sx={{ p: 6, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {detailUser.username}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ID: {detailUser.id} &middot; {detailUser.email}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setDetailUserId(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            </DialogTitle>

            <DialogContent dividers>
              {/* Status Chips */}
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                <Chip
                  icon={detailUser.isAdmin ? <AdminIcon /> : <PersonIcon />}
                  label={detailUser.isAdmin ? "Admin" : "User"}
                  size="small"
                  color={detailUser.isAdmin ? "primary" : "default"}
                  variant="outlined"
                />
                <Chip
                  label={detailUser.planType}
                  size="small"
                  color={detailUser.planType === "PRO" ? "success" : "default"}
                />
                {detailUser.isBanned && <Chip label="Banned" size="small" color="error" />}
              </Stack>

              {/* Info Section */}
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                  mb: 2,
                }}
              >
                <InfoRow
                  label="Plan Status"
                  chip={<Chip label={detailUser.planStatus} size="small" color="info" variant="outlined" />}
                />
                <Divider />
                <InfoRow label="Trial Uses" value={`${detailUser.trialUses} / ${detailUser.maxTrialUses}`} />
                <Divider />
                <InfoRow
                  label="Subscription End"
                  value={
                    detailUser.subscriptionEnd
                      ? format(new Date(detailUser.subscriptionEnd), "MMM dd, yyyy HH:mm")
                      : "—"
                  }
                />
                <Divider />
                <InfoRow label="Joined" value={format(new Date(detailUser.createdAt), "MMM dd, yyyy HH:mm")} />
                <Divider />
                <InfoRow
                  label="Last Login"
                  value={detailUser.lastLogin ? format(new Date(detailUser.lastLogin), "MMM dd, yyyy HH:mm") : "—"}
                />
                {detailUser.scrapeCount !== undefined && (
                  <>
                    <Divider />
                    <InfoRow label="Total Scrapes" value={detailUser.scrapeCount} />
                  </>
                )}
                {detailUser.isBanned && (
                  <>
                    <Divider />
                    <InfoRow label="Ban Reason" value={detailUser.banReason || "No reason"} />
                    <Divider />
                    <InfoRow
                      label="Banned At"
                      value={detailUser.bannedAt ? format(new Date(detailUser.bannedAt), "MMM dd, yyyy HH:mm") : "—"}
                    />
                  </>
                )}
              </Box>

              {/* Quick Toggle: Admin Role */}
              <Typography variant="subtitle2" sx={{ mb: 1.5, mt: 1 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={1.5}>
                {/* Toggle Admin */}
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<AdminIcon />}
                    color={detailUser.isAdmin ? "warning" : "primary"}
                    onClick={() =>
                      updateUserMutation.mutate({
                        userId: detailUser.id,
                        data: { isAdmin: !detailUser.isAdmin },
                      })
                    }
                    disabled={updateUserMutation.isPending}
                  >
                    {detailUser.isAdmin ? "Remove Admin" : "Make Admin"}
                  </Button>
                </Grid>

                {/* Ban / Unban */}
                <Grid item xs={6}>
                  {detailUser.isBanned ? (
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      startIcon={<UnbanIcon />}
                      color="success"
                      onClick={() => openConfirm("unban", detailUser.id, detailUser.username)}
                    >
                      Unban
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      startIcon={<BanIcon />}
                      color="error"
                      onClick={() => openConfirm("ban", detailUser.id, detailUser.username)}
                    >
                      Ban User
                    </Button>
                  )}
                </Grid>

                {/* Grant Pro */}
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<ProIcon />}
                    color="warning"
                    onClick={() => openConfirm("grant-pro", detailUser.id, detailUser.username)}
                  >
                    {detailUser.planType === "PRO" ? "Extend Pro" : "Grant Pro"}
                  </Button>
                </Grid>

                {/* Reset Trial */}
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<ResetIcon />}
                    onClick={() => openConfirm("reset-trial", detailUser.id, detailUser.username)}
                  >
                    Reset Trial
                  </Button>
                </Grid>

                {/* Edit Subscription End */}
                <Grid item xs={6}>
                  <TextField
                    type="date"
                    label="Subscription End"
                    size="small"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    defaultValue={
                      detailUser.subscriptionEnd ? new Date(detailUser.subscriptionEnd).toISOString().split("T")[0] : ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) {
                        updateUserMutation.mutate({
                          userId: detailUser.id,
                          data: { subscriptionEnd: new Date(value).toISOString() },
                        });
                      }
                    }}
                  />
                </Grid>

                {/* Delete User */}
                <Grid item xs={6}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    startIcon={<DeleteIcon />}
                    color="error"
                    onClick={() => openConfirm("delete", detailUser.id, detailUser.username)}
                  >
                    Delete User
                  </Button>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setDetailUserId(null)} color="inherit">
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ════════════════════════════════════════════════ */}
      {/* CONFIRMATION DIALOG                             */}
      {/* ════════════════════════════════════════════════ */}
      <Dialog open={!!confirmAction} onClose={closeConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirmAction?.type === "ban" && "Ban User"}
          {confirmAction?.type === "unban" && "Unban User"}
          {confirmAction?.type === "delete" && "Delete User"}
          {confirmAction?.type === "reset-trial" && "Reset Trial Uses"}
          {confirmAction?.type === "grant-pro" && "Grant Pro Subscription"}
        </DialogTitle>
        <DialogContent>
          {/* Ban — needs reason */}
          {confirmAction?.type === "ban" && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>{confirmAction.username}</strong> will be banned and unable to access the platform.
              </Alert>
              <TextField
                label="Ban Reason"
                fullWidth
                size="small"
                multiline
                rows={2}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason for banning this user..."
              />
            </>
          )}

          {/* Unban */}
          {confirmAction?.type === "unban" && (
            <Alert severity="info">
              <strong>{confirmAction.username}</strong> will be unbanned and regain access.
            </Alert>
          )}

          {/* Delete */}
          {confirmAction?.type === "delete" && (
            <Alert severity="error">
              Permanently delete <strong>{confirmAction.username}</strong> and all their data? This cannot be undone.
            </Alert>
          )}

          {/* Reset Trial */}
          {confirmAction?.type === "reset-trial" && (
            <Alert severity="info">
              Reset trial uses for <strong>{confirmAction.username}</strong> back to 3?
            </Alert>
          )}

          {/* Grant Pro — needs duration */}
          {confirmAction?.type === "grant-pro" && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Grant Pro subscription to <strong>{confirmAction.username}</strong>.
              </Alert>
              <TextField
                label="Duration (days)"
                type="number"
                fullWidth
                size="small"
                value={proDays}
                onChange={(e) => setProDays(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1, max: 365 }}
                helperText="How many days of Pro subscription?"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmAction?.type === "delete" || confirmAction?.type === "ban" ? "error" : "primary"}
            onClick={executeConfirm}
            disabled={isConfirmPending}
          >
            {isConfirmPending ? "Processing..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
