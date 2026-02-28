import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  alpha,
  Tooltip,
  Grid,
  Stack,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  ArrowForward as ArrowForwardIcon,
  EmojiEvents as CrownIcon,
  Close as CloseIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  SupportAgent as SupportIcon,
  ArrowDownward as DowngradeIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  Timer as TimerIcon,
} from "@mui/icons-material";
import { useAuthStore } from "@/stores/auth.store";
import { userService } from "@/services/user.service";
import { apiRequest } from "@/services/api";
import { paymentService } from "@/services/payment.service";
import { useSocket } from "@/hooks/useSocket";
import type { PlanType, PaymentSuccessEvent } from "@/types";

const PLAN_RANK: Record<PlanType, number> = { FREE: 0, PERSONAL: 1, PREMIUM: 2 };

interface PlanFeature {
  text: string;
  tooltip?: string;
}

interface PricingPlan {
  id: PlanType;
  name: string;
  price: string;
  period: string;
  features: PlanFeature[];
  buttonText: string;
  buttonTextCurrent?: string;
  highlighted?: boolean;
  badge?: string;
  gradient: string;
  chipColor: "default" | "primary" | "secondary";
}

interface PricingData {
  pricing: {
    FREE: { price: number };
    PERSONAL: { price: number; duration: number };
    PREMIUM: { price: number; duration: number };
  };
  maxComments: Record<string, number>;
  retention: Record<string, number>;
  maxTrialUses: number;
  contact: { email: string; phone: string };
}

function buildPlans(data?: PricingData, t?: ReturnType<typeof useTranslation>["t"]): PricingPlan[] {
  const p = data?.pricing;
  const mc = data?.maxComments;
  const ret = data?.retention;
  const trials = data?.maxTrialUses ?? 3;

  const freePrice = p?.FREE?.price ?? 0;
  const personalPrice = p?.PERSONAL?.price ?? 23;
  const premiumPrice = p?.PREMIUM?.price ?? 45;
  const personalDuration = p?.PERSONAL?.duration ?? 3;
  const premiumDuration = p?.PREMIUM?.duration ?? 30;

  const freeMax = mc?.FREE ?? 100;
  const personalMax = mc?.PERSONAL ?? 5000;
  const premiumMax = mc?.PREMIUM ?? 50000;

  const freeRet = ret?.FREE ?? 1;
  const personalRet = ret?.PERSONAL ?? 3;
  const premiumRet = ret?.PREMIUM ?? 5;

  const fmtDuration = (d: number) => (d === 30 ? t ? t("pricing.perMonth") : "/ mo" : d === 1 ? t ? t("pricing.perDay") : "/ day" : t ? t("pricing.perDays", { days: d }) : `/ ${d} days`);

  const tt = (key: string, options?: Record<string, unknown>) => t ? t(key, options) : key;

  return [
    {
      id: "FREE",
      name: tt("pricing.freePlan"),
      price: `$${freePrice}`,
      period: "",
      gradient: "linear-gradient(135deg, #e8eaf6 0%, #f5f5f5 100%)",
      chipColor: "default",
      features: [
        { text: tt("pricing.freeComments", { count: freeMax.toLocaleString() }) },
        { text: tt("pricing.trialScrapes", { count: trials }), tooltip: tt("pricing.trialScrapesTooltip", { count: trials }) },
        { text: tt("pricing.limitedSupport"), tooltip: tt("pricing.limitedSupportTooltip") },
        {
          text: tt("pricing.dataRetention", { days: freeRet }),
          tooltip: tt("pricing.dataRetentionTooltip", { days: freeRet }),
        },
      ],
      buttonText: tt("pricing.getStarted"),
      buttonTextCurrent: tt("pricing.currentPlan"),
    },
    {
      id: "PERSONAL",
      name: tt("pricing.personalPlan"),
      price: `$${personalPrice}`,
      period: fmtDuration(personalDuration),
      gradient: "linear-gradient(135deg, #e3f2fd 0%, #f5f5f5 100%)",
      chipColor: "primary",
      features: [
        { text: tt("pricing.personalComments", { count: personalMax.toLocaleString() }) },
        { text: tt("pricing.unlimitedExports"), tooltip: tt("pricing.unlimitedExportsTooltip") },
        { text: tt("pricing.noRecurring"), tooltip: tt("pricing.noRecurringTooltip") },
        { text: tt("pricing.standardSupport"), tooltip: tt("pricing.standardSupportTooltip") },
        { text: tt("pricing.allPlatforms"), tooltip: tt("pricing.allPlatformsTooltip") },
        {
          text: tt("pricing.dataRetention", { days: personalRet }),
          tooltip: tt("pricing.dataRetentionTooltip", { days: personalRet }),
        },
      ],
      buttonText: tt("pricing.buyNow"),
      buttonTextCurrent: tt("pricing.currentPlan"),
    },
    {
      id: "PREMIUM",
      name: tt("pricing.premiumPlan"),
      price: `$${premiumPrice}`,
      period: fmtDuration(premiumDuration),
      highlighted: true,
      badge: tt("pricing.mostPopular"),
      gradient: "linear-gradient(135deg, #7c4dff 0%, #536dfe 50%, #448aff 100%)",
      chipColor: "secondary",
      features: [
        { text: tt("pricing.premiumComments", { count: premiumMax.toLocaleString() }) },
        { text: tt("pricing.unlimitedExports"), tooltip: tt("pricing.unlimitedExportsTooltip") },
        { text: tt("pricing.scheduledExports"), tooltip: tt("pricing.scheduledExportsTooltip") },
        {
          text: premiumDuration === 30 ? tt("pricing.billedMonthly") : tt("pricing.validForDays", { days: premiumDuration }),
          tooltip: tt("pricing.cancelAnytime"),
        },
        { text: tt("pricing.prioritySupport"), tooltip: tt("pricing.prioritySupportTooltip") },
        { text: tt("pricing.allPlatforms"), tooltip: tt("pricing.allPlatformsTooltip") },
        {
          text: tt("pricing.dataRetention", { days: premiumRet }),
          tooltip: tt("pricing.dataRetentionTooltip", { days: premiumRet }),
        },
      ],
      buttonText: tt("pricing.buyNow"),
      buttonTextCurrent: tt("pricing.currentPlan"),
    },
  ];
}

function FeatureItem({ feature }: { feature: PlanFeature }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.8 }}>
      <CheckIcon sx={{ fontSize: 22, color: "success.main", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: "text.primary", lineHeight: 1.4 }}>
        {feature.text}
        {feature.tooltip && (
          <Tooltip title={feature.tooltip} arrow placement="top">
            <InfoIcon
              sx={{
                fontSize: 15,
                ml: 0.5,
                color: "text.disabled",
                cursor: "help",
                verticalAlign: "middle",
              }}
            />
          </Tooltip>
        )}
      </Typography>
    </Stack>
  );
}

function PricingCard({
  plan,
  isCurrentPlan,
  isLowerPlan,
  isExpired,
  loadingPlanId,
  onBuyClick,
  onDowngradeClick,
  t,
}: {
  plan: PricingPlan;
  isCurrentPlan: boolean;
  isLowerPlan: boolean;
  isExpired: boolean;
  loadingPlanId: PlanType | null;
  onBuyClick: (planId: PlanType) => void;
  onDowngradeClick: (planId: PlanType) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const isHighlighted = plan.highlighted;

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      {/* Most Popular badge */}
      {plan.badge && !isCurrentPlan && (
        <Box
          sx={{
            position: "absolute",
            top: -16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
          }}
        >
          <Chip
            icon={<CrownIcon sx={{ fontSize: 16, color: "#ffc107 !important" }} />}
            label={plan.badge}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: "0.75rem",
              background: "linear-gradient(135deg, #7c4dff 0%, #536dfe 100%)",
              color: "#fff",
              px: 1,
              "& .MuiChip-icon": { ml: 0.5 },
            }}
          />
        </Box>
      )}

      {/* Current Plan badge */}
      {isCurrentPlan && (
        <Box
          sx={{
            position: "absolute",
            top: -16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
          }}
        >
          <Chip
            icon={
              isExpired ? (
                <WarningIcon sx={{ fontSize: 16, color: "#fff !important" }} />
              ) : (
                <CheckIcon sx={{ fontSize: 16, color: "#fff !important" }} />
              )
            }
            label={isExpired ? t("pricing.expired") : t("pricing.currentPlan")}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: "0.75rem",
              background: isExpired
                ? "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)"
                : "linear-gradient(135deg, #43a047 0%, #66bb6a 100%)",
              color: "#fff",
              px: 1,
              "& .MuiChip-icon": { ml: 0.5 },
            }}
          />
        </Box>
      )}

      <Card
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "visible",
          border: isCurrentPlan ? "2px solid" : isHighlighted ? "2px solid" : "1px solid",
          borderColor: isCurrentPlan
            ? "success.main"
            : isHighlighted
              ? "primary.main"
              : (theme) => alpha(theme.palette.divider, 0.3),
          borderRadius: 3,
          transition: "all 0.3s ease",
          boxShadow: isCurrentPlan
            ? (theme) => `0 8px 40px ${alpha(theme.palette.success.main, 0.25)}`
            : isHighlighted
              ? (theme) => `0 8px 40px ${alpha(theme.palette.primary.main, 0.25)}`
              : "none",
          "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: (theme) =>
              isCurrentPlan
                ? `0 12px 48px ${alpha(theme.palette.success.main, 0.35)}`
                : isHighlighted
                  ? `0 12px 48px ${alpha(theme.palette.primary.main, 0.35)}`
                  : `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 3,
            pb: 2,
            textAlign: "center",
            background: isHighlighted ? plan.gradient : "transparent",
            borderRadius: isHighlighted ? "34px 34px 0 0" : 0,
          }}
        >
          <Chip
            label={plan.name}
            size="small"
            color={plan.chipColor}
            variant={isHighlighted ? "filled" : "outlined"}
            sx={{
              fontWeight: 700,
              fontSize: "0.8rem",
              letterSpacing: 1,
              mb: 2,
              ...(isHighlighted && {
                color: "#fff",
                backgroundColor: (theme) => alpha(theme.palette.common.white, 0.2),
              }),
            }}
          />
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 0.5 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: isHighlighted ? "#fff" : "text.primary",
              }}
            >
              {plan.price}
            </Typography>
            {plan.period && (
              <Typography
                variant="body1"
                sx={{
                  color: isHighlighted ? alpha("#fff", 0.8) : "text.secondary",
                  fontStyle: "italic",
                }}
              >
                {plan.period}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Features */}
        <CardContent sx={{ flexGrow: 1, px: 3, pt: 2 }}>
          <Stack spacing={0}>
            {plan.features.map((feature, idx) => (
              <FeatureItem key={idx} feature={feature} />
            ))}
          </Stack>
        </CardContent>

        {/* Button */}
        <Box sx={{ p: 3, pt: 0 }}>
          {isCurrentPlan && !isExpired ? (
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                "&.Mui-disabled": {
                  background: "linear-gradient(135deg, #43a047 0%, #66bb6a 100%)",
                  color: "#fff",
                },
              }}
            >
              {t("pricing.currentPlan")}
            </Button>
          ) : isCurrentPlan && isExpired && plan.id === "FREE" ? (
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                "&.Mui-disabled": {
                  background: "linear-gradient(135deg, #78909c 0%, #546e7a 100%)",
                  color: "#fff",
                  opacity: 0.85,
                },
              }}
            >
              {t("pricing.trialEnded")}
            </Button>
          ) : isCurrentPlan && isExpired ? (
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={loadingPlanId !== null}
              startIcon={loadingPlanId === plan.id ? <CircularProgress size={18} color="inherit" /> : undefined}
              onClick={() => onBuyClick(plan.id)}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                background: "linear-gradient(135deg, #ff9800 0%, #f57c00 100%)",
                "&:hover": {
                  background: "linear-gradient(135deg, #f57c00 0%, #e65100 100%)",
                },
              }}
            >
              {t("pricing.renewPlan")}
            </Button>
          ) : isLowerPlan ? (
            <Button
              fullWidth
              variant="text"
              size="large"
              startIcon={<DowngradeIcon />}
              onClick={() => (plan.id === "FREE" || !isExpired ? onDowngradeClick(plan.id) : onBuyClick(plan.id))}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                color: "warning.main",
                border: "1px solid",
                borderColor: (theme) => alpha(theme.palette.warning.main, 0.4),
                "&:hover": {
                  backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.08),
                  borderColor: "warning.main",
                },
              }}
            >
              {t("pricing.downgrade")}
            </Button>
          ) : (
            <Button
              fullWidth
              variant={isHighlighted ? "contained" : plan.name === t("pricing.personalPlan") ? "outlined" : "text"}
              size="large"
              disabled={loadingPlanId !== null}
              startIcon={loadingPlanId === plan.id ? <CircularProgress size={18} color="inherit" /> : undefined}
              endIcon={loadingPlanId === plan.id ? undefined : <ArrowForwardIcon />}
              onClick={() => onBuyClick(plan.id)}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                fontSize: "0.95rem",
                textTransform: "none",
                ...(isHighlighted && {
                  background: "linear-gradient(135deg, #7c4dff 0%, #536dfe 100%)",
                  "&:hover": {
                    background: "linear-gradient(135deg, #651fff 0%, #304ffe 100%)",
                  },
                }),
                ...(plan.name === t("pricing.personalPlan") && {
                  borderColor: "primary.main",
                  borderWidth: 2,
                  "&:hover": {
                    borderWidth: 2,
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }),
              }}
            >
              {plan.buttonText}
            </Button>
          )}
        </Box>
      </Card>
    </Box>
  );
}

// ===========================================
// Admin Contact Modal
// ===========================================
function AdminContactModal({
  open,
  onClose,
  contactEmail,
  contactPhone,
  t,
}: {
  open: boolean;
  onClose: () => void;
  contactEmail: string;
  contactPhone: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const displayEmail = contactEmail || "ntdungdev73@gmail.com";
  const displayPhone = contactPhone || "0373 527 362";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: "hidden",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #5c6bc0 0%, #7c4dff 100%)",
          px: 3,
          py: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SupportIcon sx={{ color: "#fff", fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff" }}>
            {t("pricing.contactAdminModal")}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: alpha("#fff", 0.8), "&:hover": { color: "#fff" } }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
          {t("pricing.contactAdminSubtitle")}
        </Typography>

        {/* Email */}
        <Box
          component="a"
          href={`mailto:${displayEmail}`}
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2.5,
            mb: 2,
            borderRadius: 3,
            textDecoration: "none",
            backgroundColor: (theme) => alpha(theme.palette.info.main, 0.06),
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.info.main, 0.15),
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: (theme) => alpha(theme.palette.info.main, 0.12),
              transform: "translateX(4px)",
            },
          }}
        >
          <Avatar sx={{ bgcolor: "info.main", width: 48, height: 48 }}>
            <EmailIcon />
          </Avatar>
          <Box sx={{ ml: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("common.email")}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: "info.main" }}>
              {displayEmail}
            </Typography>
          </Box>
        </Box>

        {/* Phone */}
        <Box
          component="a"
          href={`tel:${displayPhone.replace(/\s/g, "")}`}
          sx={{
            display: "flex",
            alignItems: "center",
            p: 2.5,
            mb: 2,
            borderRadius: 3,
            textDecoration: "none",
            backgroundColor: (theme) => alpha(theme.palette.success.main, 0.06),
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.success.main, 0.15),
            transition: "all 0.2s",
            "&:hover": {
              backgroundColor: (theme) => alpha(theme.palette.success.main, 0.12),
              transform: "translateX(4px)",
            },
          }}
        >
          <Avatar sx={{ bgcolor: "success.main", width: 48, height: 48 }}>
            <PhoneIcon />
          </Avatar>
          <Box sx={{ ml: 2, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("pricing.phone")}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, color: "success.main" }}>
              {displayPhone}
            </Typography>
          </Box>
        </Box>

        {/* Close Button */}
        <Button
          fullWidth
          variant="outlined"
          onClick={onClose}
          sx={{ mt: 1, py: 1.2, borderRadius: 2, fontWeight: 600, textTransform: "none" }}
        >
          {t("common.close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================
// Pricing Page
// ===========================================
export default function PricingPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuthStore();
  const { search } = useLocation();

  const [contactOpen, setContactOpen] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState<PlanType | null>(null);
  const [downgrading, setDowngrading] = useState(false);
  const [resultSnackbar, setResultSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({ open: false, message: "", severity: "success" });

  // Payment state
  const [loadingPlanId, setLoadingPlanId] = useState<PlanType | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    planId: PlanType | null;
    qrUrl: string;
    amount: number;
    orderCode: number;
    description: string;
    bankName: string;
    bankAcc: string;
    accountName: string;
  }>({ open: false, planId: null, qrUrl: "", amount: 0, orderCode: 0, description: "", bankName: "", bankAcc: "", accountName: "" });
  const [timeLeft, setTimeLeft] = useState(900);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    open: boolean;
    planType: string;
    expiresAt: string;
  }>({ open: false, planType: "", expiresAt: "" });

  const currentPlan = user?.planType ?? "FREE";
  const isExpired =
    user?.planStatus === "EXPIRED" || (user?.subscriptionEnd != null && new Date(user.subscriptionEnd) < new Date());

  // Fetch pricing from API
  const { data: pricingData } = useQuery({
    queryKey: ["settings", "pricing"],
    queryFn: () => apiRequest.get<{ success: boolean; data: PricingData }>("/settings/pricing"),
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const plans = buildPlans(pricingData?.data, t);

  // Socket: listen for payment:success (real-time upgrade after webhook)
  useSocket(undefined, {
    onPaymentSuccess: (data: PaymentSuccessEvent) => {
      setPaymentModal((prev) => ({ ...prev, open: false }));
      setPaymentSuccess({ open: true, planType: data.planType, expiresAt: data.planExpiresAt });
      void refreshUser();
    },
  });

  // Return URL polling: when PayOS redirects back with ?orderCode=X, poll for PAID status
  useEffect(() => {
    const params = new URLSearchParams(search);
    const rawCode = params.get("orderCode");
    if (!rawCode) return;

    const orderCode = Number(rawCode);
    if (!orderCode) return;

    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await paymentService.getOrderStatus(orderCode);
        if (res.data?.status === "PAID") {
          clearInterval(timer);
          await refreshUser();
          setPaymentSuccess({
            open: true,
            planType: res.data.planType,
            expiresAt: "",
          });
        }
      } catch {
        // ignore transient errors
      }
      if (attempts >= 5) {
        clearInterval(timer);
        setResultSnackbar({
          open: true,
          message: t("pricing.paymentPollFailed"),
          severity: "info",
        });
        void refreshUser();
      }
    }, 3000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Active polling while QR modal is open — primary detection path for SePay.
  // Calls refreshUser() every 3 s and compares the returned plan against what
  // the user purchased. Clears itself when the plan is upgraded OR the modal
  // is closed manually (cleanup function).
  useEffect(() => {
    if (!paymentModal.open || !paymentModal.planId) return;

    const expectedPlan = paymentModal.planId;

    const timer = setInterval(async () => {
      try {
        await refreshUser();
        // Read fresh Zustand state after the async refresh — avoids stale closure on `user`
        const fresh = useAuthStore.getState().user;
        if (fresh?.planType === expectedPlan && fresh?.planStatus === "ACTIVE") {
          clearInterval(timer);
          setPaymentModal((prev) => ({ ...prev, open: false }));
          setPaymentSuccess({
            open: true,
            planType: fresh.planType,
            expiresAt: fresh.subscriptionEnd ?? "",
          });
        }
      } catch {
        // ignore transient network errors; interval keeps running
      }
    }, 3000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentModal.open, paymentModal.planId]);

  // Countdown: tick every second while modal is open
  useEffect(() => {
    if (!paymentModal.open || timeLeft <= 0) return;
    const tick = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(tick);
  }, [paymentModal.open, timeLeft]);

  // Expiration: auto-close modal when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && paymentModal.open) {
      setPaymentModal((prev) => ({ ...prev, open: false }));
      setLoadingPlanId(null);
      setResultSnackbar({ open: true, message: "Thời gian giao dịch đã hết. Vui lòng thử lại.", severity: "warning" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setResultSnackbar({ open: true, message: "Đã copy!", severity: "success" });
    });
  };

  const handleBuyClick = async (planId: PlanType) => {
    if (planId === "FREE") return;
    setLoadingPlanId(planId);
    try {
      const res = await paymentService.createPaymentLink(planId as "PERSONAL" | "PREMIUM");
      const { qrUrl, amount, orderCode, description, bankName, bankAcc, accountName } = res.data!;
      setTimeLeft(900);
      setPaymentModal({ open: true, planId, qrUrl, amount, orderCode, description, bankName, bankAcc, accountName });
    } catch {
      setResultSnackbar({ open: true, message: t("pricing.paymentLinkError"), severity: "error" });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleDowngradeClick = (planId: PlanType) => {
    setDowngradeTarget(planId);
  };

  const handleDowngradeConfirm = async () => {
    if (!downgradeTarget) return;
    setDowngrading(true);
    try {
      await userService.downgradePlan(downgradeTarget);
      await refreshUser();
      setResultSnackbar({
        open: true,
        message: t("pricing.downgradeSuccess", { plan: t(`pricing.${downgradeTarget.toLowerCase()}Plan`) }),
        severity: "success",
      });
    } catch {
      setResultSnackbar({
        open: true,
        message: t("pricing.downgradeFailed"),
        severity: "error",
      });
    } finally {
      setDowngrading(false);
      setDowngradeTarget(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", py: 4, px: 2 }}>
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 6 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1.5,
            background: "linear-gradient(135deg, #7c4dff 0%, #448aff 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {t("pricing.title")}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: "auto" }}>
          {t("pricing.subtitle")}
        </Typography>
      </Box>

      {/* Pricing Cards */}
      <Grid container spacing={4} alignItems="stretch" justifyContent="center">
        {plans.map((plan) => (
          <Grid item xs={12} sm={6} md={4} key={plan.name}>
            <PricingCard
              plan={plan}
              isCurrentPlan={plan.id === currentPlan}
              isLowerPlan={PLAN_RANK[plan.id] < PLAN_RANK[currentPlan]}
              isExpired={isExpired}
              loadingPlanId={loadingPlanId}
              onBuyClick={handleBuyClick}
              onDowngradeClick={handleDowngradeClick}
              t={t}
            />
          </Grid>
        ))}
      </Grid>

      {/* FAQ / Note */}
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <Typography variant="body2" color="text.secondary">
          {t("pricing.allPlans")}
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
          {t("pricing.priceNote")}{" "}
          <Typography
            component="span"
            variant="body2"
            sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            onClick={() => setContactOpen(true)}
          >
            {t("pricing.contactAdmin")}
          </Typography>
        </Typography>
      </Box>

      {/* Admin Contact Modal */}
      <AdminContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        contactEmail={pricingData?.data?.contact?.email ?? ""}
        contactPhone={pricingData?.data?.contact?.phone ?? ""}
        t={t}
      />

      {/* Downgrade Confirmation Dialog */}
      <Dialog
        open={!!downgradeTarget}
        onClose={() => !downgrading && setDowngradeTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 700,
            color: "warning.main",
            px: 3,
            pt: 3,
            pb: 1,
          }}
        >
          <WarningIcon />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "warning.main" }}>
            {t("pricing.confirmDowngrade")}
          </Typography>
        </Box>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            {t("pricing.downgradeMessage1")}{" "}
            <strong>{downgradeTarget ? t(`pricing.${downgradeTarget.toLowerCase()}Plan`) : ""}</strong>{" "}
            {t("pricing.downgradeMessage2")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("pricing.downgradeWarning")}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setDowngradeTarget(null)}
            disabled={downgrading}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleDowngradeConfirm}
            disabled={downgrading}
            startIcon={downgrading ? <CircularProgress size={18} color="inherit" /> : <DowngradeIcon />}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {downgrading ? t("pricing.downgradingButton") : t("pricing.downgradeButton")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Modal */}
      <Dialog
        open={paymentModal.open}
        onClose={() => setPaymentModal((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, overflow: "hidden" } }}
      >
        {/* Header */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #5c6bc0 0%, #7c4dff 100%)",
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff" }}>
            {t("pricing.paymentModalTitle")}
          </Typography>
          <IconButton
            onClick={() => setPaymentModal((prev) => ({ ...prev, open: false }))}
            sx={{ color: alpha("#fff", 0.8), "&:hover": { color: "#fff" } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" } }}>

            {/* ── Left / Top: QR code + countdown ── */}
            <Box
              sx={{
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 3,
                borderRight: { md: "1px solid" },
                borderBottom: { xs: "1px solid", md: "none" },
                borderColor: "divider",
                minWidth: { md: 280 },
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textAlign: "center" }}>
                {t("pricing.paymentQRInstruction")}
              </Typography>

              {paymentModal.qrUrl && (
                <Box
                  component="img"
                  src={paymentModal.qrUrl}
                  alt="VietQR Payment Code"
                  sx={{ width: 220, height: "auto", borderRadius: 2, border: "1px solid", borderColor: "divider", mb: 2 }}
                />
              )}

              {/* Countdown timer */}
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <TimerIcon sx={{ fontSize: 18, color: timeLeft <= 60 ? "error.main" : "warning.main" }} />
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: timeLeft <= 60 ? "error.main" : "warning.main",
                  }}
                >
                  {formatTime(timeLeft)}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.disabled">
                Giao dịch tự động huỷ sau thời gian trên
              </Typography>

              {/* Waiting indicator */}
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2, color: "text.secondary" }}>
                <CircularProgress size={14} color="inherit" />
                <Typography variant="caption">{t("pricing.waitingForPayment")}</Typography>
              </Stack>
            </Box>

            {/* ── Right / Bottom: manual transfer details ── */}
            <Box sx={{ flex: 1, p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                {t("pricing.bankTransferInfo")}
              </Typography>

              {/* Helper component for each row */}
              {(
                [
                  { label: t("pricing.bankNameLabel"), value: paymentModal.bankName, copy: false },
                  { label: t("pricing.accountHolderLabel"), value: paymentModal.accountName, copy: false },
                  { label: t("pricing.accountNumberLabel"), value: paymentModal.bankAcc, copy: true },
                  { label: t("pricing.transferAmountLabel"), value: `${paymentModal.amount.toLocaleString("vi-VN")} ₫`, copy: true, copyRaw: String(paymentModal.amount) },
                  { label: t("pricing.transferContentLabel"), value: paymentModal.description, copy: true, highlight: true },
                ] as { label: string; value: string; copy: boolean; copyRaw?: string; highlight?: boolean }[]
              ).map(({ label, value, copy, copyRaw, highlight }) => (
                <Box
                  key={label}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 1.2,
                    px: 1.5,
                    mb: 0.75,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: highlight ? "warning.main" : "divider",
                    backgroundColor: highlight ? (theme) => alpha(theme.palette.warning.main, 0.07) : "transparent",
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.disabled" sx={{ display: "block", lineHeight: 1.2 }}>
                      {label}
                      {highlight && (
                        <Typography component="span" variant="caption" sx={{ color: "warning.dark", fontWeight: 700, ml: 0.5 }}>
                          {t("pricing.transferContentRequired")}
                        </Typography>
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: highlight ? 800 : 600, color: highlight ? "warning.dark" : "text.primary", wordBreak: "break-all" }}
                    >
                      {value}
                    </Typography>
                  </Box>
                  {copy && (
                    <IconButton
                      size="small"
                      onClick={() => handleCopy(copyRaw ?? value)}
                      sx={{ ml: 1, color: "primary.main", flexShrink: 0 }}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}

              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
                * Vui lòng chuyển đúng <strong>nội dung chuyển khoản</strong> để hệ thống tự động xác nhận.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Payment Success Dialog */}
      <Dialog
        open={paymentSuccess.open}
        onClose={() => setPaymentSuccess((prev) => ({ ...prev, open: false }))}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogContent sx={{ p: 4, textAlign: "center" }}>
          <Avatar
            sx={{
              bgcolor: "success.main",
              width: 72,
              height: 72,
              mx: "auto",
              mb: 2,
              background: "linear-gradient(135deg, #43a047 0%, #66bb6a 100%)",
            }}
          >
            <CrownIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>
            {t("pricing.paymentSuccessTitle")}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {paymentSuccess.expiresAt
              ? t("pricing.paymentSuccessMessage", {
                  plan: paymentSuccess.planType,
                  date: new Date(paymentSuccess.expiresAt).toLocaleDateString(),
                })
              : t("pricing.paymentSuccessMessageNoDate", { plan: paymentSuccess.planType })}
          </Typography>
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={() => setPaymentSuccess((prev) => ({ ...prev, open: false }))}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: "none",
              background: "linear-gradient(135deg, #43a047 0%, #66bb6a 100%)",
              "&:hover": { background: "linear-gradient(135deg, #388e3c 0%, #43a047 100%)" },
            }}
          >
            {t("common.close")}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Result Snackbar */}
      <Snackbar
        open={resultSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setResultSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setResultSnackbar((prev) => ({ ...prev, open: false }))}
          severity={resultSnackbar.severity}
          variant="filled"
          sx={{ width: "100%", fontWeight: 600 }}
        >
          {resultSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
