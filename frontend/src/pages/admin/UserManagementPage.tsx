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
  Person as PersonIcon,
  Warning as WarningIcon,
  Edit as EditIcon,
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
  distinctIpCount?: number;
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
    type: "ban" | "unban" | "delete" | "reset-trial" | "grant-pro" | "save-changes";
    userId: number;
    username: string;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [proDays, setProDays] = useState(30);
  const [grantPlanType, setGrantPlanType] = useState<"FREE" | "PERSONAL" | "PREMIUM">("PREMIUM");

  // Edit fields state
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [pendingPayload, setPendingPayload] = useState<Record<string, string> | null>(null);

  // Fetch admin settings for dynamic maxTrialUses
  const { data: settingsData } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: () => apiRequest.get<{ success: boolean; data: { settings: Record<string, string | null> } }>("/admin/settings"),
    staleTime: 5 * 60 * 1000,
  });
  const maxTrialUses = parseInt(settingsData?.data?.settings?.maxTrialUses ?? "3", 10) || 3;

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
        `/admin/users?page=${page + 1}&limit=${rowsPerPage}${searchQuery ? `&search=${searchQuery}` : ""}${roleFilter ? `&planType=${roleFilter}` : ""}`,
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
    mutationFn: (userId: number) => apiRequest.post(`/admin/users/${userId}/reset-trial`, {}),
    onSuccess: () => {
      toast.success("Trial uses reset");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to reset trial"),
  });

  const grantProMutation = useMutation({
    mutationFn: ({ userId, durationDays, planType }: { userId: number; durationDays: number; planType: string }) =>
      apiRequest.post(`/admin/users/${userId}/grant-pro`, { durationDays, planType }),
    onSuccess: () => {
      toast.success("Plan updated");
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error("Failed to update plan"),
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
    setPendingPayload(null);
  };

  const openConfirm = (
    type: "ban" | "unban" | "delete" | "reset-trial" | "grant-pro" | "save-changes",
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
        grantProMutation.mutate({ userId, durationDays: proDays, planType: grantPlanType });
        break;
      case "save-changes":
        if (pendingPayload) {
          updateUserMutation.mutate(
            { userId, data: pendingPayload },
            {
              onSuccess: () => {
                setEditPassword("");
                setPendingPayload(null);
                closeConfirm();
              },
            },
          );
        }
        break;
    }
  };

  const isConfirmPending =
    banMutation.isPending ||
    unbanMutation.isPending ||
    deleteMutation.isPending ||
    resetTrialMutation.isPending ||
    grantProMutation.isPending ||
    updateUserMutation.isPending;

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
            label="Plan"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All Plans</MenuItem>
            <MenuItem value="FREE">Free</MenuItem>
            <MenuItem value="PERSONAL">Personal</MenuItem>
            <MenuItem value="PREMIUM">Premium</MenuItem>
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
                          label={user.planType}
                          size="small"
                          color={
                            user.planType === "PREMIUM"
                              ? "secondary"
                              : user.planType === "PERSONAL"
                                ? "success"
                                : "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {user.isBanned ? (
                          <Chip label="Banned" size="small" color="error" />
                        ) : (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip label={user.planStatus} size="small" color="success" variant="outlined" />
                            {(user as unknown as { distinctIpCount?: number }).distinctIpCount !== undefined &&
                              (user as unknown as { distinctIpCount: number }).distinctIpCount > 3 && (
                                <Chip
                                  icon={<WarningIcon />}
                                  label={`${(user as unknown as { distinctIpCount: number }).distinctIpCount} IPs`}
                                  size="small"
                                  color="warning"
                                  variant="filled"
                                  sx={{ fontWeight: 600 }}
                                />
                              )}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {user.trialUses} / {maxTrialUses}
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
                  icon={<PersonIcon />}
                  label={detailUser.isAdmin ? "Admin" : "User"}
                  size="small"
                  color={detailUser.isAdmin ? "primary" : "default"}
                  variant="outlined"
                />
                <Chip
                  label={detailUser.planType}
                  size="small"
                  color={
                    detailUser.planType === "PREMIUM"
                      ? "secondary"
                      : detailUser.planType === "PERSONAL"
                        ? "success"
                        : "default"
                  }
                />
                {detailUser.isBanned && <Chip label="Banned" size="small" color="error" />}
                {detailUser.distinctIpCount !== undefined && detailUser.distinctIpCount > 3 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${detailUser.distinctIpCount} IPs detected`}
                    size="small"
                    color="warning"
                    variant="filled"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Stack>

              {/* Editable Fields */}
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                Edit User Info
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    label="Username"
                    size="small"
                    fullWidth
                    defaultValue={detailUser.username}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Email"
                    size="small"
                    fullWidth
                    defaultValue={detailUser.email}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="New Password"
                    size="small"
                    fullWidth
                    type="password"
                    placeholder="Leave empty to keep"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="small"
                    startIcon={<EditIcon />}
                    disabled={updateUserMutation.isPending}
                    sx={{ height: 40 }}
                    onClick={() => {
                      const payload: Record<string, string> = {};
                      if (editUsername && editUsername !== detailUser.username) payload.username = editUsername;
                      if (editEmail && editEmail !== detailUser.email) payload.email = editEmail;
                      if (editPassword) payload.password = editPassword;
                      if (Object.keys(payload).length === 0) {
                        toast.error("No changes to save");
                        return;
                      }
                      setPendingPayload(payload);
                      openConfirm("save-changes", detailUser.id, detailUser.username);
                    }}
                  >
                    {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </Grid>
              </Grid>

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
                <InfoRow label="Trial Uses" value={`${detailUser.trialUses} / ${maxTrialUses}`} />
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
                {detailUser.distinctIpCount !== undefined && (
                  <>
                    <Divider />
                    <InfoRow
                      label="Distinct IPs"
                      chip={
                        <Chip
                          label={detailUser.distinctIpCount}
                          size="small"
                          color={detailUser.distinctIpCount > 3 ? "warning" : "default"}
                          variant={detailUser.distinctIpCount > 3 ? "filled" : "outlined"}
                        />
                      }
                    />
                  </>
                )}
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

              <Typography variant="subtitle2" sx={{ mb: 1.5, mt: 1 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={1.5}>
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

                {/* Manage Plan */}
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    startIcon={<ProIcon />}
                    color="warning"
                    onClick={() => {
                      setGrantPlanType(detailUser.planType as "FREE" | "PERSONAL" | "PREMIUM");
                      openConfirm("grant-pro", detailUser.id, detailUser.username);
                    }}
                  >
                    Manage Plan
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

                {/* Revoke Sessions */}
                <Grid item xs={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="small"
                    color="warning"
                    onClick={async () => {
                      try {
                        await apiRequest.delete(`/admin/users/${detailUser.id}/sessions`);
                        toast.success("All sessions revoked");
                      } catch {
                        toast.error("Failed to revoke sessions");
                      }
                    }}
                  >
                    Revoke Sessions
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
          {confirmAction?.type === "grant-pro" && "Manage User Plan"}
          {confirmAction?.type === "save-changes" && "Update User Info"}
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
              Reset trial uses for <strong>{confirmAction.username}</strong> back to {maxTrialUses}?
            </Alert>
          )}

          {/* Manage Plan — plan selector + duration */}
          {confirmAction?.type === "grant-pro" && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Set plan for <strong>{confirmAction.username}</strong>.
              </Alert>
              <TextField
                select
                label="Plan Type"
                fullWidth
                size="small"
                value={grantPlanType}
                onChange={(e) => setGrantPlanType(e.target.value as "FREE" | "PERSONAL" | "PREMIUM")}
                sx={{ mb: 2 }}
              >
                <MenuItem value="FREE">FREE</MenuItem>
                <MenuItem value="PERSONAL">PERSONAL</MenuItem>
                <MenuItem value="PREMIUM">PREMIUM</MenuItem>
              </TextField>
              {grantPlanType !== "FREE" && (
                <TextField
                  label="Duration (days)"
                  type="number"
                  fullWidth
                  size="small"
                  value={proDays}
                  onChange={(e) => setProDays(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1, max: 365 }}
                  helperText={`Subscription will be active for ${proDays} day(s)`}
                />
              )}
              {grantPlanType === "FREE" && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  This will remove the paid subscription and revert to the Free plan.
                </Alert>
              )}
            </>
          )}

          {/* Save Changes */}
          {confirmAction?.type === "save-changes" && pendingPayload && (
            <Alert severity="warning">
              Update <strong>{confirmAction.username}</strong>'s info?
              {pendingPayload.username && (
                <>
                  <br />
                  Username → <strong>{String(pendingPayload.username)}</strong>
                </>
              )}
              {pendingPayload.email && (
                <>
                  <br />
                  Email → <strong>{String(pendingPayload.email)}</strong>
                </>
              )}
              {pendingPayload.password && (
                <>
                  <br />
                  Password → <strong>********</strong>
                </>
              )}
            </Alert>
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
