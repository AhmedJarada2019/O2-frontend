// src/components/POS/MenuGrid.tsx

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { MenuCategory, MenuItem } from "../../hooks/useMenu";
import { CATEGORIES } from '../../../constants';
import { getItemImageUrl, resolvePublicAssetUrl } from '../../services/itemService';

interface MenuGridProps {
  categories: MenuCategory[];
  selectedCategory: string;        // 'all' أو id القسم كـ string
  setSelectedCategory: (cat: string) => void;
  searchQuery: string;
  addToCart: (item: MenuItem) => void;
  loading?: boolean;
  categoryScrollable?: boolean;
  /** بوباب مفتوح فوق الشاشة (دفع، بحث..) — يعطّل تنقّل/إضافة الأصناف بالأسهم
   *  حتى ما تتحرك شبكة الأصناف اللي وراء البوباب. */
  isModalOpen?: boolean;
}

export const MenuGrid: React.FC<MenuGridProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  addToCart,
  loading = false,
  categoryScrollable = false,
  isModalOpen = false,
}) => {
  // ── Filtered items ────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase();

    const result = categories
      .filter(cat => selectedCategory === 'all' || String(cat.id) === selectedCategory)
      .flatMap(cat => cat.items)
      .filter(item =>
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.name_ar.toLowerCase().includes(q) ||
        String(item.id).includes(q) ||
        item.code.toLowerCase().includes(q)
      );

    return result;
  }, [categories, selectedCategory, searchQuery]);

  // ── التنقل بالأسهم بين الأقسام والأصناف ───────────────────────────────────
  // catIndex: 0 = "الكل" ، 1..N = categories[catIndex - 1]
  const gridRef = useRef<HTMLDivElement>(null);
  const catBarRef = useRef<HTMLDivElement>(null);
  const [focusZone, setFocusZone] = useState<'categories' | 'items'>('items');
  const [catIndex, setCatIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const catCount = categories.length + 1;

  // مزامنة مؤشر القسم مع القسم المختار فعلياً (زر الماوس، تحميل أول، إلخ)
  useEffect(() => {
    if (selectedCategory === 'all') {
      setCatIndex(0);
      return;
    }
    const i = categories.findIndex(c => String(c.id) === selectedCategory);
    if (i >= 0) setCatIndex(i + 1);
  }, [selectedCategory, categories]);

  // عند تغيير الفلتر (قسم/بحث) نرجع لأول صنف
  useEffect(() => {
    setItemIndex(0);
  }, [selectedCategory, searchQuery]);

  // نبقي مؤشر الصنف ضمن حدود القائمة الحالية
  useEffect(() => {
    setItemIndex(i => Math.min(Math.max(0, i), Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  // عدد الأعمدة الفعلي في الشبكة (يتغير حسب حجم الشاشة)
  const getColumnCount = useCallback(() => {
    const el = gridRef.current;
    if (!el) return 2;
    const cols = window
      .getComputedStyle(el)
      .gridTemplateColumns.split(' ')
      .filter(Boolean).length;
    return Math.max(1, cols);
  }, []);

  // تمرير العنصر المحدد داخل مجال الرؤية
  useEffect(() => {
    if (focusZone !== 'items') return;
    const el = gridRef.current?.children[itemIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [itemIndex, focusZone, filteredItems]);

  useEffect(() => {
    if (focusZone !== 'categories') return;
    const el = catBarRef.current?.children[catIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [catIndex, focusZone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isModalOpen) return;

      const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];
      if (!navKeys.includes(e.key)) return;

      const ae = document.activeElement as HTMLElement | null;
      const typing =
        !!ae &&
        (ae.tagName === 'INPUT' ||
          ae.tagName === 'TEXTAREA' ||
          ae.tagName === 'SELECT' ||
          ae.isContentEditable);

      // أثناء الكتابة في حقل البحث: السهم للأسفل فقط ينقل التركيز إلى الشبكة
      if (typing) {
        if (e.key === 'ArrowDown') {
          ae?.blur();
          setFocusZone('items');
          setItemIndex(0);
          e.preventDefault();
        }
        return;
      }

      if (categories.length === 0) return;

      // Enter: إضافة الصنف المحدد للسلة / أو النزول من الأقسام للأصناف
      if (e.key === 'Enter') {
        if (focusZone === 'items') {
          const it = filteredItems[itemIndex];
          if (it) addToCart(it);
        } else {
          setFocusZone('items');
          setItemIndex(0);
        }
        e.preventDefault();
        return;
      }

      // ── التنقل بين الأقسام (كل الأسهم الأربعة تنقّل بين الأقسام) ──
      if (focusZone === 'categories') {
        // RTL: يسار / أسفل = القسم التالي ، يمين / أعلى = القسم السابق
        const dir =
          e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 1 :
          e.key === 'ArrowRight' || e.key === 'ArrowUp' ? -1 : 0;
        if (dir !== 0) {
          const next = Math.min(Math.max(0, catIndex + dir), catCount - 1);
          setCatIndex(next);
          setSelectedCategory(next === 0 ? 'all' : String(categories[next - 1].id));
          e.preventDefault();
        }
        return;
      }

      // ── التنقل بين الأصناف ──
      if (filteredItems.length === 0) {
        if (e.key === 'ArrowUp') {
          setFocusZone('categories');
          e.preventDefault();
        }
        return;
      }

      const cols = getColumnCount();
      const last = filteredItems.length - 1;
      let idx = itemIndex;

      if (e.key === 'ArrowLeft') {
        idx = Math.min(last, idx + 1); // RTL: يسار = التالي
      } else if (e.key === 'ArrowRight') {
        idx = Math.max(0, idx - 1); // RTL: يمين = السابق
      } else if (e.key === 'ArrowDown') {
        idx = Math.min(last, idx + cols);
      } else if (e.key === 'ArrowUp') {
        if (idx < cols) {
          // الصف الأول → نصعد إلى شريط الأقسام
          setFocusZone('categories');
          e.preventDefault();
          return;
        }
        idx = Math.max(0, idx - cols);
      }

      setItemIndex(idx);
      e.preventDefault();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    focusZone,
    catIndex,
    catCount,
    itemIndex,
    filteredItems,
    categories,
    addToCart,
    setSelectedCategory,
    getColumnCount,
    isModalOpen,
  ]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pb-6 pr-1 custom-scrollbar">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2 animate-pulse">
            <div className="aspect-square rounded-2xl bg-slate-800" />
            <div className="h-3 bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (!loading && categories.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
        <Package size={48} strokeWidth={1} />
        <p className="font-black text-sm">لا توجد أصناف متاحة حالياً</p>
        <p className="text-xs text-slate-500">تأكد من تفعيل الأصناف وربطها بالفرع</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Category Tabs ── */}
      <div
        ref={catBarRef}
        className={`mb-3 flex shrink-0 gap-1 sticky top-0 z-10 py-1 ${categoryScrollable ? "overflow-x-auto custom-scrollbar" : "flex-wrap"}`}
      >
        {/* زر "الكل" */}
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg whitespace-nowrap text-[8px] font-black transition-all duration-200 border ${selectedCategory === 'all'
            ? 'bg-red-600 text-white border-red-600 shadow-sm'
            : 'bg-slate-900 text-slate-500 border-white/5 hover:bg-slate-800'
            } ${focusZone === 'categories' && catIndex === 0 ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-slate-950' : ''}`}
        >
          <span className="text-[10px]">🍽️</span>
          <span>الكل</span>
        </button>

        {/* أقسام المنيو */}
        {categories.map((cat, ci) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(String(cat.id))}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg whitespace-nowrap text-[8px] font-black transition-all duration-200 border ${selectedCategory === String(cat.id)
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-slate-900 text-slate-500 border-white/5 hover:bg-slate-800'
              } ${focusZone === 'categories' && catIndex === ci + 1 ? 'ring-2 ring-red-400 ring-offset-1 ring-offset-slate-950' : ''}`}
          >
            <span className="text-[10px]">{cat.icon}</span>
            <span>{cat.name_ar || cat.name}</span>
          </button>
        ))}
      </div>

      {/* ── Items Grid ── */}
      <div
        ref={gridRef}
        className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pr-1 pb-6 custom-scrollbar"
      >
        {filteredItems.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
            <Package size={40} strokeWidth={1} />
            <p className="font-black text-xs">
              {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا توجد أصناف في هذا القسم'}
            </p>
          </div>
        ) : (
          filteredItems.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setFocusZone('items');
                setItemIndex(i);
                addToCart(item);
              }}
              className={`group cursor-pointer flex flex-col gap-2 rounded-2xl ${focusZone === 'items' && itemIndex === i ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-slate-950' : ''}`}
            >
              {/* Image */}
              <div className="aspect-square relative rounded-2xl overflow-hidden bg-slate-900 border border-white/5 group-hover:border-red-600/50 transition-all duration-300 shadow-lg">
                {getItemImageUrl(item) ? (
                  <img
                    src={getItemImageUrl(item)}
                    alt={item.name_ar}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <Package size={32} strokeWidth={1} />
                  </div>
                )}

                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Badge رقم الصنف */}
                <div className="absolute top-2 right-2 bg-red-600 text-white px-1.5 py-0.5 rounded-md text-[8px] font-black shadow-lg border border-white/10">
                  #{item.code}
                </div>
              </div>

              {/* Info */}
              <div className="px-1">
                <h4 className="font-black text-slate-100 text-[13px] leading-tight group-hover:text-red-500 transition-colors line-clamp-2">
                  {item.name_ar || item.name}
                </h4>
                <div className="flex items-center justify-between mt-0.5">
                  {/* ✅ السعر يجي من pivot الفرع */}
                  <span className="text-[15px] font-black text-red-500">
                    {item.price > 0 ? `${item.price.toFixed(2)} ₪` : '—'}
                  </span>
                  {item.unit && (
                    <span className="text-[9px] text-slate-600 font-bold">{item.unit}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </>
  );
};
