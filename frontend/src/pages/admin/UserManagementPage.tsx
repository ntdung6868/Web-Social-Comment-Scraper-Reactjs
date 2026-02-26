import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useLanguageStore } from "@/stores/language.store";
import { formatDateVi, formatDateTimeVi } from "@/utils/helpers";

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
  const { t } = useTranslation();
  const { language } = useLanguageStore();
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
    refetchInterval: 10000,
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
      toast.success(t("admin.userBanned"));
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error(t("admin.banFailed")),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.post(`/admin/users/${userId}/unban`),
    onSuccess: () => {
      toast.success(t("admin.userUnbanned"));
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error(t("admin.unbanFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      toast.success(t("admin.userDeleted"));
      closeConfirm();
      setDetailUserId(null);
      refreshAll();
    },
    onError: () => toast.error(t("admin.deleteFailed")),
  });

  const resetTrialMutation = useMutation({
    mutationFn: (userId: number) => apiRequest.post(`/admin/users/${userId}/reset-trial`, {}),
    onSuccess: () => {
      toast.success(t("admin.trialReset"));
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error(t("admin.resetFailed")),
  });

  const grantProMutation = useMutation({
    mutationFn: ({ userId, durationDays, planType }: { userId: number; durationDays: number; planType: string }) =>
      apiRequest.post(`/admin/users/${userId}/grant-pro`, { durationDays, planType }),
    onSuccess: () => {
      toast.success(t("admin.planUpdated"));
      closeConfirm();
      refreshAll();
    },
    onError: () => toast.error(t("admin.updatePlanFailed")),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Record<string, unknown> }) =>
      apiRequest.patch(`/admin/users/${userId}`, data),
    onSuccess: () => {
      toast.success(t("admin.userUpdated"));
      refreshAll();
    },
    onError: () => toast.error(t("admin.updateUserFailed")),
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
    return <LoadingSpinner message={t("common.loading")} />;
  }

  const users = data?.data?.data ?? [];
  const total = data?.data?.pagination?.totalItems ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {t("nav.adminUsers")}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t("admin.manageUsers")}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => refetch()}>
          {t("common.refresh")}
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            placeholder={t("admin.searchPlaceholder")}
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
            label={t("admin.plan")}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">{t("admin.allPlans")}</MenuItem>
            <MenuItem value="FREE">{t("pricing.freePlan")}</MenuItem>
            <MenuItem value="PERSONAL">{t("pricing.personalPlan")}</MenuItem>
            <MenuItem value="PREMIUM">{t("pricing.premiumPlan")}</MenuItem>
          </TextField>
        </Box>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
        {users.length === 0 ? (
          <EmptyState title={t("admin.noUsers")} message={t("admin.noUsersMessage")} />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow
                    sx={{
                      "& th": {
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        fontWeight: 700,
                        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.05),
                        borderBottom: "2px solid",
                        borderColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                      },
                    }}
                  >
                    <TableCell>{t("common.user")}</TableCell>
                    <TableCell>{t("admin.plan")}</TableCell>
                    <TableCell>{t("common.status")}</TableCell>
                    <TableCell>{t("admin.trialUses")}</TableCell>
                    <TableCell>{t("admin.joined")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id} hover onClick={() => setDetailUserId(user.id)} sx={{ cursor: "pointer", transition: "background-color 0.2s ease" }}>
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
                          <Chip label={t("admin.banned")} size="small" color="error" />
                        ) : (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Chip label={user.planStatus} size="small" color="success" variant="outlined" />
                            {(user as unknown as { distinctIpCount?: number }).distinctIpCount !== undefined &&
                              (user as unknown as { distinctIpCount: number }).distinctIpCount > 3 && (
                                <Chip
                                  icon={<WarningIcon />}
                                  label={`${(user as unknown as { distinctIpCount: number }).distinctIpCount} ${t("admin.ips")}`}
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
                      <TableCell>{language === "vi" ? formatDateVi(user.createdAt) : format(new Date(user.createdAt), "MMM dd, yyyy")}</TableCell>
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
                  label={detailUser.isAdmin ? t("common.admin") : t("common.user")}
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
                {detailUser.isBanned && <Chip label={t("admin.banned")} size="small" color="error" />}
                {detailUser.distinctIpCount !== undefined && detailUser.distinctIpCount > 3 && (
                  <Chip
                    icon={<WarningIcon />}
                    label={`${detailUser.distinctIpCount} ${t("admin.ipsDetected")}`}
                    size="small"
                    color="warning"
                    variant="filled"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Stack>

              {/* Editable Fields */}
              <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                {t("admin.editUserInfo")}
              </Typography>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    label={t("common.username")}
                    size="small"
                    fullWidth
                    defaultValue={detailUser.username}
                    onChange={(e) => setEditUsername(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t("common.email")}
                    size="small"
                    fullWidth
                    defaultValue={detailUser.email}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label={t("admin.newPassword")}
                    size="small"
                    fullWidth
                    type="password"
                    placeholder={t("admin.leaveEmpty")}
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
                        toast.error(t("admin.noChanges"));
                        return;
                      }
                      setPendingPayload(payload);
                      openConfirm("save-changes", detailUser.id, detailUser.username);
                    }}
                  >
                    {updateUserMutation.isPending ? t("common.saving") : t("common.save")}
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
                  label={t("admin.planStatus")}
                  chip={<Chip label={detailUser.planStatus} size="small" color="info" variant="outlined" />}
                />
                <Divider />
                <InfoRow label={t("admin.trialUses")} value={`${detailUser.trialUses} / ${maxTrialUses}`} />
                <Divider />
                <InfoRow
                  label={t("admin.subscriptionEnd")}
                  value={
                    detailUser.subscriptionEnd
                      ? (language === "vi" ? formatDateTimeVi(detailUser.subscriptionEnd) : format(new Date(detailUser.subscriptionEnd), "MMM dd, yyyy HH:mm"))
                      : "—"
                  }
                />
                <Divider />
                <InfoRow label={t("admin.joined")} value={language === "vi" ? formatDateTimeVi(detailUser.createdAt) : format(new Date(detailUser.createdAt), "MMM dd, yyyy HH:mm")} />
                {detailUser.distinctIpCount !== undefined && (
                  <>
                    <Divider />
                    <InfoRow
                      label={t("admin.distinctIps")}
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
                    <InfoRow label={t("admin.totalScrapes")} value={detailUser.scrapeCount} />
                  </>
                )}
                {detailUser.isBanned && (
                  <>
                    <Divider />
                    <InfoRow label={t("admin.banReason")} value={detailUser.banReason || t("admin.noReason")} />
                    <Divider />
                    <InfoRow
                      label={t("admin.bannedAt")}
                      value={detailUser.bannedAt ? (language === "vi" ? formatDateTimeVi(detailUser.bannedAt) : format(new Date(detailUser.bannedAt), "MMM dd, yyyy HH:mm")) : "—"}
                    />
                  </>
                )}
              </Box>

              <Typography variant="subtitle2" sx={{ mb: 1.5, mt: 1 }}>
                {t("admin.quickActions")}
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
                      {t("admin.unban")}
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
                      {t("admin.banUser")}
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
                    {t("admin.managePlan")}
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
                    {t("admin.resetTrial")}
                  </Button>
                </Grid>

                {/* Edit Subscription End */}
                <Grid item xs={6}>
                  <TextField
                    type="date"
                    label={t("admin.subscriptionEnd")}
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
                    {t("admin.deleteUser")}
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
                        toast.success(t("admin.sessionsRevoked"));
                      } catch {
                        toast.error(t("admin.revokeFailed"));
                      }
                    }}
                  >
                    {t("admin.revokeSessions")}
                  </Button>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button onClick={() => setDetailUserId(null)} color="inherit">
                {t("common.close")}
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
          {confirmAction?.type === "ban" && t("admin.banUser")}
          {confirmAction?.type === "unban" && t("admin.unbanUser")}
          {confirmAction?.type === "delete" && t("admin.deleteUser")}
          {confirmAction?.type === "reset-trial" && t("admin.resetTrialUses")}
          {confirmAction?.type === "grant-pro" && t("admin.manageUserPlan")}
          {confirmAction?.type === "save-changes" && t("admin.updateUserInfo")}
        </DialogTitle>
        <DialogContent>
          {/* Ban — needs reason */}
          {confirmAction?.type === "ban" && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>{confirmAction.username}</strong> {t("admin.banWarning")}
              </Alert>
              <TextField
                label={t("admin.banReason")}
                fullWidth
                size="small"
                multiline
                rows={2}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={t("admin.banReasonPlaceholder")}
              />
            </>
          )}

          {/* Unban */}
          {confirmAction?.type === "unban" && (
            <Alert severity="info">
              <strong>{confirmAction.username}</strong> {t("admin.unbanWarning")}
            </Alert>
          )}

          {/* Delete */}
          {confirmAction?.type === "delete" && (
            <Alert severity="error">
              {t("admin.deleteWarning")} <strong>{confirmAction.username}</strong>?
            </Alert>
          )}

          {/* Reset Trial */}
          {confirmAction?.type === "reset-trial" && (
            <Alert severity="info">
              {t("admin.resetTrialMessage")} <strong>{confirmAction.username}</strong> {t("admin.resetTrialBack")} {maxTrialUses}?
            </Alert>
          )}

          {/* Manage Plan — plan selector + duration */}
          {confirmAction?.type === "grant-pro" && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                {t("admin.setPlanMessage")} <strong>{confirmAction.username}</strong>.
              </Alert>
              <TextField
                select
                label={t("admin.planType")}
                fullWidth
                size="small"
                value={grantPlanType}
                onChange={(e) => setGrantPlanType(e.target.value as "FREE" | "PERSONAL" | "PREMIUM")}
                sx={{ mb: 2 }}
              >
                <MenuItem value="FREE">{t("pricing.freePlan")}</MenuItem>
                <MenuItem value="PERSONAL">{t("pricing.personalPlan")}</MenuItem>
                <MenuItem value="PREMIUM">{t("pricing.premiumPlan")}</MenuItem>
              </TextField>
              {grantPlanType !== "FREE" && (
                <TextField
                  label={t("admin.durationDays")}
                  type="number"
                  fullWidth
                  size="small"
                  value={proDays}
                  onChange={(e) => setProDays(Math.max(1, parseInt(e.target.value) || 1))}
                  inputProps={{ min: 1, max: 365 }}
                  helperText={t("admin.subscriptionDays", { count: proDays })}
                />
              )}
              {grantPlanType === "FREE" && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t("admin.freePlanWarning")}
                </Alert>
              )}
            </>
          )}

          {/* Save Changes */}
          {confirmAction?.type === "save-changes" && pendingPayload && (
            <Alert severity="warning">
              {t("admin.updateInfoMessage")} <strong>{confirmAction.username}</strong>?
              {pendingPayload.username && (
                <>
                  <br />
                  {t("common.username")} → <strong>{String(pendingPayload.username)}</strong>
                </>
              )}
              {pendingPayload.email && (
                <>
                  <br />
                  {t("common.email")} → <strong>{String(pendingPayload.email)}</strong>
                </>
              )}
              {pendingPayload.password && (
                <>
                  <br />
                  {t("common.password")} → <strong>********</strong>
                </>
              )}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirm} color="inherit">
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color={confirmAction?.type === "delete" || confirmAction?.type === "ban" ? "error" : "primary"}
            onClick={executeConfirm}
            disabled={isConfirmPending}
          >
            {isConfirmPending ? t("common.processing") : t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
