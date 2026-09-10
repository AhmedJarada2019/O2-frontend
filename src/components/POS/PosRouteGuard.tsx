/**
 * PosRouteGuard.tsx — Route Guard لشاشات الكاشير/POS
 * ────────────────────────────────────────────────────
 * getDeviceUUIDSecurely/getRegisterInfoSecurely (posSecurity.ts) بتخزّن
 * وبترمّم بيانات التفعيل بمكانين (localStorage + IndexedDB) عن قصد — هيك
 * مقاومة لمسح الكاش العادي. المشكلة: من غير فحص دوري مع السيرفر، جهاز
 * اتفعّل مرة بيضل "مفعّل" للأبد من ناحية الفرونت إند حتى لو نقطة البيع
 * الأصلية انحذفت أو انلغي تفعيلها بالإدارة - صار هذا فعليًا (جهاز POS-002
 * "كاشير احمد جرادة" القديمة، انحذفت بتنظيف 2026-09-09، وضلّ الجهاز يدخل
 * مباشرة بدون شاشة تفعيل لأي حساب كاشير يسجّل دخول عليه).
 *
 * هذا الـguard بيسدّ الثغرة: عند تحميل أي مسار تحت /pos:
 *   1. التحقق من وجود device_uuid (localStorage أو IndexedDB).
 *   2. إذا لم يكن موجود → نسمح للـOutlet يكمل، وpos.tsx بيعرض شاشة التفعيل لحاله.
 *   3. إذا كان موجود → إرسال طلب /api/pos/check-status للباك إند (يتحقق
 *      إنه الجهاز لسا مرتبط بنقطة بيع status=ACTIVE فعليًا، مش بس محفوظ محليًا).
 *   4. إذا رجع 403 (محذوف/ملغي/خارج الشبكة) → مسح بيانات التفعيل من
 *      المكانين معًا (clearDeviceUUIDSecurely - مو localStorage لحاله، وإلا
 *      آلية الترميم التلقائي بترجّع البيانات القديمة من IndexedDB) والتوجيه
 *      إلى شاشة التفعيل. ما في مسار /activate منفصل بالراوتر - شاشة
 *      التفعيل (POSActivationPage) بتنعرض داخليًا من pos.tsx نفسها لما ما
 *      تلاقي بيانات تفعيل، فبعد المسح منسمح للـOutlet يكمل تحميله عادي
 *      وpos.tsx بيتكفّل بعرض شاشة التفعيل من جديد لحاله.
 *   5. إذا رجع 200 → السماح بالدخول (Outlet).
 */

import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import api from "../../api/axios";
import { Loader2 } from "lucide-react";
import { getDeviceUUIDSecurely, clearDeviceUUIDSecurely } from "../../utils/posSecurity";

const PosRouteGuard: React.FC = () => {
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    const checkDevice = async () => {
      try {
        // 1. هل يوجد device_uuid مخزن؟ (localStorage أو IndexedDB، مع ترميم متبادل)
        const deviceUuid = await getDeviceUUIDSecurely();
        if (!deviceUuid) {
          // ما في تفعيل أصلاً — pos.tsx بيعرض شاشة التفعيل لحاله، لا داعي لمسح شي.
          if (!cancelled) setStatus("ready");
          return;
        }

        // 2. فحص الحالة مع الباك إند — X-Device-UUID بينضاف تلقائيًا عبر axios interceptor
        await api.post("/pos/check-status");
      } catch {
        // 3. الباك إند رفض الطلب (403 أو أي خطأ) → الجهاز ملغي/محذوف/خارج الشبكة.
        // لازم نمسح من localStorage و IndexedDB معًا، وإلا الترميم التلقائي
        // برجّع البيانات القديمة بأول استدعاء جاي لـ getDeviceUUIDSecurely،
        // وpos.tsx رح يعتبر الجهاز مفعّل بالغلط زي ما صار مع POS-002.
        await clearDeviceUUIDSecurely();
      } finally {
        if (!cancelled) setStatus("ready");
      }
    };

    checkDevice();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="text-red-500 animate-spin mx-auto" />
          <p className="text-slate-400 font-semibold text-sm">جاري التحقق من حالة الجهاز...</p>
        </div>
      </div>
    );
  }

  // status === "ready" — pos.tsx نفسها بتقرر تعرض شاشة التفعيل أو الكاشير
  // الفعلي حسب بيانات التفعيل الحالية (بعد المسح لو كانت باطلة).
  return <Outlet />;
};

export default PosRouteGuard;