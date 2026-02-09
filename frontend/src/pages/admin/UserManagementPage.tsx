import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import {
  Search as SearchIcon,
  Block as BanIcon,
  CheckCircle as UnbanIcon,
  Star as ProIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import { format } from "date-fns";
import { apiRequest } from "@/services/api";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, EmptyState } from "@/components/common";
import toast from "react-hot-toast";
import type { User } from "@/types";

export default function UserManagementPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"ban" | "unban" | "pro" | null>(null);

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
  });

  const banMutation = useMutation({
    mutationFn: (userId: string) => apiRequest.post(`/admin/users/${userId}/ban`),
    onSuccess: () => {
      toast.success("User banned successfully");
      refetch();
      handleCloseDialog();
    },
    onError: () => toast.error("Failed to ban user"),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => apiRequest.post(`/admin/users/${userId}/unban`),
    onSuccess: () => {
      toast.success("User unbanned successfully");
      refetch();
      handleCloseDialog();
    },
    onError: () => toast.error("Failed to unban user"),
  });

  const grantProMutation = useMutation({
    mutationFn: (userId: string) => apiRequest.post(`/admin/users/${userId}/grant-pro`),
    onSuccess: () => {
      toast.success("Pro subscription granted");
      refetch();
      handleCloseDialog();
    },
    onError: () => toast.error("Failed to grant Pro subscription"),
  });

  const handleCloseDialog = () => {
    setSelectedUser(null);
    setActionType(null);
  };

  const handleAction = () => {
    if (!selectedUser) return;

    switch (actionType) {
      case "ban":
        banMutation.mutate(String(selectedUser.id));
        break;
      case "unban":
        unbanMutation.mutate(String(selectedUser.id));
        break;
      case "pro":
        grantProMutation.mutate(String(selectedUser.id));
        break;
    }
  };

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
            placeholder="Search by email or name..."
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
                    <TableCell>Joined</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id} hover>
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
                      <TableCell>{format(new Date(user.createdAt), "MMM dd, yyyy")}</TableCell>
                      <TableCell align="center">
                        {user.isBanned ? (
                          <Tooltip title="Unban User">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType("unban");
                              }}
                            >
                              <UnbanIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Ban User">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType("ban");
                              }}
                            >
                              <BanIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {user.planType !== "PRO" && (
                          <Tooltip title="Grant Pro">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => {
                                setSelectedUser(user);
                                setActionType("pro");
                              }}
                            >
                              <ProIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!actionType} onClose={handleCloseDialog}>
        <DialogTitle>
          {actionType === "ban" && "Ban User"}
          {actionType === "unban" && "Unban User"}
          {actionType === "pro" && "Grant Pro Subscription"}
        </DialogTitle>
        <DialogContent>
          <Alert severity={actionType === "ban" ? "warning" : "info"} sx={{ mt: 1 }}>
            {actionType === "ban" &&
              `Are you sure you want to ban ${selectedUser?.username}? They will no longer be able to access the platform.`}
            {actionType === "unban" &&
              `Are you sure you want to unban ${selectedUser?.username}? They will regain access to the platform.`}
            {actionType === "pro" && `Are you sure you want to grant Pro subscription to ${selectedUser?.username}?`}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            variant="contained"
            color={actionType === "ban" ? "error" : "primary"}
            onClick={handleAction}
            disabled={banMutation.isPending || unbanMutation.isPending || grantProMutation.isPending}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
