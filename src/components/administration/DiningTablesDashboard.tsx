/**
 * DiningTablesDashboard.tsx — Premium Enterprise Dining Halls & Tables Management
 *
 * Operational dashboard for restaurant floor management.
 * Shows KPIs, branch occupancy, hall cards, table grid, and analytics.
 */

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  DoorOpen,
  LayoutGrid,
  Armchair,
  CheckCircle2,
  Clock,
  CreditCard,
  Sparkles,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronLeft,
  Plus,
  QrCode,
  ExternalLink,
  MoreVertical,
  Eye,
  Settings,
  Trash2,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  RefreshCw,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  MapPin,
  Star,
  AlertTriangle,
  LayoutDashboard,
  X,
  Loader2,
  Hash,
  AlertCircle,
} from "lucide-react";
import { TableStatus, type Hall, type Table, type Branch } from "../../../types";
import api from "../../api/axios";

/* ══════════════════════════════════════════════════════════════
 *  Local Types
 * ══════════════════════════════════════════════════════════════ */

interface DiningTableExt {
  id: number;
  table_number: string;
  qr_code: string;
  qr_url: string;
  capacity: number;
  status: string;
  number?: number;
  seated_at?: string;
  customer_count?: number;
  current_order_id?: number;
  current_order?: {
    id: number;
    order_number: string;
    status: string;
    total: number;
    customer_name?: string;
  } | null;
}

interface DiningZoneExt {
  id: number;
  branch_id: number;
  name: string;
  code: string;
  status: string;
  tables: DiningTableExt[];
  branch?: { id: number; name: string };
}

type ViewMode = "grid" | "list";

type TableFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "PAYMENT_PENDING" | "CLEANING" | "OUT_OF_SERVICE";

/* ══════════════════════════════════════════════════════════════
 *  Status Config
 * ══════════════════════════════════════════════════════════════ */

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; bg: string; border: string; dot: string; blink?: boolean }> = {
  AVAILABLE: { label: "Available", labelAr: "متاح", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  OCCUPIED: { label: "Occupied", labelAr: "مشغول", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-400" },
  RESERVED: { label: "Reserved", labelAr: "محجوز", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-400" },
  PAYMENT_PENDING: { label: "Payment", labelAr: "بانتظار الدفع", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", dot: "bg-purple-400" },
  BILL_PRINTED: { label: "Bill Printed", labelAr: "فاتورة مطبوعة", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", dot: "bg-blue-400" },
  CLEANING: { label: "Cleaning", labelAr: "تنظيف", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", dot: "bg-slate-400" },
  OUT_OF_SERVICE: { label: "Out of Service", labelAr: "خارج الخدمة", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400" },
  PAID: { label: "Paid", labelAr: "مدفوع", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  PENDING_CONFIRMATION: { label: "Pending", labelAr: "بانتظار التأكيد", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/50", dot: "bg-red-400", blink: true },
};

const STATUS_ORDER: TableFilter[] = ["ALL", "AVAILABLE", "OCCUPIED", "RESERVED", "PAYMENT_PENDING", "CLEANING", "OUT_OF_SERVICE"];

/* ══════════════════════════════════════════════════════════════
 *  Animation Variants
 * ══════════════════════════════════════════════════════════════ */

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/* ══════════════════════════════════════════════════════════════
 *  Helper: Count tables by status for a zone
 * ══════════════════════════════════════════════════════════════ */

function countByStatus(tables: DiningTableExt[]) {
  const counts: Record<string, number> = {};
  for (const t of tables) {
    counts[t.status] = (counts[t.status] || 0) + 1;
  }
  return counts;
}

function getOccupancyPercent(tables: DiningTableExt[]): number {
  if (tables.length === 0) return 0;
  const occupied = tables.filter(
    (t) => t.status === "OCCUPIED" || t.status === "PAYMENT_PENDING"
  ).length;
  return Math.round((occupied / tables.length) * 100);
}

/* ══════════════════════════════════════════════════════════════
 *  Sub-Components
 * ══════════════════════════════════════════════════════════════ */

/* ── KPI Card ────────────────────────────────────────────── */

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  trend?: { value: number; isUp: boolean };
  delay?: number;
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, suffix, color, trend, delay = 0 }) => (
  <motion.div
    variants={fadeInUp}
    initial="initial"
    animate="animate"
    transition={{ duration: 0.4, delay }}
    className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300 group"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
        {icon}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold ${trend.isUp ? "text-emerald-400" : "text-red-400"}`}>
          {trend.isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-black text-white tracking-tight">
      {value}
      {suffix && <span className="text-sm font-semibold text-slate-400 ms-1">{suffix}</span>}
    </p>
    <p className="text-[11px] font-semibold text-slate-500 mt-1 tracking-wider">{label}</p>
  </motion.div>
);

/* ── Stat Badge ──────────────────────────────────────────── */

const StatBadge: React.FC<{ count: number; status: string; small?: boolean }> = ({ count, status, small }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.AVAILABLE;
  return (
    <span className={`inline-flex items-center gap-1.5 ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} font-semibold rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {count}
    </span>
  );
};

/* ── Progress Bar ────────────────────────────────────────── */

const ProgressBar: React.FC<{ percent: number; color?: string; height?: string }> = ({ percent, color, height = "h-2" }) => {
  const barColor = color || (percent > 80 ? "bg-red-500" : percent > 50 ? "bg-amber-500" : "bg-emerald-500");
  return (
    <div className={`w-full ${height} bg-slate-800 rounded-full overflow-hidden`}>
      <motion.div
        className={`${height} ${barColor} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
};

/* ── Empty State ─────────────────────────────────────────── */

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }> = ({
  icon,
  title,
  description,
  action,
}) => (
  <motion.div {...fadeInUp} className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="w-20 h-20 rounded-2xl bg-slate-800/50 border border-white/[0.06] flex items-center justify-center text-slate-500 mb-6">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
    {action}
  </motion.div>
);

/* ── Context Menu ────────────────────────────────────────── */

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, items }) => {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 bg-slate-800 border border-white/[0.1] rounded-xl shadow-2xl py-1.5 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
            item.danger ? "text-red-400 hover:bg-red-500/10" : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </motion.div>
  );
};

/* ══════════════════════════════════════════════════════════════
 *  Add Hall Modal — matches DiningZonesPage style
 * ══════════════════════════════════════════════════════════════ */

interface AddHallModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { branch_id: number; name: string; code: string; tables_count: number; tables_capacity: number }) => Promise<void>;
}

const AddHallModal: React.FC<AddHallModalProps> = ({ open, onClose, onSubmit }) => {
  const [form, setForm] = useState({ branch_id: "", name: "", code: "", tables_count: "10", tables_capacity: "4" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setForm({ branch_id: "", name: "", code: "", tables_count: "10", tables_capacity: "4" });
      setLoadingBranches(true);
      api.get("/branches")
        .then((res) => {
          const items = res.data.data ?? res.data;
          setBranches(Array.isArray(items) ? items : []);
        })
        .catch(() => {})
        .finally(() => setLoadingBranches(false));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.branch_id || !form.name.trim() || !form.code.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        branch_id: Number(form.branch_id),
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        tables_count: Number(form.tables_count) || 10,
        tables_capacity: Number(form.tables_capacity) || 4,
      });
      onClose();
    } catch (err: any) {
      const errs = err.response?.data?.errors;
      if (errs) {
        const k = Object.keys(errs)[0];
        setError(errs[k]?.[0] || "خطأ في التحقق");
      } else {
        setError(err.response?.data?.message || "حدث خطأ أثناء الإضافة");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Plus size={20} className="text-green-400" />
            إضافة قاعة جديدة
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-600/20 text-red-400 rounded-xl text-sm font-bold border border-red-600/20">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {/* الفرع */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={13} />
            الفرع
            <span className="text-red-500">*</span>
          </label>
          <select
            value={form.branch_id}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            required
            disabled={loadingBranches}
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 appearance-none"
          >
            <option value="">
              {loadingBranches ? "جاري التحميل..." : "اختر الفرع..."}
            </option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* اسم القاعة */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <DoorOpen size={13} />
            اسم القاعة
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="مثال: القاعة الرئيسية"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600 placeholder:text-slate-600"
          />
        </div>

        {/* كود القاعة */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Hash size={13} />
            كود القاعة (حرف واحد)
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={3}
            placeholder="مثال: A"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600 placeholder:text-slate-600 font-mono font-black text-center text-lg tracking-widest"
          />
          <p className="text-[10px] text-slate-500 font-bold">
            الطاولات ستكون: {form.code || "X"}1, {form.code || "X"}2, ...
          </p>
        </div>

        {/* عدد الطاولات والسعة */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} />
              عدد الطاولات
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={form.tables_count}
              onChange={(e) => setForm({ ...form, tables_count: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} />
              سعة كل طاولة
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={form.tables_capacity}
              onChange={(e) => setForm({ ...form, tables_capacity: e.target.value })}
              required
              className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.branch_id || !form.name.trim() || !form.code.trim()}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/20"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "جاري الإنشاء..." : "إنشاء القاعة والطاولات"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-sm hover:text-white transition-colors"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 *  Add Table Modal — matches DiningZonesPage style
 * ══════════════════════════════════════════════════════════════ */

interface AddTableModalProps {
  open: boolean;
  onClose: () => void;
  zones: DiningZoneExt[];
  onSubmit: (data: { zone_id: number; table_number: string; capacity: number }) => Promise<void>;
}

const AddTableModal: React.FC<AddTableModalProps> = ({ open, onClose, zones, onSubmit }) => {
  const [form, setForm] = useState({ zone_id: "", table_number: "", capacity: "4" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ zone_id: "", table_number: "", capacity: "4" });
      setError("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.zone_id || !form.table_number.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit({
        zone_id: Number(form.zone_id),
        table_number: form.table_number.trim(),
        capacity: Number(form.capacity) || 4,
      });
      onClose();
    } catch (err: any) {
      const errs = err.response?.data?.errors;
      if (errs) {
        const k = Object.keys(errs)[0];
        setError(errs[k]?.[0] || "خطأ في التحقق");
      } else {
        setError(err.response?.data?.message || "حدث خطأ أثناء الإضافة");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const selectedZone = zones.find((z) => String(z.id) === form.zone_id);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Armchair size={20} className="text-green-400" />
            إضافة طاولة جديدة
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-600/20 text-red-400 rounded-xl text-sm font-bold border border-red-600/20">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {/* القاعة */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <DoorOpen size={13} />
            القاعة
            <span className="text-red-500">*</span>
          </label>
          <select
            value={form.zone_id}
            onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600 appearance-none"
          >
            <option value="">اختر القاعة...</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name} ({z.code})</option>
            ))}
          </select>
        </div>

        {/* رقم الطاولة */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Hash size={13} />
            رقم الطاولة
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder={selectedZone ? `مثال: ${selectedZone.code}1` : "مثال: A6"}
            value={form.table_number}
            onChange={(e) => setForm({ ...form, table_number: e.target.value.toUpperCase() })}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600 placeholder:text-slate-600 font-mono font-black text-center text-lg tracking-widest"
          />
          {selectedZone && (
            <p className="text-[10px] text-slate-500 font-bold">
              الكود: {selectedZone.code} | الطاولات الموجودة: {selectedZone.tables.length}
            </p>
          )}
        </div>

        {/* السعة */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={13} />
            سعة الطاولة (أشخاص)
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            required
            className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-red-600"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.zone_id || !form.table_number.trim()}
            className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/20"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "جاري الإضافة..." : "إضافة الطاولة"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-800 text-slate-400 rounded-xl font-bold text-sm hover:text-white transition-colors"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 *  Edit Hall Modal
 * ══════════════════════════════════════════════════════════════ */

interface EditHallModalProps {
  open: boolean;
  onClose: () => void;
  hall: DiningZoneExt | null;
  onSubmit: (data: { id: number; name: string; status: string }) => Promise<void>;
}

const EditHallModal: React.FC<EditHallModalProps> = ({ open, onClose, hall, onSubmit }) => {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hall) {
      setName(hall.name);
      setStatus(hall.status || "ACTIVE");
    }
  }, [hall]);

  const handleSubmit = async () => {
    if (!hall || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onSubmit({ id: hall.id, name: name.trim(), status });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "فشل تعديل القاعة");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !hall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">تعديل القاعة</h3>
              <p className="text-xs text-slate-400">{hall.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">اسم القاعة</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-800 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">الحالة</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-800 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="ACTIVE">نشط</option>
              <option value="INACTIVE">غير نشط</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            حفظ التعديلات
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
 *  QR Code Modal
 * ══════════════════════════════════════════════════════════════ */

const QrModal: React.FC<{ table: DiningTableExt; onClose: () => void }> = ({ table, onClose }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl text-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-16 h-16 mx-auto bg-blue-600/20 rounded-full flex items-center justify-center border border-blue-600/30">
        <QrCode size={32} className="text-blue-400" />
      </div>

      <div>
        <h2 className="text-lg font-black text-white">QR Code</h2>
        <p className="text-sm text-slate-400 mt-1">
          الطاولة: <span className="text-slate-200 font-bold">{table.table_number}</span>
        </p>
      </div>

      <div className="bg-white rounded-2xl p-4 mx-auto w-48 h-48 flex items-center justify-center">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(table.qr_url)}`}
          alt={`QR ${table.table_number}`}
          className="w-full h-full"
        />
      </div>

      <div className="bg-slate-800 rounded-xl p-3">
        <p className="text-xs text-slate-500 font-bold mb-1">رابط QR</p>
        <p className="text-xs text-slate-300 font-mono break-all">{table.qr_url}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800 rounded-xl p-2">
          <p className="text-slate-500 font-bold">السعة</p>
          <p className="text-white font-black">{table.capacity} أشخاص</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-2">
          <p className="text-slate-500 font-bold">الحالة</p>
          <p className="text-white font-black">{table.status}</p>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
      >
        إغلاق
      </button>
    </motion.div>
  </div>
);

/* ══════════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ══════════════════════════════════════════════════════════════ */

const DiningTablesDashboard: React.FC = () => {
  /* ── State ──────────────────────────────────────────────── */
  const [zones, setZones] = useState<DiningZoneExt[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [filterHall, setFilterHall] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<TableFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // UI
  const [selectedZone, setSelectedZone] = useState<DiningZoneExt | null>(null);
  const [showAddHall, setShowAddHall] = useState(false);
  const [showAddTable, setShowAddTable] = useState(false);
  const [editHall, setEditHall] = useState<DiningZoneExt | null>(null);
  const [qrTable, setQrTable] = useState<DiningTableExt | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "hall" | "table"; data: any } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [submitting, setSubmitting] = useState(false);

  /* ── Auto-clear success ─────────────────────────────────── */
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  /* ── Fetch Data ─────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [zonesRes, branchesRes] = await Promise.all([
        api.get("/admin/dining-zones"),
        api.get("/branches"),
      ]);
      const z = zonesRes.data.data ?? zonesRes.data;
      setZones(Array.isArray(z) ? z : []);
      const b = branchesRes.data.data ?? branchesRes.data;
      setBranches(Array.isArray(b) ? b : []);
    } catch (err: any) {
      setError(err.response?.data?.message || "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Add Hall + Tables ────────────────────────────────────── */
  const handleAddHall = async (data: { branch_id: number; name: string; code: string; tables_count: number; tables_capacity: number }) => {
    setSubmitting(true);
    try {
      await api.post("/admin/dining-zones", {
        branch_id: data.branch_id,
        name: data.name,
        code: data.code,
        tables_count: data.tables_count,
        tables_capacity: data.tables_capacity,
      });
      setSuccess("تم إنشاء القاعة والطاولات بنجاح");
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Edit Hall ──────────────────────────────────────────── */
  const handleEditHall = async (data: { id: number; name: string; status: string }) => {
    setSubmitting(true);
    try {
      await api.put(`/admin/dining-zones/${data.id}`, { name: data.name, status: data.status });
      setSuccess("تم تعديل القاعة بنجاح");
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete Hall ────────────────────────────────────────── */
  const handleDeleteHall = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه القاعة؟ سيتم حذف جميع الطاولات التابعة لها.")) return;
    try {
      await api.delete(`/admin/dining-zones/${id}`);
      setSuccess("تم حذف القاعة بنجاح");
      if (selectedZone?.id === id) setSelectedZone(null);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || "فشل حذف القاعة");
    }
  };

  /* ── Add Table ──────────────────────────────────────────── */
  const handleAddTable = async (data: { zone_id: number; table_number: string; capacity: number }) => {
    setSubmitting(true);
    try {
      await api.post(`/admin/dining-zones/${data.zone_id}/tables`, {
        table_number: data.table_number,
        capacity: data.capacity,
      });
      setSuccess("تم إضافة الطاولة بنجاح");
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete Table ───────────────────────────────────────── */
  const handleDeleteTable = async (zoneId: number, tableId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الطاولة؟")) return;
    try {
      await api.delete(`/admin/dining-zones/${zoneId}/tables/${tableId}`);
      setSuccess("تم حذف الطاولة بنجاح");
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || "فشل حذف الطاولة");
    }
  };

  /* ── Computed Data ──────────────────────────────────────── */
  const filteredZones = useMemo(() => {
    let result = zones;
    if (filterBranch !== "all") {
      result = result.filter((z) => String(z.branch_id) === filterBranch);
    }
    if (filterHall !== "all") {
      result = result.filter((z) => String(z.id) === filterHall);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (z) =>
          z.name.toLowerCase().includes(q) ||
          z.code.toLowerCase().includes(q) ||
          z.tables.some((t) => t.table_number.toLowerCase().includes(q))
      );
    }
    return result;
  }, [zones, filterBranch, filterHall, searchQuery]);

  const allTables = useMemo(() => {
    let tables: (DiningTableExt & { zoneName: string; zoneCode: string; branchId: number })[] = [];
    for (const z of filteredZones) {
      for (const t of z.tables) {
        tables.push({ ...t, zoneName: z.name, zoneCode: z.code, branchId: z.branch_id });
      }
    }
    if (filterStatus !== "ALL") {
      tables = tables.filter((t) => t.status === filterStatus);
    }
    return tables;
  }, [filteredZones, filterStatus]);

  const selectedZoneTables = useMemo(() => {
    if (!selectedZone) return [];
    let tables: (DiningTableExt & { zoneId: number; zoneName: string; zoneCode: string; branchId: number })[] = selectedZone.tables.map((t) => ({ 
      ...t, 
      zoneId: selectedZone.id,
      zoneName: selectedZone.name,
      zoneCode: selectedZone.code,
      branchId: selectedZone.branch_id,
    }));
    if (filterStatus !== "ALL") {
      tables = tables.filter((t) => t.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tables = tables.filter(
        (t) => t.table_number.toLowerCase().includes(q) || String(t.capacity).includes(q)
      );
    }
    return tables;
  }, [selectedZone, filterStatus, searchQuery]);

  /* ── KPI Stats ──────────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalBranches = new Set(zones.map((z) => z.branch_id)).size;
    const totalHalls = zones.length;
    const totalTables = zones.reduce((sum, z) => sum + z.tables.length, 0);
    const occupied = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "OCCUPIED").length,
      0
    );
    const available = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "AVAILABLE").length,
      0
    );
    const reserved = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "RESERVED").length,
      0
    );
    const paymentPending = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "PAYMENT_PENDING").length,
      0
    );
    const cleaning = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "CLEANING").length,
      0
    );
    const outOfService = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "OUT_OF_SERVICE").length,
      0
    );
    const occupancyPercent = totalTables > 0 ? Math.round(((occupied + paymentPending) / totalTables) * 100) : 0;
    return { totalBranches, totalHalls, totalTables, occupied, available, reserved, paymentPending, cleaning, outOfService, occupancyPercent };
  }, [zones]);

  /* ── Branch Stats ───────────────────────────────────────── */
  const branchStats = useMemo(() => {
    const map: Record<number, { name: string; halls: number; tables: DiningTableExt[] }> = {};
    for (const z of zones) {
      if (!map[z.branch_id]) {
        map[z.branch_id] = { name: z.branch?.name || `فرع ${z.branch_id}`, halls: 0, tables: [] };
      }
      map[z.branch_id].halls++;
      map[z.branch_id].tables.push(...z.tables);
    }
    return Object.entries(map).map(([id, data]) => ({
      id: Number(id),
      name: data.name,
      halls: data.halls,
      totalTables: data.tables.length,
      occupied: data.tables.filter((t) => t.status === "OCCUPIED").length,
      available: data.tables.filter((t) => t.status === "AVAILABLE").length,
      occupancy: data.tables.length > 0 ? Math.round((data.tables.filter((t) => t.status === "OCCUPIED").length / data.tables.length) * 100) : 0,
    }));
  }, [zones]);

  /* ── Analytics ──────────────────────────────────────────── */
  const analytics = useMemo(() => {
    if (zones.length === 0) return null;

    const hallOccupancies = zones.map((z) => ({
      name: z.name,
      occupancy: getOccupancyPercent(z.tables),
      total: z.tables.length,
    }));

    const sorted = [...hallOccupancies].sort((a, b) => b.occupancy - a.occupancy);
    const mostOccupied = sorted[0];
    const leastOccupied = sorted[sorted.length - 1];

    const avgCapacity = allTables.length > 0
      ? Math.round(allTables.reduce((sum, t) => sum + t.capacity, 0) / allTables.length)
      : 0;

    const maintenance = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "OUT_OF_SERVICE").length,
      0
    );

    const cleaningQueue = zones.reduce(
      (sum, z) => sum + z.tables.filter((t) => t.status === "CLEANING").length,
      0
    );

    const avgOccupancy = hallOccupancies.length > 0
      ? Math.round(hallOccupancies.reduce((sum, h) => sum + h.occupancy, 0) / hallOccupancies.length)
      : 0;

    return { avgOccupancy, mostOccupied, leastOccupied, avgCapacity, maintenance, cleaningQueue, hallOccupancies };
  }, [zones, allTables]);

  /* ── Quick Filter Counts ────────────────────────────────── */
  const quickFilterCounts = useMemo(() => {
    const tables = zones.flatMap((z) => z.tables);
    return {
      ALL: tables.length,
      AVAILABLE: tables.filter((t) => t.status === "AVAILABLE").length,
      OCCUPIED: tables.filter((t) => t.status === "OCCUPIED").length,
      RESERVED: tables.filter((t) => t.status === "RESERVED").length,
      PAYMENT_PENDING: tables.filter((t) => t.status === "PAYMENT_PENDING").length,
      CLEANING: tables.filter((t) => t.status === "CLEANING").length,
      OUT_OF_SERVICE: tables.filter((t) => t.status === "OUT_OF_SERVICE").length,
    };
  }, [zones]);

  /* ── Loading State ──────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-400 mx-auto mb-4" />
          <p className="text-sm text-slate-400">جاري تحميل البيانات...</p>
        </motion.div>
      </div>
    );
  }

  /* ── Error State ────────────────────────────────────────── */
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div {...fadeInUp} className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-400 mx-auto mb-4">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">خطأ في تحميل البيانات</h3>
          <p className="text-sm text-slate-400 mb-6">{error}</p>
          <button
            onClick={fetchAll}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            إعادة المحاولة
          </button>
        </motion.div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
   *  RENDER
   * ══════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ═══════════════════════════════════════════════════
         *  1. HEADER
         * ═══════════════════════════════════════════════════ */}
        <motion.div {...fadeInUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <LayoutDashboard size={22} />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">القاعات والطاولات</h1>
            </div>
            <p className="text-sm text-slate-400 me-[52px]">إدارة قاعات وطاولات المطعم عبر الفروع.</p>
          </div>
          <div className="flex items-center gap-3 me-[52px] sm:me-0">
            <button
              onClick={() => setShowAddHall(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Plus size={16} />
              قاعة جديدة
            </button>
            <button
              onClick={() => setShowAddTable(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Plus size={16} />
              طاولة جديدة
            </button>
            <button
              onClick={fetchAll}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-white/[0.06]"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════
         *  2. KPI DASHBOARD CARDS
         * ═══════════════════════════════════════════════════ */}
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <KPICard
            icon={<Building2 size={20} />}
            label="الأفرع"
            value={stats.totalBranches}
            color="bg-blue-500/10 text-blue-400"
            delay={0}
          />
          <KPICard
            icon={<DoorOpen size={20} />}
            label="القاعات"
            value={stats.totalHalls}
            color="bg-indigo-500/10 text-indigo-400"
            delay={0.05}
          />
          <KPICard
            icon={<LayoutGrid size={20} />}
            label="إجمالي الطاولات"
            value={stats.totalTables}
            color="bg-slate-500/10 text-slate-400"
            delay={0.1}
          />
          <KPICard
            icon={<Armchair size={20} />}
            label="مشغولة"
            value={stats.occupied}
            color="bg-amber-500/10 text-amber-400"
            trend={{ value: stats.occupancyPercent, isUp: true }}
            delay={0.15}
          />
          <KPICard
            icon={<CheckCircle2 size={20} />}
            label="متاحة"
            value={stats.available}
            color="bg-emerald-500/10 text-emerald-400"
            delay={0.2}
          />
          <KPICard
            icon={<Calendar size={20} />}
            label="محجوزة"
            value={stats.reserved}
            color="bg-blue-500/10 text-blue-400"
            delay={0.25}
          />
          <KPICard
            icon={<CreditCard size={20} />}
            label="بانتظار الدفع"
            value={stats.paymentPending}
            color="bg-purple-500/10 text-purple-400"
            delay={0.3}
          />
          <KPICard
            icon={<Sparkles size={20} />}
            label="تنظيف"
            value={stats.cleaning}
            color="bg-slate-500/10 text-slate-400"
            delay={0.35}
          />
          <KPICard
            icon={<XCircle size={20} />}
            label="خارج الخدمة"
            value={stats.outOfService}
            color="bg-red-500/10 text-red-400"
            delay={0.4}
          />
          <KPICard
            icon={<BarChart3 size={20} />}
            label="نسبة الإشغال"
            value={stats.occupancyPercent}
            suffix="%"
            color="bg-cyan-500/10 text-cyan-400"
            delay={0.45}
          />
        </motion.div>

        {/* ═══════════════════════════════════════════════════
         *  3. ADVANCED FILTERS
         * ═══════════════════════════════════════════════════ */}
        <motion.div {...fadeInUp} className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-4 mb-8">
          {/* Main filter row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث برقم الطاولة، الاسم، أو القاعة..."
                className="w-full bg-slate-800 border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            </div>

            {/* Branch selector */}
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={filterBranch}
                onChange={(e) => { setFilterBranch(e.target.value); setFilterHall("all"); }}
                className="bg-slate-800 border border-white/[0.06] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/40 transition-colors min-w-[160px]"
              >
                <option value="all">جميع الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* Hall selector */}
            <div className="relative">
              <DoorOpen size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select
                value={filterHall}
                onChange={(e) => setFilterHall(e.target.value)}
                className="bg-slate-800 border border-white/[0.06] rounded-xl pl-9 pr-8 py-2.5 text-sm text-white appearance-none cursor-pointer focus:outline-none focus:border-indigo-500/40 transition-colors min-w-[160px]"
              >
                <option value="all">جميع القاعات</option>
                {zones
                  .filter((z) => filterBranch === "all" || String(z.branch_id) === filterBranch)
                  .map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-slate-800 border border-white/[0.06] rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <BarChart3 size={16} />
              </button>
            </div>
          </div>

          {/* Quick status filters */}
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
            <Filter size={14} className="text-slate-500" />
            {STATUS_ORDER.map((status) => {
              const isActive = filterStatus === status;
              const cfg = status === "ALL" ? null : STATUS_CONFIG[status];
              const count = quickFilterCounts[status];
              return (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/[0.04]"
                  }`}
                >
                  {cfg && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />}
                  {status === "ALL" ? "الكل" : cfg?.labelAr || status}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-slate-700/50"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ═══════════════════════════════════════════════════
         *  MAIN CONTENT AREA (with optional analytics sidebar)
         * ═══════════════════════════════════════════════════ */}
        <div className="flex gap-6">
          {/* Left: Main content */}
          <div className="flex-1 min-w-0">

            {/* ═══════════════════════════════════════════════
             *  4. BRANCH OCCUPANCY OVERVIEW
             * ═══════════════════════════════════════════════ */}
            {branchStats.length > 0 && (
              <motion.div {...fadeInUp} className="mb-8">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Building2 size={18} className="text-slate-400" />
                  نظرة عامة على إشغال الفروع
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {branchStats.map((bs, i) => (
                    <motion.div
                      key={bs.id}
                      variants={fadeInUp}
                      initial="initial"
                      animate="animate"
                      transition={{ delay: i * 0.05 }}
                      className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-base font-bold text-white">{bs.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{bs.halls} قاعات · {bs.totalTables} طاولة</p>
                        </div>
                        <span className={`text-2xl font-black ${bs.occupancy > 80 ? "text-red-400" : bs.occupancy > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                          {bs.occupancy}%
                        </span>
                      </div>
                      <ProgressBar percent={bs.occupancy} />
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-xs text-slate-400">{bs.available} متاحة</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-xs text-slate-400">{bs.occupied} مشغولة</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════
             *  5. HALLS SECTION
             * ═══════════════════════════════════════════════ */}
            <motion.div {...fadeInUp} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <DoorOpen size={18} className="text-slate-400" />
                  القاعات
                  <span className="text-xs font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{filteredZones.length}</span>
                </h2>
              </div>

              {filteredZones.length === 0 ? (
                <EmptyState
                  icon={<DoorOpen size={36} />}
                  title="لا توجد قاعات"
                  description="أنشئ قاعتك الأولى لبدء إدارة الطاولات والعمليات."
                  action={
                    <button
                      onClick={() => setShowAddHall(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                    >
                      <Plus size={16} />
                      إنشاء أول قاعة
                    </button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredZones.map((zone, i) => {
                    const counts = countByStatus(zone.tables);
                    const occupancy = getOccupancyPercent(zone.tables);
                    const isSelected = selectedZone?.id === zone.id;

                    return (
                      <motion.div
                        key={zone.id}
                        variants={fadeInUp}
                        initial="initial"
                        animate="animate"
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setSelectedZone(isSelected ? null : zone)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, type: "hall", data: zone });
                        }}
                        className={`bg-slate-900/60 backdrop-blur-sm border rounded-2xl p-5 cursor-pointer transition-all duration-300 ${
                          isSelected
                            ? "border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                            : "border-white/[0.06] hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-400"}`}>
                              <DoorOpen size={18} />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold text-white">{zone.name}</h3>
                              <p className="text-[11px] text-slate-500">{zone.branch?.name || `فرع #${zone.branch_id}`} · الكود: {zone.code}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, type: "hall", data: zone });
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-white transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>

                        {/* Occupancy */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-slate-400">الإشغال</span>
                            <span className={`text-xs font-bold ${occupancy > 80 ? "text-red-400" : occupancy > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                              {occupancy}%
                            </span>
                          </div>
                          <ProgressBar percent={occupancy} />
                        </div>

                        {/* Table count */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-slate-400">الطاولات</span>
                          <span className="text-sm font-bold text-white">{zone.tables.length}</span>
                        </div>

                        {/* Status badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {counts.AVAILABLE && <StatBadge count={counts.AVAILABLE} status="AVAILABLE" small />}
                          {counts.OCCUPIED && <StatBadge count={counts.OCCUPIED} status="OCCUPIED" small />}
                          {counts.RESERVED && <StatBadge count={counts.RESERVED} status="RESERVED" small />}
                          {counts.PAYMENT_PENDING && <StatBadge count={counts.PAYMENT_PENDING} status="PAYMENT_PENDING" small />}
                          {counts.CLEANING && <StatBadge count={counts.CLEANING} status="CLEANING" small />}
                          {counts.OUT_OF_SERVICE && <StatBadge count={counts.OUT_OF_SERVICE} status="OUT_OF_SERVICE" small />}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* ═══════════════════════════════════════════════
             *  6. TABLES GRID
             * ═══════════════════════════════════════════════ */}
            <motion.div {...fadeInUp}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <LayoutGrid size={18} className="text-slate-400" />
                  {selectedZone ? `${selectedZone.name} — الطاولات` : "جميع الطاولات"}
                  <span className="text-xs font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {selectedZone ? selectedZoneTables.length : allTables.length}
                  </span>
                </h2>
                {selectedZone && (
                  <button
                    onClick={() => setSelectedZone(null)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                  >
                    عرض جميع الطاولات
                  </button>
                )}
              </div>

              {(selectedZone ? selectedZoneTables : allTables).length === 0 ? (
                <EmptyState
                  icon={<Armchair size={36} />}
                  title={selectedZone ? "لا توجد طاولات في هذه القاعة" : "لا توجد طاولات"}
                  description={selectedZone ? "أضف أول طاولة لهذه القاعة لبدء إدارة العمليات." : "لا توجد طاولات مطابقة للفلاتر الحالية. جرّب تعديل معايير البحث."}
                  action={
                    selectedZone ? (
                      <button
                        onClick={() => setShowAddTable(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                      >
                        <Plus size={16} />
                        إضافة أول طاولة
                      </button>
                    ) : undefined
                  }
                />
              ) : viewMode === "grid" ? (
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  <AnimatePresence mode="popLayout">
                    {(selectedZone ? selectedZoneTables : allTables).map((table, i) => {
                      const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.AVAILABLE;
                      const hasOrder = table.current_order && table.status !== "AVAILABLE";
                      return (
                        <motion.div
                          key={table.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={cfg.blink ? { 
                            opacity: 1, 
                            scale: 1,
                            boxShadow: [
                              "0 0 0 0 rgba(239, 68, 68, 0.7)",
                              "0 0 0 12px rgba(239, 68, 68, 0)",
                              "0 0 0 0 rgba(239, 68, 68, 0)",
                            ],
                          } : { opacity: 1, scale: 1 }}
                          transition={cfg.blink ? {
                            boxShadow: {
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                          } : { delay: i * 0.02 }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, type: "table", data: table });
                          }}
                          className={`relative bg-slate-900/60 backdrop-blur-sm border rounded-2xl p-4 hover:border-white/[0.12] transition-all duration-300 group cursor-pointer ${cfg.border} ${cfg.blink ? 'animate-pulse border-red-500/70' : ''}`}
                        >
                          {/* Status dot */}
                          <div className="absolute top-3 right-3">
                            <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                          </div>

                          {/* Table code */}
                          <div className={`text-2xl font-black mb-1 ${cfg.color}`}>
                            {table.table_number}
                          </div>

                          {/* Capacity */}
                          <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                            <Users size={12} />
                            {table.capacity}
                          </div>

                          {/* Status label */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${cfg.bg} ${cfg.color} mb-2`}>
                            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                            {cfg.labelAr}
                          </span>

                          {/* Order info */}
                          {hasOrder && (
                            <div className="mt-2 pt-2 border-t border-white/[0.04] space-y-1">
                              {table.current_order?.order_number && (
                                <p className="text-[10px] text-slate-400">
                                  #{table.current_order.order_number}
                                </p>
                              )}
                              {table.current_order?.total != null && (
                                <p className="text-xs font-bold text-white">
                                  {Number(table.current_order.total).toFixed(2)}
                                </p>
                              )}
                              {table.customer_count != null && table.customer_count > 0 && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                  <Users size={10} />
                                  {table.customer_count} ضيوف
                                </p>
                              )}
                            </div>
                          )}

                          {/* Hover actions */}
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); setQrTable(table); }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                              title="رمز QR"
                            >
                              <QrCode size={14} />
                            </button>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                              title="فتح نقطة البيع"
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                /* List View */
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">الطاولة</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">القاعة</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">السعة</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">الحالة</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">الطلب</th>
                        <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">المبلغ</th>
                        <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {(selectedZone ? selectedZoneTables : allTables).map((table, i) => {
                          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.AVAILABLE;
                          return (
                            <motion.tr
                              key={table.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ delay: i * 0.02 }}
                              className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="px-5 py-3">
                                <span className={`text-sm font-bold ${cfg.color}`}>{table.table_number}</span>
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-300">{table.zoneName}</td>
                              <td className="px-5 py-3">
                                <span className="text-sm text-slate-400 flex items-center gap-1">
                                  <Users size={12} />
                                  {table.capacity}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.labelAr}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-sm text-slate-300">
                                {table.current_order?.order_number ? `#${table.current_order.order_number}` : "—"}
                              </td>
                              <td className="px-5 py-3 text-sm font-semibold text-white">
                                {table.current_order?.total != null ? Number(table.current_order.total).toFixed(2) : "—"}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setQrTable(table)}
                                    className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
                                  >
                                    <QrCode size={14} />
                                  </button>
                                  <button className="p-1.5 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors">
                                    <Eye size={14} />
                                  </button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══════════════════════════════════════════════════
           *  8. ANALYTICS PANEL (Right Sidebar)
           * ═══════════════════════════════════════════════════ */}
          {analytics && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="hidden xl:block w-72 flex-shrink-0"
            >
              <div className="sticky top-8 space-y-4">
                {/* Average Occupancy */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">التحليلات</h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-slate-400">متوسط الإشغال</span>
                        <span className={`text-sm font-bold ${analytics.avgOccupancy > 80 ? "text-red-400" : analytics.avgOccupancy > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                          {analytics.avgOccupancy}%
                        </span>
                      </div>
                      <ProgressBar percent={analytics.avgOccupancy} />
                    </div>

                    <div className="pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} className="text-emerald-400" />
                        <span className="text-xs text-slate-400">الأكثر اشغالاً</span>
                      </div>
                      <p className="text-sm font-bold text-white">{analytics.mostOccupied.name}</p>
                      <p className="text-xs text-slate-500">{analytics.mostOccupied.occupancy}% · {analytics.mostOccupied.total} طاولة</p>
                    </div>

                    <div className="pt-3 border-t border-white/[0.04]">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={14} className="text-blue-400" />
                        <span className="text-xs text-slate-400">الأقل اشغالاً</span>
                      </div>
                      <p className="text-sm font-bold text-white">{analytics.leastOccupied.name}</p>
                      <p className="text-xs text-slate-500">{analytics.leastOccupied.occupancy}% · {analytics.leastOccupied.total} طاولة</p>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">إحصائيات سريعة</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <Users size={14} className="text-slate-500" />
                        متوسط السعة
                      </span>
                      <span className="text-sm font-bold text-white">{analytics.avgCapacity} مقعد</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <XCircle size={14} className="text-red-400" />
                        صيانة
                      </span>
                      <span className="text-sm font-bold text-red-400">{analytics.maintenance}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <Sparkles size={14} className="text-slate-400" />
                        قائمة التنظيف
                      </span>
                      <span className="text-sm font-bold text-slate-300">{analytics.cleaningQueue}</span>
                    </div>
                  </div>
                </div>

                {/* Hall Occupancy List */}
                <div className="bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] rounded-2xl p-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">إشغال القاعات</h3>
                  <div className="space-y-3">
                    {analytics.hallOccupancies.map((h) => (
                      <div key={h.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-300 truncate">{h.name}</span>
                          <span className={`text-xs font-bold ${h.occupancy > 80 ? "text-red-400" : h.occupancy > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                            {h.occupancy}%
                          </span>
                        </div>
                        <ProgressBar percent={h.occupancy} height="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
       *  MODALS & OVERLAYS
       * ═══════════════════════════════════════════════════════ */}

      <AddHallModal open={showAddHall} onClose={() => setShowAddHall(false)} onSubmit={handleAddHall} />
      <AddTableModal open={showAddTable} onClose={() => setShowAddTable(false)} zones={zones} onSubmit={handleAddTable} />
      <EditHallModal open={!!editHall} onClose={() => setEditHall(null)} hall={editHall} onSubmit={handleEditHall} />

      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}

      {/* Success Toast */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/30 flex items-center gap-2"
          >
            <CheckCircle2 size={18} />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={
              contextMenu.type === "hall"
                ? [
                    { icon: <Eye size={16} />, label: "عرض الطاولات", onClick: () => setSelectedZone(contextMenu.data) },
                    { icon: <Settings size={16} />, label: "تعديل القاعة", onClick: () => setEditHall(contextMenu.data) },
                    { icon: <Trash2 size={16} />, label: "حذف القاعة", onClick: () => handleDeleteHall(contextMenu.data.id), danger: true },
                  ]
                : [
                    { icon: <QrCode size={16} />, label: "رمز QR", onClick: () => setQrTable(contextMenu.data) },
                    { icon: <Trash2 size={16} />, label: "حذف الطاولة", onClick: () => handleDeleteTable(contextMenu.data.dining_zone_id || contextMenu.data.zoneId, contextMenu.data.id), danger: true },
                  ]
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DiningTablesDashboard;
