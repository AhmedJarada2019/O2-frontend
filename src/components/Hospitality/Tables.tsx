/**
 * Hospitality/Tables.tsx — صفحة إدارة الطاولات لقسم الضيافة
 * تصميم متجاوب للجوال: 4 طاولات في الصف
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../store";
import { useVisibilityInterval } from "../../hooks/useVisibilityInterval";
import { TableStatus, OrderType } from "../../../types";
import type { Table } from "../../../types";
import { HALLS as DEFAULT_HALLS } from "../../../constants";
import {
  Users,
  Clock,
  DollarSign,
  Move,
  Merge,
  Trash2,
  ExternalLink,
  X,
  Info,
  Map as MapIcon,
  Grid,
  ZoomIn,
  ZoomOut,
  Layout,
  Plus,
  Loader2,
  ReceiptText,
  ClipboardList,
  CreditCard,
  Banknote,
  Wallet,
  Landmark,
  User,
  Phone,
  Hash,
  CheckCircle,
  Send,
  Link2,
  Unlink,
  AlertTriangle,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  orderService,
  type OrderFromApi,
  type PaymentMethod as ApiPaymentMethod,
} from "../../services/orderService";
import { toast } from "../shared/Toast";
import api from "../../api/axios";

const formatMoney = (value: number | string | null | undefined) =>
  `${Number(value || 0).toFixed(2)} ₪`;

const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("ar-SA") : "---";

const getBranchFilter = (currentUser: unknown) => {
  const user = currentUser as
    | { branch_id?: number | string; branchId?: number | string }
    | null;
  const rawBranchId = user?.branch_id ?? user?.branchId;
  const branchId =
    typeof rawBranchId === "number" ? rawBranchId : Number(rawBranchId);

  return Number.isFinite(branchId) ? { branch_id: branchId } : undefined;
};

const getApiOrderStatusLabel = (status: OrderFromApi["status"]) => {
  switch (status) {
    case "pending":
      return "محفوظ";
    case "pending_confirmation":
      return "بانتظار التأكيد";
    case "confirmed":
      return "مؤكد";
    case "in_progress":
      return "قيد التحضير";
    case "ready":
      return "جاهز";
    case "served":
      return "تم التقديم";
    case "paid":
      return "مدفوع";
    case "cancelled":
      return "ملغي";
    default:
      return "غير معروف";
  }
};

const getApiPaymentLabel = (method?: string | null) => {
  switch (method) {
    case "cash":
      return "كاش";
    case "card":
    case "credit_card":
      return "بطاقة/فيزا";
    case "wallet":
      return "محفظة";
    case "bank":
    case "bank_transfer":
      return "تحويل بنكي";
    default:
      return "غير مدفوع";
  }
};

const getApiPaymentIcon = (method?: string | null) => {
  switch (method) {
    case "card":
    case "credit_card":
      return <CreditCard size={16} />;
    case "wallet":
      return <Wallet size={16} />;
    case "bank":
    case "bank_transfer":
      return <Landmark size={16} />;
    case "cash":
    default:
      return <Banknote size={16} />;
  }
};

const getPrimaryPaymentMethod = (
  order: OrderFromApi,
): ApiPaymentMethod | string | null =>
  order.payments?.[0]?.payment_method ?? order.payment_method;

export const HospitalityTables: React.FC<{
  onSelect?: (table: Table) => void;
  mode?: "management" | "pos";
}> = ({ onSelect, mode = "management" }) => {
  const {
    tables,
    selectedTable,
    setSelectedTable,
    activeOrders,
    updateTableStatus,
    transferTable,
    mergeTables,
    loadOrderToPOS,
    currentUser,
    seatTable,
    setOrderType,
    diningZones,
    tablesLoading,
    fetchDiningZones,
    fetchTables,
  } = useApp();

  const navigate = useNavigate();

  const handleNavigateToPOS = (table: Table) => {
    if (onSelect) {
      onSelect(table);
    } else {
      navigate("/Hospitality");
    }
  };

  const HALLS = diningZones;

  const [viewMode, setViewMode] = useState<"MAP" | "GRID">("GRID");
  const [selectedHallId, setSelectedHallId] = useState<string>(HALLS[0]?.id || "");
  const [zoom, setZoom] = useState(1);
  const [showPopup, setShowPopup] = useState<string | null>(null);
  const [transferMode, setTransferMode] = useState<{ fromId: string } | null>(
    null,
  );
  const [transferError, setTransferError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<string[]>([]);
  const [seatingTableId, setSeatingTableId] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState<number>(2);
  const [activeApiOrder, setActiveApiOrder] = useState<OrderFromApi | null>(
    null,
  );
  const [allTableOrders, setAllTableOrders] = useState<OrderFromApi[]>([]);
  const [activeOrderLoadingTableId, setActiveOrderLoadingTableId] = useState<
    string | null
  >(null);
  const [activeOrderError, setActiveOrderError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const [mergedTableModal, setMergedTableModal] = useState<Table | null>(null);
  const [unmerging, setUnmerging] = useState(false);

  // Live timer ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  // Mobile detection with resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mapRef = useRef<HTMLDivElement>(null);

  // جلب القاعات والطاولات عند تحميل المكون (مثل الكاشير)
  useEffect(() => {
    fetchDiningZones();
  }, [fetchDiningZones]);

  // القاعات بتوصل بشكل غير متزامن بعد أول رندر (كانت فاضية وقت تهيئة selectedHallId)،
  // فبنزامن الاختيار تلقائياً أول ما توصل أو لو القاعة المختارة صارت غير موجودة
  useEffect(() => {
    if (HALLS.length === 0) return;
    if (!HALLS.some((hall) => hall.id === selectedHallId)) {
      setSelectedHallId(HALLS[0].id);
    }
  }, [HALLS, selectedHallId]);

  // تحديث تلقائي للطاولات فقط كل 10 ثواني — يتوقف تلقائياً لو التبويب بالخلفية
  useVisibilityInterval(fetchTables, 10000);

  const filteredTables = tables.filter((t) => t.hallId === selectedHallId);

  // Build a lookup: hallId -> hall code (e.g., "A", "B")
  const hallCodeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const hall of HALLS) {
      const code = (hall as any).code || hall.name;
      map[hall.id] = code;
    }
    return map;
  }, [HALLS]);

  // Compute display label for a table: e.g. "A3", "B2"
  const getTableDisplayLabel = (table: Table): string => {
    const hallCode = hallCodeById[table.hallId] || "";
    const num = table.table_number || table.label || String(table.number);
    // If num already starts with the hall code, don't double it
    if (num.toUpperCase().startsWith(hallCode.toUpperCase())) return num;
    return `${hallCode}${num}`;
  };

  const getStatusConfig = (status: TableStatus, isSelected: boolean = false) => {
    if (isSelected && status !== TableStatus.OCCUPIED && status !== TableStatus.PENDING_CONFIRMATION && status !== TableStatus.BILL_PRINTED) {
      return {
        color: "bg-red-600 border-red-700/20 text-white",
        label: "نشطة",
        border: "border-red-700/20",
      };
    }
    switch (status) {
      case TableStatus.AVAILABLE:
        return {
          color: "bg-transparent border-slate-700/40 text-slate-300",
          label: "فارغة",
          border: "border-slate-700/40",
        };
      case TableStatus.OCCUPIED:
        return {
          color: "bg-emerald-600",
          label: "مشغولة",
          border: "border-emerald-700/20",
        };
      case TableStatus.PAYMENT_PENDING:
        return {
          color: "bg-yellow-500",
          label: "طلب الحساب",
          border: "border-yellow-600/20",
        };
      case TableStatus.BILL_PRINTED:
        return {
          color: "bg-blue-600",
          label: "فاتورة مطبوعة",
          border: "border-blue-700/20",
        };
      case TableStatus.PAID:
        return {
          color: "bg-transparent border-slate-700/40 text-slate-300",
          label: "مدفوعة",
          border: "border-slate-700/40",
        };
      case TableStatus.RESERVED:
        return {
          color: "bg-blue-600",
          label: "محجوزة",
          border: "border-blue-700/20",
        };
      case TableStatus.CLEANING:
        return {
          color: "bg-slate-500",
          label: "قيد التنظيف",
          border: "border-slate-600/20",
        };
      case TableStatus.PENDING_CONFIRMATION:
        return {
          color: "bg-orange-500 text-white font-medium animate-pulse",
          label: "بانتظار التأكيد 🟡",
          border: "border-orange-600/40",
        };
      case TableStatus.MERGED:
        return {
          color: "bg-amber-700/70 border-dashed",
          label: "مدمجة",
          border: "border-amber-500/50",
        };
      default:
        return {
          color: "bg-slate-800",
          label: "غير معروف",
          border: "border-white/5",
        };
    }
  };

  const getTableOrder = (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table?.currentOrderId) return null;
    if (
      ![
        TableStatus.OCCUPIED,
        TableStatus.PAYMENT_PENDING,
        TableStatus.BILL_PRINTED,
      ].includes(table.status)
    )
      return null;
    return activeOrders.find((o) => o.id === table.currentOrderId);
  };

  const calculateSittingTime = (seatedAt?: string | Date) => {
    if (!seatedAt) return "0 دقيقة";
    const diff = Math.floor(
      (new Date().getTime() - new Date(seatedAt).getTime()) / 60000,
    );
    return `${diff} دقيقة`;
  };

  const openOccupiedTableOrder = async (table: Table) => {
    setSelectedTable(table);
    setOrderType(OrderType.DINE_IN);
    setShowPopup(table.id);
    setActiveApiOrder(null);
    setAllTableOrders([]);
    setActiveOrderError(null);
    setActiveOrderLoadingTableId(table.id);

    try {
      // جلب جميع الطلبات النشطة لهذه الطاولة (بدلاً من آخر طلب فقط)
      const orders = await orderService.getAllActiveByTableNumber(
        table.table_number || table.number,
        getBranchFilter(currentUser),
      );
      setAllTableOrders(orders);
      setActiveApiOrder(orders[0] ?? null);

      if (
        orders.length > 0 &&
        (table.currentOrderId !== String(orders[0].id) ||
          table.status !== TableStatus.OCCUPIED)
      ) {
        updateTableStatus(table.id, TableStatus.OCCUPIED, {
          currentOrderId: String(orders[0].id),
        });
      }
    } catch (error) {
      console.error("Failed to load active orders for table:", error);
      setActiveOrderError("فشل تحميل الطلبات لهذه الطاولة");
    } finally {
      setActiveOrderLoadingTableId(null);
    }
  };

  const acknowledgeWaiterCall = async (tableId: string) => {
    try {
      await api.post(`/tables/${tableId}/acknowledge-waiter-call`);
      await fetchTables();
    } catch (err) {
      console.warn("فشل تأكيد استلام نداء النادل:", err);
      toast.error("فشل تأكيد الاستلام", "حاول مرة ثانية");
    }
  };

  const handleTransferToTable = async (targetTable: Table) => {
    if (!transferMode) return;
    const sourceTable = tables.find((t) => t.id === transferMode.fromId);
    if (!sourceTable) return;

    try {
      const sourceNumber = sourceTable.table_number || String(sourceTable.number);
      const targetNumber = targetTable.table_number || String(targetTable.number);

      // جلب جميع الطلبات النشطة للطاولة المصدر
      const allOrders = await orderService.getAllActiveByTableNumber(sourceNumber, getBranchFilter(currentUser));

      // نقل الطلبات إن وُجدت — نسجل أي طلب فشل نقله بدل ما نتجاهله بصمت
      const failedOrderIds: number[] = [];
      if (allOrders.length > 0) {
        for (const order of allOrders) {
          try {
            await orderService.transferOrder(order.id, targetNumber);
          } catch (err) {
            console.warn(`فشل نقل الطلب #${order.id}:`, err);
            failedOrderIds.push(order.id);
          }
        }
      }

      const transferredCount = allOrders.length - failedOrderIds.length;

      // تحديث حالة الطاولة الهدف
      updateTableStatus(targetTable.id, TableStatus.OCCUPIED, {
        currentOrderId: allOrders.length > 0 ? String(allOrders[0].id) : undefined,
        guestCount: sourceTable.guestCount,
      });

      // نفرّغ الطاولة المصدر محلياً بس إذا كل الطلبات انتقلت فعلاً — إذا في طلب
      // فشل نقله، الباك اند أصلاً ما بيحررها (نفس فحص tableHasOtherActiveOrders)،
      // فبنسيب fetchTables تجيب الحالة الصحيحة بدل ما نعرض حالة متفائلة غلط.
      if (failedOrderIds.length === 0) {
        updateTableStatus(sourceTable.id, TableStatus.AVAILABLE, {
          currentOrderId: undefined,
          seatedAt: undefined,
          guestCount: undefined,
        });
      }

      setTransferMode(null);
      setTransferError(null);
      await fetchTables();

      if (failedOrderIds.length > 0) {
        toast.error(
          `فشل نقل ${failedOrderIds.length} من ${allOrders.length} طلب`,
          `من طاولة ${sourceNumber} إلى طاولة ${targetNumber} — الطاولة المصدر لسا فيها طلب نشط`,
        );
      } else if (allOrders.length > 0) {
        toast.success(`تم نقل ${transferredCount} طلب بنجاح`, `من طاولة ${sourceNumber} إلى طاولة ${targetNumber}`);
      } else {
        toast.success(`تم نقل الطاولة بنجاح`, `من طاولة ${sourceNumber} إلى طاولة ${targetNumber}`);
      }
    } catch (err: any) {
      setTransferError(err?.response?.data?.message || "فشل نقل الطلبات");
    }
  };

  const handleMergeConfirm = async () => {
    if (mergeMode.length < 2) {
      setTransferError("يجب اختيار طاولتين على الأقل للدمج");
      return;
    }

    // الطاولة الأخيرة هي الهدف، والباقي يتم نقلها إليها
    const targetTableId = mergeMode[mergeMode.length - 1];
    const sourceTableIds = mergeMode.slice(0, -1);

    try {
      const response = await api.post('/tables/merge', {
        from_table_ids: sourceTableIds,
        to_table_id: targetTableId,
      });

      if (response.data?.success) {
        toast.success(response.data.message);
        setMergeMode([]);
        await fetchTables();
      } else {
        setTransferError(response.data?.message || 'فشل دمج الطاولات');
      }
    } catch (err: any) {
      setTransferError(err?.response?.data?.message || 'فشل دمج الطاولات');
    }
  };

  const handleUnmergeTable = async (table: Table) => {
    setUnmerging(true);
    try {
      await api.post(`/tables/${table.id}/unmerge`);
      setMergedTableModal(null);
      await fetchDiningZones();
    } catch (err: any) {
      toast.error("فشل فك الدمج", err?.response?.data?.message);
    } finally {
      setUnmerging(false);
    }
  };

  const handleTableClick = (table: Table) => {
    if (table.status === TableStatus.MERGED) {
      setMergedTableModal(table);
      return;
    }

    if (mode === "pos") {
      setSelectedTable(table);
      setOrderType(OrderType.DINE_IN);
      handleNavigateToPOS(table);
      return;
    }

    if (transferMode) {
      if (table.status === TableStatus.AVAILABLE) {
        handleTransferToTable(table);
      } else {
        setTransferError("لا يمكن النقل لهذه الطاولة مشغولة");
      }
      return;
    }

    if (mergeMode.length > 0) {
      if (mergeMode.includes(table.id)) {
        setMergeMode((prev) => prev.filter((id) => id !== table.id));
      } else {
        setMergeMode((prev) => [...prev, table.id]);
      }
      return;
    }

    if (
      table.status === TableStatus.OCCUPIED ||
      table.status === TableStatus.PAYMENT_PENDING ||
      table.status === TableStatus.BILL_PRINTED
    ) {
      void openOccupiedTableOrder(table);
      return;
    }

    if (table.status === TableStatus.PENDING_CONFIRMATION) {
      void openOccupiedTableOrder(table);
      return;
    }

    if (table.status === TableStatus.AVAILABLE) {
      setSeatingTableId(table.id);
      setGuestCount(table.capacity);
    } else {
      setShowPopup(table.id);
    }
  };

  const resetTable = (tableId: string) => {
    updateTableStatus(tableId, TableStatus.AVAILABLE, {
      currentOrderId: undefined,
      seatedAt: undefined,
    });
    setShowPopup(null);
  };

  const activePopupTable = tables.find((t) => t.id === showPopup);
  const activePopupOrder = showPopup ? getTableOrder(showPopup) : null;
  const activePopupApiOrder =
    activePopupTable && activeOrderLoadingTableId !== activePopupTable.id
      ? activeApiOrder
      : null;
  const isLoadingActivePopupOrder =
    !!activePopupTable && activeOrderLoadingTableId === activePopupTable.id;

  // تحديث تلقائي لطلبات الطاولة المفتوحة كل 5 ثواني — يتوقف تلقائياً لو
  // التبويب بالخلفية أو ما فيه popup مفتوح
  const refreshOpenTableOrders = useCallback(async () => {
    if (!activePopupTable) return;
    try {
      const orders = await orderService.getAllActiveByTableNumber(
        activePopupTable.table_number || activePopupTable.number,
        getBranchFilter(currentUser),
      );
      setAllTableOrders(orders);
      if (orders.length > 0) {
        setActiveApiOrder(orders[0]);
      }
    } catch {
      // تجاهل الأخطاء أثناء التحديث الخلفي
    }
  }, [activePopupTable, currentUser]);

  useVisibilityInterval(
    refreshOpenTableOrders,
    showPopup && activePopupTable ? 5000 : null,
  );

  return (
    <div className="h-full flex flex-col space-y-3 sm:space-y-4 lg:space-y-6 bg-slate-950 p-3 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[3rem] overflow-hidden">
      {tablesLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-sm">جاري تحميل الطاولات...</p>
          </div>
        </div>
      ) : (
      <>
      <header className="flex flex-col justify-between items-start gap-3 sm:gap-6">
        <div className="space-y-0.5 sm:space-y-1">
          <h2 className="text-xl sm:text-4xl font-black text-white tracking-tight">
            إدارة الطاولات
          </h2>
          <p className="text-slate-500 font-bold text-[10px] sm:text-sm hidden sm:block">
            خريطة المطعم وتوزيع الطاولات المباشر
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
          {/* Hall Switcher */}
          <div className="flex bg-slate-900 p-1 rounded-xl sm:rounded-2xl border border-white/5 overflow-x-auto scrollbar-hide gap-1 sm:gap-0 w-full sm:w-auto">
            {HALLS.map((hall) => (
              <button
                key={hall.id}
                onClick={() => setSelectedHallId(hall.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-[10px] transition-all whitespace-nowrap ${selectedHallId === hall.id ? "bg-slate-800 text-white border border-white/10" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Layout size={12} className="sm:hidden" />
                <Layout size={14} className="hidden sm:block" />
                {hall.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 sm:gap-3">
            {/* Map/Grid toggle - hidden on mobile */}
            <div className="hidden sm:flex bg-slate-900 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => setViewMode("MAP")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${viewMode === "MAP" ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-slate-500 hover:text-slate-300"}`}
              >
                <MapIcon size={16} /> خريطة
              </button>
              <button
                onClick={() => setViewMode("GRID")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${viewMode === "GRID" ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Grid size={16} /> شبكة
              </button>
            </div>

            {/* Zoom controls - hidden on mobile */}
            {viewMode === "MAP" && (
              <div className="hidden sm:flex bg-slate-900 p-1 rounded-2xl border border-white/5">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                  className="p-2.5 text-slate-500 hover:text-white"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="px-4 py-2.5 text-xs font-black text-white flex items-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                  className="p-2.5 text-slate-500 hover:text-white"
                >
                  <ZoomIn size={18} />
                </button>
              </div>
            )}

            {mergeMode.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleMergeConfirm}
                  className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs shadow-lg shadow-blue-900/20 flex items-center gap-2"
                >
                  <Merge size={14} className="sm:hidden" />
                  <Merge size={16} className="hidden sm:block" /> دمج ({mergeMode.length})
                </button>
                <button
                  onClick={() => setMergeMode([])}
                  className="bg-slate-800 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Legend - horizontal scroll on mobile */}
      <div className="flex gap-4 sm:gap-6 py-2 sm:py-4 border-y border-white/5 overflow-x-auto scrollbar-hide">
        {Object.values(TableStatus).map((status) => {
          const config = getStatusConfig(status, false);
          return (
            <div key={status} className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${status === TableStatus.AVAILABLE || status === TableStatus.PAID ? "border border-slate-600 bg-transparent" : config.color.split(' ')[0]}`} />
              <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {config.label}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-600" />
          <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
            نشطة
          </span>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-900/50 rounded-xl sm:rounded-[2.5rem] border border-white/5 custom-scrollbar">
        {/* On mobile: always show grid; on desktop: respect viewMode */}
        {isMobile || viewMode === "GRID" ? (
          <div className="grid grid-cols-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-1.5 sm:gap-3 md:gap-4 p-2 sm:p-4 md:p-8 overflow-y-auto h-full custom-scrollbar">
            {filteredTables.map((table) => {
              const config = getStatusConfig(table.status, selectedTable?.id === table.id);
              const order = getTableOrder(table.id);
              return (
                  <motion.button
                    key={table.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTableClick(table)}
                    className={`relative aspect-square rounded-xl sm:rounded-3xl border-2 p-2 sm:p-3 md:p-4 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all ${
                      mergeMode.includes(table.id)
                        ? "ring-2 sm:ring-4 ring-blue-600 ring-offset-2 sm:ring-offset-4 ring-offset-slate-950"
                        : ""
                    } ${table.mergedWithId || table.status === TableStatus.MERGED ? "opacity-80 border-dashed" : ""} ${config.color} ${config.border} text-white shadow-lg sm:shadow-xl`}
                  >
                    <span className="text-sm sm:text-lg md:text-2xl font-black">{getTableDisplayLabel(table)}</span>
                  <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                    {table.status === TableStatus.PAID && (
                      <span className="text-[6px] sm:text-[8px] font-black bg-white text-emerald-600 px-1 sm:px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                        تم الدفع
                      </span>
                    )}
                    {table.status === TableStatus.MERGED && table.mergeInfo ? (
                      <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black bg-amber-600 text-white px-1 sm:px-2 py-0.5 rounded-full">
                        مدمجة مع طاولة {table.mergeInfo.merged_with_table_number || table.mergeInfo.mergedWithTableNumber || tables.find(t => t.id === table.mergeInfo?.merged_with_id || table.mergeInfo?.mergedWithId)?.table_number || ""}
                      </span>
                    ) : table.mergedWithId ? (
                      <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black bg-black/20 px-1 sm:px-2 py-0.5 rounded-full">
                        مدمجة مع طاولة {tables.find((t) => t.id === table.mergedWithId)?.table_number}
                      </span>
                    ) : table.status === TableStatus.OCCUPIED ||
                        table.status === TableStatus.BILL_PRINTED ||
                        table.status === TableStatus.PAID ? (
                      <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black bg-black/20 px-1 sm:px-2 py-0.5 rounded-full">
                        {table.guestCount || 0} أشخاص
                      </span>
                    ) : (
                      <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black bg-black/20 px-1 sm:px-2 py-0.5 rounded-full">
                        {table.capacity} سعة
                      </span>
                    )}
                    {order && table.status !== TableStatus.MERGED && !table.mergedWithId && (
                      <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                        <span className="text-[7px] sm:text-[9px] md:text-[10px] font-black text-white/80">
                          {order.total.toFixed(2)} ₪
                        </span>
                        {order.shelfLocation && (
                          <span className="text-[5px] sm:text-[7px] md:text-[8px] font-black bg-white text-red-600 px-1 sm:px-1.5 py-0.5 rounded-full shadow-sm hidden sm:inline">
                            الرف: {order.shelfLocation}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {(table.status === TableStatus.OCCUPIED ||
                    table.status === TableStatus.BILL_PRINTED) && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex items-center gap-0.5 text-[6px] sm:text-[8px] font-black bg-black/40 px-1 sm:px-1.5 py-0.5 rounded-full">
                      <Clock size={6} />
                      <span>{calculateSittingTime((table as any).seated_at || table.seatedAt)}</span>
                    </div>
                  )}
                  {table.waiterCalledAt && (
                    <div className="absolute top-1 left-1 sm:top-2 sm:left-2 bg-amber-500 text-white rounded-full p-0.5 sm:p-1 animate-pulse shadow-lg">
                      <Bell size={10} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        ) : (
          <div
            ref={mapRef}
            className="w-full h-full overflow-auto p-20 custom-scrollbar"
            style={{ cursor: transferMode ? "crosshair" : "default" }}
          >
            <div
              className="relative bg-slate-800/20 rounded-[4rem] border-4 border-dashed border-white/5"
              style={{
                width: 1500 * zoom,
                height: 1500 * zoom,
                transformOrigin: "top left",
              }}
            >
              {filteredTables.map((table) => {
                const config = getStatusConfig(table.status, selectedTable?.id === table.id);
                const order = getTableOrder(table.id);
                return (
                  <motion.button
                    key={table.id}
                    initial={false}
                    animate={{
                      left: table.position.x * zoom,
                      top: table.position.y * zoom,
                      width: 100 * zoom,
                      height: 100 * zoom,
                    }}
                    onClick={() => handleTableClick(table)}
                    className={`absolute rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-2xl transition-all ${
                      mergeMode.includes(table.id) ? "ring-4 ring-blue-600" : ""
                    } ${table.mergedWithId || table.status === TableStatus.MERGED ? "opacity-80 border-dashed" : ""} ${config.color} ${config.border} text-white`}
                  >
                    <span
                      className="font-black"
                      style={{ fontSize: `${18 * zoom}px` }}
                    >
                      {getTableDisplayLabel(table)}
                    </span>
                    {table.status === TableStatus.PAID && (
                      <span
                        className="font-black bg-white text-emerald-600 px-1 py-0.5 rounded-full shadow-sm animate-pulse"
                        style={{ fontSize: `${7 * zoom}px` }}
                      >
                        تم الدفع
                      </span>
                    )}
                        {zoom > 0.7 && (
                      <div className="flex flex-col items-center">
                        {table.status === TableStatus.MERGED && table.mergeInfo ? (
                          <span
                            className="font-black bg-amber-600 text-white px-1.5 py-0.5 rounded-full"
                            style={{ fontSize: `${8 * zoom}px` }}
                          >
                            مدمجة مع طاولة {table.mergeInfo.merged_with_table_number || table.mergeInfo.mergedWithTableNumber || tables.find(t => t.id === table.mergeInfo?.merged_with_id || table.mergeInfo?.mergedWithId)?.table_number || ""}
                          </span>
                        ) : table.mergedWithId ? (
                          <span
                            className="font-black bg-black/20 px-1.5 py-0.5 rounded-full"
                            style={{ fontSize: `${8 * zoom}px` }}
                          >
                            مدمجة مع طاولة {tables.find((t) => t.id === table.mergedWithId)?.table_number}
                          </span>
                        ) : table.status === TableStatus.OCCUPIED ||
                            table.status === TableStatus.BILL_PRINTED ||
                            table.status === TableStatus.PAID ? (
                          <span
                            className="font-black bg-black/20 px-1.5 py-0.5 rounded-full"
                            style={{ fontSize: `${8 * zoom}px` }}
                          >
                            {table.guestCount || 0} أشخاص
                          </span>
                        ) : (
                          <span
                            className="font-black bg-black/20 px-1.5 py-0.5 rounded-full"
                            style={{ fontSize: `${8 * zoom}px` }}
                          >
                            {table.capacity} سعة
                          </span>
                        )}
                        {order && table.status !== TableStatus.MERGED && !table.mergedWithId && (
                          <div className="flex flex-col items-center">
                            <span
                              className="font-black"
                              style={{ fontSize: `${9 * zoom}px` }}
                            >
                              {order.total.toFixed(2)} ₪
                            </span>
                            {order.shelfLocation && (
                              <span
                                className="font-black bg-white text-red-600 px-1 py-0.5 rounded-full shadow-sm"
                                style={{ fontSize: `${7 * zoom}px` }}
                              >
                                الرف: {order.shelfLocation}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Seating Modal */}
      <AnimatePresence>
        {seatingTableId && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-slate-900 w-full sm:max-w-sm rounded-t-3xl sm:rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Users size={24} className="sm:hidden" />
                  <Users size={32} className="hidden sm:block" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  تسكين الطاولة #
                  {tables.find((t) => t.id === seatingTableId)?.number}
                </h3>
                <p className="text-slate-500 font-bold text-xs sm:text-sm">
                  يرجى تحديد عدد الأشخاص لبدء الوقت
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <button
                  onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800 text-white rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-slate-700 transition-all font-black text-lg sm:text-xl border border-white/5"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={guestCount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setGuestCount(0);
                      return;
                    }
                    const val = parseInt(raw);
                    if (!isNaN(val) && val >= 1 && val <= 99) setGuestCount(val);
                  }}
                  onBlur={() => {
                    if (guestCount < 1) setGuestCount(1);
                  }}
                  className="w-20 sm:w-24 text-center text-5xl sm:text-6xl font-black text-white bg-transparent border-b-2 border-white/20 focus:border-red-500 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setGuestCount(Math.min(99, guestCount + 1))}
                  className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-800 text-white rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-slate-700 transition-all font-black text-lg sm:text-xl border border-white/5"
                >
                  +
                </button>
              </div>

              <div className="flex flex-col gap-2 sm:gap-3">
                <button
                  onClick={async () => {
                    const table = tables.find((t) => t.id === seatingTableId);
                    if (!table) return;
                    const count = Math.max(1, guestCount);
                    const ok = await seatTable(seatingTableId, count);
                    if (!ok) {
                      toast.error("فشل تسكين الطاولة", "حاول مرة ثانية");
                      return;
                    }
                    setSelectedTable(table);
                    setOrderType(OrderType.DINE_IN);
                    setSeatingTableId(null);
                    if (onSelect) {
                      onSelect(table);
                    }
                  }}
                  className="w-full bg-emerald-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"
                >
                  تسكين الطاولة
                </button>
                <button
                  onClick={() => setSeatingTableId(null)}
                  className="w-full bg-slate-800 text-slate-400 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm active:scale-95 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPopup && activePopupTable && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-slate-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div
                className={`p-4 sm:p-8 ${getStatusConfig(activePopupTable.status, selectedTable?.id === activePopupTable.id).color} text-white flex justify-between items-start`}
              >
                <div className="space-y-0.5 sm:space-y-1">
                  <h3 className="text-2xl sm:text-5xl font-black">
                    طاولة {getTableDisplayLabel(activePopupTable)}
                  </h3>
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold opacity-80">
                    <Info size={14} className="sm:hidden" />
                    <Info size={16} className="hidden sm:block" />{" "}
                    {getStatusConfig(activePopupTable.status, selectedTable?.id === activePopupTable.id).label}
                  </div>
                </div>
                <button
                  onClick={() => setShowPopup(null)}
                  className="p-2 hover:bg-black/20 rounded-full transition-colors"
                >
                  <X size={20} className="sm:hidden" />
                  <X size={24} className="hidden sm:block" />
                </button>
              </div>

              <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 max-h-[70vh] overflow-y-auto">
                {activePopupTable.waiterCalledAt && (
                  <div className="bg-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2 text-amber-400">
                      <Bell size={18} />
                      <span className="font-black text-xs sm:text-sm">
                        الزبون طلب نادل ({calculateSittingTime(activePopupTable.waiterCalledAt)})
                      </span>
                    </div>
                    <button
                      onClick={() => acknowledgeWaiterCall(activePopupTable.id)}
                      className="bg-amber-500 text-white px-3 py-1.5 rounded-xl font-black text-[10px] shrink-0"
                    >
                      تم الرد
                    </button>
                  </div>
                )}
                {activePopupTable.status === TableStatus.OCCUPIED ||
                activePopupTable.status === TableStatus.PAYMENT_PENDING ||
                activePopupTable.status === TableStatus.BILL_PRINTED ||
                activePopupTable.status === TableStatus.PAID ||
                isLoadingActivePopupOrder ||
                activeOrderError ||
                activePopupApiOrder ||
                activePopupOrder ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                          <Users size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            عدد الأشخاص
                          </span>
                        </div>
                        <p className="text-lg font-black text-white">
                          {activePopupTable.guestCount ||
                            activePopupTable.capacity}{" "}
                          أشخاص
                        </p>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2 text-slate-500 mb-1">
                          <Clock size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            وقت الجلوس
                          </span>
                        </div>
                        <p className="text-lg font-black text-white">
                          {calculateSittingTime(activePopupTable.seatedAt)}
                        </p>
                      </div>
                    </div>

                    {activePopupTable.mergedWithId && (
                      <div className="bg-amber-600/10 border border-amber-600/20 p-4 rounded-2xl text-center">
                        <p className="text-amber-500 font-black text-xs">
                          مدمجة مع طاولة {tables.find((t) => t.id === activePopupTable.mergedWithId)?.table_number}
                        </p>
                      </div>
                    )}

                    {isLoadingActivePopupOrder ? (
                      <div className="bg-slate-800/50 p-8 rounded-3xl border border-white/5 flex items-center justify-center gap-3 text-slate-300">
                        <Loader2 size={18} className="animate-spin text-red-500" />
                        <span className="text-xs font-black">
                          جاري تحميل طلب الطاولة...
                        </span>
                      </div>
                    ) : activeOrderError ? (
                      <div className="bg-red-500/10 p-5 rounded-3xl border border-red-500/20 text-red-300 text-center text-xs font-black">
                        {activeOrderError}
                      </div>
                    ) : activePopupApiOrder ? (
                      <div className="bg-slate-800/50 p-5 rounded-3xl border border-white/5 flex flex-col gap-4">
                        {/* ملخص جميع الطلبات */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-500">
                              <ReceiptText size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                فاتورة الطاولة
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500">
                              {allTableOrders.length > 0
                                ? `${allTableOrders.length} طلب${allTableOrders.length > 1 ? 'ات' : ''} على الطاولة`
                                : 'لا توجد طلبات'}
                            </p>
                          </div>
                          <div className="text-left">
                            <div className="flex items-center justify-end gap-1 text-slate-500">
                              <DollarSign size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                الإجمالي
                              </span>
                            </div>
                            <p className="text-sm font-black text-red-600">
                              {formatMoney(
                                allTableOrders.reduce((sum, order) => sum + Number(order.total || 0), 0)
                              )}
                            </p>
                          </div>
                        </div>

                        {/* أصناف جميع الطلبات مجمعة */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <ClipboardList size={14} />
                            <span className="text-[10px] font-black uppercase tracking-widest">
                              جميع الأصناف
                            </span>
                          </div>
                          <div className="rounded-2xl border border-white/5 overflow-hidden">
                            <div className="max-h-72 overflow-y-auto custom-scrollbar">
                              {allTableOrders.length === 0 ? (
                                <div className="text-center py-6 text-slate-500 text-xs font-bold">
                                  لا توجد أصناف بعد
                                </div>
                              ) : (
                                allTableOrders.map((order, orderIdx) => (
                                  <div key={order.id}>
                                    {/* رأس الطلب */}
                                    <div className="bg-slate-900/60 px-3 py-1.5 border-b border-dashed border-white/10 text-[8px] font-bold text-slate-400 flex items-center gap-2 flex-wrap">
                                      <span>طلب #{order.order_number}</span>
                                      <span>·</span>
                                      <span>{getApiOrderStatusLabel(order.status)}</span>
                                      <span>·</span>
                                      <span>{formatMoney(order.total)}</span>
                                      <span>·</span>
                                      <span className="text-slate-500">
                                        {calculateSittingTime(order.created_at)}
                                      </span>
                                    </div>
                                    {/* أصناف الطلب */}
                                    {order.items.map((item: any) => {
                                      // الطلب المُؤكّد (تم إرساله للأقسام) = أرسل
                                      // الطلب المحفوظ فقط (لم يُؤكّد بعد) = معلق
                                      const isSent = !['pending', 'pending_confirmation'].includes(order.status);
                                      return (
                                        <div
                                          key={`${order.id}-${item.id}`}
                                          className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center px-3 py-2 border-b border-white/5 last:border-b-0 bg-slate-900/30"
                                        >
                                          <div className="min-w-0">
                                            <p className="text-xs font-black text-white truncate">
                                              {item.item_name_ar || item.item_name}
                                            </p>
                                            {item.notes && (
                                              <p className="text-[8px] font-bold text-slate-500 truncate">
                                                {item.notes}
                                              </p>
                                            )}
                                            {/* <p className="text-[7px] font-bold text-slate-600 mt-0.5">
                                              {calculateSittingTime(item.created_at || order.created_at)}
                                            </p> */}
                                          </div>
                                          <span className="text-xs font-black text-slate-400">
                                            x{item.quantity}
                                          </span>
                                          <span className="text-xs font-black text-red-400">
                                            {formatMoney(item.total_price)}
                                          </span>
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black ${isSent ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'}`}>
                                            <Send size={8} className="ml-0.5" />
                                            {isSent ? 'أرسل' : 'معلق'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {allTableOrders.some(o => o.note) && (
                          <p className="bg-slate-900/60 rounded-2xl border border-white/5 p-3 text-[10px] font-bold text-slate-400">
                            {allTableOrders.filter(o => o.note).map(o => o.note).join(' | ')}
                          </p>
                        )}

                        {/* أزرار الإجراءات */}
                        <button
                          onClick={() => {
                            setSelectedTable(activePopupTable);
                            setOrderType(OrderType.DINE_IN);
                            setShowPopup(null);
                            handleNavigateToPOS(activePopupTable);
                          }}
                          className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-xs shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                        >
                          <ExternalLink size={16} /> فتح الطاولة في شاشة البيع
                        </button>

                        <button
                          onClick={() => {
                            setSelectedTable(activePopupTable);
                            setOrderType(OrderType.DINE_IN);
                            setShowPopup(null);
                            navigate("/Hospitality?addOrder=1");
                          }}
                          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black text-xs shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                        >
                          <Plus size={16} /> طلب جديد (إضافة طلب آخر)
                        </button>
                      </div>
                    ) : activePopupOrder ? (
                      <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-500">
                              <DollarSign size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">
                                إجمالي الفاتورة
                              </span>
                            </div>
                            <p className="text-3xl font-black text-red-600">
                              {activePopupOrder.total.toFixed(2)} ₪
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              loadOrderToPOS(activePopupOrder.id);
                              setOrderType(OrderType.DINE_IN);
                              setTimeout(() => {
                                handleNavigateToPOS(activePopupTable);
                              }, 100);
                            }}
                            className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-red-900/20 flex items-center gap-2"
                          >
                            <ExternalLink size={18} /> فتح الفاتورة
                          </button>
                        </div>

                        {activePopupTable.status === TableStatus.OCCUPIED && (
                          <button
                            onClick={() =>
                              updateTableStatus(
                                activePopupTable.id,
                                TableStatus.PAYMENT_PENDING,
                              )
                            }
                            className="w-full bg-orange-500 text-white py-3 rounded-xl font-black text-xs shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
                          >
                            <DollarSign size={16} /> طلب الحساب (بانتظار الدفع)
                          </button>
                        )}

                        {activePopupTable.status === TableStatus.PAID && (
                          <div className="space-y-3">
                            <div className="bg-emerald-600/10 border border-emerald-600/20 p-3 rounded-xl text-center">
                              <p className="text-emerald-500 font-black text-xs">
                                تم دفع الحساب بنجاح
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedTable(activePopupTable);
                                setOrderType(OrderType.DINE_IN);
                                setTimeout(() => {
                                  handleNavigateToPOS(activePopupTable);
                                }, 100);
                              }}
                              className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                            >
                              <Plus size={16} /> فتح فاتورة جديدة
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-800/50 p-6 rounded-3xl border border-white/5 flex flex-col gap-4">
                        <div className="text-center py-2">
                          <p className="text-slate-400 font-bold text-sm">
                            لا توجد طلبات مسجلة لهذه الطاولة بعد
                          </p>
                        </div>
                      <button
                        onClick={() => {
                          setSelectedTable(activePopupTable);
                          setOrderType(OrderType.DINE_IN);
                          setShowPopup(null);
                          setTimeout(() => {
                            handleNavigateToPOS(activePopupTable);
                          }, 100);
                        }}
                        className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> إضافة طلب جديد
                      </button>
                      <p className="text-[10px] font-bold text-slate-500 text-center mt-2">
                        سيتم فتح المنيو تلقائياً لاختيار الأصناف
                      </p>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(() => {
                        const hasActiveOrders = allTableOrders.length > 0;
                        const canClear = !hasActiveOrders && (
                          activePopupTable.status === TableStatus.PAID ||
                          ((activePopupTable.status === TableStatus.OCCUPIED ||
                            activePopupTable.status === TableStatus.BILL_PRINTED) &&
                            !activePopupTable.currentOrderId)
                        );
                        return (
                          <button
                            onClick={() => {
                              if (canClear) {
                                updateTableStatus(
                                  activePopupTable.id,
                                  TableStatus.AVAILABLE,
                                );
                              } else {
                                toast.error("لا يمكن تفريغ الطاولة، يوجد طلب نشط عليها");
                                return;
                              }
                            }}
                            disabled={!canClear}
                            className={`flex flex-col items-center gap-1 sm:gap-2 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 transition-all ${
                              canClear
                                ? "bg-slate-800 hover:bg-slate-700 cursor-pointer"
                                : "bg-slate-900 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <Trash2 size={16} className="text-red-500 sm:hidden" />
                            <Trash2 size={20} className="text-red-500 hidden sm:block" />
                            <span className="text-[8px] sm:text-[10px] font-black text-slate-300">
                              تفريغ
                            </span>
                          </button>
                        );
                      })()}
                      <button
                        onClick={() => {
                          setTransferMode({ fromId: activePopupTable.id });
                          setShowPopup(null);
                        }}
                        className="flex flex-col items-center gap-1 sm:gap-2 p-2.5 sm:p-4 bg-slate-800 rounded-xl sm:rounded-2xl border border-white/5 hover:bg-slate-700 transition-all"
                      >
                        <Move size={16} className="text-blue-500 sm:hidden" />
                        <Move size={20} className="text-blue-500 hidden sm:block" />
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-300">
                          نقل
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setMergeMode([activePopupTable.id]);
                          setShowPopup(null);
                        }}
                        className="flex flex-col items-center gap-1 sm:gap-2 p-2.5 sm:p-4 bg-slate-800 rounded-xl sm:rounded-2xl border border-white/5 hover:bg-slate-700 transition-all"
                      >
                        <Merge size={16} className="text-purple-500 sm:hidden" />
                        <Merge size={20} className="text-purple-500 hidden sm:block" />
                        <span className="text-[8px] sm:text-[10px] font-black text-slate-300">
                          دمج
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activePopupTable.status === TableStatus.RESERVED && (
                      <div className="bg-blue-600/10 p-6 rounded-3xl border border-blue-600/20 space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                            اسم الحجز
                          </p>
                          <p className="text-xl font-black text-white">
                            {activePopupTable.reservationName || "غير محدد"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                            وقت الحجز
                          </p>
                          <p className="text-xl font-black text-white">
                            {activePopupTable.reservationTime || "--:--"}
                          </p>
                        </div>
                      </div>
                    )}

                    {activePopupTable.status === TableStatus.CLEANING && (
                      <div className="text-center py-8 space-y-4">
                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-500">
                          <Clock size={40} />
                        </div>
                        <p className="text-slate-400 font-bold">
                          الطاولة قيد التنظيف حالياً
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3">
                      {activePopupTable.status === TableStatus.CLEANING && (
                        <button
                          onClick={() => resetTable(activePopupTable.id)}
                          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-900/20"
                        >
                          تم التنظيف (تفعيل الطاولة)
                        </button>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const name = prompt("اسم الحجز:");
                            const time = prompt("وقت الحجز (مثلاً 07:00 PM):");
                            if (name && time) {
                              updateTableStatus(
                                activePopupTable.id,
                                TableStatus.RESERVED,
                                {
                                  reservationName: name,
                                  reservationTime: time,
                                } as any,
                              );
                              setShowPopup(null);
                            }
                          }}
                          className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-blue-900/20"
                        >
                          حجز الطاولة
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Merged Table Modal */}
      <AnimatePresence>
        {mergedTableModal && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setMergedTableModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 w-full max-w-md rounded-[3rem] border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - amber for merged */}
              <div className="p-8 bg-amber-600/70 text-white flex justify-between items-start">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black">
                    طاولة {getTableDisplayLabel(mergedTableModal)}
                  </h3>
                  <div className="flex items-center gap-2 text-sm font-bold opacity-80">
                    <Link2 size={16} /> مدمجة مع طاولة {mergedTableModal.mergeInfo?.merged_with_table_number || mergedTableModal.mergeInfo?.mergedWithTableNumber || tables.find(t => t.id === mergedTableModal.mergeInfo?.merged_with_id || mergedTableModal.mergeInfo?.mergedWithId)?.table_number || "---"}
                  </div>
                </div>
                <button
                  onClick={() => setMergedTableModal(null)}
                  className="p-2 hover:bg-black/20 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <Link2 size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        مدمجة مع
                      </span>
                    </div>
                    <p className="text-lg font-black text-amber-400">
                      طاولة {mergedTableModal.mergeInfo?.merged_with_table_number || mergedTableModal.mergeInfo?.mergedWithTableNumber || tables.find(t => t.id === mergedTableModal.mergeInfo?.merged_with_id || mergedTableModal.mergeInfo?.mergedWithId)?.table_number || "---"}
                    </p>
                  </div>
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <Users size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        السعة
                      </span>
                    </div>
                    <p className="text-lg font-black text-white">
                      {mergedTableModal.capacity} أشخاص
                    </p>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs font-bold text-red-300 leading-relaxed">
                    لا يمكن تنفيذ أي عمليات على هذه الطاولة لأنها مدمجة مع طاولة أخرى. يجب فك الدمج أولاً.
                  </p>
                </div>

                {/* Orders Info */}
                {mergedTableModal.orders && mergedTableModal.orders.length > 0 && (
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 text-slate-500 mb-3">
                      <ReceiptText size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        الطلبات المحولة ({mergedTableModal.orders.length})
                      </span>
                    </div>
                    <div className="space-y-3">
                      {mergedTableModal.orders.map((order: any) => (
                        <div key={order.id} className="bg-slate-900/60 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">#{order.order_number || order.id}</span>
                            <span className="text-xs font-bold text-green-400">{formatMoney(order.total)}</span>
                          </div>
                          {order.items && order.items.length > 0 && (
                            <div className="space-y-1 pl-3 border-r-2 border-amber-500/30">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-[10px]">
                                  <span className="text-slate-300 font-bold">
                                    {item.quantity}x {item.item_name_ar || item.item_name}
                                  </span>
                                  <span className="text-slate-400 font-bold">{formatMoney(item.total_price)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unmerge Button */}
                <button
                  onClick={() => handleUnmergeTable(mergedTableModal)}
                  disabled={unmerging}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 transition-all"
                >
                  {unmerging ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Unlink size={18} />
                  )}
                  {unmerging ? "جاري فك الدمج..." : "فك الدمج"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Mode Overlay */}
      {transferMode && (
        <div className="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 sm:px-8 py-3 sm:py-4 rounded-full font-black shadow-2xl flex items-center gap-2 sm:gap-4 animate-bounce">
          <Move size={18} className="sm:hidden" />
          <Move size={24} className="hidden sm:block" />
          <span className="text-[10px] sm:text-sm">اختر الطاولة الجديدة...</span>
          <button
            onClick={() => { setTransferMode(null); setTransferError(null); }}
            className="bg-black/20 p-1 rounded-full hover:bg-black/40"
          >
            <X size={14} className="sm:hidden" />
            <X size={16} className="hidden sm:block" />
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
};
