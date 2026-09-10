import React, { useState, useMemo, useEffect } from 'react';
import { resolvePublicAssetUrl } from '../../services/itemService';
import { useApp } from '../../../store';
import { useAuth } from '../../auth/AuthContext';
import { orderService, type OrderFromApi } from '../../services/orderService';
import { financialTransactionService } from '../../services/financialTransactionService';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Layers,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  Smartphone,
  DollarSign,
  CreditCard,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
  color?: string;
}

interface FinancialTxFromApi {
  id: number;
  type: 'SALE' | 'EXPENSE' | 'WITHDRAWAL' | 'DEPOSIT' | 'REFUND' | 'CASH_DROP' | 'VOID';
  amount: number | string;
  timestamp: string;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك اواي',
  delivery: 'توصيل',
};

const DashboardPage = () => {
  const { menuItems, currentShift, fetchCurrentShift } = useApp();
  const { user } = useAuth();

  const [orders, setOrders] = useState<OrderFromApi[]>([]);
  const [transactions, setTransactions] = useState<FinancialTxFromApi[]>([]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    const branchId = user?.branch_id ?? undefined;

    (async () => {
      try {
        const [ordersRes, txRes] = await Promise.all([
          orderService.getAll({ branch_id: branchId, date: today }),
          financialTransactionService
            .getAll({ branch_id: branchId, date: today })
            .catch(() => [] as FinancialTxFromApi[]),
        ]);
        if (!cancelled) {
          setOrders(ordersRes);
          setTransactions(txRes as unknown as FinancialTxFromApi[]);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      }
    })();

    fetchCurrentShift();

    return () => {
      cancelled = true;
    };
  }, [user?.branch_id, fetchCurrentShift]);

  const paidOrders = useMemo(() => orders.filter((o) => o.status === 'paid'), [orders]);

  const deptSalesData = useMemo(() => {
    const deptSales: Record<string, number> = {};
    paidOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const name = item.department?.name || 'أخرى';
        deptSales[name] = (deptSales[name] || 0) + (item.total_price ?? item.unit_price * item.quantity);
      });
    });
    return Object.entries(deptSales).map(([name, value]) => ({ name, value }));
  }, [paidOrders]);

  const topItemsData = useMemo(() => {
    const counts: Record<string, { name: string; qty: number }> = {};
    paidOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const key = item.item_name_ar || item.item_name;
        if (!counts[key]) counts[key] = { name: key, qty: 0 };
        counts[key].qty += item.quantity;
      });
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [paidOrders]);

  const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, trend, trendUp, color = "text-red-500" }) => (
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 hover:border-red-500/30 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold ${trendUp ? 'text-emerald-500' : 'text-red-500'}`}>
            {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
      <h4 className="text-2xl font-black text-white">{value}</h4>
    </div>
  );

  const stats = useMemo(() => {
    const totalSales = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const invoiceCount = paidOrders.length;
    const avgInvoice = invoiceCount > 0 ? totalSales / invoiceCount : 0;

    const sumByType = (type: FinancialTxFromApi['type']) =>
      transactions.filter((tx) => tx.type === type).reduce((sum, tx) => sum + Number(tx.amount), 0);

    const expenses = sumByType('EXPENSE');
    const withdrawals = sumByType('WITHDRAWAL');
    const deposits = sumByType('DEPOSIT');
    const refunds = sumByType('REFUND');

    const cashSales = paidOrders.filter((o) => o.payment_method === 'cash').reduce((sum, o) => sum + o.total, 0);
    const cardSales = paidOrders.filter((o) => o.payment_method === 'card').reduce((sum, o) => sum + o.total, 0);
    const walletSales = paidOrders.filter((o) => o.payment_method === 'wallet').reduce((sum, o) => sum + o.total, 0);

    const openingCash = Number((currentShift as any)?.opening_balance ?? 0);
    const netCash = openingCash + cashSales + deposits - expenses - withdrawals - refunds;

    return {
      totalSales,
      invoiceCount,
      avgInvoice,
      expenses,
      withdrawals,
      netCash,
      cashSales,
      cardSales,
      walletSales,
      activeCount: orders.filter((o) => o.status !== 'paid' && o.status !== 'cancelled').length,
      cancelledCount: orders.filter((o) => o.status === 'cancelled').length,
    };
  }, [orders, paidOrders, transactions, currentShift]);

  const hourlySalesData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, sales: 0 }));
    paidOrders.forEach((o) => {
      const hour = new Date(o.created_at).getHours();
      hours[hour].sales += o.total;
    });
    return hours;
  }, [paidOrders]);

  const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المبيعات اليوم"
          value={`₪${stats.totalSales.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="المصروفات"
          value={`₪${stats.expenses.toLocaleString()}`}
          icon={ArrowDownRight}
          color="text-red-500"
        />
        <StatCard
          title="السحوبات"
          value={`₪${stats.withdrawals.toLocaleString()}`}
          icon={Wallet}
          color="text-orange-500"
        />
        <StatCard
          title="صافي الصندوق"
          value={`₪${stats.netCash.toLocaleString()}`}
          icon={DollarSign}
          color="text-emerald-500"
        />
      </div>

      {/* Payment Methods Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">نقدي (Cash)</p>
            <p className="text-xl font-black text-white">₪{stats.cashSales.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">بطاقة (Card)</p>
            <p className="text-xl font-black text-white">₪{stats.cardSales.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <CreditCard size={20} />
          </div>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">تطبيقات (Apps/Wallet)</p>
            <p className="text-xl font-black text-white">₪{stats.walletSales.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Smartphone size={20} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-red-500" />
            مبيعات اليوم حسب الساعة
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={hourlySalesData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₪${value}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Layers size={20} className="text-orange-500" />
            مبيعات الأقسام
          </h3>
          <div className="h-[300px] flex items-center justify-center">
            {deptSalesData.length === 0 ? (
              <p className="text-slate-500 text-sm">لا توجد مبيعات اليوم بعد</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={deptSalesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {deptSalesData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-1/3 space-y-2">
                  {deptSalesData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs text-slate-400 truncate">{entry.name}</span>
                      <span className="text-xs font-bold text-white ml-auto">₪{entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white">آخر الطلبات</h3>
            <button className="text-sm text-red-500 font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="text-slate-500 text-sm border-b border-white/5">
                  <th className="pb-4 font-medium">رقم الطلب</th>
                  <th className="pb-4 font-medium">العميل</th>
                  <th className="pb-4 font-medium">النوع</th>
                  <th className="pb-4 font-medium">الحالة</th>
                  <th className="pb-4 font-medium">الإجمالي</th>
                  <th className="pb-4 font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.slice(0, 5).map(order => (
                  <tr key={order.id} className="text-sm hover:bg-white/5 transition-colors">
                    <td className="py-4 font-bold text-white">#{order.order_number}</td>
                    <td className="py-4 text-slate-300">{order.customer_name || 'عميل نقدي'}</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        order.order_type === 'dine_in' ? 'bg-blue-500/10 text-blue-500' :
                        order.order_type === 'takeaway' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={`flex items-center gap-1 text-[10px] font-bold ${
                        order.status === 'paid' ? 'text-emerald-500' :
                        order.status === 'cancelled' ? 'text-red-500' :
                        'text-blue-500'
                      }`}>
                        {order.status === 'paid' ? <CheckCircle2 size={12} /> :
                        order.status === 'cancelled' ? <XCircle size={12} /> :
                        <Clock size={12} />}
                        {order.status === 'paid' ? 'مكتمل' : order.status === 'cancelled' ? 'ملغى' : 'قيد التنفيذ'}
                      </span>
                    </td>
                    <td className="py-4 font-bold text-white">₪{Number(order.total || 0).toFixed(2)}</td>
                    <td className="py-4 text-slate-500 text-xs">{new Date(order.created_at).toLocaleTimeString('ar-SA')}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 text-sm">لا توجد طلبات اليوم بعد</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-white mb-6">الأكثر مبيعاً</h3>
          <div className="space-y-4">
            {topItemsData.length === 0 && (
              <p className="text-slate-500 text-sm">لا توجد مبيعات اليوم بعد</p>
            )}
            {topItemsData.map((item) => {
              const menuItem = menuItems.find((mi) => mi.name === item.name);
              return (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 overflow-hidden shrink-0">
                    {menuItem && (
                      <img
                        src={menuItem.image_url || resolvePublicAssetUrl(menuItem.image)}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{item.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{item.qty}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
