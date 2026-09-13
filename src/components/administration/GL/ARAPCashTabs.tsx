import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  Briefcase,
  CreditCard,
  Landmark,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Edit3,
  Trash2,
  Wallet,
  Save,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from "lucide-react";
import { useApp } from "../../../../store";
import type { BankAccount, Customer, Supplier } from "../../../../types";
import { CustomerType, FinancialTransactionType } from "../../../../types";

type ViewMode = "cards" | "table";

const SummaryCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bg: string;
  border: string;
  icon: React.ElementType;
}> = ({ label, value, sub, color, bg, border, icon: Icon }) => (
  <div className={`bg-slate-900/60 border ${border} rounded-3xl p-5`}>
    <div className="flex items-center justify-between mb-3">
      <div
        className={`w-10 h-10 rounded-2xl ${bg} border ${border} flex items-center justify-center ${color}`}
      >
        <Icon size={18} />
      </div>
      {sub && (
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
          {sub}
        </span>
      )}
    </div>
    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">
      {label}
    </p>
    <p className={`text-xl font-black font-mono ${color}`}>{value}</p>
  </div>
);

const CardShell: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, children, actions }) => (
  <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden">
    <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h3 className="text-base font-black text-white">{title}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const ModalShell: React.FC<{
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden text-right"
    >
      <button
        onClick={onClose}
        className="absolute top-5 left-5 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all z-10"
      >
        <X size={15} />
      </button>
      <div className="p-7">
        <div className="mb-6">
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>
        </div>
        {children}
      </div>
    </motion.div>
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1.5">
    {children}
  </label>
);

const inputCls =
  "w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white text-right outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all placeholder:text-slate-700";
const selectCls = `${inputCls} cursor-pointer`;

const customerTypeOptions: Array<{ value: CustomerType; label: string }> = [
  { value: CustomerType.REGULAR, label: "عميل عادي" },
  { value: CustomerType.LOYAL, label: "عميل دائم" },
  { value: CustomerType.VIP, label: "VIP" },
  { value: CustomerType.COMPANY, label: "شركة" },
  { value: CustomerType.EMPLOYEE, label: "موظف" },
  { value: CustomerType.SUPPLIER, label: "مورد" },
];

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  type: CustomerType;
  allowCredit: boolean;
  notes: string;
};

type SupplierForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  linkedAccountId: string;
};

type BankAccountForm = {
  name: string;
  accountNumber: string;
  bankName: string;
  linkedAccountId: string;
};

const emptyCustomerForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  type: CustomerType.REGULAR,
  allowCredit: true,
  notes: "",
};

const emptySupplierForm: SupplierForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  linkedAccountId: "",
};

const emptyBankAccountForm: BankAccountForm = {
  name: "",
  accountNumber: "",
  bankName: "",
  linkedAccountId: "",
};

const customerBadge = (customer: Customer) =>
  customer.balance > 0 ? "text-blue-400" : "text-emerald-400";

const supplierBadge = (supplier: Supplier) =>
  supplier.balance > 0 ? "text-rose-400" : "text-emerald-400";

const AgingBadge = ({ days }: { days: number }) => {
  if (days <= 30) {
    return (
      <span className="px-2.5 py-1 rounded-lg border text-[10px] font-black text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
        جارية
      </span>
    );
  }
  if (days <= 60) {
    return (
      <span className="px-2.5 py-1 rounded-lg border text-[10px] font-black text-amber-400 bg-amber-500/10 border-amber-500/20">
        30-60 يوم
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-lg border text-[10px] font-black text-rose-400 bg-rose-500/10 border-rose-500/20">
      متأخرة
    </span>
  );
};

const CustomerModal: React.FC<{
  isOpen: boolean;
  customer: Customer | null;
  onClose: () => void;
  onSave: (form: CustomerForm) => void;
}> = ({ isOpen, customer, onClose, onSave }) => {
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);

  React.useEffect(() => {
    if (!isOpen) return;
    setForm(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            email: customer.email ?? "",
            type: customer.type,
            allowCredit: customer.allowCredit,
            notes: customer.notes ?? "",
          }
        : emptyCustomerForm,
    );
  }, [customer, isOpen]);

  if (!isOpen) return null;

  return (
    <ModalShell
      title={customer ? "تعديل عميل" : "إضافة عميل جديد"}
      subtitle="إنشاء أو تعديل بيانات العميل داخل تبويب AR"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>اسم العميل</FieldLabel>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputCls}
              placeholder="مثال: أحمد علي"
            />
          </div>
          <div>
            <FieldLabel>رقم الهاتف</FieldLabel>
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className={inputCls}
              placeholder="0590000000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>البريد الإلكتروني</FieldLabel>
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={inputCls}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <FieldLabel>نوع العميل</FieldLabel>
            <select
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as CustomerType }))}
              className={selectCls}
            >
              {customerTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/60 border border-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.allowCredit}
            onChange={(e) => setForm((prev) => ({ ...prev, allowCredit: e.target.checked }))}
            className="w-4 h-4 accent-red-600"
          />
          <span className="text-sm text-white font-bold">السماح بالدفع الآجل</span>
        </label>

        <div>
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className={`${inputCls} h-24 resize-none py-2`}
            placeholder="أي ملاحظات إضافية..."
          />
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white/5 border border-white/5 text-slate-400 hover:text-white rounded-2xl font-black text-sm transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 shadow-lg shadow-red-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Save size={14} />
            {customer ? "حفظ التغييرات" : "إضافة العميل"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const SupplierModal: React.FC<{
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (form: SupplierForm) => void;
}> = ({ isOpen, supplier, onClose, onSave }) => {
  const [form, setForm] = useState<SupplierForm>(emptySupplierForm);

  React.useEffect(() => {
    if (!isOpen) return;
    setForm(
      supplier
        ? {
            name: supplier.name,
            phone: supplier.phone,
            email: supplier.email ?? "",
            address: supplier.address ?? "",
            linkedAccountId: supplier.linkedAccountId ?? "",
          }
        : emptySupplierForm,
    );
  }, [supplier, isOpen]);

  if (!isOpen) return null;

  return (
    <ModalShell
      title={supplier ? "تعديل مورد" : "إضافة مورد جديد"}
      subtitle="إنشاء أو تعديل بيانات المورد داخل تبويب AP"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>اسم المورد</FieldLabel>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputCls}
              placeholder="مثال: شركة الغد"
            />
          </div>
          <div>
            <FieldLabel>رقم الهاتف</FieldLabel>
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className={inputCls}
              placeholder="0590000000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>البريد الإلكتروني</FieldLabel>
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className={inputCls}
              placeholder="supplier@company.com"
            />
          </div>
          <div>
            <FieldLabel>رقم الحساب المرتبط</FieldLabel>
            <input
              value={form.linkedAccountId}
              onChange={(e) => setForm((prev) => ({ ...prev, linkedAccountId: e.target.value }))}
              className={inputCls}
              placeholder="اختياري"
            />
          </div>
        </div>

        <div>
          <FieldLabel>العنوان</FieldLabel>
          <textarea
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            className={`${inputCls} h-24 resize-none py-2`}
            placeholder="العنوان الكامل..."
          />
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white/5 border border-white/5 text-slate-400 hover:text-white rounded-2xl font-black text-sm transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex-1 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-sm hover:bg-rose-700 shadow-lg shadow-rose-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Save size={14} />
            {supplier ? "حفظ التغييرات" : "إضافة المورد"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const BankAccountModal: React.FC<{
  isOpen: boolean;
  bankAccount: BankAccount | null;
  onClose: () => void;
  onSave: (form: BankAccountForm) => void;
}> = ({ isOpen, bankAccount, onClose, onSave }) => {
  const [form, setForm] = useState<BankAccountForm>(emptyBankAccountForm);

  React.useEffect(() => {
    if (!isOpen) return;
    setForm(
      bankAccount
        ? {
            name: bankAccount.name,
            accountNumber: bankAccount.accountNumber,
            bankName: bankAccount.bankName,
            linkedAccountId: bankAccount.linkedAccountId ?? "",
          }
        : emptyBankAccountForm,
    );
  }, [bankAccount, isOpen]);

  if (!isOpen) return null;

  return (
    <ModalShell
      title={bankAccount ? "تعديل حساب بنكي" : "إضافة حساب بنكي"}
      subtitle="حسابات البنوك الظاهرة في قسم النقدية"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>اسم الحساب</FieldLabel>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className={inputCls}
              placeholder="حساب بنك فلسطين"
            />
          </div>
          <div>
            <FieldLabel>اسم البنك</FieldLabel>
            <input
              value={form.bankName}
              onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
              className={inputCls}
              placeholder="Bank Name"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>رقم الحساب</FieldLabel>
            <input
              value={form.accountNumber}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, accountNumber: e.target.value }))
              }
              className={inputCls}
              placeholder="IBAN / Account Number"
            />
          </div>
          <div>
            <FieldLabel>رقم الحساب المرتبط</FieldLabel>
            <input
              value={form.linkedAccountId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, linkedAccountId: e.target.value }))
              }
              className={inputCls}
              placeholder="اختياري"
            />
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white/5 border border-white/5 text-slate-400 hover:text-white rounded-2xl font-black text-sm transition-all"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Save size={14} />
            {bankAccount ? "حفظ التغييرات" : "إضافة الحساب"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

const useArSearch = <T extends { name: string; phone?: string }>(
  rows: T[],
  query: string,
) =>
  rows.filter((row) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return (
      row.name.toLowerCase().includes(normalized) ||
      (row.phone ?? "").toLowerCase().includes(normalized)
    );
  });

export const ARTab: React.FC<{ customers?: Customer[] }> = ({ customers }) => {
  const app = useApp();
  const records = customers ?? app.customers;
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const filtered = useArSearch(records, search);

  const stats = useMemo(() => {
    const creditCustomers = records.filter((customer) => customer.allowCredit);
    return {
      total: creditCustomers.reduce((sum, customer) => sum + Math.max(customer.balance, 0), 0),
      count: creditCustomers.length,
      overdue: creditCustomers.filter((customer) => customer.balance > 5000).length,
      settled: creditCustomers.filter((customer) => customer.balance <= 0).length,
    };
  }, [records]);

  const openCreate = () => {
    setEditingCustomer(null);
    setShowModal(true);
  };

  const handleSave = (form: CustomerForm) => {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      type: form.type,
      allowCredit: form.allowCredit,
      notes: form.notes.trim() || undefined,
    };

    if (editingCustomer) {
      app.updateCustomer(editingCustomer.id, payload);
    } else {
      app.addCustomer(payload as any);
    }

    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleDelete = (customer: Customer) => {
    if (window.confirm(`حذف العميل "${customer.name}"؟`)) {
      app.deleteCustomer(customer.id);
    }
  };

  const handleSettle = (customer: Customer) => {
    if (customer.balance !== 0) {
      app.adjustCustomerBalance(customer.id, -customer.balance);
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pb-10 space-y-6" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="إجمالي الذمم المدينة"
          value={`₪${stats.total.toLocaleString()}`}
          color="text-blue-400"
          bg="bg-blue-500/10"
          border="border-blue-500/20"
          icon={Users}
        />
        <SummaryCard
          label="عملاء بالدفع الآجل"
          value={`${stats.count}`}
          sub="عميل"
          color="text-slate-300"
          bg="bg-white/5"
          border="border-white/10"
          icon={Users}
        />
        <SummaryCard
          label="ذمم متأخرة"
          value={`${stats.overdue}`}
          sub="تحتاج متابعة"
          color="text-amber-400"
          bg="bg-amber-500/10"
          border="border-amber-500/20"
          icon={AlertTriangle}
        />
        <SummaryCard
          label="مسدد / مسوى"
          value={`${stats.settled}`}
          sub="حساب"
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          border="border-emerald-500/20"
          icon={CheckCircle2}
        />
      </div>

      <CardShell
        title="الذمم المدينة"
        subtitle="عرض العملاء مع أدوات الإضافة والتعديل والسداد"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="bg-slate-950 border border-white/5 rounded-xl py-2 pr-9 pl-4 text-xs text-white outline-none focus:border-blue-500/50 w-52"
              />
            </div>
            <button className="p-2 bg-white/5 border border-white/5 rounded-xl text-slate-400 hover:text-white transition-all">
              <Filter size={14} />
            </button>
            <div className="flex items-center bg-slate-950 border border-white/5 rounded-xl p-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  viewMode === "cards" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                بطاقات
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  viewMode === "table" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                جدول
              </button>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all"
            >
              <Plus size={14} /> إضافة عميل
            </button>
          </div>
        }
      >
        {viewMode === "cards" ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((customer, index) => (
              <motion.div
                key={customer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, type: "spring", stiffness: 180 }}
                className="bg-slate-950/60 border border-white/5 rounded-3xl overflow-hidden hover:border-white/15 transition-all group"
              >
                <div className="p-5 flex items-center gap-4 border-b border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                    {customer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <h4 className="text-sm font-black text-white truncate">{customer.name}</h4>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">{customer.phone}</p>
                    <span className="inline-block mt-1 bg-slate-950 px-2 py-0.5 rounded-lg text-[10px] text-red-500 font-mono font-black border border-red-500/20">
                      {customer.type}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/5 text-right">
                  <div className="p-4">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">
                      الرصيد
                    </p>
                    <p className={`text-sm font-black font-mono ${customerBadge(customer)}`}>
                      ₪{Math.abs(customer.balance).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">
                      الحالة
                    </p>
                    <p className="text-sm font-black text-white">
                      {customer.allowCredit ? "آجل" : "نقدي"}
                    </p>
                  </div>
                </div>

                <div className="p-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSettle(customer)}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    تسوية
                  </button>
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingCustomer(customer);
                        setShowModal(true);
                      }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(customer)}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-600 font-black italic">
                لا يوجد عملاء مطابقون للبحث
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/40 border-b border-white/5">
                <tr className="text-slate-500 font-black uppercase tracking-wider">
                  <th className="px-5 py-3">العميل</th>
                  <th className="px-5 py-3">الهاتف</th>
                  <th className="px-5 py-3 text-center">الرصيد</th>
                  <th className="px-5 py-3 text-center">النوع</th>
                  <th className="px-5 py-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((customer) => (
                  <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                          {customer.name[0]}
                        </div>
                        <span className="font-bold text-white">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">{customer.phone}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`font-black font-mono text-sm ${customerBadge(customer)}`}>
                        ₪{Math.abs(customer.balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg border text-[10px] font-black text-blue-400 bg-blue-500/10 border-blue-500/20">
                        {customer.allowCredit ? "آجل" : "نقدي"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSettle(customer)}
                          className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          تسوية
                        </button>
                        <button
                          onClick={() => {
                            setEditingCustomer(customer);
                            setShowModal(true);
                          }}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black rounded-lg hover:bg-white/10 transition-all"
                        >
                          تعديل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-600 font-black italic">
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>

      <CustomerModal
        isOpen={showModal}
        customer={editingCustomer}
        onClose={() => {
          setShowModal(false);
          setEditingCustomer(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};

export const APTab: React.FC<{ suppliers?: Supplier[] }> = ({ suppliers }) => {
  const app = useApp();
  const records = suppliers ?? app.suppliers;
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const filtered = useArSearch(records, search);

  const stats = useMemo(() => {
    return {
      total: records.reduce((sum, supplier) => sum + Math.max(supplier.balance, 0), 0),
      count: records.length,
      overdue: records.filter((supplier) => supplier.balance > 0).length,
      settled: records.filter((supplier) => supplier.balance <= 0).length,
    };
  }, [records]);

  const openCreate = () => {
    setEditingSupplier(null);
    setShowModal(true);
  };

  const handleSave = (form: SupplierForm) => {
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      linkedAccountId: form.linkedAccountId.trim() || undefined,
    };

    if (editingSupplier) {
      app.updateSupplier(editingSupplier.id, payload);
    } else {
      app.addSupplier(payload as any);
    }

    setShowModal(false);
    setEditingSupplier(null);
  };

  const handleSettle = (supplier: Supplier) => {
    if (supplier.balance !== 0) {
      app.updateSupplier(supplier.id, { balance: 0 });
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pb-10 space-y-6" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="إجمالي الذمم الدائنة"
          value={`₪${stats.total.toLocaleString()}`}
          color="text-rose-400"
          bg="bg-rose-500/10"
          border="border-rose-500/20"
          icon={Briefcase}
        />
        <SummaryCard
          label="عدد الموردين"
          value={`${stats.count}`}
          sub="مورد"
          color="text-slate-300"
          bg="bg-white/5"
          border="border-white/10"
          icon={Briefcase}
        />
        <SummaryCard
          label="فواتير متأخرة"
          value={`${stats.overdue}`}
          sub="تحتاج سداد"
          color="text-amber-400"
          bg="bg-amber-500/10"
          border="border-amber-500/20"
          icon={Clock}
        />
        <SummaryCard
          label="تمت التسوية"
          value={`${stats.settled}`}
          sub="مورد"
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          border="border-emerald-500/20"
          icon={CheckCircle2}
        />
      </div>

      <CardShell
        title="الذمم الدائنة"
        subtitle="عرض الموردين مع إنشاء وتعديل وتسوية مباشرة"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="bg-slate-950 border border-white/5 rounded-xl py-2 pr-9 pl-4 text-xs text-white outline-none focus:border-rose-500/50 w-48"
              />
            </div>
            <div className="flex items-center bg-slate-950 border border-white/5 rounded-xl p-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  viewMode === "cards" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                بطاقات
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  viewMode === "table" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                جدول
              </button>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-700 transition-all"
            >
              <Plus size={14} /> إضافة مورد
            </button>
          </div>
        }
      >
        {viewMode === "cards" ? (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((supplier, index) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, type: "spring", stiffness: 180 }}
                className="bg-slate-950/60 border border-white/5 rounded-3xl overflow-hidden hover:border-white/15 transition-all group"
              >
                <div className="p-5 flex items-center gap-4 border-b border-white/5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-900 flex items-center justify-center text-white font-black text-lg shadow-lg shrink-0">
                    {supplier.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <h4 className="text-sm font-black text-white truncate">{supplier.name}</h4>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">{supplier.phone}</p>
                    <span className="inline-block mt-1 bg-slate-950 px-2 py-0.5 rounded-lg text-[10px] text-red-500 font-mono font-black border border-red-500/20">
                      مورد
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-x-reverse divide-white/5 text-right">
                  <div className="p-4">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">
                      المستحق
                    </p>
                    <p className={`text-sm font-black font-mono ${supplierBadge(supplier)}`}>
                      ₪{Math.abs(supplier.balance).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-1">
                      العمر
                    </p>
                    <AgingBadge days={0} />
                  </div>
                </div>

                <div className="p-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleSettle(supplier)}
                    className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                  >
                    تسوية
                  </button>
                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingSupplier(supplier);
                        setShowModal(true);
                      }}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-600 font-black italic">
                لا يوجد موردون مطابقون للبحث
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950/40 border-b border-white/5">
                <tr className="text-slate-500 font-black uppercase tracking-wider">
                  <th className="px-5 py-3">المورد</th>
                  <th className="px-5 py-3">الهاتف</th>
                  <th className="px-5 py-3 text-center">الرصيد</th>
                  <th className="px-5 py-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-black text-sm shrink-0">
                          {supplier.name[0]}
                        </div>
                        <span className="font-bold text-white">{supplier.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">{supplier.phone}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`font-black font-mono text-sm ${supplierBadge(supplier)}`}>
                        ₪{Math.abs(supplier.balance).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSettle(supplier)}
                          className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black rounded-lg hover:bg-emerald-600 hover:text-white transition-all"
                        >
                          تسوية
                        </button>
                        <button
                          onClick={() => {
                            setEditingSupplier(supplier);
                            setShowModal(true);
                          }}
                          className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black rounded-lg hover:bg-white/10 transition-all"
                        >
                          تعديل
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-600 font-black italic">
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardShell>

      <SupplierModal
        isOpen={showModal}
        supplier={editingSupplier}
        onClose={() => {
          setShowModal(false);
          setEditingSupplier(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};

export const CashBankTab: React.FC<{ bankAccounts?: BankAccount[] }> = ({
  bankAccounts,
}) => {
  const app = useApp();
  const records = bankAccounts ?? app.bankAccounts;
  const [showModal, setShowModal] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccount | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useArSearch(records, search);
  const totalBank = useMemo(
    () => records.reduce((sum, bank) => sum + bank.balance, 0),
    [records],
  );
  const cashOnHand = useMemo(
    () => app.cashBoxes.reduce((sum, cashBox) => sum + cashBox.balance, 0),
    [app.cashBoxes],
  );
  // مدفوعات الشهر الحالي (مصروفات + سحوبات) — كانت مرجّعة بدون تعريف إطلاقًا
  const monthlyOutflows = useMemo(() => {
    const now = new Date();
    return app.financialTransactions
      .filter((tx) => {
        const d = new Date(tx.timestamp);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          (tx.type === FinancialTransactionType.EXPENSE ||
            tx.type === FinancialTransactionType.WITHDRAWAL)
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [app.financialTransactions]);

  const openCreate = () => {
    setEditingBankAccount(null);
    setShowModal(true);
  };

  const handleSave = (form: BankAccountForm) => {
    const payload = {
      name: form.name.trim(),
      accountNumber: form.accountNumber.trim(),
      bankName: form.bankName.trim(),
      linkedAccountId: form.linkedAccountId.trim() || undefined,
    };

    if (editingBankAccount) {
      app.updateBankAccount(editingBankAccount.id, payload);
    } else {
      app.addBankAccount(payload as any);
    }

    setShowModal(false);
    setEditingBankAccount(null);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pb-10 space-y-6" dir="rtl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="إجمالي أرصدة البنوك"
          value={totalBank}
          color="text-blue-400"
          bg="bg-blue-500/10"
          border="border-blue-500/20"
          icon={Landmark}
        />
        <SummaryCard
          label="النقد في الصندوق"
          value={cashOnHand}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          border="border-emerald-500/20"
          icon={CreditCard}
        />
        <SummaryCard
          label="إجمالي السيولة"
          value={totalBank + cashOnHand}
          sub="بنوك + صندوق"
          color="text-amber-400"
          bg="bg-amber-500/10"
          border="border-amber-500/20"
          icon={Wallet}
        />
        <SummaryCard
          label="مدفوعات الفترة"
          value={monthlyOutflows}
          sub="من القيود"
          color="text-rose-400"
          bg="bg-rose-500/10"
          border="border-rose-500/20"
          icon={CreditCard}
        />
      </div>

      <CardShell
        title="الحسابات البنكية"
        subtitle="إضافة حساب جديد وربطه مباشرة بالحسابات التشغيلية"
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="bg-slate-950 border border-white/5 rounded-xl py-2 pr-9 pl-4 text-xs text-white outline-none focus:border-blue-500/50 w-52"
              />
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black hover:bg-blue-700 transition-all"
            >
              <Plus size={14} /> حساب جديد
            </button>
          </div>
        }
      >
        <div className="p-5 space-y-3">
          {filtered.map((bank, index) => (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 hover:border-blue-500/30 transition-all group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{bank.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{bank.bankName}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mb-0.5">
                    الرصيد
                  </p>
                  <p className="text-base font-black font-mono text-white">
                    ₪{bank.balance.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-[9px] text-slate-600 font-black">
                  {bank.accountNumber}
                </p>
                <button
                  onClick={() => {
                    setEditingBankAccount(bank);
                    setShowModal(true);
                  }}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black rounded-lg hover:bg-white/10 transition-all"
                >
                  تعديل
                </button>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-600 font-black italic">
              لا توجد حسابات بنكية
            </div>
          )}
        </div>
      </CardShell>

      <BankAccountModal
        isOpen={showModal}
        bankAccount={editingBankAccount as unknown as BankAccount}
        onClose={() => {
          setShowModal(false);
          setEditingBankAccount(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
};