// src/components/POS/pos.tsx
//
// التغييرات الجوهرية:
// 1. المنيو يجي من API عبر useMenu(branchId) بدل MENU_ITEMS الثابتة
// 2. السلة تدار عبر useCart — addToCart يزيد الكمية بدل صف جديد
// 3. submitOrder يرسل للـ API فعلياً
// 4. getItemCurrentPrice تقرأ item.price مباشرة (جاي من pivot الفرع)

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../../../store";
import { useVisibilityInterval } from "../../hooks/useVisibilityInterval";
import {
  OrderType,
  OrderStatus,
  PaymentMethod,
  CustomerType,
  TableStatus,
} from "../../../types";
import { AlertCircle, ShoppingCart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../shared/Toast";
import { useDiscountCart } from "../../hooks/useDiscountCart";

import { POSHeader } from "./POSHeader";
import { HospitalityPOSHeader } from "../Hospitality/HospitalityPOSHeader";
import { MenuGrid } from "./MenuGrid";
import { InvoiceInfoTab } from "./InvoiceInfoTab";
import { ContactInfoTab } from "./ContactInfoTab";
import { AccountsInfoTab } from "./AccountsInfoTab";
import type { PaymentEntry } from "./CustomerTab";
import { CartPanel } from "./CartPanel";
import {
  CustomerSearchModal,
  QuickAddCustomerModal,
  CloseInvoiceModal,
} from "./POSModals";

import { useMenu } from "../../hooks/useMenu";
import { useCart, type CartItem } from "../../hooks/useCart";
import type { MenuItem } from "../../hooks/useMenu";
import {
  orderService,
  normalizePaymentMethod as normalizeApiPaymentMethod,
  type OrderFromApi,
  type PaymentMethod as ApiPaymentMethod,
} from "../../services/orderService";
import { TablesView } from "./Tables";
import type { Order, Table } from "../../../types";
import { getDeviceUUIDSecurely, getRegisterInfoSecurely } from "../../utils/posSecurity";
import POSActivationPage from "./POSActivationPage";
import { PaymentMethodModal } from "../Hospitality/PaymentMethodModal";
import { PERMISSIONS, ROLES } from "../../auth/permissions";
import api from "../../api/axios";


const MONEY_EPSILON = 0.01;

const roundMoney = (value: number) =>
  Math.round((Number(value) || 0) * 100) / 100;

// الكمية بتنخزن على الباك اند كـ decimal(15,4) (أصناف الوزن: كمية مشتقّة من
// الإجمالي ÷ السعر). نقرّبها لـ4 خانات عشرية قبل ما نخزّنها بالسلة حتى:
//   • subtotal الواجهة يطابق اللي بيحسبه الباك اند (ما يطلع «المبلغ المدفوع
//     ناقص/زائد» وقت الإغلاق)
//   • السطر يرجّع نفس الإجمالي اللي كتبه الكاشير (10 ÷ 35 = 0.2857 → ×35 ≈ 10)
const roundQty = (value: number) =>
  Math.round((Number(value) || 0) * 10000) / 10000;

const requiresPaymentReference = (method: PaymentMethod) =>
  method === PaymentMethod.WALLET ||
  method === PaymentMethod.QR ||
  method === PaymentMethod.ONLINE;

const toPosOrderType = (type: OrderFromApi["order_type"]) =>
  type === "dine_in" ? OrderType.DINE_IN : OrderType.TAKEAWAY;

const toPosPaymentMethod = (
  method?: ApiPaymentMethod | string | null,
): PaymentMethod => {
  const normalized = normalizeApiPaymentMethod(method);
  if (normalized === "card") return PaymentMethod.CREDIT_CARD;
  if (normalized === "wallet") return PaymentMethod.WALLET;
  if (normalized === "bank") return PaymentMethod.QR;
  return PaymentMethod.CASH;
};

const apiOrderToCartItems = (order: OrderFromApi): CartItem[] =>
  order.items.map((item) => ({
    uniqueId: `api-${item.id}`,
    itemId: String(item.item_id),
    id: item.item_id,
    name: item.item_name_ar || item.item_name,
    name_ar: item.item_name_ar || item.item_name,
    price: Number(item.unit_price || 0),
    quantity: Number(item.quantity || 0),
    notes: item.notes ?? undefined,
    department_id: item.department_id,
    is_printed_direct: item.is_printed_direct ?? false,
    is_takeaway: item.is_takeaway ?? false,
    is_complimentary: item.is_complimentary ?? false,
  }));

const localOrderToCartItems = (order: Order): CartItem[] =>
  order.items.map((item) => ({
    uniqueId: item.uniqueId,
    itemId: item.itemId,
    id: Number(item.itemId) || 0,
    name: item.name,
    name_ar: item.name,
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    notes: item.note,
    department_id: Number(item.departmentId) || 0,
  }));

type TableCartDraft = {
  items: CartItem[];
  orderType: OrderType;
  invoiceNote: string;
  discountValue: number;
  discountType: "AMOUNT" | "PERCENT";
  payments: PaymentEntry[];
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  customerMobile: string;
  customerAddress: string;
  customerNotes: string;
  scheduledAt: string;
  editingApiOrderId: number | null;
};

const cloneCartItems = (items: CartItem[]) =>
  items.map((item) => ({ ...item }));

const clonePayments = (items: PaymentEntry[]) =>
  items.map((payment) => ({ ...payment }));

const normalizeTableNumber = (value: string | number | null | undefined) =>
  String(value ?? "").trim();

export const POS: React.FC<{
  onViewTables: () => void;
  initialMode?: "menu" | "tables" | "info" | "contact" | "accounts";
}> = ({ onViewTables, initialMode = "menu" }) => {

  const [searchParams] = useSearchParams();
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [posInfo, setPosInfo] = useState<any>(null);
  const [checkingSecurity, setCheckingSecurity] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<number | null>(null);
  const [invoiceNavLoading, setInvoiceNavLoading] = useState(false);

  useEffect(() => {
    const checkDeviceSecurity = async () => {
      try {
        const uuid = await getDeviceUUIDSecurely();
        const storedInfo = await getRegisterInfoSecurely();

        if (uuid && storedInfo) {
          setDeviceUuid(uuid);
          setPosInfo(storedInfo);
        }
      } catch (error) {
        console.error("خطأ في فحص أمان نقطة البيع:", error);
      } finally {
        setCheckingSecurity(false);
      }
    };
    checkDeviceSecurity();
  }, []);

// دالة يتم استدعاؤها لتحديث الحالة فور إدخال كود التفعيل بنجاح
const handleActivationSuccess = (activatedInfo: any) => {
  getDeviceUUIDSecurely().then((uuid) => {
    setDeviceUuid(uuid);
    setPosInfo(activatedInfo);
  });
};

  // ── Store (للحالات القديمة غير المنقولة بعد) ──────────────────────────────
  const {
    selectedTable,
    setSelectedTable,
    tables,
    currentUser,
    userRole,
    customers,
    addCustomer,
    employees,
    suppliers,
    activeOrders,
    updateTableStatus,
  } = useApp();

  const isHospitality = userRole === "HOSPITALITY";

  // ── Branch ID ─────────────────────────────────────────────────────────────
  // نأخذه من currentUser — إذا ما في فرع، يستخدم null
  // (MenuController سيرفض الطلب لغير super-admin بدون فرع)

  const branchId: number | undefined =
  posInfo?.branch_id ?? (currentUser as any)?.branch_id ?? undefined;

  // ── Menu from API ─────────────────────────────────────────────────────────
  const {
    categories,
    allItems,
    loading: menuLoading,
    error: menuError,
    findByCode,
  } = useMenu(branchId);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const {
    cart: currentCart,
    subtotal,
    addToCart: addToCartRaw,
    updateCartItem: updateCartItemRaw,
    removeFromCart: removeFromCartRaw,
    loadCart,
    clearCart,
    submitOrder: submitOrderApi,
    submitting,
    submitError,
  } = useCart();

  // wrapper لمنع التحديث أثناء التعديل
  const updateCartItem = (...args: Parameters<typeof updateCartItemRaw>) => {
    markUserEditing();
    return updateCartItemRaw(...args);
  };

  const removeFromCart = (...args: Parameters<typeof removeFromCartRaw>) => {
    markUserEditing();
    return removeFromCartRaw(...args);
  };

  // ── UI State ──────────────────────────────────────────────────────────────
  const [activePOSMode, setActivePOSMode] = useState<
    "tables" | "menu" | "info" | "contact" | "accounts"
  >(initialMode);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [pendingCloseKind, setPendingCloseKind] = useState<"takeaway" | "dine_in" | null>(null);

  // فشل تحميل المنيو كان بيمر بصمت — الشاشة بتضل فاضية بدون أي توضيح للكاشير
  useEffect(() => {
    if (menuError) {
      setPosError(menuError);
    }
  }, [menuError]);

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [manualTable, setManualTable] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Auto-dismiss error toast
  useEffect(() => {
    if (posError) {
      toast.error(posError);
      setPosError(null);
    }
  }, [posError]);

  // Show submit errors from useCart as toast
  useEffect(() => {
    if (submitError) {
      toast.error("فشل إرسال الطلب", submitError);
    }
  }, [submitError]);

  // ── Customer State ────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  // ── Invoice State ─────────────────────────────────────────────────────────
  const [invoiceNote, setInvoiceNote] = useState("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"AMOUNT" | "PERCENT">(
    "AMOUNT",
  );
  const [editingDiscount, setEditingDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [cartOrderType, setCartOrderType] = useState<OrderType>(
    OrderType.TAKEAWAY,
  );
  const [accountType, setAccountType] = useState<
    "ACCOUNT" | "SUPPLIER" | "EMPLOYEE"
  >("ACCOUNT");
  const [accountNumber, setAccountNumber] = useState("");

  // ── Cart Editing State ────────────────────────────────────────────────────
  const [editingQty, setEditingQty] = useState<{ [id: string]: string }>({});
  const [editingNames, setEditingNames] = useState<{ [id: string]: string }>(
    {},
  );
  const [editingApiOrderId, setEditingApiOrderId] = useState<number | null>(
    null,
  );
  const [cancelledEditForTable, setCancelledEditForTable] = useState<string | null>(null);
  const [tableCartDrafts, setTableCartDrafts] = useState<
    Record<string, TableCartDraft>
  >({});
  const currentEditingOrderId = editingApiOrderId
    ? String(editingApiOrderId)
    : null;

  // ── قراءة editOrderId من الرابط وتحميل الطلب تلقائياً ──
  useEffect(() => {
    const editOrderIdParam = searchParams.get("editOrderId");
    if (!editOrderIdParam) return;

    const orderId = Number(editOrderIdParam);
    if (!Number.isFinite(orderId)) return;

    // تنظيف الرابط بعد القراءة
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("editOrderId");
    const newUrl = `${window.location.pathname}${newSearchParams.toString() ? "?" + newSearchParams.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);

    let cancelled = false;

    const loadOrderForEdit = async () => {
      try {
        const order = await orderService.getOne(orderId);
        if (!cancelled) {
          applyApiOrderToCart(order);
          setIsCartOpen(true);
          setActivePOSMode("menu");
        }
      } catch (err) {
        console.error("فشل تحميل الطلب للتعديل:", err);
        if (!cancelled) setPosError("فشل تحميل الطلب للتعديل");
      }
    };

    loadOrderForEdit();

    return () => { cancelled = true; };
  }, [searchParams]);

  // ── قراءة tableId من الرابط (قادمين من صفحة الطاولات المستقلة /pos/tables)
  //    وفتح طلب الطاولة تلقائياً بشاشة البيع مع فتح السلة ──
  const handledTableParamRef = useRef<string | null>(null);
  useEffect(() => {
    const tableIdParam = searchParams.get("tableId");
    if (!tableIdParam) return;
    if (handledTableParamRef.current === tableIdParam) return;

    const table = tables?.find((t) => String(t.id) === String(tableIdParam));
    if (!table) return; // الطاولات لسا ما تحمّلت — رح يعيد المحاولة لما توصل

    handledTableParamRef.current = tableIdParam;

    // تنظيف الرابط بعد القراءة
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("tableId");
    const newUrl = `${window.location.pathname}${newSearchParams.toString() ? "?" + newSearchParams.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);

    setActivePOSMode("menu");
    setCartOrderType(OrderType.DINE_IN);
    setSelectedTable(table);
    setManualTable(table.table_number || table.number.toString());
    setIsCartOpen(true);
    void loadApiOrderForTable(table, false).catch((err) => {
      console.error("Failed to load table order from tableId param:", err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tables]);

  // ── جلب بيانات الفاتورة عند تعديل طلب موجود ──
  useEffect(() => {
    if (!editingApiOrderId) {
      setInvoiceData(null);
      setCurrentInvoiceId(null);
      return;
    }

    let cancelled = false;

    const fetchInvoiceForOrder = async () => {
      try {
        const invoice = await orderService.getInvoiceForOrder(editingApiOrderId);
        if (!cancelled && invoice) {
          // InvoiceResource (باك اند) بيرجع الشكل متداخل فعلياً تحت pos/details/opening/closing —
          // كانت هاي القراءة سابقاً بتحاول تقرأ حقول مسطّحة (pos_register_id مباشرة على
          // الفاتورة) مش موجودة أصلاً، فتبويب "بيانات الفاتورة" كان يضل فاضي عند فتح
          // طلب محفوظ مسبقاً. نقرأ الشكل المتداخل الحقيقي مع fallback للحقول المسطّحة.
          const raw = invoice as any;
          const pos = raw.pos ?? {};
          const details = raw.details ?? {};
          const opening = raw.opening ?? {};
          const closing = raw.closing;

          setInvoiceData({
            pos: {
              register_id: pos.register_id ?? raw.pos_register_id ?? null,
              code: pos.code ?? raw.pos_code ?? null,
              name: pos.name ?? raw.pos_name ?? null,
              branch: pos.branch ?? (raw.branch ? { id: raw.branch.id, name: raw.branch.name } : null),
            },
            details: {
              number: details.number ?? invoice.number,
              date: details.date ?? invoice.created_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
              time: details.time ?? (invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : ''),
              currency: details.currency ?? raw.currency ?? 'ILS',
              exchange_rate: details.exchange_rate ?? 1,
              account_number: details.account_number ?? raw.account_number ?? null,
              daily_sequence: details.daily_sequence ?? null,
              reference_number: details.reference_number ?? null,
              financial_voucher_number: details.financial_voucher_number ?? null,
              vat_report_number: details.vat_report_number ?? null,
              journal_entry_number: details.journal_entry_number ?? null,
            },
            opening: {
              user: opening.user ?? (raw.opened_by_user ? { id: raw.opened_by_user.id, name: raw.opened_by_user.name } : null),
              pos_name: opening.pos_name ?? pos.name ?? raw.pos_name ?? null,
              date: opening.date ?? raw.opened_at?.split('T')[0] ?? null,
              time: opening.time ?? (raw.opened_at ? new Date(raw.opened_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : null),
            },
            closing: closing ? {
              user: closing.user ?? null,
              pos_name: closing.pos_name ?? pos.name ?? null,
              date: closing.date ?? null,
              time: closing.time ?? null,
            } : (raw.closed_at ? {
              user: raw.closed_by_user ? { id: raw.closed_by_user.id, name: raw.closed_by_user.name } : null,
              pos_name: raw.pos_name ?? null,
              date: raw.closed_at?.split('T')[0] ?? null,
              time: raw.closed_at ? new Date(raw.closed_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : null,
            } : null),
            accounts: raw.accounts ?? null,
          });
          setCurrentInvoiceId(raw.id ?? null);
        }
      } catch (err) {
        console.warn('لم يتم العثور على فاتورة لهذا الطلب:', err);
        if (!cancelled) setInvoiceData(null);
      }
    };

    fetchInvoiceForOrder();

    return () => { cancelled = true; };
  }, [editingApiOrderId]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setEditingDiscount(discountValue.toString());
  }, [discountValue]);

  useEffect(() => {
    if (selectedTable) {
      setManualTable((selectedTable as any).table_number || ((selectedTable as any).number?.toString() ?? ""));
    } else {
      setManualTable("");
    }
  }, [selectedTable]);

  useEffect(() => {
    if (isHospitality) {
      setCartOrderType(OrderType.DINE_IN);
      setActivePOSMode("menu");
    }
  }, [isHospitality]);

  // ── Account data comes from real API via CustomerTab/SettlementPanel ──
  // No hardcoded mock account numbers.
  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery) return [];
    return (customers ?? []).filter(
      (c: any) =>
        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.phone.includes(customerSearchQuery),
    );
  }, [customers, customerSearchQuery]);

  const getEntityDepartmentId = (): number | undefined => {
    if (accountType === "EMPLOYEE" && accountNumber) {
      const empId = parseInt(accountNumber, 10);
      if (empId) {
        // نحاول إيجاد القسم من الموظف — سيحله محرك الخصم من الـ mock entities
        return undefined; // المحرك سيستنتج department_id من employee_id
      }
    }
    // إذا كان العميل مختار من القائمة، نحاول إيجاد department_id من أول صنف في السلة
    if (currentCart.length > 0 && currentCart[0].department_id) {
      return currentCart[0].department_id;
    }
    return undefined;
  };

  const getPricingContext = () => {
    const numericId = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === "") return undefined;
      const n = typeof v === "number" ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    return {
      customer_id:
        accountType === "ACCOUNT"
          ? (selectedCustomer?.id
              ? numericId(selectedCustomer.id)
              : numericId(accountNumber))
          : undefined,
      employee_id:
        accountType === "EMPLOYEE" ? numericId(accountNumber) : undefined,
      supplier_id:
        accountType === "SUPPLIER" ? numericId(accountNumber) : undefined,
      department_id: numericId(getEntityDepartmentId()),
      branch_id: numericId(branchId),
    };
  };

  const discountContext = useMemo(() => getPricingContext(), [
    accountType,
    selectedCustomer,
    accountNumber,
    branchId,
    currentCart,
  ]);

  const {
    engineDiscountTotal,
    originalSubtotal: engineOriginalSubtotal,
    appliedDiscounts,
    items: engineDiscountItems,
    loading: discountLoading,
    error: discountError,
  } = useDiscountCart(currentCart, discountContext);

  // فشل حساب الخصم كان بيمر بصمت — الكاشير يشوف "بدون خصم" بدون أي تفسير
  useEffect(() => {
    if (discountError) {
      toast.error("فشل حساب الخصم", discountError);
    }
  }, [discountError]);

  const enrichedCart = useMemo(
    () =>
      currentCart.map((item) => {
        const line = engineDiscountItems.find((l) => l.item_id === item.id);
        if (!line || line.discount_amount <= 0) return item;
        return {
          ...item,
          original_price: line.original_price,
          final_price: line.final_unit_price,
          discount_amount: line.discount_amount,
          discount_percent: line.discount_percent,
          discount_id: line.discount?.id,
        };
      }),
    [currentCart, engineDiscountItems],
  );

  // خلال إعادة حساب الخصم (loading) أو عند فشلها (error)، قيم المحرك
  // (engineOriginalSubtotal / engineDiscountTotal) بتضل قديمة من حالة سلة
  // سابقة. الاعتماد عليها كان بيخلي `total` غير مستقر — خصوصاً مع أصناف
  // الوزن اللي كل ضغطة زر بتطلق نداء محرك جديد — فيطلع "المبلغ المدفوع
  // ناقص/زائد" وقت الإغلاق رغم إن الكاشير دفع الظاهر عالشاشة. وقتها منعتمد
  // على subtotal المحلي (Σ سعر×كمية) بدون خصم محرك.
  const engineReady = !discountLoading && !discountError;
  const safeEngineDiscountTotal = engineReady ? engineDiscountTotal : 0;
  const displaySubtotal =
    engineReady && engineOriginalSubtotal > 0 ? engineOriginalSubtotal : subtotal;
  const afterEngineSubtotal = Math.max(
    0,
    displaySubtotal - safeEngineDiscountTotal,
  );
  const manualDiscount =
    discountType === "PERCENT"
      ? (afterEngineSubtotal * discountValue) / 100
      : discountValue;
  const calculatedDiscount = roundMoney(safeEngineDiscountTotal + manualDiscount);
  const total = roundMoney(Math.max(0, displaySubtotal - calculatedDiscount));
  const totalPaid = roundMoney(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const remainingAmount = Math.max(0, roundMoney(total - totalPaid));

  // ── Helpers ───────────────────────────────────────────────────────────────

  // ✅ getItemCurrentPrice: السعر يجي من pivot مباشرة
  const getItemCurrentPrice = (item: any): number => item.price ?? 0;

  const setOrderType = (type: OrderType) => {
    // فوري ومحلي طلبات منفصلة تماماً — التبديل بين الوضعين ما لازم يخلي
    // أصناف/بيانات الطلب الحالي (اللي كانت بوضع تاني) تنتقل معه
    if (type !== cartOrderType) {
      clearActiveCart();
    }
    setCartOrderType(type);
    if (type === OrderType.DINE_IN) {
      setActivePOSMode("tables");
    } else {
      setActivePOSMode("menu");
    }
  };

  const addToCart = (
    item: MenuItem | any,
    opts?: { quantity?: number; price?: number },
  ) => {
    markUserEditing();
    addToCartRaw(item, opts);
  };

  // معرفة entityType من accountType الحالي
  const getEntityType = (): string | undefined => {
    if (accountType === 'EMPLOYEE') return 'employee';
    if (accountType === 'SUPPLIER') return 'supplier';
    if (accountType === 'ACCOUNT') return 'customer';
    return undefined;
  };

  const buildCurrentTableDraft = (): TableCartDraft => ({
    items: cloneCartItems(currentCart),
    orderType: cartOrderType,
    invoiceNote,
    discountValue,
    discountType,
    payments: clonePayments(payments),
    paymentMethod,
    customerName,
    customerPhone,
    customerMobile,
    customerAddress,
    customerNotes,
    scheduledAt,
    editingApiOrderId,
  });

  const forgetTableDraft = (tableId: string) => {
    setTableCartDrafts((prev) => {
      if (!prev[tableId]) return prev;
      const next = { ...prev };
      delete next[tableId];
      return next;
    });
  };

  const cacheCurrentTableDraft = () => {
    if (!selectedTable) return;

    setTableCartDrafts((prev) => {
      if (currentCart.length === 0) {
        if (!prev[selectedTable.id]) return prev;
        const next = { ...prev };
        delete next[selectedTable.id];
        return next;
      }

      return {
        ...prev,
        [selectedTable.id]: buildCurrentTableDraft(),
      };
    });
  };

  const applyTableDraft = (table: Table, draft: TableCartDraft) => {
    loadCart(cloneCartItems(draft.items));
    setEditingApiOrderId(draft.editingApiOrderId);
    setCartOrderType(draft.orderType);
    setManualTable(table.table_number || table.number.toString());
    setInvoiceNote(draft.invoiceNote);
    setDiscountValue(draft.discountValue);
    setDiscountType(draft.discountType);
    setPayments(clonePayments(draft.payments));
    setPaymentMethod(draft.paymentMethod);
    setCustomerName(draft.customerName);
    setCustomerPhone(draft.customerPhone);
    setCustomerMobile(draft.customerMobile ?? "");
    setCustomerAddress(draft.customerAddress ?? "");
    setCustomerNotes(draft.customerNotes ?? "");
    setScheduledAt(draft.scheduledAt ?? "");
    setIsCartOpen(draft.items.length > 0);
  };

  // ── حالة الطلب الحالي (للتحقق مما إذا كان مؤجل) ──
  const [currentOrderStatus, setCurrentOrderStatus] = useState<OrderStatus | null>(null);

  const applyApiOrderToCart = (order: OrderFromApi, table?: Table) => {
    loadCart(apiOrderToCartItems(order));
    setEditingApiOrderId(order.id);
    // إذا كان الطلب مؤجل (pending_payment)، نبقي النوع dine_in مع إظهار رقم الطاولة
    // حتى يفتح في واجهة "محلي" وليس "فوري"
    const isDeferred = order.status === "pending_payment";
    setCartOrderType(toPosOrderType(order.order_type));
    if (isDeferred) {
      // استخراج رقم الطاولة من الملاحظات إن وُجد (مخزن كـ [Table: A1])
      const tableMatch = (order.note ?? "").match(/\[Table:\s*([^\]]+)\]/i);
      const deferredTableNumber = tableMatch ? tableMatch[1].trim() : "";
      // الطلب المؤجل: نخلي رقم الطاولة يظهر لكن بدون تحديد طاولة (لأنها محررة)
      setManualTable(deferredTableNumber || order.table_number || table?.table_number || table?.number.toString() || "");
      setSelectedTable(null);
    } else {
      setManualTable(table?.table_number || order.table_number || table?.number.toString() || "");
    }
    setCurrentOrderStatus(order.status);
    setInvoiceNote(order.note ?? "");
    setDiscountValue(Number(order.discount_value || 0));
    setDiscountType(order.discount_type === "percent" ? "PERCENT" : "AMOUNT");
    setCustomerName(order.customer_name ?? "");
    setCustomerPhone(order.customer_phone ?? "");
    setCustomerMobile((order as any).customer_mobile ?? "");
    setCustomerAddress((order as any).customer_address ?? "");
    setCustomerNotes((order as any).customer_notes ?? "");
    setScheduledAt(((order as any).scheduled_at ?? "").slice(0, 16));

    const apiPayments = order.payments ?? [];
    setPayments(
      apiPayments.map((payment) => ({
        method: toPosPaymentMethod(payment.payment_method as ApiPaymentMethod),
        amount: Number(payment.amount || 0),
        reference: payment.reference_number,
      })),
    );

    const primaryMethod = apiPayments[0]?.payment_method ?? order.payment_method;
    if (primaryMethod) {
      setPaymentMethod(toPosPaymentMethod(primaryMethod as ApiPaymentMethod));
    }
  };

  // ── التنقل بين الفواتير (التالي/السابق/الأول/الأخير) ──
  const navigateInvoice = async (direction: "next" | "prev" | "first" | "last") => {
    if (!currentInvoiceId || invoiceNavLoading) return;
    setInvoiceNavLoading(true);
    try {
      const targetInvoice = await orderService.getAdjacentInvoice(currentInvoiceId, direction);
      if (targetInvoice.order_id) {
        const order = await orderService.getOne(targetInvoice.order_id);
        applyApiOrderToCart(order);
        setIsCartOpen(true);
      }
    } catch (err: any) {
      setPosError(err?.response?.data?.message || "لا توجد فاتورة أخرى بهذا الاتجاه");
    } finally {
      setInvoiceNavLoading(false);
    }
  };

  const clearLoadedApiOrder = () => {
    setEditingApiOrderId(null);
    clearCart();
    setInvoiceNote("");
    setDiscountValue(0);
    setDiscountType("AMOUNT");
    setPayments([]);
    setPaymentMethod(PaymentMethod.CASH);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerMobile("");
    setCustomerAddress("");
    setCustomerNotes("");
    setScheduledAt("");
  };

  const clearActiveCart = () => {
    if (selectedTable) {
      forgetTableDraft(selectedTable.id);
      setCancelledEditForTable(selectedTable.id);
    }
    setSelectedTable(null);
    setManualTable("");
    clearLoadedApiOrder();
  };

  const resolveActiveDineInTable = () => {
    if (cartOrderType !== OrderType.DINE_IN) return null;

    const tableNumber = normalizeTableNumber(manualTable);
    if (!tableNumber) {
      setPosError("يرجى اختيار الطاولة قبل حفظ الطلب");
      return null;
    }

    if (selectedTable && selectedTable.table_number?.toUpperCase() === tableNumber.toUpperCase()) {
      return selectedTable;
    }

    const table = tables.find(
      (t) => t.table_number?.toUpperCase() === tableNumber.toUpperCase() || t.number.toString() === tableNumber,
    );
    if (!table) {
      setPosError("الطاولة المحددة غير موجودة");
      return null;
    }

    if (selectedTable && selectedTable.id !== table.id) {
      setPosError("السلة الحالية لا تتبع الطاولة النشطة");
      return null;
    }

    return table;
  };

  const loadApiOrderForTable = async (table: Table, clearWhenMissing = true) => {
    const tableNum = table.table_number || table.number.toString();
    const orders = await orderService.getAllActiveByTableNumber(tableNum, {
      branch_id: branchId || 0,
    });

    if (orders.length > 0) {
      // دمج جميع الطلبات في السلة
      const allItems: ReturnType<typeof apiOrderToCartItems>[number][] = [];
      let firstOrder: OrderFromApi | null = null;
      for (const order of orders) {
        if (!firstOrder) firstOrder = order;
        allItems.push(...apiOrderToCartItems(order));
      }

      loadCart(allItems);
      setEditingApiOrderId(firstOrder!.id);
      setCartOrderType(toPosOrderType(firstOrder!.order_type));
      setManualTable(table.table_number || table.number.toString());
      setCurrentOrderStatus(firstOrder!.status);
      setInvoiceNote(firstOrder!.note ?? "");
      setDiscountValue(Number(firstOrder!.discount_value || 0));
      setDiscountType(firstOrder!.discount_type === "percent" ? "PERCENT" : "AMOUNT");
      setCustomerName(firstOrder!.customer_name ?? "");
      setCustomerPhone(firstOrder!.customer_phone ?? "");

      const apiPayments = firstOrder!.payments ?? [];
      setPayments(
        apiPayments.map((payment) => ({
          method: toPosPaymentMethod(payment.payment_method as ApiPaymentMethod),
          amount: Number(payment.amount || 0),
          reference: payment.reference_number,
        })),
      );

      const primaryMethod = apiPayments[0]?.payment_method ?? firstOrder!.payment_method;
      if (primaryMethod) {
        setPaymentMethod(toPosPaymentMethod(primaryMethod as ApiPaymentMethod));
      }

      updateTableStatus(table.id, TableStatus.OCCUPIED, {
        currentOrderId: String(firstOrder!.id),
      });
      return firstOrder;
    }

    if (clearWhenMissing) {
      clearLoadedApiOrder();
    }

    return null;
  };

  useEffect(() => {
    if (!selectedTable) return;

    const isActiveTable =
      selectedTable.status === TableStatus.OCCUPIED ||
      selectedTable.status === TableStatus.PAYMENT_PENDING ||
      selectedTable.status === TableStatus.BILL_PRINTED;

    if (!isActiveTable || editingApiOrderId || currentCart.length > 0) return;

    // لا تحمل الطلب إذا المستخدم ألغى التعديل على نفس الطاولة
    if (cancelledEditForTable === selectedTable.id) return;

    void loadApiOrderForTable(selectedTable, false)
      .then((order) => {
        if (!order) return;
        setIsCartOpen(true);
      })
      .catch((err) => {
        console.error("Failed to load selected table order:", err);
        setPosError("فشل تحميل طلب الطاولة");
      });
  }, [
    selectedTable?.id,
    selectedTable?.number,
    selectedTable?.status,
    editingApiOrderId,
    currentCart.length,
    cancelledEditForTable,
  ]);

  // ── مؤشر لمنع التحديث أثناء تعديل المستخدم للسلة ──
  const userActiveEditRef = useRef(false);
  const userEditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOrderHashRef = useRef<string>("");

  const markUserEditing = () => {
    userActiveEditRef.current = true;
    if (userEditTimerRef.current) clearTimeout(userEditTimerRef.current);
    userEditTimerRef.current = setTimeout(() => {
      userActiveEditRef.current = false;
    }, 10000);
  };

  // تحديث السلة فقط عند وجود تغييرات فعلية بال database
  const isActiveTableForPolling =
    !!selectedTable &&
    (selectedTable.status === TableStatus.OCCUPIED ||
      selectedTable.status === TableStatus.PAYMENT_PENDING ||
      selectedTable.status === TableStatus.BILL_PRINTED);

  const checkTableForUpdates = useCallback(async () => {
    if (!selectedTable || userActiveEditRef.current) return;

    try {
      const tableNum = selectedTable.table_number || selectedTable.number.toString();
      const orders = await orderService.getAllActiveByTableNumber(tableNum, {
        branch_id: branchId || 0,
      });

      // نبني hash بسيط من الطلب لتحديد إذا في تغيير
      const hash = orders.map(o => `${o.id}:${o.updated_at}:${o.items.length}:${o.status}`).join("|");

      if (hash && hash !== lastOrderHashRef.current) {
        // في تغيير! نحدث السلة
        lastOrderHashRef.current = hash;

        if (orders.length === 0) return;

        const allItems: ReturnType<typeof apiOrderToCartItems>[number][] = [];
        let firstOrder: OrderFromApi | null = null;
        for (const order of orders) {
          if (!firstOrder) firstOrder = order;
          allItems.push(...apiOrderToCartItems(order));
        }

        loadCart(allItems);
        setEditingApiOrderId(firstOrder!.id);
        setCurrentOrderStatus(firstOrder!.status);
      }
    } catch {
      // تجاهل الأخطاء
    }
  }, [selectedTable, branchId]);

  // تحقق أول مرة عند تغيير الطاولة النشطة
  useEffect(() => {
    if (isActiveTableForPolling) {
      checkTableForUpdates();
    }
  }, [selectedTable?.id, isActiveTableForPolling, checkTableForUpdates]);

  // كل 15 ثانية نتحقق (خفيف) — يتوقف تلقائياً لو التبويب بالخلفية أو ما فيه طاولة نشطة
  useVisibilityInterval(checkTableForUpdates, isActiveTableForPolling ? 15000 : null);

  const handleTableInput = (val: string) => {
    setManualTable(val);

    const normalized = normalizeTableNumber(val);
    const table = tables?.find(
      (t: any) => t.table_number?.toUpperCase() === normalized?.toUpperCase() || t.number?.toString() === normalized,
    );

    if (!table) {
      if (selectedTable) {
        cacheCurrentTableDraft();
        clearLoadedApiOrder();
      }
      setSelectedTable(null);
      return;
    }

    if (selectedTable?.id === table.id) return;

    cacheCurrentTableDraft();
    clearLoadedApiOrder();
    setSelectedTable(table);

    const draft = tableCartDrafts[table.id];
    if (draft) {
      applyTableDraft(table, draft);
    }
  };

  const handleTableClick = async (table: Table) => {
    const isSwitchingTables = selectedTable && selectedTable.id !== table.id;

    if (isSwitchingTables) {
      cacheCurrentTableDraft();
      clearLoadedApiOrder();
      setIsCartOpen(false);
    }

    // مسح flag الإلغاء عند اختيار طاولة مختلفة
    if (isSwitchingTables || table.id !== selectedTable?.id) {
      setCancelledEditForTable(null);
    }

    setSelectedTable(table);
    setManualTable(table.table_number || table.number.toString());

    setCartOrderType(OrderType.DINE_IN);

    if (!isSwitchingTables && selectedTable?.id === table.id) {
      setIsCartOpen(currentCart.length > 0);
      return;
    }

    const draft = tableCartDrafts[table.id];
    if (draft) {
      applyTableDraft(table, draft);
      return;
    }

    const isActiveTable =
      table.status === TableStatus.OCCUPIED ||
      table.status === TableStatus.PAYMENT_PENDING ||
      table.status === TableStatus.BILL_PRINTED;

    if (isActiveTable) {
      try {
        const apiOrder = await loadApiOrderForTable(table, false);
        if (apiOrder) {
          setIsCartOpen(true);
          return;
        }
      } catch (err) {
        console.error("Failed to load table order:", err);
        setPosError("فشل تحميل طلب الطاولة");
      }
    }

    const order = activeOrders.find(
      (o) => o.tableId === table.id || o.id === table.currentOrderId,
    );
    if (order) {
      loadCart(localOrderToCartItems(order));
      setEditingApiOrderId(null);
      setCartOrderType(order.type);
      setIsCartOpen(true);
      return;
    }

    // الطاولة مشغولة بس ما فيها طلب → افتح السلة فاضية
    if (isActiveTable) {
      setCartOrderType(OrderType.DINE_IN);
      setManualTable(table.table_number || table.number.toString());
      setIsCartOpen(true);
      return;
    }

    if (editingApiOrderId) {
      clearLoadedApiOrder();
    }
  };

const handlePrintInvoice = async (
  orderId?: number | string | null,
  mode: "all" | "merged" | "departments" | "fawri" = "all",
) => {
  if (isPrinting) return;
  if (!orderId) {
    toast.error("لا يوجد طلب محفوظ لطباعته بعد");
    return;
  }

  setIsPrinting(true); // استخدام الدالة المعرفة مسبقاً في ملفك
  try {
    // mode: departments = نسخ الأقسام فقط | merged = الفاتورة المدمجة فقط | all = الاثنين
    // pos_register_id: هوية محطة الكاشير الفعلية (من تفعيل الجهاز) — لازم
    // نرسلها صراحة، وإلا السيرفر بيرفض الطباعة (أو يخمّن محطة غلط قديمًا).
    // ‼️ هاد السطر اختفى 3 مرات سابقًا (2026-09-09، 2026-09-10، 2026-09-12)
    // بدون تفسير واضح كل مرة - على الأغلب نسخة قديمة محلية عند مطور تاني
    // بتكتب فوق هالملف. لو بتلمس هالدالة لأي سبب، تأكد إنه pos_register_id
    // يضل موجود بجسم الطلب، وبلّغ فورًا لو لقيته اختفى تاني.
    const response = await api.post(`/orders/${orderId}/print-invoice`, {
      mode,
      pos_register_id: posInfo?.id ?? null,
    });

    if (response.data && response.data.success) {
      toast.success(response.data.message || "تم إرسال أمر الطباعة إلى الطابعة");
    } else {
      // نجاح الطلب (200) لا يعني نجاح الطباعة الفعلية — نظهر رسالة الفشل الحقيقية بدل تجاهلها بصمت
      toast.error(response.data?.message || "لم تتم الطباعة، تحقق من الطابعة والاتصال");
    }
  } catch (error: any) {
    console.error("Print Error:", error);
    const errorMsg = error.response?.data?.message || "فشلت العملية، تحقق من الشبكة";
    toast.error(errorMsg);
  } finally {
    setIsPrinting(false);
  }
};

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setShowSearchModal(false);
    setCustomerSearchQuery("");
  };

  const handleQuickAddCustomer = () => {
    if (!quickCustomerName || !quickCustomerPhone) return;
    addCustomer?.({
      name: quickCustomerName,
      phone: quickCustomerPhone,
      type: CustomerType.REGULAR,
      allowCredit: false,
      notes: "",
    });
    setShowQuickAddCustomer(false);
    setQuickCustomerName("");
    setQuickCustomerPhone("");
  };

  // ── Cart Handlers ─────────────────────────────────────────────────────────
  const handleNameChange = (uniqueId: string, newName: string) => {
    setEditingNames((prev) => ({ ...prev, [uniqueId]: newName }));
    updateCartItem(uniqueId, { name: newName } as any);
  };

  const handleQuantityChange = (uniqueId: string, val: string) => {
    setEditingQty((prev) => ({ ...prev, [uniqueId]: val }));
    if (val === "" || val === "." || val.endsWith(".")) return;
    const qty = parseFloat(val);
    if (!isNaN(qty)) updateCartItem(uniqueId, { quantity: Math.max(0, qty) } as any);
  };

  const handleQuantityBlur = (uniqueId: string, val: string) => {
    updateCartItem(uniqueId, { quantity: roundQty(Math.max(0, parseFloat(val) || 0)) } as any);
    setEditingQty((prev) => {
      const n = { ...prev };
      delete n[uniqueId];
      return n;
    });
  };

  const handleTotalChange = (uniqueId: string, val: string, price: number) => {
    if (val === "") {
      updateCartItem(uniqueId, { quantity: 0 } as any);
      return;
    }
    const newTotal = parseFloat(val);
    if (!isNaN(newTotal))
      updateCartItem(uniqueId, {
        quantity: price > 0 ? roundQty(Math.max(0, newTotal / price)) : 0,
      } as any);
  };

  // ── submitOrder ───────────────────────────────────────────────────────────
  // يرسل الطلب للـ API الحقيقي — محسّن لإرسال entity data للمدفوعات على حساب الكيانات
  const submitOrder = async (
    status: OrderStatus,
    method: PaymentMethod,
    _discount: number,
    meta: { name: string; phone: string; note: string; currency?: string; exchangeRate?: number },
    paymentsArg?: any[],
    clearAfterSubmit = true,
    options?: { directPrintFirst?: boolean; cashierDeviceId?: number; skipSync?: boolean },
  ): Promise<any> => {
    if (isSubmittingOrder) return null;
    if (currentCart.length === 0) {
      setPosError("السلة فارغة");
      return null;
    }

    setIsSubmittingOrder(true);
    try {

    const orderType =
      cartOrderType === OrderType.DINE_IN ? "dine_in" : "takeaway";

    const shouldConfirm = status === OrderStatus.CONFIRMED || isHospitality; // الضيافة تأكد مباشرة
    const isClosingOrder = status === OrderStatus.DELIVERED;
    const selectedPayments = (paymentsArg ?? payments)
      .map((payment) => ({
        ...payment,
        amount: roundMoney(payment.amount),
        reference: payment.reference?.trim() || undefined,
      }))
      .filter((payment) => payment.amount > 0);
    const closingPayments: PaymentEntry[] =
      isClosingOrder && selectedPayments.length === 0 && total > MONEY_EPSILON
        ? [{ method, amount: roundMoney(total) }]
        : selectedPayments;

    if (isClosingOrder) {
      const paidTotal = roundMoney(
        closingPayments.reduce((sum, payment) => sum + payment.amount, 0),
      );
      const paymentDiff = roundMoney(total - paidTotal);

      if (total > MONEY_EPSILON && closingPayments.length === 0) {
        setPosError("يرجى تحديد طريقة الدفع قبل الإغلاق");
        return;
      }

      if (total > MONEY_EPSILON && Math.abs(paymentDiff) > MONEY_EPSILON) {
        setPosError(
          paymentDiff > 0
            ? `المبلغ المدفوع ناقص ${paymentDiff.toFixed(2)} ₪`
            : `المبلغ المدفوع زائد ${Math.abs(paymentDiff).toFixed(2)} ₪`,
        );
        return;
      }

      if (
        closingPayments.some(
          (payment) =>
            requiresPaymentReference(payment.method) && !payment.reference,
        )
      ) {
        setPosError("يرجى إدخال الرقم المرجعي للمحفظة أو التحويل");
        return;
      }
    }

    const selectedPaymentMethod = closingPayments[0]?.method ?? method;
    // Normalize all payment methods — مع المحافظة على entity data
    const apiClosingPayments = closingPayments
      .map((payment) => {
        const method = normalizeApiPaymentMethod(payment.method);
        if (!method) return null;
        const isEntityMethod = (method as string) === 'account' || (method as string) === 'customer' || (method as string) === 'employee' || (method as string) === 'supplier';
        const result: any = {
          method,
          amount: payment.amount,
          reference: payment.reference,
        };
        // FIXED: نرسل entity_type فقط إذا method = account/customer/employee/supplier
        // لا نرسل entity_type مع cash/bank/card/wallet أبداً
        if (isEntityMethod && (payment as any).entity_type) {
          result.entity_type = (payment as any).entity_type;
          result.entity_id = (payment as any).entity_id;
          result.subledger_type = (payment as any).subledger_type;
          result.subledger_id = (payment as any).subledger_id;
        }
        return result;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null) as any[];

    // للطلبات المؤجلة (pending_payment): نتجاوز التحقق من الطاولة ونستخدم order_type = takeaway
    const isDeferredOrder = currentOrderStatus === "pending_payment";
    let activeTable: Table | null = null;
    if (cartOrderType === OrderType.DINE_IN && !isDeferredOrder) {
      activeTable = resolveActiveDineInTable();
      if (!activeTable) return;
    }

    const effectiveOrderType = isDeferredOrder ? "takeaway" : orderType;

    // للطلبات المؤجلة: نأكد الطلب أولاً (confirm) قبل إنشاء الفاتورة
    if (isDeferredOrder && editingApiOrderId && isClosingOrder) {
      try {
        await orderService.confirm(editingApiOrderId);
      } catch (confirmErr: any) {
        console.warn("[deferred] confirm may have already been done:", confirmErr);
      }
    }

    const result = await submitOrderApi(
      {
        branch_id: branchId,
        cashier_id: currentUser?.id ? Number(currentUser.id) : undefined,
        order_type: effectiveOrderType,
        // «فوري» = تبويب Takeaway في نقطة البيع — يُحفظ مستقلاً عن order_type
        is_fawri: cartOrderType === OrderType.TAKEAWAY,
        table_number: activeTable?.table_number || activeTable?.number.toString(),
        dining_table_id: activeTable ? Number(activeTable.id) : undefined,
        customer_name: meta.name || undefined,
        customer_phone: meta.phone || undefined,
        customer_mobile: customerMobile || undefined,
        customer_address: customerAddress || undefined,
        customer_notes: customerNotes || undefined,
        scheduled_at: scheduledAt || undefined,
        note: meta.note || undefined,
        currency: meta.currency && meta.currency !== "ILS" ? meta.currency : undefined,
        exchange_rate: meta.currency && meta.currency !== "ILS" ? meta.exchangeRate : undefined,
        discount_value: discountValue || undefined,
        discount_type: discountType === "PERCENT" ? "percent" : "amount",
        ...getPricingContext(),
        payment_method: isClosingOrder
          ? normalizeApiPaymentMethod(selectedPaymentMethod)
          : undefined,
      },
      shouldConfirm,
      isClosingOrder ? (apiClosingPayments as any[]) : [],
      isClosingOrder,
      editingApiOrderId,
      clearAfterSubmit,
      options?.directPrintFirst,
      options?.cashierDeviceId,
      options?.skipSync,
    );

    if (result) {
      if (isClosingOrder) {
        toast.success("تم إغلاق الفاتورة بنجاح", `رقم الطلب: ${result.order_number || result.id}`);
      } else {
        toast.success("تم حفظ الطلب بنجاح", `رقم الطلب: ${result.order_number || result.id}`);
      }
      if (activeTable) {
        if (isClosingOrder) {
          updateTableStatus(activeTable.id, TableStatus.AVAILABLE, {
            currentOrderId: undefined,
            seatedAt: undefined,
            guestCount: undefined,
          });
          forgetTableDraft(activeTable.id);
          setSelectedTable(null);
        } else {
          updateTableStatus(activeTable.id, TableStatus.OCCUPIED, {
            currentOrderId: String(result.id),
          });
          forgetTableDraft(activeTable.id);
          setSelectedTable(activeTable);
        }
      }
      // تنظيف بعد النجاح
      setInvoiceNote("");
      setDiscountValue(0);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerMobile("");
      setCustomerAddress("");
      setCustomerNotes("");
      setScheduledAt("");
      setPayments([]);
      setPaymentMethod(PaymentMethod.CASH);
      setEditingApiOrderId(null);
      setShowCustomerModal(false);
      if (isClosingOrder || !activeTable) {
        setManualTable("");
      }
    }
    return result;
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // ── commonCartProps ───────────────────────────────────────────────────────
  // دالة تأجيل الطلب من شاشة البيع — تقوم بتحديث حالة الطاولة محلياً
  const handleDeferFromCart = async () => {
    if (!selectedTable) return;
    try {
      const tableId = selectedTable.id;

      // استخدام الـ endpoint الجديد لتأجيل كل الطلبات كفاتورة وحدة
      await api.post(`/tables/${tableId}/defer-all`);

      // تحديث حالة الطاولة محلياً إلى AVAILABLE
      updateTableStatus(selectedTable.id, TableStatus.AVAILABLE, {
        currentOrderId: undefined,
        seatedAt: undefined,
        guestCount: undefined,
      });
      setSelectedTable(null);
      clearActiveCart();
      setIsCartOpen(false);
      setPosError(null);
    } catch (err: any) {
      setPosError(err?.response?.data?.message || "فشل تأجيل الطلبات");
    }
  };

  // أي بوباب مفتوح فوق الشاشة — يعطّل اختصارات/تنقّل الكاشير اللي وراءه
  // (السلة، شبكة الأصناف، فتح صندوق النقدية...) حتى ما تتحرك الصفحة بالغلط.
  const isModalOpen =
    showPaymentMethodModal || showSearchModal || showQuickAddCustomer || showCustomerModal;

  const commonCartProps = {
    isCartOpen,
    setIsCartOpen,
    isHospitality,
    cartOrderType,
    setOrderType,
    currentCart: enrichedCart,
    manualTable,
    handleTableInput,
    onViewTables,
    subtotal: displaySubtotal,
    calculatedDiscount,
    engineDiscountTotal: safeEngineDiscountTotal,
    manualDiscount,
    appliedDiscounts,
    discountLoading,
    discountType,
    discountValue,
    total,
    invoiceNote,
    setInvoiceNote,
    editingDiscount,
    setEditingDiscount,
    setDiscountValue,
    setDiscountType,
    paymentMethod,
    editingOrderId: currentEditingOrderId,
    editingQty,
    editingNames,
    handleNameChange,
    handleQuantityChange,
    handleQuantityBlur,
    handleTotalChange,
    setEditingNames,
    removeFromCart,
    updateCartItem,
    getItemCurrentPrice,
    setPosError,
    submitOrder,
    customerName,
    customerPhone,
    setShowCustomerModal,
    handlePrintInvoice,
    isPrinting,
    isSubmitting: isSubmittingOrder,
    allItems,
    addToCart,
    posInfo,
    clearCart: clearActiveCart,
    onDeferOrder: handleDeferFromCart,
    isDeferred: currentOrderStatus === "pending_payment",
    onRequestClose: (kind: "takeaway" | "dine_in") => {
      setPendingCloseKind(kind);
      setShowPaymentMethodModal(true);
    },
    isModalOpen,
  };
  // 1. إذا كان النظام ما زال يفحص هوية المتصفح
  if (checkingSecurity) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white" dir="rtl">
        <Loader2 size={40} className="text-red-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400">جاري التحقق من الهوية الرقمية لجهاز نقطة البيع...</p>
      </div>
    );
  }

  // 2. إذا لم يجد بصمة مفعلة أو كود مسجل، يحجب الكاشير ويعرض شاشة التفعيل
  //    لكن إذا كان المستخدم من لوحة الإدارة (يملك صلاحية ACCESS_POS_INTERFACE) يتجاوز التفعيل
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.BRANCH_MANAGER];
  const hasPosInterfaceAccess = userRole && adminRoles.includes(userRole as any);
  
  if (!deviceUuid || !posInfo) {
    if (hasPosInterfaceAccess) {
      // المستخدم من لوحة الإدارة — يسمح له بالدخول بدون تفعيل جهاز
      // استخدم بيانات وهمية لـ posInfo لتجنب الأخطاء
      setPosInfo({ code: 'ADMIN', name: 'واجهة الإدارة', branch_id: null });
    } else {
      return <POSActivationPage onActivationSuccess={handleActivationSuccess} />;
    }
  }
  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row-reverse gap-4 h-full bg-slate-950 overflow-y-auto lg:overflow-hidden p-2 sm:p-4 lg:p-0 custom-scrollbar relative">
      {/* Submitting Overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[150] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl px-8 py-6 flex items-center gap-4 shadow-2xl">
              <Loader2 size={24} className="text-red-500 animate-spin" />
              <span className="text-white font-black text-sm">
                جاري إرسال الطلب...
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Area — left side on desktop */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${isCartOpen ? "hidden lg:flex" : "flex"}`}
      >
        {isHospitality ? (
          <HospitalityPOSHeader
            editingOrderId={currentEditingOrderId}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            clearCart={clearActiveCart}
            onNewInvoice={clearActiveCart}
          />
        ) : (
          <POSHeader
            editingOrderId={currentEditingOrderId}
            isHospitality={isHospitality}
            activePOSMode={activePOSMode}
            setActivePOSMode={setActivePOSMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            clearCart={clearActiveCart}
            isModalOpen={isModalOpen}
            posInfo={posInfo}
          />
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {activePOSMode === "tables" ? (
            <TablesView mode="pos" onSelect={handleTableClick} />
          ) : activePOSMode === "menu" ? (
            <MenuGrid
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              searchQuery={searchQuery}
              addToCart={addToCart}
              loading={menuLoading}
              isModalOpen={isModalOpen}
            />
          ) : activePOSMode === "contact" ? (
            <ContactInfoTab
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerMobile={customerMobile}
              setCustomerMobile={setCustomerMobile}
              customerAddress={customerAddress}
              setCustomerAddress={setCustomerAddress}
              scheduledAt={scheduledAt}
              setScheduledAt={setScheduledAt}
              customerNotes={customerNotes}
              setCustomerNotes={setCustomerNotes}
            />
          ) : activePOSMode === "accounts" ? (
            <AccountsInfoTab />
          ) : (
            <InvoiceInfoTab
              editingOrderId={currentEditingOrderId}
              currentUser={currentUser}
              posInfo={posInfo}
              invoiceData={invoiceData}
              onNavigate={currentInvoiceId ? navigateInvoice : undefined}
              navigating={invoiceNavLoading}
            />
          )}
        </div>
      </div>

      {/* Invoice / Cart — right side on desktop */}
      <CartPanel {...commonCartProps} />

      {/* Mobile Cart Button */}
      {currentCart.length > 0 && !isCartOpen && (
        <button
          onClick={() => setIsCartOpen(true)}
          className="lg:hidden fixed bottom-6 left-6 right-6 bg-red-600 text-white py-4 rounded-2xl font-black shadow-2xl shadow-red-900/40 flex items-center justify-center gap-3 z-40 animate-bounce"
        >
          <ShoppingCart size={20} />
          عرض السلة ({currentCart.length}) — {total.toFixed(2)} ₪
        </button>
      )}

      {/* Modals */}
      <CustomerSearchModal
        show={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        customerSearchQuery={customerSearchQuery}
        setCustomerSearchQuery={setCustomerSearchQuery}
        filteredCustomers={filteredCustomers}
        handleSelectCustomer={handleSelectCustomer}
        onAddNew={(name) => {
          setQuickCustomerName(name);
          setShowQuickAddCustomer(true);
        }}
      />

      <QuickAddCustomerModal
        show={showQuickAddCustomer}
        onClose={() => setShowQuickAddCustomer(false)}
        quickCustomerName={quickCustomerName}
        setQuickCustomerName={setQuickCustomerName}
        quickCustomerPhone={quickCustomerPhone}
        setQuickCustomerPhone={setQuickCustomerPhone}
        handleQuickAddCustomer={handleQuickAddCustomer}
      />

      <CloseInvoiceModal
        show={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        customerName={customerName}
        setCustomerName={setCustomerName}
        setPosError={setPosError}
        onConfirm={() => {
          // بدل الإغلاق مباشرة بطريقة دفع افتراضية "كاش" — نفتح مودال طريقة الدفع
          // ليختار الكاشير كاش/بطاقة/محفظة.
          setShowCustomerModal(false);
          setPendingCloseKind("dine_in");
          setShowPaymentMethodModal(true);
        }}
      />

      <PaymentMethodModal
        show={showPaymentMethodModal}
        total={total}
        confirming={isSubmittingOrder}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        accountType={accountType}
        setAccountType={setAccountType}
        accountNumber={accountNumber}
        setAccountNumber={setAccountNumber}
        setShowSearchModal={setShowSearchModal}
        onClose={() => {
          setShowPaymentMethodModal(false);
          setPendingCloseKind(null);
        }}
        onConfirm={async (lines, currency, exchangeRate) => {
          setShowPaymentMethodModal(false);
          const kind = pendingCloseKind; // "dine_in" | "takeaway"
          const meta = { name: customerName, phone: customerPhone, note: invoiceNote, currency, exchangeRate };
          // دفع مُجزّأ: قد يكون سطر واحد (كاش/بطاقة/محفظة/حساب) أو عدة أسطر مقسّمة.
          // نرفق بيانات الكيان فقط لو الدفعة كلها سطر واحد على حساب زبون/مورد/موظف.
          const isEntityPayment =
            lines.length === 1 &&
            (lines[0].method === PaymentMethod.CUSTOMER ||
              lines[0].method === PaymentMethod.SUPPLIER ||
              lines[0].method === PaymentMethod.EMPLOYEE);
          const entityType = isEntityPayment ? getEntityType() : undefined;
          const entityId =
            isEntityPayment && accountNumber ? parseInt(accountNumber, 10) : undefined;
          const payments = lines.map((line) => ({
            method: line.method,
            amount: roundMoney(line.amount),
            reference: line.reference,
            entity_type: isEntityPayment ? entityType : undefined,
            entity_id: isEntityPayment ? entityId : undefined,
            subledger_type: isEntityPayment ? entityType : undefined,
            subledger_id: isEntityPayment ? entityId : undefined,
          }));

          // "تنفيذ" = دفع + إغلاق. بمحلي: إغلاق + فاتورة جديدة فقط (بدون طباعة —
          // الطباعة لها زر مستقل). بفوري: إغلاق + فاتورة جديدة + طباعة على الكاشير.
          const result = await submitOrder(
            OrderStatus.DELIVERED,
            payments[0]?.method ?? PaymentMethod.CASH,
            calculatedDiscount,
            meta,
            payments,
            true,
            {},
          );
          const printedOrderId = result?.id ?? editingApiOrderId;

          if (result) {
            // نمسح الفاتورة القديمة ونبدأ فاتورة جديدة فوراً — قبل الطباعة، لأنها
            // بطيئة (Browsershot/طابور) وكانت تعلّق الشاشة على الطلب القديم لثوانٍ.
            clearActiveCart();
          }

          if (printedOrderId) {
            // الطباعة بالخلفية (بدون await) حتى لا تؤخّر الفاتورة الجديدة.
            // فوري: فاتورة منفصلة لكل قسم على طابعة الكاشير.
            // محلي: فاتورة الكاشير المدمجة (كل الأصناف سوا) على طابعة الكاشير.
            void handlePrintInvoice(
              printedOrderId,
              kind === "takeaway" ? "fawri" : "merged",
            );
          }
          setPendingCloseKind(null);
        }}
      />
    </div>
  );
};
