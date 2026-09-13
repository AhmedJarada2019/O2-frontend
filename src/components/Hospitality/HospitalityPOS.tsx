// src/components/Hospitality/HospitalityPOS.tsx
//
// نسخة منفصلة من صفحة POS مخصصة لقسم الضيافة
// تستخدم HospitalityPOSHeader بدل POSHeader
// - لا توجد شريط إضافة سريعة (Quick Add)
// - لا توجد تبويبات (طاولات/منيو/معلومات/عميل)
// - دائماً نوع الطلب DINE_IN
// - دائماً يبدأ بعرض المنيو

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useApp } from "../../../store";
import {
  OrderType,
  OrderStatus,
  PaymentMethod,
  CustomerType,
  TableStatus,
} from "../../../types";
import { AlertCircle, ShoppingCart, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { HospitalityPOSHeader } from "./HospitalityPOSHeader";
import { MenuGrid } from "../POS/MenuGrid";
import { CustomerTab, type PaymentEntry } from "../POS/CustomerTab";
import { CartPanel } from "../POS/CartPanel";
import {
  CustomerSearchModal,
  QuickAddCustomerModal,
  CloseInvoiceModal,
} from "../POS/POSModals";

import { useMenu } from "../../hooks/useMenu";
import { useCart, type CartItem } from "../../hooks/useCart";
import type { MenuItem } from "../../hooks/useMenu";
import {
  orderService,
  normalizePaymentMethod as normalizeApiPaymentMethod,
  type OrderFromApi,
  type PaymentMethod as ApiPaymentMethod,
} from "../../services/orderService";
import type { Order, Table } from "../../../types";
import { getDeviceUUIDSecurely } from "../../utils/hospitalitySecurity";
import HospitalityActivationPage from "./HospitalityActivationPage";
import { ROLES } from "../../auth/permissions";
import api from "../../api/axios";
import { toast } from "../shared/Toast";


const MONEY_EPSILON = 0.01;

const roundMoney = (value: number) =>
  Math.round((Number(value) || 0) * 100) / 100;

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
  editingApiOrderId: number | null;
};

const cloneCartItems = (items: CartItem[]) =>
  items.map((item) => ({ ...item }));

const clonePayments = (items: PaymentEntry[]) =>
  items.map((payment) => ({ ...payment }));

const normalizeTableNumber = (value: string | number | null | undefined) =>
  String(value ?? "").trim();

export const HospitalityPOS: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [deviceUuid, setDeviceUuid] = useState<string | null>(null);
  const [posInfo, setPosInfo] = useState<any>(null);
  const [checkingSecurity, setCheckingSecurity] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  useEffect(() => {
    const checkDeviceSecurity = async () => {
      try {
        const uuid = await getDeviceUUIDSecurely();
        const storedInfo = localStorage.getItem("hospitality_register_info");

        if (uuid && storedInfo) {
          setDeviceUuid(uuid);
          setPosInfo(JSON.parse(storedInfo));
        }
      } catch (error) {
        console.error("خطأ في فحص أمان نقطة البيع:", error);
      } finally {
        setCheckingSecurity(false);
      }
    };
    checkDeviceSecurity();
  }, []);

  const handleActivationSuccess = (activatedInfo: any) => {
    getDeviceUUIDSecurely().then((uuid) => {
      setDeviceUuid(uuid);
      setPosInfo(activatedInfo);
    });
  };

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

  const branchId: number | undefined =
    posInfo?.branch_id ?? (currentUser as any)?.branch_id ?? undefined;

  const {
    categories,
    allItems,
    loading: menuLoading,
    error: menuError,
    findByCode,
  } = useMenu(branchId);

  const {
    cart: currentCart,
    subtotal,
    addToCart: addToCartRaw,
    updateCartItem,
    removeFromCart,
    loadCart,
    clearCart,
    submitOrder: submitOrderApi,
    submitting,
    submitError,
  } = useCart();

  // الضيافة دائماً تبدأ بعرض المنيو
  const [activePOSMode, setActivePOSMode] = useState<"menu">("menu");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);

  // فشل تحميل المنيو كان بيمر بصمت — الشاشة بتضل فاضية بدون أي توضيح للكاشير
  // إنه في مشكلة اتصال/صلاحيات بدل ما الفرع فعلاً ما عنده أصناف.
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

  // ── Customer State ────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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
    OrderType.DINE_IN,
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
        }
      } catch (err) {
        console.error("فشل تحميل الطلب للتعديل:", err);
        if (!cancelled) setPosError("فشل تحميل الطلب للتعديل");
      }
    };

    loadOrderForEdit();

    return () => { cancelled = true; };
  }, [searchParams]);

  // ── معالجة addOrder من الرابط (طلب جديد بسلة فاضية) ──
  const [isNewOrderMode, setIsNewOrderMode] = useState(false);
  useEffect(() => {
    const addOrder = searchParams.get("addOrder");
    if (!addOrder) return;

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete("addOrder");
    const newUrl = `${window.location.pathname}${newSearchParams.toString() ? "?" + newSearchParams.toString() : ""}`;
    window.history.replaceState({}, "", newUrl);

    // نضمن أن السلة فاضية ونفتحها
    clearLoadedApiOrder();
    setIsCartOpen(true);
    setIsNewOrderMode(true);
    // بعد 1 ثانية نعيد تعيين العلم
    setTimeout(() => setIsNewOrderMode(false), 1000);
  }, [searchParams]);

  // ── جلب بيانات الفاتورة عند تعديل طلب موجود ──
  useEffect(() => {
    if (!editingApiOrderId) {
      setInvoiceData(null);
      return;
    }

    let cancelled = false;

    const fetchInvoiceForOrder = async () => {
      try {
        const invoice = await orderService.getInvoiceForOrder(editingApiOrderId);
        if (!cancelled && invoice) {
          setInvoiceData({
            pos: {
              register_id: (invoice as any).pos_register_id,
              code: (invoice as any).pos_code,
              name: (invoice as any).pos_name,
              branch: (invoice as any).branch ? { id: (invoice as any).branch.id, name: (invoice as any).branch.name } : null,
            },
            details: {
              number: invoice.number,
              date: invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              time: invoice.created_at ? new Date(invoice.created_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : '',
              currency: (invoice as any).currency || 'ILS',
              account_number: (invoice as any).account_number || null,
            },
            opening: {
              user: (invoice as any).opened_by_user ? { id: (invoice as any).opened_by_user.id, name: (invoice as any).opened_by_user.name } : null,
              pos_name: (invoice as any).pos_name,
              date: (invoice as any).opened_at?.split('T')[0] || null,
              time: (invoice as any).opened_at ? new Date((invoice as any).opened_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : null,
            },
            closing: (invoice as any).closed_at ? {
              user: (invoice as any).closed_by_user ? { id: (invoice as any).closed_by_user.id, name: (invoice as any).closed_by_user.name } : null,
              pos_name: (invoice as any).pos_name,
              date: (invoice as any).closed_at?.split('T')[0] || null,
              time: (invoice as any).closed_at ? new Date((invoice as any).closed_at).toLocaleTimeString('ar-PS', { hour: '2-digit', minute: '2-digit' }) : null,
            } : null,
          });
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
      setManualTable((selectedTable as any).table_number || (selectedTable as any).number?.toString() || "");
      // فتح السلة تلقائياً عند اختيار طاولة من قسم الطاولات
      setIsCartOpen(true);
    } else {
      setManualTable("");
    }
  }, [selectedTable]);

  // الضيافة دائماً DINE_IN
  useEffect(() => {
    setCartOrderType(OrderType.DINE_IN);
  }, []);

  useEffect(() => {
    if (posError || submitError) {
      const msg = submitError || posError;
      setPosError(msg);
      const t = setTimeout(() => setPosError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [posError, submitError]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery) return [];
    return (customers ?? []).filter(
      (c: any) =>
        c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
        c.phone.includes(customerSearchQuery),
    );
  }, [customers, customerSearchQuery]);

  const calculatedDiscount =
    discountType === "PERCENT"
      ? (subtotal * discountValue) / 100
      : discountValue;
  const total = roundMoney(Math.max(0, subtotal - calculatedDiscount));
  const totalPaid = roundMoney(
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const remainingAmount = Math.max(0, roundMoney(total - totalPaid));

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getItemCurrentPrice = (item: any): number => item.price ?? 0;

  const setOrderType = (type: OrderType) => setCartOrderType(type);

  const addToCart = (
    item: MenuItem | any,
    opts?: { quantity?: number; price?: number },
  ) => {
    addToCartRaw(item, opts);
  };

  const getEntityType = (): string | undefined => {
    if (accountType === 'EMPLOYEE') return 'employee';
    if (accountType === 'SUPPLIER') return 'supplier';
    if (accountType === 'ACCOUNT') return 'customer';
    return undefined;
  };

  const addPayment = (method: PaymentMethod) => {
    if (remainingAmount <= MONEY_EPSILON) return;
    setPaymentMethod(method);
    const entityMethod = getEntityType();
    const entityId = accountNumber ? parseInt(accountNumber, 10) : undefined;
    const paymentPayload = {
      method,
      amount: roundMoney(remainingAmount),
      entity_type: entityMethod,
      entity_id: entityId,
      subledger_type: entityMethod,
      subledger_id: entityId,
    };
    setPayments((prev) => [
      ...prev,
      paymentPayload,
    ]);
  };

  const removePayment = (index: number) => {
    setPayments((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setPaymentMethod(next[0]?.method ?? PaymentMethod.CASH);
      return next;
    });
  };

  const updatePaymentAmount = (index: number, val: string) => {
    const amount = parseFloat(val) || 0;
    setPayments((prev) =>
      prev.map((payment, i) =>
        i === index ? { ...payment, amount } : payment,
      ),
    );
  };

  const updatePaymentReference = (index: number, val: string) => {
    setPayments((prev) =>
      prev.map((payment, i) =>
        i === index ? { ...payment, reference: val } : payment,
      ),
    );
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
    setIsCartOpen(draft.items.length > 0);
  };

  const applyApiOrderToCart = (order: OrderFromApi, table?: Table) => {
    loadCart(apiOrderToCartItems(order));
    setEditingApiOrderId(order.id);
    setCartOrderType(toPosOrderType(order.order_type));
    setManualTable(table?.table_number || order.table_number || table?.number.toString() || "");
    setInvoiceNote(order.note ?? "");
    setDiscountValue(Number(order.discount_value || 0));
    setDiscountType(order.discount_type === "percent" ? "PERCENT" : "AMOUNT");
    setCustomerName(order.customer_name ?? "");
    setCustomerPhone(order.customer_phone ?? "");

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
  };

  const clearActiveCart = () => {
    if (selectedTable) {
      forgetTableDraft(selectedTable.id);
    }
    clearLoadedApiOrder();
    setSelectedTable(null);
    setManualTable("");
    setIsCartOpen(false);
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
    const order = await orderService.getActiveByTableNumber(table.table_number || table.number, {
      branch_id: branchId || 0,
    });

    if (order) {
      applyApiOrderToCart(order, table);
      updateTableStatus(table.id, TableStatus.OCCUPIED, {
        currentOrderId: String(order.id),
      });
      return order;
    }

    if (clearWhenMissing) {
      clearLoadedApiOrder();
    }

    return null;
  };

  useEffect(() => {
    if (!selectedTable) return;
    // إذا كان وضع طلب جديد، لا نحمل الأصناف القديمة
    if (isNewOrderMode) return;

    const isActiveTable =
      selectedTable.status === TableStatus.OCCUPIED ||
      selectedTable.status === TableStatus.PAYMENT_PENDING ||
      selectedTable.status === TableStatus.BILL_PRINTED;

    // إذا كانت السلة مليئة أو في وضع التعديل، لا نفعل شيئاً
    if (editingApiOrderId || currentCart.length > 0) return;

    if (isActiveTable) {
      // تحميل جميع الطلبات النشطة للطاولة وعرض أصنافها
      (async () => {
        try {
          const allOrders = await orderService.getAllActiveByTableNumber(
            selectedTable.table_number || selectedTable.number,
            { branch_id: branchId || 0 },
          );

          if (allOrders.length > 0) {
            const allItems: CartItem[] = [];
            for (const order of allOrders) {
              for (const item of order.items) {
                const isSent = item.is_printed_direct ?? false;
                allItems.push({
                  uniqueId: `api-${order.id}-${item.id}-${Math.random().toString(36).substr(2, 9)}`,
                  itemId: String(item.item_id),
                  id: item.item_id,
                  name: item.item_name_ar || item.item_name,
                  name_ar: item.item_name_ar || item.item_name,
                  price: Number(item.unit_price || 0),
                  quantity: Number(item.quantity || 0),
                  notes: item.notes ?? undefined,
                  department_id: item.department_id,
                  is_printed_direct: isSent,
                  is_takeaway: item.is_takeaway ?? false,
                });
              }
            }
            if (allItems.length > 0) {
              loadCart(allItems);
              setEditingApiOrderId(null);
            }
          }
          setIsCartOpen(true);
        } catch (err) {
          console.error("Failed to load table orders:", err);
          setIsCartOpen(true);
        }
      })();
    } else {
      setIsCartOpen(true);
    }
  }, [
    selectedTable?.id,
    selectedTable?.number,
    selectedTable?.status,
    isNewOrderMode,
  ]);

  const handleTableInput = (val: string) => {
    setManualTable(val);

    const normalized = normalizeTableNumber(val);
    const table = tables?.find(
      (t: any) =>
        t.table_number?.toUpperCase() === normalized.toUpperCase() ||
        t.number?.toString() === normalized,
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
        // جلب جميع الطلبات النشطة للطاولة وتجميع أصنافها
        const allOrders = await orderService.getAllActiveByTableNumber(
          table.table_number || table.number,
          { branch_id: branchId || 0 },
        );

        if (allOrders.length > 0) {
          // تجميع أصناف جميع الطلبات في سلة واحدة
          const allItems: CartItem[] = [];
          let hasUnsentItems = false;
          for (const order of allOrders) {
            // إضافة الأصناف التي لم ترسل for this order
            for (const item of order.items) {
              const isSent = order.tickets?.some((t: any) =>
                t.items?.some((ti: any) => ti.order_item_id === item.id)
              );
              if (!isSent) {
                hasUnsentItems = true;
              }
              // نضيف جميع الأصناف مع ملاحظة إذا أرسلت أو لا
              allItems.push({
                uniqueId: `api-${order.id}-${item.id}-${Math.random().toString(36).substr(2, 9)}`,
                itemId: String(item.item_id),
                id: item.item_id,
                name: item.item_name_ar || item.item_name,
                name_ar: item.item_name_ar || item.item_name,
                price: Number(item.unit_price || 0),
                quantity: Number(item.quantity || 0),
                notes: item.notes ?? undefined,
                department_id: item.department_id,
                is_printed_direct: isSent,
                is_takeaway: item.is_takeaway ?? false,
              });
            }
          }

          if (allItems.length > 0) {
            loadCart(allItems);
            setEditingApiOrderId(null);
            setIsCartOpen(true);
            return;
          }
        }

        // لا توجد طلبات نشطة → فتح السلة فاضية
        setCartOrderType(OrderType.DINE_IN);
        setManualTable(table.table_number || table.number.toString());
        setIsCartOpen(true);
        return;
      } catch (err) {
        console.error("Failed to load table orders:", err);
        setPosError("فشل تحميل طلبات الطاولة");
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

  const handlePrintInvoice = async () => {
    if (currentCart.length === 0) {
      setPosError("السلة فارغة");
      return;
    }
    if (cartOrderType === OrderType.DINE_IN && !manualTable) {
      setPosError("يرجى إدخال رقم الطاولة أولاً");
      return;
    }

    const activeTable =
      cartOrderType === OrderType.DINE_IN ? resolveActiveDineInTable() : null;
    if (cartOrderType === OrderType.DINE_IN && !activeTable) return;

    const orderType =
      cartOrderType === OrderType.DINE_IN ? "dine_in" : "takeaway";
    const result = await submitOrderApi(
      {
        branch_id: branchId || 0,
        cashier_id: currentUser?.id ? Number(currentUser.id) : undefined,
        order_type: orderType,
        table_number: activeTable?.table_number || activeTable?.number.toString(),
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        note: invoiceNote || undefined,
        discount_value: discountValue || undefined,
        discount_type: discountType === "PERCENT" ? "percent" : "amount",
      },
      true,
      [],
      false,
      editingApiOrderId,
    );

    if (result) {
      if (activeTable) {
        await updateTableStatus(activeTable.id, TableStatus.OCCUPIED, {
          currentOrderId: String(result.id),
        });
        setSelectedTable(activeTable);
        forgetTableDraft(activeTable.id);
      }
      setEditingApiOrderId(null);

      // Call print-invoice API
      setIsPrinting(true);
      try {
        await api.post(`/orders/${result.id}/print-invoice`);
        toast.success("تم إرسال الفاتورة إلى الطابعة بنجاح 🖨️", `الطاولة #${manualTable}`);
      } catch (printErr: any) {
        const msg = printErr.response?.data?.message || "فشل إرسال الفاتورة للطابعة";
        toast.error("خطأ في الطباعة", msg);
      } finally {
        setIsPrinting(false);
      }
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
    const newCustomer = {
      id: 'c_' + Math.random().toString(36).substr(2, 9),
      name: quickCustomerName,
      phone: quickCustomerPhone,
      type: CustomerType.REGULAR,
      allowCredit: false,
      notes: "",
      points: 0,
      totalSpent: 0,
      ordersCount: 0,
      balance: 0,
      isBlocked: false,
      addresses: [],
      rating: 5,
      lastVisit: new Date(),
      createdAt: new Date(),
    };
    addCustomer?.(newCustomer);
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
    updateCartItem(uniqueId, { quantity: Math.max(0, parseFloat(val) || 0) } as any);
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
        quantity: price > 0 ? Math.max(0, newTotal / price) : 0,
      } as any);
  };

  // ── submitOrder ───────────────────────────────────────────────────────────
  const submitOrder = async (
    status: OrderStatus,
    method: PaymentMethod,
    _discount: number,
    meta: { name: string; phone: string; note: string },
    paymentsArg?: any[],
  ) => {
    if (isSubmittingOrder) return;
    if (currentCart.length === 0) {
      setPosError("السلة فارغة");
      return;
    }

    setIsSubmittingOrder(true);
    try {

    const orderType =
      cartOrderType === OrderType.DINE_IN ? "dine_in" : "takeaway";

    // تأكيد الطلب فقط إذا كان الزر "إرسال الطلب" (CONFIRMED)
    const shouldConfirm = status === OrderStatus.CONFIRMED;
    const isClosingOrder = status === OrderStatus.DELIVERED;
    const isSaving = status === OrderStatus.PENDING;
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
        if (isEntityMethod && (payment as any).entity_type) {
          result.entity_type = (payment as any).entity_type;
          result.entity_id = (payment as any).entity_id;
          result.subledger_type = (payment as any).subledger_type;
          result.subledger_id = (payment as any).subledger_id;
        }
        return result;
      })
      .filter((p): p is NonNullable<typeof p> => p !== null) as any[];

    const activeTable =
      cartOrderType === OrderType.DINE_IN ? resolveActiveDineInTable() : null;
    if (cartOrderType === OrderType.DINE_IN && !activeTable) return;

    // ── حالة خاصة: إرسال الطلبات المعلقة للأقسام ──
    // إذا ضغط المستخدم "إرسال الطلب" وكانت السلة تحتوي على أصناف من طلبات موجودة
    if (shouldConfirm && !editingApiOrderId && activeTable) {
      try {
        // 1. فصل الأصناف: جديدة (لم تُحفظ بعد) vs موجودة في طلبات سابقة
        const unsentItems = currentCart.filter(item => !item.is_printed_direct);
        const newItems = unsentItems.filter(item => !item.uniqueId.startsWith("api-"));

        // 1ب. هل الطاولة عليها أصلاً طلب نشط؟ لو آه، الأصناف الجديدة تنضاف
        // عليه هو بالذات بدل ما ننشئ Order جديد منفصل لكل جولة — وإلا كل
        // جولة إضافة بتصير فاتورة لحالها بدل ما تنحسب مع نفس فاتورة الطاولة.
        const existingOrders = await orderService.getAllActiveByTableNumber(
          activeTable.table_number || activeTable.number,
          { branch_id: branchId || 0 },
        );
        const targetOrder =
          existingOrders.find((o) => o.status === "pending" || o.status === "pending_confirmation") ??
          existingOrders[0] ??
          null;

        // الطلب الذي أُضيفت عليه/أُنشئ للأصناف الجديدة — بنسخته الأحدث (فيها items محدّثة)
        let workingOrder = targetOrder;

        if (newItems.length > 0 && targetOrder) {
          // كل الأصناف الجديدة دفعة واحدة (طلب HTTP واحد بدل واحد لكل صنف)
          try {
            workingOrder = await orderService.addOrderItemsBatch(
              targetOrder.id,
              newItems.map((item) => ({
                item_id: item.id,
                quantity: item.quantity,
                unit_price: item.price,
                notes: item.notes,
                is_takeaway: item.is_takeaway,
              })),
            );
          } catch (err) {
            console.warn(`فشل إضافة الأصناف على الطلب #${targetOrder.id}:`, err);
            setPosError("فشل إضافة الأصناف للطلب");
            return;
          }
        } else if (newItems.length > 0) {
          // ما في طلب نشط أصلاً على الطاولة — نطلب جديد (أول جولة)
          const savedOrder = await submitOrderApi(
            {
              branch_id: branchId || 0,
              cashier_id: currentUser?.id ? Number(currentUser.id) : undefined,
              order_type: orderType,
              table_number: activeTable?.table_number || activeTable?.number.toString(),
              customer_name: meta.name || undefined,
              customer_phone: meta.phone || undefined,
              note: meta.note || undefined,
              discount_value: discountValue || undefined,
              discount_type: discountType === "PERCENT" ? "percent" : "amount",
            },
            false, // لا تؤكد بعد
            [],
            false,
            null, // طلب جديد
          );
          if (!savedOrder) {
            setPosError("فشل حفظ الأصناف الجديدة");
            return;
          }
          workingOrder = savedOrder;
        }

        // 3. الطلبات المعلقة = الموجودة سابقاً + الطلب الجديد/المُحدّث (بلا إعادة
        // جلب من الشبكة — كان نداء إضافي بطيء). نستخدم نسخة workingOrder الأحدث.
        const ordersById = new Map<number, (typeof existingOrders)[number]>();
        for (const o of existingOrders) ordersById.set(o.id, o);
        if (workingOrder) ordersById.set(workingOrder.id, workingOrder);

        const pendingOrders = [...ordersById.values()].filter(
          (o) =>
            o.status === 'pending' ||
            o.status === 'pending_confirmation' ||
            (o.items ?? []).some((item) => !item.is_printed_direct),
        );

        // 3. طباعة مباشرة للأقسام قبل التأكيد (بالتوازي، مش وحدة وراء وحدة)
        if (!posInfo?.id) {
          // لا نوقف تأكيد الطلبات، لكن يجب أن يعرف الموظف أن الطباعة لن تحدث
          console.warn("directPrint skipped: no posInfo.id in this session");
          setPosError("تعذّرت الطباعة الفورية: جهاز الكاشير غير محدد لهذه الجلسة");
        } else {
          try {
            const { printerService } = await import("../../services/printerService");
            const results = await Promise.allSettled(
              pendingOrders.map((order) => printerService.directPrint(order.id, posInfo.id)),
            );
            const failedCount = results.reduce((count, r, i) => {
              if (r.status === "rejected") {
                console.warn(`directPrint فشل للطلب #${pendingOrders[i].id}:`, r.reason);
                return count + 1;
              }
              if (!r.value?.success) {
                console.warn(`directPrint فشل للطلب #${pendingOrders[i].id}:`, r.value?.message);
                return count + 1;
              }
              return count;
            }, 0);
            if (failedCount > 0) {
              setPosError(
                `فشلت طباعة ${failedCount} من ${pendingOrders.length} طلب — تحقق من الطابعات`,
              );
            }
          } catch {
            setPosError("تعذّر الاتصال بخدمة الطباعة");
          }
        }

        // 4. تأكيد الطلبات المعلقة (إنشاء التذاكر في الـ DB) — بالتوازي
        await Promise.allSettled(
          pendingOrders.map((order) =>
            orderService.confirm(order.id).catch((err) => {
              console.warn(`فشل تأكيد الطلب #${order.id}:`, err);
            }),
          ),
        );

        // 4. إعادة تحميل السلة مع الحالة المحدثة
        const refreshedOrders = await orderService.getAllActiveByTableNumber(
          activeTable.table_number || activeTable.number,
          { branch_id: branchId || 0 },
        );

        if (refreshedOrders.length > 0) {
          const allItems: CartItem[] = [];
          for (const order of refreshedOrders) {
            for (const item of order.items) {
              const isSent = item.is_printed_direct ?? false;
              allItems.push({
                uniqueId: `api-${order.id}-${item.id}-${Math.random().toString(36).substr(2, 9)}`,
                itemId: String(item.item_id),
                id: item.item_id,
                name: item.item_name_ar || item.item_name,
                name_ar: item.item_name_ar || item.item_name,
                price: Number(item.unit_price || 0),
                quantity: Number(item.quantity || 0),
                notes: item.notes ?? undefined,
                department_id: item.department_id,
                is_printed_direct: isSent,
                is_takeaway: item.is_takeaway ?? false,
              });
            }
          }
          loadCart(allItems);
        }

        setPosError(null);
        return;
      } catch (err) {
        console.error("فشل إرسال الطلبات:", err);
        setPosError("فشل إرسال الطلبات للأقسام");
        return;
      }
    }

    // ── الحالة العادية: حفظ طلب جديد ──
    if (isSaving && !editingApiOrderId && activeTable) {
      // فصل الأصناف: جديدة (لم تُحفظ) vs موجودة في طلبات سابقة
      const unsentItems = currentCart.filter(item => !item.is_printed_direct);
      const newItems = unsentItems.filter(item => !item.uniqueId.startsWith("api-"));

      // إذا الأصناف المعلقة كلها موجودة بطلبات سابقة، فقط نحفظ ونخرج
      if (newItems.length === 0 && unsentItems.length > 0) {
        // الأصناف موجودة بطلبات سابقة، لا نحتاج إنشاء طلب جديد
        // فقط نحفظ الملاحظات والخصم على الطلب الحالي
        if (activeTable) {
          await updateTableStatus(activeTable.id, TableStatus.OCCUPIED, {
            currentOrderId: editingApiOrderId ? String(editingApiOrderId) : undefined,
          });
        }
        setInvoiceNote("");
        setDiscountValue(0);
        setManualTable("");
        setCustomerName("");
        setCustomerPhone("");
        setPayments([]);
        setPaymentMethod(PaymentMethod.CASH);
        setEditingApiOrderId(null);
        setShowCustomerModal(false);
        setIsCartOpen(false);
        return;
      }

      if (newItems.length === 0) {
        setPosError("جميع الأصناف مرسلة بالفعل");
        return;
      }

      // إنشاء طلب جديد فقط بالأصناف الجديدة غير المحفوظة
      const result = await submitOrderApi(
        {
          branch_id: branchId || 0,
          cashier_id: currentUser?.id ? Number(currentUser.id) : undefined,
          order_type: orderType,
          table_number: activeTable?.table_number || activeTable?.number.toString(),
          customer_name: meta.name || undefined,
          customer_phone: meta.phone || undefined,
          note: meta.note || undefined,
          discount_value: discountValue || undefined,
          discount_type: discountType === "PERCENT" ? "percent" : "amount",
          payment_method: isClosingOrder
            ? normalizeApiPaymentMethod(selectedPaymentMethod)
            : undefined,
        },
        false, // لا تؤكد
        [],
        false,
        null, // طلب جديد
      );

      if (result) {
        if (activeTable) {
          await updateTableStatus(activeTable.id, TableStatus.OCCUPIED, {
            currentOrderId: String(result.id),
          });
          forgetTableDraft(activeTable.id);
          setSelectedTable(activeTable);
        }
        setInvoiceNote("");
        setDiscountValue(0);
        setManualTable("");
        setCustomerName("");
        setCustomerPhone("");
        setPayments([]);
        setPaymentMethod(PaymentMethod.CASH);
        setEditingApiOrderId(null);
        setShowCustomerModal(false);
        setIsCartOpen(false);
      }
      return;
    }

    // ── الحالة العادية مع editingApiOrderId ──
    const result = await submitOrderApi(
      {
        branch_id: branchId || 0,
        cashier_id: currentUser?.id ? Number(currentUser.id) : undefined,
        order_type: orderType,
        table_number: activeTable?.table_number || activeTable?.number.toString(),
        customer_name: meta.name || undefined,
        customer_phone: meta.phone || undefined,
        note: meta.note || undefined,
        discount_value: discountValue || undefined,
        discount_type: discountType === "PERCENT" ? "percent" : "amount",
        payment_method: isClosingOrder
          ? normalizeApiPaymentMethod(selectedPaymentMethod)
          : undefined,
      },
      shouldConfirm,
      [],
      false,
      editingApiOrderId,
    );

    if (result) {
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
          await updateTableStatus(activeTable.id, TableStatus.OCCUPIED, {
            currentOrderId: String(result.id),
          });
          forgetTableDraft(activeTable.id);
          setSelectedTable(activeTable);
        }
      }
      setInvoiceNote("");
      setDiscountValue(0);
      setManualTable("");
      setCustomerName("");
      setCustomerPhone("");
      setPayments([]);
      setPaymentMethod(PaymentMethod.CASH);
      setEditingApiOrderId(null);
      setShowCustomerModal(false);
      setIsCartOpen(false);
    }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // ── commonCartProps ───────────────────────────────────────────────────────
  const commonCartProps = {
    isCartOpen,
    setIsCartOpen,
    isHospitality: true,
    cartOrderType,
    setOrderType,
    currentCart,
    manualTable,
    handleTableInput,
    onViewTables: () => navigate("/Hospitality/tables"),
    subtotal,
    calculatedDiscount,
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
    onCloseCart: clearActiveCart,
    allItems,
    addToCart,
  };

  // 1. فحص أمان الجهاز
  if (checkingSecurity) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white" dir="rtl">
        <Loader2 size={40} className="text-red-500 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-400">جاري التحقق من الهوية الرقمية لجهاز نقطة البيع...</p>
      </div>
    );
  }

  // 2. تفعيل الجهاز — الضيافة يمكنها تجاوز التفعيل إذا كان لديها صلاحية إدارة
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.BRANCH_MANAGER];
  const hasPosInterfaceAccess = userRole && adminRoles.includes(userRole as any);

  if (!deviceUuid || !posInfo) {
    if (hasPosInterfaceAccess) {
      setPosInfo({ code: 'ADMIN', name: 'واجهة الإدارة', branch_id: null });
    } else {
      return <HospitalityActivationPage onActivationSuccess={handleActivationSuccess} />;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full bg-slate-950 overflow-y-auto lg:overflow-hidden p-2 sm:p-4 lg:p-0 custom-scrollbar relative">
      {/* Error Toast */}
      <AnimatePresence>
        {posError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl flex items-center gap-3 border border-red-500/50"
          >
            <AlertCircle size={20} />
            {posError}
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Left Panel: Menu Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full ${isCartOpen ? "hidden lg:flex" : "flex"}`}
      >
        {/* دائماً HospitalityPOSHeader */}
        <HospitalityPOSHeader
          editingOrderId={currentEditingOrderId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          clearCart={clearActiveCart}
          onNewInvoice={clearActiveCart}
        />

        <div className="flex-1 flex flex-col min-h-0">
          {/* الضيافة دائماً تعرض المنيو */}
          <MenuGrid
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            addToCart={addToCart}
            loading={menuLoading}
          />
        </div>
      </div>

      {/* Right Panel: Cart */}
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
        onConfirm={() =>
          submitOrder(
            OrderStatus.DELIVERED,
            paymentMethod,
            calculatedDiscount,
            { name: customerName, phone: customerPhone, note: invoiceNote },
          )
        }
      />
    </div>
  );
};
