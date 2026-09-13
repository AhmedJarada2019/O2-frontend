// src/components/Hospitality/PaymentMethodModal.tsx
//
// مودال اختيار طريقة الدفع عند إغلاق/تحصيل فاتورة.
// بدونه كان النظام بيفترض "نقدي" بصمت دايماً — راجع feedback الجلسة.
//
// يدعم الدفع المُجزّأ: الكاشير يقدر يوزّع إجمالي الفاتورة على أكثر من طريقة
// (جزء كاش + جزء بطاقة + جزء محفظة). يضيف "سطر دفع" لكل طريقة، يعدّل مبلغه،
// وما بيتفعّل زر التأكيد إلا لما مجموع الأسطر = إجمالي الفاتورة بالظبط.
//
// بالكاشير العادي (pos.tsx) بيستقبل كمان بيانات الزبون والحساب (اسم/جوال/بحث
// عن عميل-مورد-موظف) عشان الكاشير ما يحتاج يروح لتاب منفصل قبل ما يقفل الفاتورة —
// هاي الحقول اختيارية وما بتظهر إلا إذا الأب مرر setCustomerName (حالة الضيافة
// اللي بتستخدم هالمودال من HospitalityOrders.tsx ما بتمررها فبتضل زي ما كانت).

import React, { useState, useEffect, useRef, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote, CreditCard, Wallet, X, Search, Loader2,
  Users, UserCheck, Truck, Phone, Tag, Plus, Trash2,
} from "lucide-react";
import { PaymentMethod } from "../../../types";
import { customerService } from "../../services/customerService";
import { employeeService } from "../../services/employeeService";
import { supplierService } from "../../services/supplierService";

export const requiresPaymentReference = (method: PaymentMethod) =>
  method === PaymentMethod.WALLET || method === PaymentMethod.QR || method === PaymentMethod.ONLINE ||
  method === PaymentMethod.CREDIT_CARD;

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;
const MONEY_EPSILON = 0.01;

/** سطر دفع واحد ضمن التسوية المُجزّأة */
export interface PaymentLine {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

interface MethodMeta {
  label: string;
  icon: React.ElementType;
}

const METHOD_META: Partial<Record<PaymentMethod, MethodMeta>> = {
  [PaymentMethod.CASH]: { label: "نقدي", icon: Banknote },
  [PaymentMethod.CREDIT_CARD]: { label: "بطاقة", icon: CreditCard },
  [PaymentMethod.WALLET]: { label: "محفظة / تحويل", icon: Wallet },
  [PaymentMethod.CUSTOMER]: { label: "حساب عميل", icon: Users },
  [PaymentMethod.SUPPLIER]: { label: "حساب مورد", icon: Truck },
  [PaymentMethod.EMPLOYEE]: { label: "حساب موظف", icon: UserCheck },
};

// طرق الدفع المباشر المتاحة للتجزئة
const DIRECT_METHODS: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.WALLET,
];

interface EntityResult {
  id: number;
  name: string;
  phone: string;
  balance: number;
  creditLimit?: number;
  isBlocked?: boolean;
  status?: string;
  /** الرقم الوظيفي — موظفين بس، يُستخدم كرقم الحساب بدل الـ id الداخلي */
  employeeId?: string;
}

type AccountType = "ACCOUNT" | "SUPPLIER" | "EMPLOYEE";

interface LineState extends PaymentLine {
  key: string;
  reference: string;
}

interface PaymentMethodModalProps {
  show: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (payments: PaymentLine[], currency?: string, exchangeRate?: number) => void;
  confirming?: boolean;

  // بيانات الزبون والحساب — اختيارية (كاشير فقط)
  customerName?: string;
  setCustomerName?: (name: string) => void;
  customerPhone?: string;
  setCustomerPhone?: (phone: string) => void;
  accountType?: AccountType;
  setAccountType?: (type: AccountType) => void;
  accountNumber?: string;
  setAccountNumber?: (num: string) => void;
  setShowSearchModal?: (show: boolean) => void;
}

let _lineSeq = 0;
const nextLineKey = () => `line-${Date.now()}-${++_lineSeq}`;

export const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  show,
  total,
  onClose,
  onConfirm,
  confirming = false,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  accountType,
  setAccountType,
  // accountNumber ما بينقرا هون — accountSearchText هو نص الخانة، و setAccountNumber
  // بس بيخزّن الـ id الداخلي وقت اختيار حساب.
  setAccountNumber,
  setShowSearchModal,
}) => {
  const [lines, setLines] = useState<LineState[]>([]);
  const [error, setError] = useState("");
  const accountSearchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const methodsGridRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  // اختصار F7 (تأكيد وتحصيل) — محفوظ بـ ref لأن مستمع الكيبورد تحت مربوط بـ
  // [show] فقط، فلو ناديناه مباشرة رح يمسك نسخة قديمة من lines/selectedEntity.
  const confirmHotkeyRef = useRef<() => void>(() => {});
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const showAccountFields = !!setCustomerName;

  // ── التنقل بالأسهم بين عناصر المودال (أزرار + بوكسات الإدخال) ────────────
  // الأزرار: أي سهم ينقل للعنصر التالي/السابق (يسار/أسفل = التالي RTL).
  // البوكسات (input/select): أعلى/أسفل تنقل بين الحقول ، يمين/يسار تبقى داخل النص.
  // Enter = تفعيل الزر المحدّد ، Esc = إغلاق.
  useEffect(() => {
    if (!show) return;

    const SELECTOR =
      "button:not(:disabled), input:not(:disabled):not([type=hidden]), select:not(:disabled), textarea:not(:disabled)";

    const getNavEls = () =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(SELECTOR) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      // F7 = اختصار "تأكيد وتحصيل الفاتورة" (طباعة + تنفيذ) — نفس زر "إغلاق"
      // اللي فتح البوباب من السلة. يخلّي الكاشير يقفل الفاتورة بالكيبورد بدون
      // ما يوصل لزر التأكيد بالماوس/التاب. يشتغل بوضع فوري ومحلي (الطباعة
      // بتصير من onConfirm بـ pos.tsx: fawri للفوري / merged للمحلي).
      if (e.key === "F7") {
        e.preventDefault();
        confirmHotkeyRef.current();
        return;
      }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return;

      const ae = document.activeElement as HTMLElement | null;
      const isButton = ae instanceof HTMLButtonElement;
      const isField =
        !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT");

      if (e.key === "Enter") {
        if (isButton) {
          e.preventDefault();
          ae!.click();
          return;
        }
        // داخل حقل إدخال: Enter = "تأكيد وتحصيل الفاتورة" (نفس F7 والزر الأحمر)
        // حتى يقدر الكاشير يعبّي كل البيانات ويضغط Enter مباشرة بدون ما يوصل
        // للزر. الاستثناء الوحيد خانة بحث الحساب — Enter عندها بيختار أول
        // نتيجة (لها onKeyDown خاص فيها).
        if (isField) {
          if (ae === accountSearchInputRef.current) return;
          e.preventDefault();
          confirmHotkeyRef.current();
        }
        return;
      }

      // داخل بوكس نص: يمين/يسار تحرّك المؤشر — ما بنتدخل
      if (isField && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;

      const els = getNavEls();
      if (els.length === 0) return;

      const forward = e.key === "ArrowLeft" || e.key === "ArrowDown"; // RTL
      const cur = ae ? els.indexOf(ae) : -1;
      const next =
        cur === -1
          ? forward
            ? 0
            : els.length - 1
          : (cur + (forward ? 1 : -1) + els.length) % els.length;

      const target = els[next];
      target.focus();
      if (target instanceof HTMLInputElement && target.type !== "checkbox" && target.type !== "radio") {
        target.select();
      }
      e.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  // تركيز أول طريقة دفع عند فتح المودال حتى تشتغل الأسهم فوراً
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      methodsGridRef.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [show]);

  // ── بحث الحساب (عميل/مورد/موظف) ─────────────────────────────────────────
  // accountSearchText: نص خانة البحث نفسه (اللي الكاشير بيكتبه/بيشوفه) —
  // منفصل عمداً عن accountNumber (الـ id الداخلي الحقيقي المرسل للباكند
  // وقت التحصيل). قبل هذا الفصل، اختيار نتيجة كان يبدّل نص الخانة لـ id
  // داخلي مختلف عن الرقم اللي الكاشير كتبه فعلاً (مثلاً يكتب "45" ويطلع
  // له رقم تاني بعد الإنتر) — هلق الخانة بتضل عارضة نفس اللي كتبه.
  const [accountSearchText, setAccountSearchText] = useState("");
  const [showAccountSuggestions, setShowAccountSuggestions] = useState(false);
  const [entityResults, setEntityResults] = useState<EntityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityResult | null>(null);

  // ── حساب المخصّص / المتبقّي ─────────────────────────────────────────────
  const allocated = useMemo(
    () => roundMoney(lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)),
    [lines],
  );
  const remaining = useMemo(() => roundMoney(total - allocated), [total, allocated]);
  const isBalanced = Math.abs(remaining) <= MONEY_EPSILON;
  const missingReference = lines.some(
    (l) => requiresPaymentReference(l.method) && !l.reference.trim(),
  );

  useEffect(() => {
    if (!showAccountFields || !accountSearchText || accountSearchText.length < 1 || !showAccountSuggestions) {
      setEntityResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let results: EntityResult[] = [];

        if (accountType === "ACCOUNT") {
          const res = await customerService.list({ search: accountSearchText, per_page: 10 });
          const paginatedData: any = res?.data?.data;
          const data: any[] = Array.isArray(paginatedData) ? paginatedData : (paginatedData?.data || []);
          results = data.map((c: any) => ({
            id: c.id,
            name: c.name,
            phone: c.phone || "",
            balance: Number(c.balance) || 0,
            creditLimit: Number(c.credit_limit) || 0,
            isBlocked: c.status === "blocked" || false,
          }));
        } else if (accountType === "SUPPLIER") {
          const res = await supplierService.list({ search: accountSearchText, per_page: 10 });
          const data = res?.data?.data || [];
          results = data.map((s: any) => ({
            id: s.id,
            name: s.name,
            phone: s.phone || "",
            balance: s.balance || 0,
          }));
        } else if (accountType === "EMPLOYEE") {
          const data = await employeeService.getAll({ search: accountSearchText });
          const employeesData = Array.isArray(data) ? data : [];
          results = employeesData.map((e: any) => ({
            id: e.id,
            name: e.name,
            phone: e.phone || "",
            balance: e.outstanding_advance || 0,
            status: e.employment_status,
            employeeId: e.employeeId || undefined,
          }));
        }

        setEntityResults(results);
      } catch (err) {
        console.error("Entity search failed:", err);
        setEntityResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [accountSearchText, accountType, showAccountSuggestions, showAccountFields]);

  useEffect(() => {
    if (!selectedEntity) return;
    setCustomerName?.(selectedEntity.name);
    setCustomerPhone?.(selectedEntity.phone);
  }, [selectedEntity]);

  // المودال بيتصفر بين فتحة وفتحة عشان ما يفضل حساب طلب سابق عالق
  useEffect(() => {
    if (!show) {
      setLines([]);
      setError("");
      setSelectedEntity(null);
      setShowAccountSuggestions(false);
      setEntityResults([]);
      setAccountSearchText("");
    }
  }, [show]);

  // قفل تمرير الصفحة اللي وراء المودال حتى ما تتحرك الفاتورة أثناء فتحه
  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  const handleSelectAccount = (entity: EntityResult) => {
    // مهم: accountNumber هون هو الـ id الداخلي الفعلي اللي بينبعت للباكند
    // كـ entity_id/subledger_id وقت تحصيل الدفعة (راجع pos.tsx) — لازم يضل
    // رقم قاعدة البيانات الحقيقي بغض النظر عن نوع الحساب، وإلا بتتحصّل
    // الدفعة عالموظف/الحساب الغلط. الرقم الوظيفي يُعرض للكاشير للتأكيد بس
    // (selectedEntity.employeeId بالبادج تحت)، ما بيغيّر قيمة accountNumber.
    setAccountNumber?.(String(entity.id));
    setSelectedEntity(entity);
    setShowAccountSuggestions(false);
  };

  const entityTypeLabel = accountType === "ACCOUNT" ? "عميل" : accountType === "SUPPLIER" ? "مورد" : "موظف";
  const entityPaymentMethod =
    accountType === "ACCOUNT" ? PaymentMethod.CUSTOMER
      : accountType === "SUPPLIER" ? PaymentMethod.SUPPLIER
      : PaymentMethod.EMPLOYEE;

  const handleClose = () => {
    onClose();
  };

  // ── إدارة أسطر الدفع ────────────────────────────────────────────────────
  const addLine = (method: PaymentMethod) => {
    setError("");
    setLines((prev) => {
      if (prev.some((l) => l.method === method)) return prev;
      const alloc = prev.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      const rest = roundMoney(total - alloc);
      return [
        ...prev,
        { key: nextLineKey(), method, amount: rest > 0 ? rest : 0, reference: "" },
      ];
    });
  };

  const updateLineAmount = (key: string, value: string) => {
    const amount = roundMoney(parseFloat(value) || 0);
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, amount } : l)));
  };

  const updateLineReference = (key: string, value: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, reference: value } : l)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const fillRestAsCash = () => {
    setError("");
    setLines((prev) => {
      const alloc = prev.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      const rest = roundMoney(total - alloc);
      if (rest <= 0) return prev;
      const idx = prev.findIndex((l) => l.method === PaymentMethod.CASH);
      if (idx >= 0) {
        return prev.map((l, i) =>
          i === idx ? { ...l, amount: roundMoney(l.amount + rest) } : l,
        );
      }
      return [
        ...prev,
        { key: nextLineKey(), method: PaymentMethod.CASH, amount: rest, reference: "" },
      ];
    });
  };

  const emit = (payload: PaymentLine[]) => {
    onConfirm(payload);
  };

  const handleConfirm = () => {
    if (lines.length === 0) {
      setError("أضف طريقة دفع واحدة على الأقل");
      return;
    }
    if (lines.some((l) => l.amount <= 0)) {
      setError("كل سطر دفع يجب أن يكون بمبلغ أكبر من صفر");
      return;
    }
    if (!isBalanced) {
      setError(
        remaining > 0
          ? `المبلغ ناقص ${remaining.toFixed(2)} ₪`
          : `المبلغ زائد ${Math.abs(remaining).toFixed(2)} ₪`,
      );
      return;
    }
    if (missingReference) {
      setError("يرجى إدخال الرقم المرجعي للمحفظة / البطاقة");
      return;
    }
    emit(
      lines.map((l) => ({
        method: l.method,
        amount: roundMoney(l.amount),
        reference: l.reference.trim() || undefined,
      })),
    );
  };

  // دفع كامل الفاتورة على حساب الكيان المحدد (غير مُجزّأ)
  const handleEntityConfirm = () => {
    emit([{ method: entityPaymentMethod, amount: roundMoney(total), reference: undefined }]);
  };

  // اختصار F7 (وEnter داخل حقل إدخال) = نفس منطق الزر الأحمر "تأكيد وتحصيل"،
  // ويحصّل الفاتورة بضغطة وحدة في الوضعين فوري ومحلي:
  //   • في أسطر دفع مضافة → handleConfirm (بيعرض خطأ مبلغ ناقص/زائد أو مرجع
  //     ناقص لو الفاتورة مش جاهزة)
  //   • ما في أسطر بس في حساب محدد → تحميل كامل المبلغ على الحساب
  //   • ما في أسطر ولا حساب → تحصيل كامل المبلغ كاش وإقفال مباشرة (بدون ما
  //     الكاشير يضطر يضيف سطر دفع يدوي)
  useEffect(() => {
    confirmHotkeyRef.current = () => {
      if (confirming) return;
      if (lines.length > 0) {
        handleConfirm();
        return;
      }
      if (selectedEntity) {
        handleEntityConfirm();
        return;
      }
      emit(
        total > 0
          ? [{ method: PaymentMethod.CASH, amount: roundMoney(total), reference: undefined }]
          : [],
      );
    };
  });

  const accountSection = showAccountFields && (
    <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-white">بيانات الزبون والحساب</h4>
                  {(setAccountType || setShowSearchModal) && (
                    <button
                      onClick={() => {
                        if (setAccountType) {
                          setShowAccountSuggestions(true);
                          setTimeout(() => accountSearchInputRef.current?.focus(), 0);
                        } else {
                          setShowSearchModal?.(true);
                        }
                      }}
                      className="flex items-center gap-1.5 bg-red-600/10 border border-red-600/30 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors px-2.5 py-1.5 rounded-lg text-[10px] font-black active:scale-95"
                    >
                      <Search size={11} />
                      بحث عن عميل مسجل
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      value={customerName ?? ""}
                      onChange={(e) => setCustomerName?.(e.target.value)}
                      placeholder="اسم الزبون..."
                      className="w-full p-2 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-black text-[10px] text-white"
                    />
                    {selectedEntity && (
                      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/20 text-emerald-500 px-1 py-0.5 rounded text-[7px] font-bold">
                        <Tag size={7} />
                        {entityTypeLabel}
                        {accountType === "EMPLOYEE" && selectedEntity.employeeId && (
                          <span>#{selectedEntity.employeeId}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={customerPhone ?? ""}
                    onChange={(e) => setCustomerPhone?.(e.target.value)}
                    placeholder="رقم الجوال..."
                    className="w-full p-2 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-black text-[10px] text-white"
                  />
                </div>

                {setAccountType && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={accountType}
                      onChange={(e) => {
                        setAccountType(e.target.value as AccountType);
                        setAccountNumber?.("");
                        setAccountSearchText("");
                        setSelectedEntity(null);
                        setEntityResults([]);
                        setShowAccountSuggestions(false);
                      }}
                      className="w-full p-2 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-black text-[10px] text-white appearance-none"
                    >
                      <option value="ACCOUNT">زبون</option>
                      <option value="SUPPLIER">مورد</option>
                      <option value="EMPLOYEE">موظف</option>
                    </select>
                    <div className="relative">
                      <input
                        ref={accountSearchInputRef}
                        type="text"
                        value={accountSearchText}
                        onChange={(e) => {
                          setAccountSearchText(e.target.value);
                          setSelectedEntity(null);
                          setShowAccountSuggestions(true);
                        }}
                        onFocus={() => setShowAccountSuggestions(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && entityResults.length > 0) {
                            event.preventDefault();
                            handleSelectAccount(entityResults[0]);
                          }
                          if (event.key === "Escape") setShowAccountSuggestions(false);
                        }}
                        placeholder={
                          accountType === "EMPLOYEE"
                            ? "ابحث بالرقم الوظيفي أو الاسم..."
                            : "ابحث بالاسم/الجوال..."
                        }
                        className="w-full p-2 pl-7 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-black text-[10px] text-white"
                      />
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />

                      <AnimatePresence>
                        {showAccountSuggestions && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="absolute z-50 w-56 -left-2 mt-1.5 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                          >
                            <div className="p-1.5 border-b border-white/5 bg-white/5 flex items-center justify-between">
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                                {isSearching ? "جاري البحث..." : "نتائج البحث"}
                              </span>
                              <button type="button" onClick={() => setShowAccountSuggestions(false)}>
                                <X size={10} className="text-slate-500 hover:text-white" />
                              </button>
                            </div>

                            {isSearching && (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 size={14} className="text-red-500 animate-spin" />
                              </div>
                            )}

                            {!isSearching && entityResults.length > 0 && (
                              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                {entityResults.map((entity) => (
                                  <button
                                    key={`${accountType}-${entity.id}`}
                                    type="button"
                                    onClick={() => handleSelectAccount(entity)}
                                    className="w-full text-right p-2 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center ${entity.isBlocked ? "bg-red-500/10 text-red-500" : "bg-slate-800 text-slate-400"}`}>
                                        {accountType === "ACCOUNT" ? <Users size={11} /> : accountType === "SUPPLIER" ? <Truck size={11} /> : <UserCheck size={11} />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black text-white truncate">{entity.name}</p>
                                        <p className="text-[8px] font-bold text-slate-500 flex items-center gap-1">
                                          {accountType === "EMPLOYEE" && entity.employeeId ? (
                                            <>
                                              <Tag size={7} /> رقم وظيفي: {entity.employeeId}
                                            </>
                                          ) : (
                                            <>
                                              <Phone size={7} /> {entity.phone || "—"}
                                            </>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-[9px] font-mono font-black shrink-0">
                                      <span className={entity.balance > 0 ? "text-red-500" : "text-emerald-500"}>{entity.balance.toFixed(0)}</span>
                                    </p>
                                  </button>
                                ))}
                              </div>
                            )}

                            {!isSearching && accountSearchText && entityResults.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-4 text-slate-500">
                                <p className="text-[9px] font-black">لا توجد نتائج</p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {selectedEntity && (
                  <div className="bg-slate-800/50 border border-white/5 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-[9px] font-black text-emerald-500">
                      ✓ {entityTypeLabel} محدد #
                      {accountType === "EMPLOYEE" && selectedEntity.employeeId
                        ? selectedEntity.employeeId
                        : selectedEntity.id}
                    </span>
                    <span className={`text-[10px] font-mono font-black ${selectedEntity.balance > 0 ? "text-red-500" : "text-emerald-500"}`}>
                      رصيد: {selectedEntity.balance.toFixed(2)} ₪
                    </span>
                  </div>
                )}
    </div>
  );

  const totalSection = (
            <div className="text-center">
              <p className="text-slate-500 text-xs font-bold">المبلغ المطلوب تحصيله</p>
              <p className="text-3xl font-black text-white mt-1">{total.toFixed(2)} ₪</p>
            </div>
  );

  const allocationSection = (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/60 border border-white/5 rounded-xl p-2.5 text-center">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">المخصّص</p>
                <p className="text-sm font-mono font-black text-white mt-0.5">{allocated.toFixed(2)} ₪</p>
              </div>
              <div className={`rounded-xl p-2.5 text-center border ${isBalanced ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                  {remaining < 0 ? "الزائد" : "المتبقّي"}
                </p>
                <p className={`text-sm font-mono font-black mt-0.5 ${isBalanced ? "text-emerald-400" : "text-red-400"}`}>
                  {Math.abs(remaining).toFixed(2)} ₪
                </p>
              </div>
            </div>
  );

  const addMethodsSection = (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mr-1">أضف طريقة دفع</p>
              <div ref={methodsGridRef} className="grid grid-cols-3 gap-2">
                {DIRECT_METHODS.map((method) => {
                  const meta = METHOD_META[method]!;
                  const Icon = meta.icon;
                  const used = lines.some((l) => l.method === method);
                  return (
                    <button
                      key={method}
                      onClick={() => addLine(method)}
                      disabled={used}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border font-bold text-[11px] transition-all active:scale-95 ${
                        used
                          ? "bg-slate-800/40 border-white/5 text-slate-600 cursor-not-allowed"
                          : "bg-slate-800 border-white/5 text-slate-300 hover:text-white hover:border-red-600/40"
                      }`}
                    >
                      <Icon size={18} />
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {remaining > MONEY_EPSILON && (
                <button
                  onClick={fillRestAsCash}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-all text-[10px] font-black active:scale-95"
                >
                  <Plus size={12} />
                  الباقي كاش ({remaining.toFixed(2)} ₪)
                </button>
              )}
            </div>
  );

  const linesSection = lines.length > 0 && (
              <div className="space-y-2">
                {lines.map((line) => {
                  const meta = METHOD_META[line.method]!;
                  const Icon = meta.icon;
                  const needsRef = requiresPaymentReference(line.method);
                  return (
                    <div
                      key={line.key}
                      className="bg-white/[0.03] border border-white/5 rounded-xl p-2.5 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 shrink-0 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center text-slate-300">
                          <Icon size={15} />
                        </div>
                        <span className="text-[11px] font-black text-white flex-1 truncate">{meta.label}</span>
                        <div className="relative w-28 shrink-0">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={line.amount}
                            onChange={(e) => updateLineAmount(line.key, e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-lg pl-5 pr-2 py-1.5 text-right text-xs font-mono font-black text-emerald-400 outline-none focus:border-emerald-500/50 transition-all [appearance:textfield]"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] text-slate-600 font-black">₪</span>
                        </div>
                        <button
                          onClick={() => removeLine(line.key)}
                          className="w-7 h-7 shrink-0 rounded-lg bg-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {needsRef && (
                        <input
                          type="text"
                          value={line.reference}
                          onChange={(e) => updateLineReference(line.key, e.target.value)}
                          placeholder={line.method === PaymentMethod.CREDIT_CARD ? "رقم عملية البطاقة..." : "رقم العملية / التحويل..."}
                          className="w-full p-2 bg-slate-800 border border-white/5 rounded-lg outline-none focus:ring-1 focus:ring-red-600 font-bold text-[10px] text-white"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
  );

  const entityConfirmSection = selectedEntity && (
              <button
                onClick={handleEntityConfirm}
                disabled={confirming}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 transition-all text-[11px] font-black active:scale-95 disabled:opacity-50"
              >
                {entityTypeLabel === "عميل" ? <Users size={14} /> : entityTypeLabel === "مورد" ? <Truck size={14} /> : <UserCheck size={14} />}
                تحميل كامل المبلغ على حساب {entityTypeLabel}
              </button>
  );

  const errorSection = error && (
              <p className="text-red-400 text-xs font-bold text-center">{error}</p>
  );

  const actionsSection = (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirm}
                disabled={confirming || lines.length === 0 || !isBalanced || missingReference}
                className="w-full bg-red-600 text-white py-3 rounded-2xl font-black text-xs shadow-lg shadow-red-900/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? "جاري التحصيل..." : "تأكيد وتحصيل الفاتورة"}
              </button>
              <button
                onClick={handleClose}
                className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-xs active:scale-95 transition-all"
              >
                إلغاء
              </button>
            </div>
  );

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={`bg-slate-900 w-full rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden p-7 [&_button:focus]:outline-none [&_button:focus]:ring-2 [&_button:focus]:ring-red-500 [&_button:focus]:ring-offset-2 [&_button:focus]:ring-offset-slate-900 ${
              showAccountFields
                ? "max-w-[64rem] max-h-[95vh]"
                : "max-w-md space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
            }`}
          >
            <div className={`flex items-center justify-between ${showAccountFields ? "mb-6" : ""}`}>
              <h3 className="text-lg font-black text-white">إتمام الفاتورة</h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {showAccountFields ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-start">
                <div className="space-y-5 md:border-l md:border-white/10 md:pl-8">
                  {accountSection}
                  {totalSection}
                  {allocationSection}
                </div>
                <div className="space-y-5">
                  {addMethodsSection}
                  {linesSection}
                  {entityConfirmSection}
                  {errorSection}
                  {actionsSection}
                </div>
              </div>
            ) : (
              <>
                {totalSection}
                {allocationSection}
                {addMethodsSection}
                {linesSection}
                {entityConfirmSection}
                {errorSection}
                {actionsSection}
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
