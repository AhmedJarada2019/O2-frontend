import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Tag,
  FileText,
  Printer,
  Search,
  Loader2,
} from "lucide-react";
import { OrderType, OrderStatus, PaymentMethod } from "../../../types";

interface CartItem {
  uniqueId: string;
  itemId: string;
  id: number;
  name: string;
  price: number;
  quantity: number;
  original_price?: number;
  final_price?: number;
  discount_amount?: number;
  discount_percent?: number;
  discount_id?: number;
  is_takeaway?: boolean;
  is_complimentary?: boolean;
  is_printed_direct?: boolean;
  notes?: string;
  created_at?: string;
}

interface SearchableItem {
  id: number;
  name: string;
  name_ar: string;
  code: string;
  price: number;
  department_id: number;
}

interface CartPanelProps {
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isHospitality: boolean;
  cartOrderType: OrderType;
  setOrderType: (type: OrderType) => void;
  currentCart: CartItem[];
  manualTable: string;
  handleTableInput: (val: string) => void;
  onViewTables: () => void;
  subtotal: number;
  calculatedDiscount: number;
  engineDiscountTotal?: number;
  manualDiscount?: number;
  appliedDiscounts?: Array<{
    id: number;
    name: string;
    code: string;
    amount: number;
  }>;
  discountLoading?: boolean;
  discountType: "AMOUNT" | "PERCENT";
  discountValue: number;
  total: number;
  invoiceNote: string;
  setInvoiceNote: (note: string) => void;
  editingDiscount: string;
  setEditingDiscount: (val: string) => void;
  setDiscountValue: (val: number) => void;
  setDiscountType: (type: "AMOUNT" | "PERCENT") => void;
  paymentMethod: PaymentMethod;
  editingOrderId: string | null;
  editingQty: { [id: string]: string };
  editingNames: { [id: string]: string };
  handleNameChange: (uniqueId: string, newName: string) => void;
  handleQuantityChange: (uniqueId: string, val: string, price: number) => void;
  handleQuantityBlur: (uniqueId: string, val: string) => void;
  handleTotalChange: (uniqueId: string, val: string, price: number) => void;
  setEditingNames: React.Dispatch<
    React.SetStateAction<{ [id: string]: string }>
  >;
  removeFromCart: (id: string) => void;
  updateCartItem: (
    uniqueId: string,
    changes: Partial<{ quantity: number; name: string; price: number; is_takeaway?: boolean }>,
  ) => void;
  getItemCurrentPrice: (item: any) => number;
  setPosError: (err: string) => void;
  submitOrder: (
    status: OrderStatus,
    method: PaymentMethod,
    discount: number,
    meta: { name: string; phone: string; note: string },
    payments?: { method: PaymentMethod; amount: number; reference?: string }[],
    clearAfterSubmit?: boolean,
  ) => Promise<any>;
  customerName: string;
  customerPhone: string;
  setShowCustomerModal: (show: boolean) => void;
  handlePrintInvoice?: (
    orderId?: string | number | null,
    mode?: "all" | "merged" | "departments" | "fawri",
  ) => void;
  isPrinting?: boolean;
  isSubmitting?: boolean;
  onCloseCart?: () => void;
  onDeferOrder?: () => Promise<void>;
  isDeferred?: boolean;
  allItems?: SearchableItem[];
  addToCart?: (item: any, opts?: { quantity?: number; price?: number }) => void;
  posInfo?: { id?: number; code?: string; name?: string; branch_id?: number } | null;
  clearCart?: () => void;
  onRequestClose?: (kind: "takeaway" | "dine_in") => void;
  /** true إذا في بوباب/مودال مفتوح فوق الشاشة (دفع، بحث، إلخ) — يعطّل اختصارات
   *  الكيبورد وتنقّل الأسهم بالسلة حتى ما تتحرك الفاتورة اللي وراء البوباب. */
  isModalOpen?: boolean;
}

// أعمدة جدول السلة — Grid ثابت مشترك بين الهيدر وصفوف الأصناف (بدل <table>)
// عشان عمود "الصنف" ياخد المساحة الحقيقية المتبقية بدل ما ينقسم بالتساوي
// مع باقي الأعمدة الضيقة (السعر/الكمية/الإجمالي/TW/O)، ومشكلة عدم تزامن
// التمرير الأفقي بين جدولين منفصلين (هيدر وجسم) ما عادت موجودة أصلاً.
const CART_GRID_COLS = "grid grid-cols-[18px_minmax(0,1fr)_38px_74px_58px_46px_28px]";
// فوري: بدون عمود العلامات (TW/O) نهائياً — بلا فراغ زائد بين الإجمالي وزر الحذف
const CART_GRID_COLS_TAKEAWAY = "grid grid-cols-[18px_minmax(0,1fr)_38px_74px_58px_28px]";

export const CartPanel: React.FC<CartPanelProps> = ({
  isCartOpen,
  setIsCartOpen,
  isHospitality,
  cartOrderType,
  setOrderType,
  currentCart,
  manualTable,
  handleTableInput,
  onViewTables,
  subtotal,
  calculatedDiscount,
  engineDiscountTotal = 0,
  manualDiscount = 0,
  appliedDiscounts = [],
  discountLoading = false,
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
  editingOrderId,
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
  isPrinting = false,
  isSubmitting = false,
  allItems = [],
  onCloseCart,
  onDeferOrder,
  isDeferred = false,
  addToCart,
  posInfo,
  clearCart,
  onRequestClose,
  isModalOpen = false,
}) => {
  const isDineIn = cartOrderType === OrderType.DINE_IN;

  // ── Inline Search State ──────────────────────────────────────────────────
  const [inlineSearch, setInlineSearch] = useState("");
  const [inlineQty, setInlineQty] = useState("1");
  const [inlineTotal, setInlineTotal] = useState("");
  // buffer لنص خانة «الإجمالي» لكل سطر أثناء الكتابة. بدونه الخانة controlled
  // بقيمة price×quantity المعاد حسابها كل ضغطة زر، فلما الكاشير يكتب رقم من
  // كذا خانة لصنف وزن (السعر ما بيقسم بالظبط) الخانة بتقفز لقيمة مقرّبة وبيضيع
  // الرقم. نعرض الـ buffer أثناء focus، وننضّفه عند blur فترجع للقيمة المحسوبة.
  const [editingTotal, setEditingTotal] = useState<{ [id: string]: string }>({});
  const [selectedSearchItem, setSelectedSearchItem] =
    useState<SearchableItem | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const roundMoney = (value: number) =>
    Math.round((Number(value) || 0) * 100) / 100;

  // ── اختصارات لوحة المفاتيح للكاشير (حسب الورقة المرجعية) ──
  // وضع "فوري" (Takeaway):  -  طباعة   /  فاتورة جديدة   *  تحديد كمية   F2  حفظ   F7  إغلاق
  // وضع "محلي" (Dine-in):   F12 طباعة   F2 حفظ           F7 إغلاق        F3 فاتورة جديدة
  const lastFocusedItemRef = useRef<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // في حال في مودال/بوباب مفتوح (دفع، بحث..) — نعطّل اختصارات السلة
      // بالكامل حتى ما تتحرك الفاتورة اللي وراء البوباب بالغلط.
      if (isModalOpen) return;

      // Don't trigger when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const isTakeaway = !isHospitality && cartOrderType === OrderType.TAKEAWAY;
      const isDineIn = !isHospitality && cartOrderType === OrderType.DINE_IN;

      const doPrint = () => {
        if (currentCart.length === 0 || isPrinting) return;
        // زر/اختصار "طباعة" بمحلي = نسخ الأقسام فقط (المدمجة بتطلع من "تنفيذ")
        handlePrintInvoice?.(editingOrderId, "departments");
      };

      const doNewInvoice = () => {
        clearCart?.();
      };

      const doSaveTakeaway = () => {
        if (currentCart.length === 0) return;
        submitOrder(OrderStatus.PENDING, paymentMethod, calculatedDiscount, {
          name: customerName,
          phone: customerPhone,
          note: invoiceNote,
        });
      };

      const doSaveDineIn = () => {
        if (currentCart.length === 0) return;
        if (!manualTable) {
          setPosError("يرجى إدخال رقم الطاولة أولاً");
          return;
        }
        submitOrder(
          OrderStatus.PENDING,
          paymentMethod,
          calculatedDiscount,
          { name: customerName, phone: customerPhone, note: invoiceNote },
          undefined,
          true,
          { skipSync: true },
        );
      };

      const doCloseTakeaway = async () => {
        if (currentCart.length === 0) return;
        // الإغلاق يمرّ عبر PaymentMethodModal حتى يختار الكاشير طريقة الدفع فعلياً
        // (كاش/بطاقة/محفظة) بدل الافتراضي الثابت "كاش".
        if (onRequestClose) {
          onRequestClose("takeaway");
          return;
        }
        // fallback فقط لو ما في onRequestClose (نادر) — "فوري" = دفع + إغلاق ثم طباعة.
        const result = await submitOrder(
          OrderStatus.DELIVERED,
          paymentMethod,
          calculatedDiscount,
          { name: customerName, phone: customerPhone, note: invoiceNote },
          undefined,
          true,
          {},
        );
        if (result?.id) {
          await handlePrintInvoice?.(result.id, "fawri");
        }
      };

      const doCloseDineIn = async () => {
        if (currentCart.length === 0) return;
        if (!manualTable) {
          setPosError("يرجى إدخال رقم الطاولة أولاً");
          return;
        }
        // الإغلاق يمرّ عبر PaymentMethodModal (يجمع اسم الزبون + طريقة الدفع).
        if (onRequestClose) {
          onRequestClose("dine_in");
          return;
        }
        // fallback فقط لو ما في onRequestClose (نادر).
        if (
          !customerName ||
          (customerName === "صندوق مبيعات" && paymentMethod !== PaymentMethod.CASH)
        ) {
          setShowCustomerModal(true);
          return;
        }
        const result = await submitOrder(
          OrderStatus.DELIVERED,
          paymentMethod,
          calculatedDiscount,
          { name: customerName, phone: customerPhone, note: invoiceNote },
        );
        if (result?.id) {
          await handlePrintInvoice?.(result.id, "merged");
        }
      };

      const focusQuantity = () => {
        const targetItem =
          lastFocusedItemRef.current ||
          currentCart[currentCart.length - 1]?.uniqueId;
        if (!targetItem) return;
        const el = document.getElementById(
          `qty-input-${targetItem}`,
        ) as HTMLInputElement | null;
        el?.focus();
        el?.select();
      };

      if (isTakeaway) {
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          doPrint();
          return;
        }
        if (e.key === "/") {
          e.preventDefault();
          doNewInvoice();
          return;
        }
        if (e.key === "*") {
          e.preventDefault();
          focusQuantity();
          return;
        }
        if (e.key === "F2") {
          e.preventDefault();
          doSaveTakeaway();
          return;
        }
        if (e.key === "F7") {
          e.preventDefault();
          doCloseTakeaway();
          return;
        }
      } else if (isDineIn) {
        if (e.key === "F12") {
          e.preventDefault();
          doPrint();
          return;
        }
        if (e.key === "F2") {
          e.preventDefault();
          doSaveDineIn();
          return;
        }
        if (e.key === "F7") {
          e.preventDefault();
          doCloseDineIn();
          return;
        }
        if (e.key === "F3") {
          e.preventDefault();
          doNewInvoice();
          return;
        }
      }

      // زيادة/إنقاص كمية آخر صنف تم التركيز عليه (سلوك عام لا يرتبط بورقة الاختصارات)
      if (currentCart.length === 0) return;
      const targetItem =
        lastFocusedItemRef.current ||
        currentCart[currentCart.length - 1]?.uniqueId;
      if (!targetItem) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        const item = currentCart.find((c) => c.uniqueId === targetItem);
        if (item) updateCartItem(targetItem, { quantity: item.quantity + 1 });
      } else if (!isTakeaway && (e.key === "-" || e.key === "_")) {
        // زر الطرح مخصص للطباعة بوضع "فوري"، وبباقي الأوضاع يبقى لإنقاص الكمية
        e.preventDefault();
        const item = currentCart.find((c) => c.uniqueId === targetItem);
        if (item && item.quantity > 1) {
          updateCartItem(targetItem, { quantity: item.quantity - 1 });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentCart,
    updateCartItem,
    clearCart,
    handlePrintInvoice,
    editingOrderId,
    isPrinting,
    submitOrder,
    isHospitality,
    cartOrderType,
    manualTable,
    paymentMethod,
    calculatedDiscount,
    customerName,
    customerPhone,
    invoiceNote,
    posInfo,
    setPosError,
    setShowCustomerModal,
    isModalOpen,
  ]);

  // ── تشغيل زر "تنفيذ" الأساسي حسب وضع الفاتورة (نفس منطق الزر الأحمر/الأخضر) ──
  const runPrimaryExecute = () => {
    if (currentCart.length === 0 || isSubmitting) return;
    if (isHospitality) {
      if (cartOrderType === OrderType.DINE_IN && !manualTable) {
        setPosError("يرجى إدخال رقم الطاولة أولاً");
        return;
      }
      submitOrder(OrderStatus.CONFIRMED, PaymentMethod.CASH, calculatedDiscount, {
        name: customerName,
        phone: customerPhone,
        note: invoiceNote,
      });
      return;
    }
    if (cartOrderType === OrderType.DINE_IN && !manualTable) {
      setPosError("يرجى إدخال رقم الطاولة أولاً");
      return;
    }
    onRequestClose?.(
      cartOrderType === OrderType.TAKEAWAY ? "takeaway" : "dine_in",
    );
  };

  // ── التحكم بكامل الفاتورة بالأسهم (صفوف + ملاحظة + خصم + أزرار) ────────────
  //   "محطات" الفاتورة بالترتيب: صفوف الأصناف ← الملاحظة ← قيمة الخصم ←
  //   زر نوع الخصم (₪/%) ← أزرار الإجراءات (حفظ / تنفيذ / طباعة). كل محطة
  //   غير الصفوف معلّمة بـ data-inv-stop.
  //
  //   • على صف صنف: سهم فوق/تحت = زيادة/إنقاص الكمية لنفس الصنف (التركيز ما
  //     بيتحرك) ، سهم يمين/يسار = تنقّل بين المحطات (RTL: يسار = التالي) ،
  //     Enter = تنفيذ.
  //   • على الملاحظة/الخصم (حقول نص): سهم فوق/تحت = تنقّل بين المحطات ، سهم
  //     يمين/يسار = تبقى لتحريك مؤشر النص.
  //   • على زر (نوع الخصم / إجراء): كل الأسهم = تنقّل ، Enter = ضغط الزر.
  //
  //   يعمل بطور الالتقاط (capture) ويوقف الانتشار حتى ما يتعارض مع تنقّل
  //   شبكة الأصناف (MenuGrid) اللي بيسمع على نفس النافذة.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      const key = e.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(key)) {
        return;
      }

      const ae = document.activeElement as HTMLElement | null;
      if (!ae || !rootRef.current?.contains(ae)) return;

      const rowEl = ae.closest?.("[data-cart-row]") as HTMLElement | null;
      const isExtraStop = ae.matches?.("[data-inv-stop]") ?? false;

      // حقل داخلي جوّا صف (اسم/كمية/إجمالي) — اترك المفاتيح طبيعية تماماً
      if (rowEl && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      // مش واقفين على أي محطة معروفة — لا تتدخّل (خلّي MenuGrid يشتغل)
      if (!rowEl && !isExtraStop) return;

      const isTextStop = ae.tagName === "INPUT" || ae.tagName === "TEXTAREA";
      // على محطة نصية: يمين/يسار تبقى لتحريك مؤشر النص
      if (isTextStop && (key === "ArrowLeft" || key === "ArrowRight")) return;

      // Enter
      if (key === "Enter") {
        if (rowEl) {
          e.preventDefault();
          e.stopImmediatePropagation();
          runPrimaryExecute();
        } else if (ae instanceof HTMLButtonElement) {
          e.preventDefault();
          e.stopImmediatePropagation();
          ae.click();
        }
        return;
      }

      // على صف: فوق/تحت = تعديل الكمية لنفس الصنف
      if (rowEl && (key === "ArrowUp" || key === "ArrowDown")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const idx = Number(rowEl.getAttribute("data-cart-row"));
        const item = currentCart[idx];
        if (item && !item.is_printed_direct) {
          const nextQty = item.quantity + (key === "ArrowUp" ? 1 : -1);
          if (nextQty >= 1) {
            updateCartItem(item.uniqueId, { quantity: nextQty });
          }
        }
        return;
      }

      // غير هيك: تنقّل بين محطات الفاتورة
      e.preventDefault();
      e.stopImmediatePropagation();
      const stops = [
        ...Array.from(
          rootRef.current.querySelectorAll<HTMLElement>("[data-cart-row]"),
        ),
        ...Array.from(
          rootRef.current.querySelectorAll<HTMLElement>("[data-inv-stop]"),
        ),
      ].filter(
        (el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled,
      );
      if (stops.length === 0) return;

      const cur = rowEl ?? ae;
      const curIdx = stops.indexOf(cur);
      const forward = key === "ArrowLeft" || key === "ArrowDown"; // RTL
      const nextIdx =
        curIdx === -1
          ? 0
          : Math.min(Math.max(curIdx + (forward ? 1 : -1), 0), stops.length - 1);
      const target = stops[nextIdx];
      if (target) {
        target.focus();
        target.scrollIntoView?.({ block: "nearest" });
        if (target.tagName === "INPUT") {
          (target as HTMLInputElement).select?.();
        }
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    currentCart,
    updateCartItem,
    isHospitality,
    cartOrderType,
    manualTable,
    isSubmitting,
    calculatedDiscount,
    customerName,
    customerPhone,
    invoiceNote,
    submitOrder,
    onRequestClose,
    setPosError,
    isModalOpen,
  ]);

  // ── تحديد افتراضي على الفاتورة أول ما يفتح الكاشير ───────────────────────────
  //   المطلوب: أول ما تفتح شاشة الكاشير يكون التحديد على الفاتورة نفسها حتى
  //   يشتغل تنقّل الأسهم (فوق/تحت = كمية الصنف ، يمين/يسار = تنقّل بين محطات
  //   الملاحظة/الخصم/الأزرار) و Enter (يفتح بوباب الدفع) فوراً بدون ماوس.
  //
  //   • فيه أصناف بالفاتورة → نحط التحديد على أول صف.
  //   • الفاتورة فارغة → نركّز حقل "ابحث عن صنف" حتى يبلّش يكتب/يسكان فوراً.
  //
  //   نسحب التركيز مرة وحدة لأول صف (didFocusRowRef) — بعدها ما بنتدخّل نهائياً
  //   حتى ما نزعج الكاشير وهو بيضيف أصناف متتالية. وما بنسحب التركيز إذا الكاشير
  //   أصلاً واقف على حقل/زر تاني (غير حقل البحث) أو في بوباب مفتوح.
  const inlineSearchInputRef = useRef<HTMLInputElement>(null);
  const didInitialFocusRef = useRef(false);
  const didFocusRowRef = useRef(false);
  useEffect(() => {
    if (isModalOpen || didFocusRowRef.current) return;

    const ae = document.activeElement as HTMLElement | null;
    const focusIdle = !ae || ae === document.body || ae === rootRef.current;

    // فيه أصناف → التحديد على أول صف بالفاتورة (لمرة وحدة)
    const firstRow = rootRef.current?.querySelector<HTMLElement>("[data-cart-row]");
    if (firstRow && (focusIdle || ae === inlineSearchInputRef.current)) {
      firstRow.focus();
      firstRow.scrollIntoView?.({ block: "nearest" });
      didFocusRowRef.current = true;
      didInitialFocusRef.current = true;
      return;
    }

    // فاتورة فارغة → نركّز حقل البحث عن صنف (مرة وحدة لكل فتح)
    if (!didInitialFocusRef.current && focusIdle && inlineSearchInputRef.current) {
      inlineSearchInputRef.current.focus();
      didInitialFocusRef.current = true;
    }
  }, [allItems.length, currentCart.length, isModalOpen]);

  const filteredSearchItems = useMemo(() => {
    if (!inlineSearch || inlineSearch.length < 1) return [];
    const q = inlineSearch.toLowerCase();
    return allItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.name_ar.includes(inlineSearch) ||
          String(item.id) === inlineSearch ||
          item.code === inlineSearch,
      )
      .slice(0, 8);
  }, [inlineSearch, allItems]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectSearchItem = (item: SearchableItem) => {
    setSelectedSearchItem(item);
    setInlineSearch(item.name_ar || item.name);
    setInlineQty("1");
    setInlineTotal(roundMoney(item.price).toFixed(2));
    setShowDropdown(false);
  };

  const handleInlineAdd = () => {
    if (!selectedSearchItem || !addToCart) return;
    // الكمية decimal(10,2) على الباك اند — نقرّبها لخانتين حتى إجمالي الواجهة
    // يطابق حساب الباك اند وما يطلع فرق قروش وقت الإغلاق.
    const qty = roundMoney(parseFloat(inlineQty) || 1);
    addToCart(selectedSearchItem, {
      quantity: qty,
      price: selectedSearchItem.price,
    });
    setInlineSearch("");
    setInlineQty("1");
    setInlineTotal("");
    setSelectedSearchItem(null);
  };

  const handleInlineSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineSearch(value);
    setSelectedSearchItem(null);
    setShowDropdown(true);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedSearchItem) {
        handleInlineAdd();
      } else if (filteredSearchItems.length > 0) {
        handleSelectSearchItem(filteredSearchItems[0]);
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={`w-full lg:w-[450px] xl:w-[500px] bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 flex flex-col shadow-2xl overflow-hidden h-auto lg:h-full shrink-0 ${isCartOpen ? "fixed inset-0 z-50 lg:relative lg:z-0" : "hidden lg:flex"}`}
    >
      {/* 1. Header & Table Info */}
      <div className="p-3 sm:p-4 border-b border-white/5 space-y-3 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShoppingCart className="text-red-500" size={16} />
            <h3 className="text-xs sm:text-sm font-black text-white">
              تفاصيل الفاتورة
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            {/* زر تصغير السلة (minimize) - يظهر فقط في الشاشات الصغيرة */}
            <button
              onClick={() => setIsCartOpen(false)}
              className="lg:hidden p-1.5 text-slate-500 hover:text-white transition-colors"
              title="تصغير"
            >
              <span className="text-lg font-black leading-none">−</span>
            </button>
            {/* زر إغلاق السلة (close) - يغلق الطاولة ويلغي الطلب */}
            <button
              onClick={() => onCloseCart?.()}
              className="lg:hidden p-1.5 text-slate-500 hover:text-red-400 transition-colors"
              title="إغلاق الطاولة"
            >
              <span className="text-lg font-black leading-none">×</span>
            </button>
            {!isHospitality && (
              <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto scrollbar-hide">
                {[OrderType.DINE_IN, OrderType.TAKEAWAY].map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`px-1.5 sm:px-2 py-1 text-[7px] sm:text-[8px] font-black rounded-md transition-all whitespace-nowrap ${cartOrderType === type ? "bg-red-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {type === OrderType.DINE_IN ? "محلي" : "فوري"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {cartOrderType === OrderType.DINE_IN && (
          <div className="grid grid-cols-2 gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 mr-2 uppercase tracking-widest">
                الطاولة
              </label>
              <input
                type="text"
                value={manualTable}
                onChange={(e) => handleTableInput(e.target.value)}
                placeholder="رقم..."
                className="w-full px-2 py-1.5 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-black text-[10px] text-center text-white"
              />
            </div>
            <div className="flex items-end">
              {isHospitality ? (
                <button
                  onClick={onViewTables}
                  className="w-full py-1.5 bg-slate-800 text-slate-400 border border-white/5 rounded-lg font-black text-[8px] hover:bg-slate-700 hover:text-slate-100 transition-all"
                >
                  الخريطة
                </button>
              ) : editingOrderId ? (
                <button
                  onClick={async () => {
                    if (isDeferred) return;
                    if (onDeferOrder) {
                      await onDeferOrder();
                    } else {
                      try {
                        const { default: api } = await import("../../api/axios");
                        // استخدام الـ endpoint الجديد لتأجيل كل الطلبات كفاتورة وحدة
                        if (manualTable) {
                          // البحث عن الطاولة ب رقمها
                          const { data: res } = await api.get('/tables', { params: {} });
                          const zones = res.data ?? res;
                          let tableId: string | null = null;
                          if (Array.isArray(zones)) {
                            for (const zone of zones) {
                              if (Array.isArray(zone.tables)) {
                                const found = zone.tables.find((t: any) => t.table_number === manualTable || String(t.number) === manualTable);
                                if (found) { tableId = String(found.id); break; }
                              }
                            }
                          }
                          if (tableId) {
                            await api.post(`/tables/${tableId}/defer-all`);
                          }
                        }
                        clearCart?.();
                        setPosError(null);
                        setIsCartOpen(false);
                      } catch (err: any) {
                        setPosError(err?.response?.data?.message || "فشل تأجيل الطلب");
                      }
                    }
                  }}
                  disabled={isDeferred}
                  className={`w-full py-1.5 rounded-lg font-black text-[8px] transition-all ${
                    isDeferred
                      ? "bg-slate-800 text-slate-500 border border-slate-600/30 cursor-not-allowed"
                      : "bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30"
                  }`}
                >
                  {isDeferred ? "مؤجلة" : "تأجيل"}
                </button>
              ) : (
                <button
                  onClick={onViewTables}
                  className="w-full py-1.5 bg-slate-800 text-slate-400 border border-white/5 rounded-lg font-black text-[8px] hover:bg-slate-700 hover:text-slate-100 transition-all"
                >
                  الخريطة
                </button>
              )}
            </div>
          </div>
        )}

        {/* Total Amount */}
        <div className="bg-red-600/10 border border-red-600/20 p-2 px-3 rounded-lg flex flex-col gap-1">
          {calculatedDiscount > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                  الإجمالي الفرعي
                </span>
                <span className="text-sm font-black text-slate-300">
                  {subtotal.toFixed(2)} ₪
                </span>
              </div>
              {engineDiscountTotal > 0 && (
                <div className="flex justify-between items-center text-emerald-400">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      خصم تلقائي
                    </span>
                    {appliedDiscounts.map((d) => (
                      <span
                        key={d.id}
                        className="text-[7px] text-emerald-300/80"
                        title={`${d.name} (${d.code})`}
                      >
                        {d.name} — {d.code}
                      </span>
                    ))}
                  </div>
                  <span className="text-sm font-black">
                    -{engineDiscountTotal.toFixed(2)} ₪
                  </span>
                </div>
              )}
              {manualDiscount > 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      خصم إضافي
                    </span>
                    {discountType === "PERCENT" && (
                      <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                        %{discountValue}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black">
                    -{manualDiscount.toFixed(2)} ₪
                  </span>
                </div>
              )}
              {engineDiscountTotal <= 0 && manualDiscount <= 0 && (
                <div className="flex justify-between items-center text-red-500">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-widest">
                      الخصم
                    </span>
                    {discountType === "PERCENT" && (
                      <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-800 rounded">
                        %{discountValue}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-black">
                    -{calculatedDiscount.toFixed(2)} ₪
                  </span>
                </div>
              )}
            </>
          )}
          
          <div
            className={`pt-1 mt-1 ${calculatedDiscount > 0 ? "border-t border-red-600/20" : ""} flex justify-between items-center`}
          >
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {calculatedDiscount > 0 ? "الصافي النهائي" : "الإجمالي الكلي"}
            </span>
            <div className="text-left">
            <span className="text-xl sm:text-2xl lg:text-3xl font-black text-red-600">
                {total.toFixed(2)}
              </span>
              <span className="text-[11px] font-black text-red-600 mr-1">₪</span>
            </div>
          </div>
        </div>
      </div>


      {/* 3. Header + Search (pinned, no scroll) — Grid بدل Table عشان عمود
          الاسم ياخد مساحته الحقيقية وما تنقسم الأعمدة بالتساوي */}
      <div className="bg-slate-900 border-b border-white/5">
        <div className={isDineIn ? CART_GRID_COLS : CART_GRID_COLS_TAKEAWAY}>
          {(isDineIn
            ? ["#", "الصنف", "السعر", "الكمية", "الإجمالي", "TW/O", ""]
            : ["#", "الصنف", "السعر", "الكمية", "الإجمالي", ""]
          ).map((h, i) => (
            <div
              key={i}
              className={`px-1 py-2 sm:px-2 text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 ${i === 4 ? "text-left" : i === 0 ? "" : "text-center"}`}
            >
              {h}
            </div>
          ))}
        </div>

        {/* Inline Search/Add Row — always visible */}
        {addToCart && allItems.length > 0 && (
          <div className={`${isDineIn ? CART_GRID_COLS : CART_GRID_COLS_TAKEAWAY} bg-slate-800/30 border-b border-dashed border-white/10 items-center`}>
            <div className="px-1 py-1.5 text-center">
              <Plus size={12} className="text-emerald-500 mx-auto" />
            </div>
            <div className="px-1 py-1.5 sm:px-2 relative" ref={searchRef}>
              <div className="relative flex items-center gap-1">
                <input
                  ref={inlineSearchInputRef}
                  type="text"
                  value={inlineSearch}
                  onChange={handleInlineSearchChange}
                  onFocus={() => {
                    if (inlineSearch) setShowDropdown(true);
                  }}
                  onKeyDown={handleInlineKeyDown}
                  placeholder="ابحث عن صنف..."
                  className="w-full bg-transparent text-[10px] sm:text-xs font-bold text-white outline-none border-b border-emerald-500/30 focus:border-emerald-500 placeholder:text-slate-600"
                />
                <Search
                  size={12}
                  className="shrink-0 text-slate-500"
                />
              </div>
              {/* Dropdown appears above */}
              {showDropdown && filteredSearchItems.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-30 max-h-40 overflow-y-auto custom-scrollbar">
                  {filteredSearchItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSearchItem(item)}
                      className="w-full text-right px-3 py-2 hover:bg-white/5 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="text-[10px] font-black text-white truncate">
                        {item.name_ar || item.name}
                      </span>
                      <span className="text-[9px] font-bold text-emerald-500 shrink-0">
                        {item.price} ₪
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-1 py-1.5 text-center text-[10px] font-bold text-slate-500">
              {selectedSearchItem ? selectedSearchItem.price : ""}
            </div>
            <div className="px-1 py-1.5">
              {selectedSearchItem && (
                <input
                  type="number"
                  value={inlineQty}
                  onChange={(e) => setInlineQty(e.target.value)}
                  onKeyDown={handleInlineKeyDown}
                  className="w-full bg-transparent text-center text-[10px] sm:text-xs font-black text-white outline-none border-b border-emerald-500/30 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
            <div className="px-1 py-1.5">
              {selectedSearchItem && (
                <input
                  type="text"
                  value={inlineTotal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInlineTotal(val);
                    if (selectedSearchItem && val) {
                      const total = parseFloat(val);
                      if (!isNaN(total) && total >= 0 && selectedSearchItem.price > 0) {
                        const qty = total / selectedSearchItem.price;
                        setInlineQty(roundMoney(qty).toFixed(2));
                      }
                    }
                  }}
                  className="w-full bg-transparent text-left text-[10px] sm:text-xs font-black text-emerald-400 outline-none border-b border-emerald-500/30 focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            </div>
            {isDineIn && <div />}
            <div className="px-1 py-1.5 text-center">
              <button
                onClick={handleInlineAdd}
                disabled={!selectedSearchItem}
                className="p-1 text-emerald-500 hover:text-emerald-400 transition-colors disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Invoice Items (scrollable) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[100px] lg:min-h-0">
        {currentCart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-slate-700 gap-2">
            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center shadow-inner">
              <ShoppingCart size={24} strokeWidth={1.5} />
            </div>
            <p className="font-black text-lg">الفاتورة فارغة</p>
          </div>
        )}
        <div className="divide-y divide-white/5">
          {currentCart.map((item, index) => (
            <div
              key={item.uniqueId}
              data-cart-row={index}
              tabIndex={0}
              onFocus={() => {
                lastFocusedItemRef.current = item.uniqueId;
              }}
              className={`${isDineIn ? CART_GRID_COLS : CART_GRID_COLS_TAKEAWAY} group hover:bg-white/5 transition-colors items-center outline-none focus:bg-red-600/10 focus:ring-2 focus:ring-inset focus:ring-red-500`}
            >
              <div className="px-1 py-1.5 sm:px-2 sm:py-2 text-[8px] sm:text-[10px] font-black text-slate-600">
                {index + 1}
              </div>
              <div className="px-1 py-1.5 sm:px-2 sm:py-2 min-w-0">
                <input
                  type="text"
                  value={
                    editingNames[item.uniqueId] !== undefined
                      ? editingNames[item.uniqueId]
                      : item.name
                  }
                  disabled={!!item.is_printed_direct}
                  onFocus={() => {
                    lastFocusedItemRef.current = item.uniqueId;
                    // عند الدخول للحقل، نضع القيمة الحالية في التعديل للسماح بالإضافة فقط
                    if (editingNames[item.uniqueId] === undefined) {
                      setEditingNames((prev) => ({
                        ...prev,
                        [item.uniqueId]: item.name,
                      }));
                    }
                  }}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    const baseName = item.name;
                    // نسمح فقط إذا كانت القيمة الجديدة تبدأ بالاسم الأصلي
                    if (newVal.startsWith(baseName)) {
                      handleNameChange(item.uniqueId, newVal);
                    }
                  }}
                  onBlur={() => {
                    setEditingNames((prev) => {
                      const next = { ...prev };
                      delete next[item.uniqueId];
                      return next;
                    });
                  }}
                  className="w-full bg-transparent text-[10px] sm:text-xs font-black text-white outline-none border-b border-transparent focus:border-red-500/30"
                />
                {item.created_at && (
                  <p className="text-[7px] font-bold text-slate-600 mt-0.5">
                    {(() => {
                      const diff = Math.floor((new Date().getTime() - new Date(item.created_at).getTime()) / 60000);
                      return `${diff} دقيقة`;
                    })()}
                  </p>
                )}
              </div>
              <div className="px-1 py-1.5 sm:px-2 sm:py-2 text-center text-[11px] sm:text-xs font-bold text-slate-300">
                {getItemCurrentPrice(item)}
              </div>
              <div className="px-1 py-1.5 sm:px-2 sm:py-2">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => {
                      if (!item.is_printed_direct && item.quantity > 1) {
                        updateCartItem(item.uniqueId, {
                          quantity: item.quantity - 1,
                        });
                      }
                    }}
                    disabled={!!item.is_printed_direct}
                    className={`w-5 h-5 shrink-0 bg-slate-700 rounded text-[11px] font-bold text-white flex items-center justify-center ${item.is_printed_direct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600'}`}
                  >
                    -
                  </button>
                  <input
                    id={`qty-input-${item.uniqueId}`}
                    type="text"
                    value={
                      editingQty[item.uniqueId] !== undefined
                        ? editingQty[item.uniqueId]
                        : item.quantity
                    }
                    disabled={!!item.is_printed_direct}
                    onFocus={() => {
                      lastFocusedItemRef.current = item.uniqueId;
                    }}
                    onChange={(e) =>
                      handleQuantityChange(
                        item.uniqueId,
                        e.target.value,
                        item.price,
                      )
                    }
                    onBlur={(e) =>
                      handleQuantityBlur(item.uniqueId, e.target.value)
                    }
                    className="w-6 shrink-0 bg-transparent text-center text-[11px] sm:text-xs font-black text-white outline-none"
                  />
                  <button
                    onClick={() => {
                      if (!item.is_printed_direct) {
                        updateCartItem(item.uniqueId, {
                          quantity: item.quantity + 1,
                        });
                      }
                    }}
                    disabled={!!item.is_printed_direct}
                    className={`w-5 h-5 shrink-0 bg-slate-700 rounded text-[11px] font-bold text-white flex items-center justify-center ${item.is_printed_direct ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600'}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="px-1 py-1.5 sm:px-2 sm:py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    editingTotal[item.uniqueId] !== undefined
                      ? editingTotal[item.uniqueId]
                      : Math.round(item.price * item.quantity * 100) / 100
                  }
                  disabled={!!item.is_printed_direct}
                  onChange={(e) => {
                    setEditingTotal((prev) => ({
                      ...prev,
                      [item.uniqueId]: e.target.value,
                    }));
                    handleTotalChange(
                      item.uniqueId,
                      e.target.value,
                      item.price,
                    );
                  }}
                  onBlur={() =>
                    setEditingTotal((prev) => {
                      const next = { ...prev };
                      delete next[item.uniqueId];
                      return next;
                    })
                  }
                  className="w-full bg-transparent text-left text-[11px] sm:text-xs font-black text-red-500 outline-none"
                />
              </div>
              {isDineIn && (
                <div className="px-1 py-1.5 sm:px-2 sm:py-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="تيك أواي">
                      <input
                        type="checkbox"
                        checked={item.is_takeaway ?? false}
                        disabled={!!item.is_printed_direct}
                        onChange={(e) => {
                          updateCartItem(item.uniqueId, { is_takeaway: e.target.checked });
                        }}
                        className={`w-3 h-3 accent-emerald-500 ${item.is_printed_direct ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      />
                      <span className="text-[6px] font-black text-slate-600 leading-none">TW</span>
                    </label>
                    <label className="flex flex-col items-center gap-0.5 cursor-pointer" title="صنف مجاني / على حساب المحل">
                      <input
                        type="checkbox"
                        checked={item.is_complimentary ?? false}
                        disabled={!!item.is_printed_direct}
                        onChange={(e) => {
                          updateCartItem(item.uniqueId, { is_complimentary: e.target.checked });
                        }}
                        className={`w-3 h-3 accent-amber-500 ${item.is_printed_direct ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      />
                      <span className="text-[6px] font-black text-slate-600 leading-none">O</span>
                    </label>
                  </div>
                </div>
              )}
              <div className="px-1 py-1.5 sm:px-2 sm:py-2 text-center">
                {/* زر حذف دائماً لكل صنف (كاشير وضيافة) — حتى الأصناف المرسلة للمطبخ.
                    ألغينا علامة "صح" نهائياً. */}
                <button
                  onClick={() => removeFromCart(item.uniqueId)}
                  className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Footer Summary & Actions */}
      <div className="p-3 sm:p-4 bg-slate-950 border-t border-white/10 space-y-2">
        {/* Note & Discount Row */}
        <div className={`flex gap-2 ${isHospitality ? '' : ''}`}>
          {/* Invoice Note */}
          <div className="flex-1 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-slate-500 shrink-0">
              <FileText size={10} />
              <span className="text-[8px] font-black uppercase tracking-widest">
                الملاحظة
              </span>
            </div>
            <textarea
              data-inv-stop="note"
              value={invoiceNote}
              onChange={(e) => setInvoiceNote(e.target.value)}
              placeholder="..."
              className="w-full bg-transparent text-[9px] sm:text-[10px] font-black outline-none text-white placeholder:text-slate-700 h-12 sm:h-16 resize-none"
            />
          </div>
          {/* Discount */}
          <div className="w-28 sm:w-32 bg-slate-900 px-3 py-1.5 rounded-xl border border-white/5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-slate-500 shrink-0">
              <Tag size={10} />
              <span className="text-[8px] font-black uppercase tracking-widest">
                الخصم
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
  data-inv-stop="discount"
  type="text"
  value={editingDiscount}
  onChange={(e) => {
    setEditingDiscount(e.target.value);
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0) {
      setDiscountValue(val);
    }
  }}
  placeholder="0"
  className="flex-1 min-w-0 bg-transparent text-center text-[10px] sm:text-xs font-black text-white outline-none"
/>
              <button
                data-inv-stop="discount-type"
                onClick={() =>
                  setDiscountType(
                    discountType === "AMOUNT" ? "PERCENT" : "AMOUNT",
                  )
                }
                className="text-[9px] font-black text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded hover:text-slate-200 transition-colors"
              >
                {discountType === "AMOUNT" ? "₪" : "%"}
              </button>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        {isHospitality ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                if (cartOrderType === OrderType.DINE_IN && !manualTable) {
                  setPosError("يرجى إدخال رقم الطاولة أولاً");
                  return;
                }
                submitOrder(
                  OrderStatus.PENDING,
                  PaymentMethod.CASH,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                );
              }}
              disabled={currentCart.length === 0 || isSubmitting}
              data-inv-stop="action"
              className="py-3 sm:py-4 bg-slate-800 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-slate-700 shadow-lg disabled:opacity-30 transition-all active:scale-95"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              حفظ الطلب
            </button>
            <button
              onClick={() => {
                if (cartOrderType === OrderType.DINE_IN && !manualTable) {
                  setPosError("يرجى إدخل رقم الطاولة أولاً");
                  return;
                }
                submitOrder(
                  OrderStatus.CONFIRMED,
                  PaymentMethod.CASH,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                );
              }}
              disabled={currentCart.length === 0 || isSubmitting}
              data-inv-stop="action"
              className="py-3 sm:py-4 bg-red-600 text-white rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-red-700 shadow-xl shadow-red-900/20 disabled:opacity-30 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isSubmitting
                ? "جاري الإرسال..."
                : editingOrderId
                  ? "تحديث الطلب"
                  : "إرسال الطلب"}
            </button>
          </div>
        ) : cartOrderType === OrderType.TAKEAWAY ? (
          /* فوري: زرين — حفظ وتنفيذ وطباعة */
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => {
                submitOrder(
                  OrderStatus.PENDING,
                  paymentMethod,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                );
              }}
              disabled={currentCart.length === 0}
              data-inv-stop="action"
              className="py-2.5 sm:py-3 bg-slate-800 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95"
            >
              <Save size={14} />
              حفظ
            </button>
            <button
              data-inv-stop="action"
              onClick={async () => {
                if (onRequestClose) {
                  onRequestClose("takeaway");
                  return;
                }
                // fallback: "فوري" = دفع + إغلاق ثم الفاتورة المدمجة على طابعة
                // الكاشير فقط (بدون تيكيتات أقسام).
                const result = await submitOrder(
                  OrderStatus.DELIVERED,
                  paymentMethod,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                  undefined,
                  true,
                  {},
                );
                if (result?.id) {
                  await handlePrintInvoice?.(result.id, "fawri");
                }
              }}
              disabled={currentCart.length === 0}
              className="py-2.5 sm:py-3 bg-red-600 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 hover:bg-red-700 shadow-xl shadow-red-900/20 disabled:opacity-30 transition-all active:scale-95"
            >
              <CheckCircle size={14} />
              تنفيذ وطباعة
            </button>
          </div>
        ) : (
          /* محلي: حفظ, تنفيذ (دفع+إغلاق), طباعة (أقسام), فاتورة فقط (فاتورة الزبون) */
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <button
              onClick={() => {
                if (cartOrderType === OrderType.DINE_IN && !manualTable) {
                  setPosError("يرجى إدخال رقم الطاولة أولاً");
                  return;
                }
                submitOrder(
                  OrderStatus.PENDING,
                  paymentMethod,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                  undefined,
                  true,
                  { skipSync: true },
                );
              }}
              disabled={currentCart.length === 0}
              data-inv-stop="action"
              className="py-2.5 sm:py-3 bg-slate-800 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 hover:bg-slate-700 disabled:opacity-30 transition-all active:scale-95"
            >
              <Save size={14} />
              حفظ
            </button>
            <button
              onClick={async () => {
                if (cartOrderType === OrderType.DINE_IN && !manualTable) {
                  setPosError("يرجى إدخال رقم الطاولة أولاً");
                  return;
                }
                // تنفيذ محلي هلأ بيطلب الدفع أول (زي إغلاق بالظبط) وبعدين يرسل للمطبخ —
                // بدل ما كان يرسل للمطبخ فقط بدون تحصيل أي دفعة. كان في فحص هون
                // بيحوّل لمودال تاني (CloseInvoiceModal) لو مافي اسم زبون معبّى —
                // وهو غالباً الحالة الافتراضية بمحلي، فبوب أب "إتمام الفاتورة" الحقيقي
                // (PaymentMethodModal) ما كان يفتح إطلاقاً. البيانات هاي أصلاً موجودة
                // جوا PaymentMethodModal نفسه، فما في داعي للفحص المسبق هون.
                if (onRequestClose) {
                  onRequestClose("dine_in");
                  return;
                }
                // fallback (نادراً ما يُستخدم): "تنفيذ" محلي = دفع + إغلاق فقط.
                // بدون طباعة — الطباعة لها زر مستقل بمحلي.
                await submitOrder(
                  OrderStatus.DELIVERED,
                  paymentMethod,
                  calculatedDiscount,
                  {
                    name: customerName,
                    phone: customerPhone,
                    note: invoiceNote,
                  },
                  undefined,
                  true,
                  {},
                );
              }}
              disabled={currentCart.length === 0 || isSubmitting}
              data-inv-stop="action"
              className="py-2.5 sm:py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1.5 hover:bg-emerald-700 shadow-xl shadow-emerald-900/20 disabled:opacity-30 transition-all active:scale-95"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              تنفيذ
            </button>
            <button
              onClick={() => handlePrintInvoice?.(editingOrderId, "departments")}
              disabled={currentCart.length === 0 || isPrinting}
              data-inv-stop="action"
              className="py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1 hover:bg-blue-700 shadow-xl shadow-blue-900/20 disabled:opacity-30 transition-all active:scale-95"
            >
              {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              {isPrinting ? "..." : "طباعة"}
            </button>
            {/* فاتورة الزبون فقط — نسخة الكاشير المدمجة (سعر + خصم + إجمالي).
                لو الطلب لسا ما انحفظ منحفظه (pending فقط — بلا مطبخ/دفع/إغلاق)
                ثم منطبع الفاتورة. */}
            <button
              onClick={async () => {
                let orderId: string | number | null | undefined = editingOrderId;
                if (!orderId) {
                  if (cartOrderType === OrderType.DINE_IN && !manualTable) {
                    setPosError("يرجى إدخال رقم الطاولة أولاً");
                    return;
                  }
                  const result = await submitOrder(
                    OrderStatus.PENDING,
                    paymentMethod,
                    calculatedDiscount,
                    { name: customerName, phone: customerPhone, note: invoiceNote },
                    undefined,
                    false, // ما نمسح السلة
                    { skipSync: true },
                  );
                  orderId = result?.id ?? null;
                }
                if (orderId) handlePrintInvoice?.(orderId, "merged");
              }}
              disabled={currentCart.length === 0 || isPrinting || isSubmitting}
              data-inv-stop="action"
              className="py-2.5 sm:py-3 bg-slate-700 text-white rounded-xl font-black text-[9px] sm:text-[10px] flex items-center justify-center gap-1 hover:bg-slate-600 disabled:opacity-30 transition-all active:scale-95"
            >
              {isPrinting || isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              فاتورة فقط
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
