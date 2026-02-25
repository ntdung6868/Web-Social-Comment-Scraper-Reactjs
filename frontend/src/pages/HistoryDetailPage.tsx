import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { useLanguageStore } from "@/stores/language.store";
import { formatDateVi, formatDateTimeVi } from "@/utils/helpers";

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language } = useLanguageStore();

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
      const time = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
      a.download = `comments-${scrape.platform}-${time}.${format}`;
      a.click();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message={t("common.loading")} />;
  }

  if (error || !data) {
    return (
      <ErrorMessage
        title={t("history.notFound")}
        message={t("errors.errorOccurred")}
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
        {t("history.backToHistory")}
      </Button>

      {/* Scrape Info */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                {t("history.details")}
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
                {t("history.platform")}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {scrape.platform}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("scraper.totalComments")}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {scrape.totalComments.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("history.date")}
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {language === "vi" ? formatDateTimeVi(scrape.createdAt) : format(new Date(scrape.createdAt), "MMM dd, yyyy HH:mm")}
              </Typography>
            </Box>
          </Box>

          {/* Export Buttons */}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleExport("xlsx")} size="small">
              {t("history.exportXlsx")}
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport("csv")} size="small">
              {t("history.exportCsv")}
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => handleExport("json")} size="small">
              {t("history.exportJson")}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Comments Table */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {t("history.comments")} ({comments.length})
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("history.username")}</TableCell>
                  <TableCell>{t("history.comment")}</TableCell>
                  <TableCell align="right">{t("history.likes")}</TableCell>
                  <TableCell>{t("history.date")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {comments.map((comment: Comment) => (
                  <TableRow key={comment.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {comment.username}
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
                      {comment.timestamp ? (language === "vi" ? formatDateVi(comment.timestamp) : format(new Date(comment.timestamp), "MMM dd, yyyy")) : "-"}
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
