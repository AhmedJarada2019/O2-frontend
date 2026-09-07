# O2 System — توثيق الفرونت إند (RestoMaster)

هاد الملف بيوثّق مشروع `o2-company-front` (الاسم الداخلي "RestoMaster")
— الواجهة الأمامية لنظام O2. الباك إند (`o2-system-backend`، Laravel)
موثّق بشكل منفصل بريبو الباك إند تحت `docs/PROJECT.md` و`docs/PRINTING.md`
— راجعهم لتفاصيل الـAPI ونظام الطباعة من جهة السيرفر.

---

## 1. التقنيات والأدوات

- **React 18.2** + TypeScript 5، أداة البناء **Vite 5**.
- **التوجيه**: `react-router-dom` v7 (بنية `<Routes>`/`<Outlet>` متداخلة).
- **إدارة الحالة**: Zustand v5 (`create` + `persist`) — متجر واحد كبير
  بجذر المشروع (`store.tsx`).
- **التنسيق**: Tailwind CSS v4 عبر `@tailwindcss/vite` (بدون
  `tailwind.config.js` تقليدي — أسلوب v4 الجديد المعتمد على CSS)، مع
  `tailwind-merge` و`clsx`.
- **UI/حركة**: `framer-motion`، `lucide-react` (أيقونات)، `@dnd-kit/*`
  (سحب وإفلات — لتخطيط الطاولات على الأغلب).
- **رسوم بيانية**: `recharts`.
- **PDF**: `html2pdf.js` (توليد PDF من جهة العميل مباشرة).
- **HTTP**: `axios`.
- **PWA**: `vite-plugin-pwa`، `registerType: 'autoUpdate'` (تحديث صامت
  للـservice worker بدون سؤال المستخدم)، manifest بالعربي ("نظام
  الفخامة لإدارة المطاعم" / "Fakhama POS").
- **الاختبارات**: Vitest 4 + Testing Library + jsdom.
- **بروكسي التطوير**: `vite.config.ts` بيوجّه `/api` لـ`http://127.0.0.1:8000`
  محليًا؛ الإنتاج بيستخدم `VITE_API_URL=http://192.168.2.250:8095/api`.

---

## 2. بنية المشروع (`src/`)

```
src/
  api/            axios instance(s) + مساعدات API فردية
  auth/           سياق المصادقة، تخزين التوكن، الحراس، ثوابت الصلاحيات
  components/     معظم واجهة التطبيق، منظمة حسب المجال الوظيفي
  features/       نمط "وحدات وظيفية" أحدث — حاليًا crm/ بس
  hooks/          hooks مخصصة لجلب بيانات كل مجال (useMenu، useOrders...)
  pages/          صفحات مستوى-الراوت مش تابعة لمجلد components فرعي
  services/       ملف خدمة API واحد لكل مورد بالباك إند تقريبًا
  types/          أنواع TypeScript مشتركة
  utils/          آليات أمان الأجهزة (posSecurity، hospitalitySecurity...)
  App.tsx         إعداد الراوتر كامل + الحراس
  store.tsx       (بجذر المشروع) المتجر المركزي (Zustand)
```

**أهم مجلدات `components/`**:

| المجلد | المحتوى |
|---|---|
| `POS/` | واجهة كاشير نقطة البيع (سجل/سلة/منيو/طاولات/شفت) |
| `Hospitality/` | نسخة موازية لـPOS مخصصة لخدمة الطاولات (نادل/مضيف) |
| `administration/` | البوابة الخلفية الكاملة — أكبر مجلد بكثير (تفصيل قسم 6) |
| `call-center/` | مساحة عمل وكيل مركز الاتصال |
| `customer/` | تدفق الطلب عبر QR-code للعميل (بدون تسجيل دخول) |
| `financial/` | نموذج/قائمة الفاتورة المالية القديمة |
| `sales-invoices/` | وحدة فواتير المبيعات الأحدث |
| `quotes/` | عروض الأسعار |
| `shared/` | مكونات مشتركة: ConfirmModal، DynamicCRUDTable، ThemeToggle، Toast |

---

## 3. التوجيه (`src/App.tsx`)

معظم الراوتس `lazy()` جوا `<Suspense>` واحدة.

- **عام (بدون تسجيل دخول)**: `/login`, `/unauthorized`,
  `/customer/:qrCode` (+ `/menu`, `/cart`) — تدفق طلب العميل عبر QR.
- **بعد `ProtectedRoute`**، كل شجرة محمية إضافيًا بـ`RoleGuard` (فحص
  أدوار محلي بـApp.tsx):
  - `/admin/*` — أدوار: `SUPER_ADMIN, ACCOUNTANT, BRANCH_MANAGER`.
    قائمة راوتس ضخمة ومسطّحة (فروع، أقسام، منيو، طلبات، مبيعات، عملاء،
    موردين، موظفين، تقارير، محاسبة، مستخدمين، صلاحيات، أجهزة نقطة
    بيع/hospitality/call-center، مناطق الصالة...). معظمها بالحقيقة
    **نفس المكون** (`FinanceView`/`AccountingView`) بيقرأ آخر جزء من
    الـURL ويحوّله لـ`initialView`/`initialTab` — يعني "راوتس" كتير
    هي فعليًا حالة داخلية لمكون واحد، مش صفحات منفصلة فعليًا.
  - `/admin/crm/*` — حارس منفصل `CrmRouteGuard` (من `features/crm`).
  - `/pos/*` — `POSLayout`، أدوار: `CASHIER, HOSPITALITY, DEPT_STAFF, SUPER_ADMIN, ACCOUNTANT, BRANCH_MANAGER`.
  - `/Hospitality/*` (ملاحظة: H كبيرة) — `HospitalityLayout`.
  - `/call-center/*` — `CallCenterLayout` + `CallCenterGuard` إضافي
    (تفعيل الجهاز).
  - `/shift`, `/admin/day-close`, `/admin/reconciliation` — راوتس
    مستقلة خارج الأشجار المحمية بالأدوار.
- `*` → صفحة 404 مخصصة.

### حراس الأجهزة (Device Guards) — ⚠️ ملاحظة مهمة

- `PosRouteGuard` (`components/POS/PosRouteGuard.tsx`) موجود بالكود
  (يفحص `pos_device_uuid` وينادي `/pos/check-status`) **بس مش موصول
  فعليًا** بشجرة `/pos/*` بـ`App.tsx` — الراوتس هناك محمية بـ`RoleGuard`
  بس. إنفاذ تفعيل جهاز الكاشير شكله حاصل بمكان تاني (جوا `pos.tsx` نفسه،
  أو عبر إعادة توجيه الـaxios interceptor عند 403).
- `CallCenterGuard` موصول فعليًا وبيعرض `CallCenterActivationPage`
  مباشرة (مش redirect) لو الجهاز مش مفعّل.
- Hospitality إلها `HospitalityActivationPage.tsx` بس بدون حارس راوت
  مخصص واضح جنبها — على الأغلب نفس أسلوب POS الضمني.

---

## 4. إدارة الحالة

### ⚠️ ملاحظة مهمة: مفهومين متوازيين لـ"المستخدم الحالي"

- **Zustand `store.tsx`** (بجذر المشروع) — متجر ضخم واحد بيغطي تقريبًا
  كل حالة التطبيق المشتركة: `currentUser`/`isLoggedIn`/`login`/`logout`،
  الفروع والأقسام، الأصناف، مناطق/طاولات الصالة، الطلبات، الشفتات،
  الموظفين، العملاء.
- **`src/auth/AuthContext.tsx`** — React Context **منفصل تمامًا**،
  بيدير `user`/`isLoggedIn`/`login`/`logout` بشكل مستقل، مدعوم بمفاتيح
  localStorage مختلفة (`src/auth/authStorage.ts`).

**يعني فيه نسختين مستقلتين من "هل المستخدم مسجّل دخول ومين هو"** —
لازم توضيح أي وحدة هي المرجع الفعلي لأي جزء بالتطبيق قبل أي تعديل
كبير على منطق المصادقة، وإلا سهل يصير تناقض (مثلاً تسجيل خروج من
وحدة بينسى الثانية).

---

## 5. المصادقة والصلاحيات

**التدفق**: `AuthProvider` بيغلّف التطبيق، بينادي `fetchUser()` عند
التحميل (يقرأ `token` من localStorage، بينادي `GET /auth/me`). `login()`
بينادي `POST /login` ويحفظ `{token, roles, permissions, user}`.
**تخزين التوكن**: localStorage عادي (`token`, `roles`, `permissions`,
`branch_id`) — بدون تشفير أو IndexedDB (بعكس هوية جهاز POS، قسم 8).

**مكون `<Can permission="x">`** (`src/auth/Can.tsx`): بيعرض المحتوى بس
لو `useAuth().hasPermission(permission)` صح، وإلا `fallback` (افتراضي
`null`). فيه `useCan(permission)` hook للفحص البرمجي. `ProtectedRoute`
هو النسخة الكاملة-الصفحة (redirect بدل إخفاء).

### `src/auth/permissions.ts` — المحتوى الكامل

**الأدوار (7)**: `SUPER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`,
`CASHIER`, `HOSPITALITY`, `DEPT_STAFF`, `CALL_CENTER`.

**الصلاحيات (23)**: `MANAGE_BRANCHES`, `MANAGE_DEPARTMENTS`,
`MANAGE_ITEMS`, `MANAGE_EMPLOYEES`, `VIEW_ACCOUNTING`,
`MANAGE_ACCOUNTING`, `MANAGE_ORDERS`, `VIEW_ORDERS`, `VIEW_REPORTS`,
`MANAGE_SETTINGS`, `VIEW_AUDIT_LOG`, `VIEW_ARCHIVE`, `MANAGE_CUSTOMERS`,
`MANAGE_SUPPLIERS`, `MANAGE_INVOICES`, `MANAGE_USERS`,
`MANAGE_POS_REGISTERS`, `MANAGE_HOSPITALITY_DEVICES`,
`MANAGE_DINING_ZONES`, `ACCESS_POS_INTERFACE`, `MANAGE_DISCOUNTS`,
`MANAGE_CALL_CENTER`, `ACCESS_CALL_CENTER_INTERFACE`,
`MANAGE_CALL_CENTER_DEVICES`.

**`CRM_PERMISSIONS`** (نطاق منفصل وأحدث): `ACCESS` ("crm.access"),
`VIEW_CUSTOMER_FINANCIAL` ("crm.view-customer-financial").

**⚠️ `ROLE_PERMISSIONS`** بالملف موسوم صراحة بتعليق "مرجعي فقط" —
الربط الفعلي بيصير بالـseeder على الباك إند. لاحظ إنه
`MANAGE_USERS`و`ACCESS_POS_INTERFACE` معرّفين كصلاحيات بس مش مربوطين
بأي دور بهاد الخريطة المرجعية، و`CRM_PERMISSIONS` مش مذكورة فيها
إطلاقًا. **لا تعتمد هاد الملف كمصدر وحيد للحقيقة** — راجع
`docs/PROJECT.md` بريبو الباك إند (قسم 2.2) بخصوص هاي النقطة بالذات.

---

## 6. المناطق الوظيفية الرئيسية

### `POS/` — كاشير نقطة البيع
`pos.tsx` (1626 سطر، الشاشة الرئيسية)، `CartPanel.tsx` (1315 سطر —
السلة/الخصومات/الدفع)، `Tables.tsx` (1522 سطر)، `MenuGrid.tsx`،
`Shift.tsx`، `POSActivationPage.tsx`. اختيار أصناف، سلة/دفع، تبويبات
عميل/فاتورة، فتح/إغلاق شفت، تعيين طاولة، تفعيل الجهاز.

### `Hospitality/` — خدمة الطاولات
`HospitalityPOS.tsx` (1531 سطر)، `Tables.tsx` (1565 سطر) — نسخة موازية
شبه مكررة من POS/ مخصصة لسير عمل النادل/المضيف (تفصيل تكرار بقسم 11).

### `administration/` — البوابة الخلفية (أكبر منطقة بكثير)
تطبيق ERP خلفي كامل تقريبًا داخل مجلد واحد:
- `BranchesPage/`, `Departments/`, `Items/` (شجرة منيو/أصناف)
- `EmployeeManagement/` + `employees/` (**تطبيقين منفصلين** لإدارة
  الموظفين — قسم 11)
- `customers/`, `suppliers/` (دفاتر مالية + بوابات)
- `discounts/` (`DiscountManagementPortal` **و**`...V2` جنب بعض)
- `OrgStructure/` (شجرة تنظيمية: فروع/أقسام/وظائف/موظفين)
- `GL/` — **تطبيق فرعي كامل للمحاسبة**: `AccountingPortal.tsx` (1747
  سطر)، `GLSubViews.tsx` (1748 سطر)، `ARAPCashTabs.tsx` (1302 سطر)،
  قيود اليومية، أدراج فواتير، سُلف/كشوفات موظفين
- سندات، فواتير شراء، سنوات مالية، إغلاق يومي/تسوية، إدارة طابعات،
  سجل تدقيق، أرشيف، إعدادات، صفحات اختبار PBX

### `call-center/` — مركز الاتصال
`CallCenterPOS.tsx` (طلبات هاتفية)، `CustomerProfileDrawer.tsx` (1157
سطر)، `CallCenterCustomerAccountTab.tsx` (1047 سطر)،
`ComplaintsManagement.tsx`, `OccasionsPage.tsx`, `CrmDirectoryPage.tsx`.
متكامل مع FreePBX (راجع `docs/PRINTING.md`... لأ — `docs/PROJECT.md`
قسم 7 بريبو الباك إند لتفاصيل FreePBX).

### `customer/` — طلب العميل عبر QR (بدون تسجيل دخول)
`cart-provider.tsx`, `CustomerTableProvider.tsx`,
`menu-item-card(-grid).tsx`, `call-waiter.tsx`, `order-tracker.tsx`,
`TableWaitingPage.tsx`.

### `features/crm/` — وحدة CRM أحدث ومنفصلة
`CrmShell.tsx`, `Customer360Page.tsx`, `CrmRouteGuard.tsx`, وتبويبات
(`OverviewTab`, `OrdersTab`, `FinancialTab`, `AddressesTab`,
`ComplaintsTab`, `NotesOccasionsTab`) — عرض "بروفايل عميل 360°"، منفصل
عن شاشات `administration/customers/` الأقدم.

### `financial/` و`sales-invoices/`
نظامين فوترة منفصلين — `financial/` (الأقدم/الأبسط) مقابل
`sales-invoices/` (الأحدث، مع `CustomerSelector`, `ItemPickerModal`).

### `quotes/`
`QuoteFormPage.tsx` (1230 سطر)، `QuotesListPage.tsx`.

---

## 7. طبقة الـAPI

### `src/api/axios.ts` — الـinstance الرئيسي (`api`)

- `baseURL`, `withCredentials: true`, `timeout: 20000` (بتعليق صريح:
  بدون timeout كانت الواجهة تعلّق للأبد لو طابعة غير قابلة للوصول).
- **Request interceptor**: يرفق `Authorization: Bearer <token>`، ويرفق
  `X-Device-UUID` باختيار **بحسب أولوية**:
  `call_center_device_uuid` > `hospitality_device_uuid` > `pos_device_uuid`
  (أي واحد موجود بالـlocalStorage) — نفس الهيدر بيتشارك بين الأنظمة
  الثلاثة.
- **Response interceptor**:
  - `401` → مسح بيانات المصادقة بدون إعادة توجيه إجباري (تفادي حلقة
    إعادة تحميل — الحراس بـReact Router هم يلي بيقرروا التوجيه).
  - `403` → لو الطلب الفاشل نفسه طلب تفعيل/فحص حالة جهاز
    (`/call-center/check-status`, `/hospitality/check-status`,
    `/pos/check-status`) وتأكد الـUUID المرسل يطابق المخزّن، بيمسح
    مفاتيح هاد الجهاز بالتحديد ويعمل `window.location.href` قسري
    لصفحة التفعيل المناسبة.
- ⚠️ فيه **محاكاة خصومات مضمّنة** (`getDiscountMockHandler` + `require("./discountApiMock")`)
  وردود وهمية مكتوبة يدويًا لمسارات `aging-report`/`collection-report`
  — شكلها بقايا تطوير من قبل ما هاي النقاط النهائية تصير موجودة فعليًا
  بالباك إند. يستاهل تنضيف أو تأكيد إنها لسا لازمة.

### `src/services/` (~30 ملف، ملف واحد تقريبًا لكل مورد بالباك إند)

أهمها: `orderService.ts` (1021 سطر)، `discountEngine.ts` (874 سطر —
منطق حساب خصومات من جهة العميل، إله اختبار مستبعد من التشغيل التلقائي
— راجع قسم 10)، `menuService.ts`, `customerTableService.ts`,
`financeService.ts` + `accounting/` (فرعي)، `voucherService.ts`,
`purchaseBillService.ts`, `settlementService.ts`, `salesInvoiceService.ts`,
`callCenterOrderWorkflow.ts`, `callTicketService.ts`, `branchService.ts`,
`departmentService.ts`, `employeeService.ts`, `supplierService.ts`,
`customerService.ts`, `itemService.ts`, `printerService.ts`,
`soundService.ts`, `shiftService.ts`, `quoteService.ts`.

---

## 8. آلية هوية جهاز نقطة البيع (device identity)

`src/utils/posSecurity.ts` — **ليست تشفير**، هي تخزين مضاعف
(localStorage + IndexedDB) لضمان البقاء ضد مسح جزئي للكاش:

- `saveDeviceUUIDSecurely()`/`getDeviceUUIDSecurely()` — يكتب/يقرأ من
  **الاثنين مع بعض** (`pos_device_uuid` بـlocalStorage +
  IndexedDB قاعدة `POS_Secure_Storage`)، مع "شفاء ذاتي": لو وحدة فاضية
  والثانية فيها قيمة، بيعبّي الفاضية من الممتلئة تلقائيًا.
- `saveRegisterInfoSecurely()`/`getRegisterInfoSecurely()` — نفس
  النمط لمعلومات تفعيل المحطة (`pos_register_info`) — أُضيف تحديدًا
  (حسب تعليق بالكود) لأنه هاي المعلومة كانت تضيع عند مسح الكاش رغم
  إنه الـUUID نفسه كان ينجو عبر IndexedDB.
- `clearDeviceUUIDSecurely()` — يمسح الاثنين، وبس المفروض يشتغل لما
  الأدمن يلغي تفعيل الجهاز صراحة من لوحة التحكم.

⚠️ **نفس المنطق بالضبط مكرر 3 مرات**: `hospitalitySecurity.ts` و
`callCenterSecurity.ts` نسخ شبه متطابقة (بس أسماء قاعدة IndexedDB
ومفاتيح localStorage مختلفة). مرشح واضح لاستخراج utility مشتركة واحدة
بدل التكرار.

---

## 9. البناء والنشر

- `npm run build` → `vite build` → `dist/`.
- **nginx** (`/etc/nginx/sites-available/o2-front`): بورت **8095**،
  `root /var/www/o2-company-front/dist`، SPA fallback
  (`try_files $uri $uri/ /index.html`).
- **⚠️ لا يوجد مزامنة تلقائية بين الكود المصدري والنشر**: أي `vite build`
  (حتى لو للتحقق فقط) بيكتب فوق `dist/` المنشور فعليًا على nginx —
  يعني بناء تجريبي بينشر مباشرة على الإنتاج بدون خطوة تأكيد إضافية.
  انتبه لهاد قبل أي `npm run build` على هاد السيرفر.
- **Service Worker**: `registerType: 'autoUpdate'` — تحديث صامت، ممكن
  يحتاج تحديث/إعادة فتح تبويب المتصفح مرة وحدة قبل ما يفعل فعليًا (متصفح
  POS مفتوح طول اليوم بدون إعادة تحميل ممكن يضل يشتغل بكود قديم لفترة).

---

## 10. الاختبارات

Vitest — ملفات مبعثرة جوا `src/` (مش مجلد `tests/` موحّد):
- `src/tests/discountEngine.test.ts` — **مستبعد فعليًا من تشغيل
  الاختبارات** (`vitest run --exclude "**/discountEngine.test.ts"`
  بـ`package.json`) — على الأغلب معطّل/بطيء/متجاوز حاليًا.
- `services/callCenterOrderWorkflow.test.ts` +
  `.checkout.test.ts`, `components/call-center/CallCenterInvoiceInfoTab.test.tsx`,
  `customerFlow.test.ts`, `customerProfileOverview.test.ts`.

التغطية ضعيفة جدًا ومركّزة بس على مجال مركز الاتصال/الخصومات — POS،
Hospitality، الإدارة/GL، المصادقة، وتدفق طلب العميل عبر QR **بدون أي
اختبار**.

---

## 11. ملاحظات تقنية وديون تقنية

### تكرار مكونات حقيقي (مرشح لتوحيد لاحقًا، مش عطل فوري)

| الأول | الثاني |
|---|---|
| `components/POS/Tables.tsx` (1522 سطر) | `components/Hospitality/Tables.tsx` (1565 سطر) |
| `pages/BranchesPage.tsx` | `components/administration/BranchesPage/BranchesPage.tsx` |
| `components/administration/DepartmentsPage.tsx` | `components/administration/Departments/DepartmentsPage.tsx` |
| `components/administration/employees/EmployeePortal.tsx` | `components/administration/EmployeeManagement/` (كامل) |
| `discounts/DiscountManagementPortal.tsx` | `discounts/DiscountManagementPortalV2.tsx` (جنب بعض) |
| `*Page.tsx` لصفحات PBX | `*View.tsx` المقابلة (الـApp.tsx بيستورد النسخة `*View` بس — نسخ `*Page` غالبًا كود ميت) |
| `posSecurity.ts` | `hospitalitySecurity.ts` و`callCenterSecurity.ts` (نفس المنطق حرفيًا 3 مرات) |

### أكبر الملفات بالمشروع (أولوية لو بدك تقسّم/تبسّط)

`administration/DiningTablesDashboard.tsx` (1882 سطر، الأكبر بالمشروع)،
`administration/GL/GLSubViews.tsx` (1748)،
`administration/GL/AccountingPortal.tsx` (1747)،
`Hospitality/Tables.tsx` (1565)، `Hospitality/HospitalityPOS.tsx` (1531)،
`POS/Tables.tsx` (1522)، `administration/SalesInvoicesPage.tsx` (1425)،
`administration/GL/ARAPCashTabs.tsx` (1302)، `quotes/QuoteFormPage.tsx` (1230)،
`call-center/CustomerProfileDrawer.tsx` (1157).

### تنظيف مرشّح

- `vite.config.ts.timestamp-*.mjs` وملف فاضي اسمه `vite` (0 بايت) —
  مخلّفات بناء/تطوير بجذر المشروع.
- `src/api/axios.js` — نسخة JS عادية موازية لـ`axios.ts` — تأكد أي
  وحدة فعليًا مستخدمة قبل ما تحذف أي وحدة.
- ملفات `.md` تحليل بجذر المشروع (`CRM_CURRENT_SYSTEM_ANALYSIS.md`,
  `STATEMENT_ANALYSIS.md`, `STATEMENT_CUSTOMER_SUPPLIER_PARITY_AUDIT.md`,
  `STATEMENT_IMPLEMENTATION_REPORT.md`, `troubleshooting_guide.txt`) —
  تقارير تحليل سابقة تستاهل تنتقل لمجلد `docs/` بدل تبعثرها بالجذر.
- اسم ملف فيه مسافة زايدة قبل الامتداد:
  `components/administration/Departments/Departmentsheader .tsx`.

### ملاحظة عامة

التطبيق عربي بالكامل واتجاهه RTL (`dir="rtl"`) بكل مكان — أي إضافة UI
جديدة لازم تحترم هاد الاتجاه من البداية (راجع أيضًا ملاحظة container
queries بقسم "الطباعة والفرونت إند" بـ`docs/PRINTING.md` بريبو الباك
إند، خاصة لصفحة POS تحديدًا).
