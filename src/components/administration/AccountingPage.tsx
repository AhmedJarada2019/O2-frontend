import { useState, useMemo } from 'react';
import { useApp } from "../../../store";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  Wallet, 
  ArrowDownRight,
  Plus,
  Lock
} from 'lucide-react';
import { 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
} from 'recharts';
import { OrderStatus, PaymentMethod, FinancialTransactionType } from '../../../types';
import { toast } from '../shared/Toast';
import { financialTransactionService } from '../../services/financialTransactionService';

const sumBy = <T,>(items: T[], predicate: (item: T) => boolean, selector: (item: T) => number) =>
  items.filter(predicate).reduce((sum, item) => sum + selector(item), 0);

const money = (value: number) => `₪${value.toLocaleString()}`;


const AccountingPage = () => {
    const { 
        activeOrders, 
        employees, 
        financialTransactions,
        currentShift, openShift, closeShift,
        addFinancialTransaction,
        currentUser,
    } = useApp();

    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = activeOrders.filter((order) => new Date(order.createdAt) >= today);
        const todayTransactions = financialTransactions.filter((transaction) => new Date(transaction.timestamp) >= today);

        const totalSales = sumBy(todayOrders, () => true, (order) => order.total);
        const invoiceCount = todayOrders.length;
        const cashSales = sumBy(todayOrders, (order) => order.paymentMethod === PaymentMethod.CASH, (order) => order.total);
        const cardSales = sumBy(todayOrders, (order) => order.paymentMethod === PaymentMethod.CREDIT_CARD, (order) => order.total);
        const walletSales = sumBy(todayOrders, (order) => order.paymentMethod === PaymentMethod.WALLET, (order) => order.total);
        const expenses = sumBy(todayTransactions, (transaction) => transaction.type === 'EXPENSE', (transaction) => transaction.amount);
        const withdrawals = sumBy(todayTransactions, (transaction) => transaction.type === 'WITHDRAWAL', (transaction) => transaction.amount);
        const deposits = sumBy(todayTransactions, (transaction) => transaction.type === 'DEPOSIT', (transaction) => transaction.amount);
        const refunds = sumBy(todayTransactions, (transaction) => transaction.type === 'REFUND', (transaction) => transaction.amount);
        const openingCash = currentShift?.openingBalance || 0;

        return {
        totalSales,
        invoiceCount,
        avgInvoice: invoiceCount > 0 ? totalSales / invoiceCount : 0,
        expenses,
        withdrawals,
        netCash: openingCash + cashSales + deposits - expenses - withdrawals - refunds,
        cashSales,
        cardSales,
        walletSales,
        activeCount: activeOrders.filter((order) => order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELED).length,
        cancelledCount: activeOrders.filter((order) => order.status === OrderStatus.CANCELED).length
        };
    }, [activeOrders, financialTransactions, currentShift]);
    const shiftTransactions = financialTransactions.filter((transaction) => transaction.shiftId === currentShift?.id);
    const totalSales = sumBy(shiftTransactions, (transaction) => transaction.type === FinancialTransactionType.SALE, (transaction) => transaction.amount);
    const totalExpenses = sumBy(shiftTransactions, (transaction) => transaction.type === FinancialTransactionType.EXPENSE, (transaction) => transaction.amount);
    const totalWithdrawals = sumBy(shiftTransactions, (transaction) => transaction.type === FinancialTransactionType.WITHDRAWAL, (transaction) => transaction.amount);
    const totalDeposits = sumBy(shiftTransactions, (transaction) => transaction.type === FinancialTransactionType.DEPOSIT, (transaction) => transaction.amount);
    const totalRefunds = sumBy(shiftTransactions, (transaction) => transaction.type === FinancialTransactionType.REFUND, (transaction) => transaction.amount);
    
    const currentBalance = (currentShift?.openingBalance || 0) + totalSales + totalDeposits - totalExpenses - totalWithdrawals - totalRefunds;
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionType, setTransactionType] = useState<FinancialTransactionType>(FinancialTransactionType.EXPENSE);
    const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Daily Financial Summary (Requested by user) */}
        <div className="bg-slate-900/50 border border-white/5 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-white">ملخص اليوم المالي (Daily Summary)</h2>
              <p className="text-xs text-slate-500">نظرة سريعة على أداء اليوم المالي</p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl text-xs font-bold">
              {new Date().toLocaleDateString('ar-SA')}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">إجمالي المبيعات (Sales Today)</p>
              <p className="text-2xl font-black text-white">{money(stats.totalSales)}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] text-slate-400">عدد الفواتير: <span className="text-white font-bold">{stats.invoiceCount}</span></span>
              </div>
            </div>
            <div className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">المصروفات (Expenses)</p>
              <p className="text-2xl font-black text-red-500">{money(stats.expenses)}</p>
            </div>
            <div className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">السحوبات (Withdrawals)</p>
              <p className="text-2xl font-black text-orange-500">{money(stats.withdrawals)}</p>
            </div>
            <div className="bg-slate-800/30 border border-white/5 p-4 rounded-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">صافي الصندوق (Net Cash)</p>
              <p className="text-2xl font-black text-emerald-500">{money(stats.netCash)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-white/5">
              <span className="text-xs text-slate-400">نقدي (Cash)</span>
              <span className="text-sm font-bold text-white">{money(stats.cashSales)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-white/5">
              <span className="text-xs text-slate-400">بطاقة (Card)</span>
              <span className="text-sm font-bold text-white">{money(stats.cardSales)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/20 border border-white/5">
              <span className="text-xs text-slate-400">تطبيقات (Apps)</span>
              <span className="text-sm font-bold text-white">{money(stats.walletSales)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">حركة الصندوق (Cashbox Movements)</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setTransactionType(FinancialTransactionType.EXPENSE); setShowTransactionModal(true); }}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <ArrowDownRight size={14} />
                    مصروف
                  </button>
                  <button 
                    onClick={() => { setTransactionType(FinancialTransactionType.WITHDRAWAL); setShowTransactionModal(true); }}
                    className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <Wallet size={14} />
                    سحب
                  </button>
                  <button 
                    onClick={() => { setTransactionType(FinancialTransactionType.DEPOSIT); setShowTransactionModal(true); }}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-bold transition-all"
                  >
                    <Plus size={14} />
                    إيداع
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {financialTransactions.slice().reverse().map(tx => (
                  <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-slate-800/30 border border-white/5 hover:border-white/10 transition-all">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      tx.type === FinancialTransactionType.SALE || tx.type === FinancialTransactionType.DEPOSIT ? 'bg-emerald-500/10 text-emerald-500' : 
                      tx.type === FinancialTransactionType.REFUND || tx.type === FinancialTransactionType.VOID ? 'bg-red-500/10 text-red-500' :
                      'bg-orange-500/10 text-orange-500'
                    }`}>
                      {tx.type === FinancialTransactionType.SALE || tx.type === FinancialTransactionType.DEPOSIT ? <TrendingUp size={20} /> : <ArrowDownRight size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{tx.reason}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(tx.timestamp).toLocaleString('ar-SA')} • {tx.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        tx.type === FinancialTransactionType.SALE || tx.type === FinancialTransactionType.DEPOSIT ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {tx.type === FinancialTransactionType.SALE || tx.type === FinancialTransactionType.DEPOSIT ? '+' : '-'}₪{tx.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500">بواسطة: {employees.find(e => e.id === tx.cashierId)?.name || 'النظام'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6">حالة الشفت الحالي</h3>
              
              {!currentShift ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Lock size={32} />
                  </div>
                  <div>
                    <p className="text-white font-bold">لا يوجد شفت مفتوح</p>
                    <p className="text-xs text-slate-500">يجب فتح شفت لبدء العمليات المالية</p>
                  </div>
                  <button 
                    onClick={() => setShowShiftModal(true)}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20"
                  >
                    فتح شفت جديد
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-500 font-bold uppercase">الرصيد المتوقع في الصندوق</p>
                      <div className="flex items-center gap-1 text-emerald-500">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold">متوازن</span>
                      </div>
                    </div>
                    <p className="text-3xl font-black text-white">{money(currentBalance)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">رصيد البداية</p>
                      <p className="text-sm font-bold text-white">{money(currentShift.openingBalance)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">إجمالي المبيعات</p>
                      <p className="text-sm font-bold text-emerald-500">{money(totalSales)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">المصروفات</p>
                      <p className="text-sm font-bold text-red-500">{money(totalExpenses)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/30 border border-white/5">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">السحوبات</p>
                      <p className="text-sm font-bold text-orange-500">{money(totalWithdrawals)}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">الكاشير المسئول:</span>
                      <span className="text-white font-bold">{employees.find(e => e.id === currentShift.cashierId)?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">وقت البدء:</span>
                      <span className="text-white font-bold">{new Date(currentShift.startTime).toLocaleTimeString('ar-SA')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">نوع الشفت:</span>
                      <span className="text-white font-bold">{currentShift.type}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowShiftModal(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl font-bold transition-all border border-white/5"
                  >
                    إغلاق الشفت (Close Shift)
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">توزيع طرق الدفع</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'كاش', value: stats.cashSales },
                        { name: 'بطاقة', value: stats.cardSales },
                        { name: 'محفظة', value: stats.walletSales },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Shift Modal */}
        <AnimatePresence>
          {showShiftModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowShiftModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
              >
                <h3 className="text-2xl font-black text-white mb-6">
                  {currentShift ? 'إغلاق الشفت' : 'فتح شفت جديد'}
                </h3>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    if (currentShift) {
                      await closeShift(parseFloat(formData.get('closingBalance') as string));
                    } else {
                      const ok = await openShift(
                        parseFloat(formData.get('openingBalance') as string),
                        formData.get('type') as any
                      );
                      if (!ok) {
                        toast.error('فشل فتح اليومية');
                        return;
                      }
                    }
                    setShowShiftModal(false);
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'فشلت العملية');
                  }
                }} className="space-y-6">
                  {currentShift ? (
                    <>
                      <div className="p-4 rounded-2xl bg-slate-800/50 border border-white/5 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">الرصيد المتوقع:</span>
                          <span className="text-white font-bold">{money(currentBalance)}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">الرصيد الفعلي في الصندوق</label>
                        <input 
                          name="closingBalance"
                          type="number" 
                          defaultValue={currentBalance}
                          className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          required
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">رصيد البداية (Opening Cash)</label>
                        <input 
                          name="openingBalance"
                          type="number" 
                          placeholder="0.00"
                          className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">فترة العمل</label>
                        <select 
                          name="type"
                          className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none"
                        >
                          <option value="MORNING">صباحي (Morning)</option>
                          <option value="EVENING">مسائي (Evening)</option>
                          <option value="NIGHT">ليلي (Night)</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowShiftModal(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold transition-all"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-red-900/20"
                    >
                      {currentShift ? 'تأكيد الإغلاق' : 'بدء الشفت'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Transaction Modal */}
        <AnimatePresence>
          {showTransactionModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowTransactionModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
              >
                <h3 className="text-2xl font-black text-white mb-6">
                  إضافة {transactionType === FinancialTransactionType.EXPENSE ? 'مصروف' : transactionType === FinancialTransactionType.WITHDRAWAL ? 'سحب' : 'إيداع'}
                </h3>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  try {
                    const saved = await financialTransactionService.create({
                      type: transactionType,
                      amount: parseFloat(formData.get('amount') as string),
                      reason: formData.get('reason') as string,
                    });
                    addFinancialTransaction({
                      id: String((saved as any).id),
                      shiftId: String((saved as any).shift_id ?? currentShift?.id ?? ''),
                      cashierId: String((saved as any).cashier_id ?? currentUser?.id ?? ''),
                      type: transactionType,
                      amount: parseFloat(formData.get('amount') as string),
                      reason: formData.get('reason') as string,
                      timestamp: new Date((saved as any).timestamp ?? Date.now()),
                      status: 'APPROVED',
                    });
                    toast.success('تم الحفظ', 'تم تسجيل الحركة بنجاح');
                    setShowTransactionModal(false);
                  } catch (err: any) {
                    toast.error('فشل الحفظ', err?.response?.data?.message || 'تعذّر تسجيل الحركة');
                  }
                }} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">المبلغ</label>
                    <input 
                      name="amount"
                      type="number" 
                      placeholder="0.00"
                      className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase">السبب / التفاصيل</label>
                    <textarea 
                      name="reason"
                      rows={3}
                      className="w-full bg-slate-800 border border-white/5 rounded-2xl px-6 py-4 text-white font-bold focus:outline-none"
                      required
                    ></textarea>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowTransactionModal(false)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold transition-all"
                    >
                      إلغاء
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-red-900/20"
                    >
                      حفظ العملية
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
};

export default AccountingPage;
