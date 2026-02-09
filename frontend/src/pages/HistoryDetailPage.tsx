import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { ArrowBack as ArrowBackIcon, Download as DownloadIcon, ThumbUp as ThumbUpIcon } from "@mui/icons-material";
import { format } from "date-fns";
import { scraperService } from "@/services/scraper.service";
import { queryKeys } from "@/lib/query-client";
import { LoadingSpinner, ErrorMessage } from "@/components/common";
import type { Comment } from "@/types";

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.history.detail(id!),
    queryFn: () => scraperService.getHistoryDetail(id!),
    enabled: !!id,
  });

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    try {
      const blob = await scraperService.exportComments(id!, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comments-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading scrape details..." />;
  }

  if (error || !data) {
    return (
      <ErrorMessage
        title="Failed to load details"
        message="Could not load the scrape details. Please try again."
        onRetry={() => navigate("/history")}
      />
    );
  }

  const scrape = data.data!;
  const comments = scrape.comments;

  return (
    <Box>
      {/* Back Button */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/history")} sx={{ mb: 3 }}>
        Back to History
      </Button>

      {/* Scrape Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Scrape Details
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                {scrape.url}
              </Typography>
            </Box>
            <Chip label={scrape.status} color={scrape.status === "SUCCESS" ? "success" : "default"} />
          </Box>

          <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap", mb: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Platform
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {scrape.platform}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Total Comments
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {scrape.totalComments.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {format(new Date(scrape.createdAt), "MMM dd, yyyy HH:mm")}
              </Typography>
            </Box>
          </Box>

          {/* Export Buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleExport("xlsx")} size="small">
              Export XLSX
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport("csv")} size="small">
              Export CSV
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport("json")} size="small">
              Export JSON
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Comments ({comments.length})
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Comment</TableCell>
                  <TableCell align="right">Likes</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comments.map((comment: Comment) => (
                  <TableRow key={comment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        @{comment.username}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          maxWidth: 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {comment.content}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                        <ThumbUpIcon fontSize="small" sx={{ color: "text.secondary" }} />
                        <Typography variant="body2">{comment.likes.toLocaleString()}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {comment.timestamp ? format(new Date(comment.timestamp), "MMM dd, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
