import React, { useState } from 'react';
import { Search, RefreshCw, Loader2, Archive, UserRound } from 'lucide-react';
import { useApp } from '../../../store';
import { useAuth } from '../../auth';
import api from '../../api/axios';
import { toast } from '../shared/Toast';

interface POSHeaderProps {
  editingOrderId: string | null;
  isHospitality: boolean;
  activePOSMode: 'menu' | 'tables' | 'info' | 'contact' | 'accounts';
  setActivePOSMode: (mode: 'menu' | 'tables' | 'info' | 'contact' | 'accounts') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  clearCart: () => void;
  /** بوباب مفتوح فوق الشاشة — يعطّل اختصار فتح الصندوق (F9) حتى ما يفتح
   *  بالغلط أثناء التركيز على بوباب تاني. */
  isModalOpen?: boolean;
  posInfo?: { code?: string; name?: string } | null;
}

export const POSHeader: React.FC<POSHeaderProps> = ({
  editingOrderId, isHospitality, activePOSMode, setActivePOSMode,
  searchQuery, setSearchQuery, clearCart, isModalOpen = false, posInfo,
}) => {
  const { currentShift, currentUser, rollover, userRole } = useApp();
  const { user } = useAuth();
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const canRollover = userRole === 'super-admin' || userRole === 'admin' || userRole === 'ADMIN';
  const cashierName = user?.name || currentUser?.name || 'غير معروف';

  const handleOpenDrawer = async () => {
    setDrawerLoading(true);
    try {
      await api.post('/pos/open-drawer');
      toast.success('تم فتح صندوق النقدية');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'فشل فتح الصندوق — تأكد من ربط طابعة الكاشير');
    } finally {
      setDrawerLoading(false);
    }
  };

  // F9 — فتح صندوق النقدية
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (e.key === 'F9') {
        e.preventDefault();
        handleOpenDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleRollover = async () => {
    setRolloverLoading(true);
    try {
      await rollover(currentShift?.openingBalance ?? 0);
      setShowRolloverConfirm(false);
    } catch (error) {
      console.error('Rollover failed:', error);
    } finally {
      setRolloverLoading(false);
    }
  };

  return (
    <header className="mb-3 bg-slate-900 p-3 sm:p-5 rounded-2xl border border-white/5 shadow-xl space-y-4">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0 w-full xl:w-auto justify-between xl:justify-start">
          <h2
            onClick={clearCart}
            className="text-base sm:text-lg font-black text-white tracking-tight whitespace-nowrap cursor-pointer hover:text-red-500 transition-colors"
          >
            {editingOrderId ? `تعديل طلب #${editingOrderId.slice(-4)}` : 'فاتورة جديدة'}
          </h2>
          <div
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-200"
            title={posInfo?.name ? `الكاشير: ${cashierName} - ${posInfo.name}` : `الكاشير: ${cashierName}`}
          >
            <UserRound size={13} className="shrink-0" />
            <span className="text-[10px] font-black whitespace-nowrap">الكاشير:</span>
            <span className="max-w-28 truncate text-[10px] font-black sm:max-w-40">
              {cashierName}
            </span>
            {posInfo?.code && (
              <span className="text-[10px] font-black text-emerald-400 whitespace-nowrap">
                ({posInfo.code})
              </span>
            )}
          </div>
          {editingOrderId && (
            <button onClick={clearCart} className="text-[10px] font-black text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-xl transition-colors border border-red-500/20">إلغاء</button>
          )}
          
          {/* فتح صندوق النقدية (F9) */}
          <button
            onClick={handleOpenDrawer}
            disabled={drawerLoading}
            title="فتح صندوق النقدية (F9)"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-black transition-all disabled:opacity-50 border border-white/5"
          >
            {drawerLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Archive size={12} />
            )}
            فتح الصندوق
          </button>

          {/* زر الترحيل */}
          {canRollover && currentShift && (
            <div className="relative">
              <button
                onClick={() => setShowRolloverConfirm(true)}
                disabled={rolloverLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-all disabled:opacity-50"
              >
                {rolloverLoading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                ترحيل اليومية
              </button>
              
              {/* نافذة التأكيد */}
              {showRolloverConfirm && (
                <div className="absolute top-full left-0 mt-2 p-4 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 w-72">
                  <p className="text-white text-xs font-bold mb-3">
                    هل أنت متأكد من ترحيل اليومية؟
                  </p>
                  <p className="text-slate-400 text-[10px] mb-4">
                    سيتم إغلاق اليومية الحالية وفتح يومية جديدة. الطلبات المدفوعة ستبقى في اليومية القديمة.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRollover}
                      disabled={rolloverLoading}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black transition-all disabled:opacity-50"
                    >
                      {rolloverLoading ? 'جاري الترحيل...' : 'تأكيد الترحيل'}
                    </button>
                    <button
                      onClick={() => setShowRolloverConfirm(false)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[10px] font-black transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="w-full xl:flex-1 relative group">
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-500 transition-colors pointer-events-none">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="ابحث عن وجبة، رقم الصنف..."
            className="w-full pr-10 pl-3 py-2.5 bg-slate-800/40 border border-white/5 rounded-xl focus:ring-2 focus:ring-red-600/50 outline-none text-[10px] font-bold text-white placeholder-slate-600 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {!isHospitality && (
          <div className="flex flex-wrap bg-slate-800 p-1 rounded-xl shrink-0 border border-white/5 shadow-inner">
            {(['menu', 'tables', 'contact', 'info', 'accounts'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setActivePOSMode(mode)}
                className={`px-3 sm:px-5 py-2 rounded-lg text-[8px] sm:text-[10px] font-black transition-all whitespace-nowrap ${activePOSMode === mode ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {mode === 'menu' ? 'المنيو' : mode === 'tables' ? 'الطاولات' : mode === 'contact' ? 'بيانات التواصل' : mode === 'info' ? 'بيانات الفاتورة' : 'أرقام الحسابات'}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};
