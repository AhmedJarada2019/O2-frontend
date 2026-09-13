// src/hooks/useCart.ts
//
// يدير حالة السلة:
// - addToCart: يزيد الكمية إذا الصنف موجود بدل صف جديد
// - submitOrder: يرسل الطلب للـ API ويتبع التدفق الكامل من إنشاء الطلب إلى القيد المحاسبي

import { useState, useCallback } from "react";
import api from "../api/axios";
import { toast } from "../components/shared/Toast";
import {
  orderService,
  type OrderFromApi,
  type PaymentMethod,
} from "../services/orderService";
import type { MenuItem } from "./useMenu";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  uniqueId: string;
  itemId: string;
  id: number;
  name: string;
  name_ar: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  discount_percent?: number;
  discount_id?: number;
  final_price?: number;
  quantity: number;
  notes?: string;
  department_id: number;
  is_printed_direct?: boolean;
  is_takeaway?: boolean;
  is_complimentary?: boolean;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference?: string;
  entity_type?: "customer" | "employee" | "supplier";
  entity_id?: number;
  subledger_type?: "customer" | "employee" | "supplier";
  subledger_id?: number;
}

export interface SubmitOrderPayload {
  branch_id: number;
  cashier_id?: number;
  order_type: "dine_in" | "takeaway" | "delivery";
  /** طلب «فوري» (بيع كاشير سريع) — يُخزّن مستقلاً عن order_type */
  is_fawri?: boolean;
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: number;
  customer_mobile?: string;
  customer_address?: string;
  customer_notes?: string;
  scheduled_at?: string;
  employee_id?: number;
  supplier_id?: number;
  note?: string;
  discount_value?: number;
  discount_type?: "amount" | "percent";
  payment_method?: PaymentMethod;
  source?: "call_center" | string;
  call_center_agent_id?: number;
  call_notes?: string;
  customer_address_id?: number;
  delivery_address_snapshot?: Record<string, unknown>;
  delivery_zone_id?: number;
  delivery_fee?: number;
  delivery_notes?: string;
  currency?: string;
  exchange_rate?: number;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const MONEY_EPSILON = 0.01;

const roundMoney = (value: number) =>
  Math.round((Number(value) || 0) * 100) / 100;

const normalizePaymentEntries = (entries: PaymentEntry[]): PaymentEntry[] =>
  entries
    .map((payment) => ({
      ...payment,
      amount: roundMoney(payment.amount),
      reference: payment.reference?.trim() || undefined,
    }))
    .filter((payment) => payment.amount > 0);

const normalizeTableNumber = (value: string | number | null | undefined) =>
  String(value ?? "").trim();

type ApiErrorLike = {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
  message?: string;
};

const getApiError = (error: unknown) => error as ApiErrorLike;

const getApiErrorMessage = (error: unknown, fallback = "") => {
  const apiError = getApiError(error);
  return String(
    apiError.response?.data?.message ?? apiError.message ?? fallback,
  );
};

const isCloseUpdateStateError = (error: unknown) => {
  const apiError = getApiError(error);
  const status = apiError.response?.status;
  const message = getApiErrorMessage(error).toLowerCase();

  return (
    status === 409 ||
    message.includes("already") ||
    message.includes("confirmed") ||
    message.includes("confirmation") ||
    message.includes("تأكيد") ||
    message.includes("مؤكد")
  );
};

export const useCart = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── addToCart ─────────────────────────────────────────────────────────────
  // اذا الصنف موجود بالسلة → تزيد الكمية بدل صف جديد
  const addToCart = useCallback(
    (item: MenuItem, opts?: { quantity?: number; price?: number }) => {
      const qty = opts?.quantity ?? 1;
      const price = opts?.price ?? item.price;

      setCart((prev) => {
        // لا ندمج مع صنف مطبوع — نضيف سطر جديد لكي يكون قابل للطباعة
        const existingIdx = prev.findIndex((c) => c.id === item.id && !c.is_printed_direct);
        if (existingIdx >= 0) {
          // الصنف موجود وغير مطبوع — زيد الكمية
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantity: updated[existingIdx].quantity + qty,
          };
          return updated;
        }
        // صنف جديد — أضف في البداية (أول الفاتورة)
        const uniqueId = String(item.id) + '-' + Math.random().toString(36).substr(2, 9);
        return [
          {
            uniqueId,
            itemId: uniqueId,
            id: item.id,
            name: item.name_ar || item.name,
            name_ar: item.name_ar || item.name,
            price,
            quantity: qty,
            department_id: item.department_id,
            notes: undefined,
          },
          ...prev,
        ];
      });
    },
    [],
  );

  // ── updateCartItem ────────────────────────────────────────────────────────
  const updateCartItem = useCallback(
    (uniqueId: string, changes: Partial<CartItem>) => {
      setCart((prev) =>
        prev.map((c) => (c.uniqueId === uniqueId ? { ...c, ...changes } : c)),
      );
    },
    [],
  );

  // ── removeFromCart ────────────────────────────────────────────────────────
  const removeFromCart = useCallback((uniqueId: string) => {
    setCart((prev) => prev.filter((c) => c.uniqueId !== uniqueId));
  }, []);

  const loadCart = useCallback((items: CartItem[]) => {
    setCart(items);
  }, []);

  // ── clearCart ─────────────────────────────────────────────────────────────
  const clearCart = useCallback(() => setCart([]), []);

  // ── submitOrder ───────────────────────────────────────────────────────────
  // يرسل الطلب للـ API — يتبع التدفق الكامل من إنشاء الطلب إلى القيد المحاسبي
  // Phase 1: إنشاء الطلب (pending)
  // Phase 2: إرسال للمطبخ (confirm → production tickets)
  // Phase 3: الأقسام تحضّر (preparing → ready)
  // Phase 4: التسليم والدفع (serve → create invoice → pay)
  // ترحيل المبيعات يتم لاحقا من شاشة الطلبات المغلقة
  const submitOrder = useCallback(
    async (
      payload: SubmitOrderPayload,
      shouldConfirm = false,
      paymentEntries: PaymentEntry[] = [],
      createInvoice = false,
      existingOrderId?: number | null,
      clearAfterSubmit = true,
      directPrintFirst = false,
      cashierDeviceId?: number,
      skipSync = false,
    ) => {
      if (cart.length === 0) return null;

      setSubmitting(true);
      setSubmitError(null);

      try {
        const requestedTableNumber = normalizeTableNumber(payload.table_number);
        if (payload.order_type === "dine_in" && !requestedTableNumber) {
          throw new Error("رقم الطاولة مطلوب لحفظ طلب محلي");
        }

        if (existingOrderId && requestedTableNumber) {
          const existingOrder = await orderService.getOne(existingOrderId);
          const existingTableNumber = normalizeTableNumber(
            existingOrder.table_number,
          );

          if (
            existingTableNumber &&
            existingTableNumber !== requestedTableNumber
          ) {
            throw new Error("لا يمكن تعديل طلب طاولة مختلفة من السلة الحالية");
          }
        }
        // ═══════════════════════════════════════════════════
        // PHASE 1: إنشاء الطلب
        // ═══════════════════════════════════════════════════
        const orderPayload = {
          ...payload,
          ...((directPrintFirst || skipSync) ? { skip_sync: true } : {}),
          items: cart
            .filter((c) => !c.is_printed_direct)
            .map((c) => ({
              item_id: c.id,
              quantity: c.quantity,
              unit_price: c.price,
              notes: c.notes ?? undefined,
              is_takeaway: c.is_takeaway ?? false,
              is_complimentary: c.is_complimentary ?? false,
            })),
        };

        let order: OrderFromApi;
        if (existingOrderId) {
          if (createInvoice) {
            order = await orderService.getOne(existingOrderId);
          } else {
            try {
              order = await orderService.update(existingOrderId, orderPayload);
            } catch (error) {
              if (!isCloseUpdateStateError(error)) {
                throw error;
              }
              order = await orderService.getOne(existingOrderId);
            }
          }
        } else {
          order = (await api.post("/orders", orderPayload)).data
            .data as OrderFromApi;
        }

        const savedTableNumber = normalizeTableNumber(order.table_number);
        if (
          payload.order_type === "dine_in" &&
          savedTableNumber !== requestedTableNumber
        ) {
          throw new Error("استجابة الطلب لا تطابق الطاولة النشطة");
        }

        setLastOrderId(order.id);

        // ═══════════════════════════════════════════════════
        // PHASE 1.5: طباعة فورية قبل التأكيد (فوري)
        // ═══════════════════════════════════════════════════
        if (directPrintFirst && order.id) {
          if (!cashierDeviceId) {
            // لا نوقف حفظ الطلب، لكن يجب أن يعرف الكاشير أن الطباعة لن تحدث
            console.warn("[useCart] directPrint skipped: no cashierDeviceId in this session");
            toast.error("تعذّرت الطباعة الفورية: جهاز الكاشير غير محدد لهذه الجلسة");
          } else {
            try {
              const { printerService } = await import("../services/printerService");
              const itemsWithTw = (order.items || []).map((item: any) => ({
                order_item_id: item.id,
                is_takeaway: cart.find((c) => c.id === item.item_id)?.is_takeaway ?? false,
              }));
              const printResult = await printerService.directPrint(
                order.id,
                cashierDeviceId,
                itemsWithTw.length > 0 ? itemsWithTw : undefined,
              );
              if (!printResult?.success) {
                toast.error(printResult?.message || "فشلت الطباعة الفورية على الطابعة");
              }
              // إعادة جلب الطلب بعد الطباعة لتحديث is_printed_direct
              order = await orderService.getOne(order.id);
            } catch (dpErr: any) {
              console.error("[useCart] directPrint failed, continuing:", dpErr);
              // نكمل حفظ الطلب حتى لو فشلت الطباعة، لكن نبلّغ الكاشير بالفشل بدل إخفائه
              const msg =
                dpErr?.response?.data?.message ||
                (dpErr?.code === "ECONNABORTED"
                  ? "انتهت مهلة الاتصال بالطابعة"
                  : "تعذّر الاتصال بخدمة الطباعة، تحقق من الشبكة");
              toast.error(`فشلت الطباعة الفورية: ${msg}`);
            }
          }
        }

        // ═══════════════════════════════════════════════════
        // PHASE 2: إرسال للمطبخ (اختياري)
        // ═══════════════════════════════════════════════════
        // نأكد الطلب إذا كان pending سواء أردنا confirm أو createInvoice
        // لأن الباكند يتطلب tickets موجودة قبل إنشاء الفاتورة
        if (shouldConfirm && !createInvoice && order.status === "pending") {
          try {
            order = await orderService.confirm(order.id);
          } catch (error) {
            if (createInvoice) {
              // عند الإغلاق، نتجاهل أخطاء التأكيد ونحاول جلب الطلب
              // الباكند يقوم بتأكيد الطلب تلقائياً عند إنشاء الفاتورة
              try {
                order = await orderService.getOne(order.id);
              } catch {
                // تجاهل
              }
            } else if (!isCloseUpdateStateError(error)) {
              throw error;
            } else {
              order = await orderService.getOne(order.id);
            }
          }
        }

        // ═══════════════════════════════════════════════════
        // PHASE 3: الأقسام تحضّر (handled b  y backend/KDS)
        // ═══════════════════════════════════════════════════
        // Kitchen updates production tickets: preparing → ready
        // When all items ready → order status = ready

        // ═══════════════════════════════════════════════════
        // PHASE 4: التسليم والدفع
        // ═══════════════════════════════════════════════════
        if (createInvoice && order.id) {
          try {
            order = await orderService.syncPricing(order.id, {
              customer_id: payload.customer_id,
              employee_id: payload.employee_id,
              supplier_id: payload.supplier_id,
              discount_value: payload.discount_value,
              discount_type: payload.discount_type,
              customer_name: payload.customer_name,
              customer_phone: payload.customer_phone,
              note: payload.note,
            });
          } catch (error) {
            // كانت هاي بتبتلع الخطأ بصمت — الفاتورة كانت تتقفل وتتحصّل بالمجموع
            // القديم (بدون الخصم/الملاحظة اللي عدّلها الكاشير قبل الإغلاق مباشرة)
            // لأن إنشاء الفاتورة بعدها بيعيد حساب السعر من discount_value المخزّن
            // بقاعدة البيانات، مش من القيمة الظاهرة عالشاشة. لازم نوقف هون ونبلّغ
            // الكاشير بدل ما نكمل تحصيل بمبلغ غلط.
            throw new Error(
              getApiErrorMessage(error, "فشلت مزامنة الخصم/الملاحظة قبل إغلاق الفاتورة — حاول مرة ثانية"),
            );
          }
        }

        const orderTotal = roundMoney(Number(order.total ?? 0));
        const normalizedPayments = normalizePaymentEntries(paymentEntries);
        const paymentsToRecord: PaymentEntry[] =
          normalizedPayments.length > 0
            ? normalizedPayments
            : createInvoice && orderTotal > 0 && payload.payment_method
              ? [{ method: payload.payment_method, amount: orderTotal }]
              : [];

        if (createInvoice || paymentsToRecord.length > 0) {
          const paidTotal = roundMoney(
            paymentsToRecord.reduce((sum, payment) => sum + payment.amount, 0),
          );
          const paymentDiff = roundMoney(orderTotal - paidTotal);

          if (orderTotal > 0 && paymentsToRecord.length === 0) {
            throw new Error("يرجى تحديد طريقة الدفع قبل إغلاق الفاتورة");
          }

          if (
            !createInvoice &&
            orderTotal > 0 &&
            Math.abs(paymentDiff) > MONEY_EPSILON
          ) {
            throw new Error(
              paymentDiff > 0
                ? `المبلغ المدفوع ناقص ${paymentDiff.toFixed(2)} ₪`
                : `المبلغ المدفوع زائد ${Math.abs(paymentDiff).toFixed(2)} ₪`,
            );
          }

          order = await orderService.closeOrderWithPayments(order.id, {
            customer_name: payload.customer_name,
            customer_phone: payload.customer_phone,
            customer_id: payload.customer_id,
            employee_id: payload.employee_id,
            supplier_id: payload.supplier_id,
            note: payload.note,
            payments: paymentsToRecord.map((payment) => ({
              method: payment.method,
              payment_method: payment.method,
              amount: payment.amount,
              reference_number: payment.reference,
              // المحافظة على entity data إذا كانت موجودة
              entity_type: (payment as any).entity_type,
              entity_id: (payment as any).entity_id,
              subledger_type: (payment as any).subledger_type,
              subledger_id: (payment as any).subledger_id,
            })),
          });
        }

        // Financial closure must succeed before production tickets are created.
        // This path is used by call-center checkout and prevents unpaid orders
        // from reaching the kitchen.
        if (createInvoice && shouldConfirm) {
          const latest = await orderService.getOne(order.id);
          if (latest.status !== "paid") {
            throw new Error("لا يمكن إرسال الطلب للمطبخ قبل اكتمال الدفع");
          }
          order = await orderService.confirm(order.id);
        }

        let finalOrder = order;
        try {
          const { data: refreshedOrder } = await api.get(`/orders/${order.id}`);
          finalOrder = refreshedOrder.data ?? order;
        } catch {
          finalOrder = order;
        }

        if (clearAfterSubmit) {
          clearCart();
        }
        return finalOrder;
      } catch (e) {
        const msg = getApiErrorMessage(e, "فشل إرسال الطلب");
        setSubmitError(msg);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [cart, clearCart],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  return {
    cart,
    subtotal,
    addToCart,
    updateCartItem,
    removeFromCart,
    loadCart,
    clearCart,
    submitOrder,
    submitting,
    submitError,
    lastOrderId,
  };
};
