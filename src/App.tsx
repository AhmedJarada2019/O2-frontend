/**
 * App.tsx — النسخة المُصحّحة
 * 1. تحويل تلقائي بعد Login حسب الدور
 * 2. حماية مسارات Admin بالدور (role)
 * 3. تحديث المحتوى عند تغيير الرابط (key prop)
 */

import React, { useEffect, useState, Suspense, lazy } from "react";
import { sound } from "./services/soundService";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  AuthProvider,
  useAuth,
  ProtectedRoute,
  UnauthorizedPage,
} from "./auth";
import { ROLES } from "./auth/permissions";

// ── مكونات خفيفة/هيكلية تبقى محمّلة فوراً (layouts, guards, providers) ──
import { Login } from "./components/Login";
import { AdminLayout } from "./components/administration/Layout";
import { POSLayout } from "./components/POS/Layout";
import { HospitalityLayout } from "./components/Hospitality/Layout";
import { ToastContainer } from "./components/shared/Toast";
import { CartProvider } from "./components/customer/cart-provider";
import { CustomerTableProvider } from "./components/customer/CustomerTableProvider";
import { ThemeProvider } from "./theme";
import { CrmRouteGuard } from "./features/crm";
import { CallCenterLayout } from "./components/call-center/Layout";
import CallCenterGuard from "./components/call-center/CallCenterGuard";
import PosRouteGuard from "./components/POS/PosRouteGuard";

// ── صفحات/مكونات ثقيلة — تُحمَّل فقط عند زيارة الراوت الخاص فيها (code-splitting) ──
const FinancePortal = lazy(() => import("./components/administration/FinancePortal").then(m => ({ default: m.FinancePortal })));
const AccountingPortal = lazy(() => import("./components/administration/GL/AccountingPortal").then(m => ({ default: m.AccountingPortal })));
const POS = lazy(() => import("./components/POS/pos").then(m => ({ default: m.POS })));
const AdminPOSWrapper = lazy(() => import("./components/POS/AdminPOSWrapper"));
const TablesView = lazy(() => import("./components/POS/Tables").then(m => ({ default: m.TablesView })));
const DeferredTables = lazy(() => import("./components/POS/DeferredTables"));
const OrdersView = lazy(() => import("./components/POS/Orders").then(m => ({ default: m.OrdersView })));
const ShiftView = lazy(() => import("./components/POS/Shift").then(m => ({ default: m.ShiftView })));
const HospitalityPOS = lazy(() => import("./components/Hospitality/HospitalityPOS").then(m => ({ default: m.HospitalityPOS })));
const HospitalityOrders = lazy(() => import("./components/Hospitality/HospitalityOrders").then(m => ({ default: m.HospitalityOrders })));
const HospitalityTables = lazy(() => import("./components/Hospitality/Tables").then(m => ({ default: m.HospitalityTables })));
const FinancialInvoicesPage = lazy(() => import("./components/financial/FinancialInvoicesPage").then(m => ({ default: m.FinancialInvoicesPage })));
const SalesInvoiceListPage = lazy(() => import("./components/sales-invoices").then(m => ({ default: m.SalesInvoiceListPage })));
const SalesInvoiceFormPage = lazy(() => import("./components/sales-invoices").then(m => ({ default: m.SalesInvoiceFormPage })));
const UsersManagementPage = lazy(() => import("./pages/UsersManagementPage"));
const PosRegistersPage = lazy(() => import("./pages/PosRegistersPage"));
const CallCenterDevicesPage = lazy(() => import("./pages/CallCenterDevicesPage"));
const PrintersManagement = lazy(() => import("./components/administration/printers-management").then(m => ({ default: m.PrintersManagement })));
const HospitalityDevicesPage = lazy(() => import("./pages/HospitalityDevicesPage"));
const DiningZonesPage = lazy(() => import("./pages/DiningZonesPage"));
const DiningTablesDashboard = lazy(() => import("./components/administration/DiningTablesDashboard"));
const MenuPage = lazy(() => import("./pages/customer/MenuPage"));
const CartPage = lazy(() => import("./pages/customer/CartPage"));
const TablePage = lazy(() => import("./pages/customer/TablePage"));
const RolesPermissionsPage = lazy(() => import("./pages/RolesPermissionsPage"));
const DepartmentsPage = lazy(() => import("./components/administration/DepartmentsPage"));
const DayClosePage = lazy(() => import("./components/administration/DayClosePage").then(m => ({ default: m.DayClosePage })));
const ReconciliationBoard = lazy(() => import("./components/administration/ReconciliationBoard").then(m => ({ default: m.ReconciliationBoard })));
const ShiftClosingsPage = lazy(() => import("./components/administration/ShiftClosingsPage").then(m => ({ default: m.ShiftClosingsPage })));
const BusinessDayClosingPage = lazy(() => import("./components/administration/BusinessDayClosingPage").then(m => ({ default: m.BusinessDayClosingPage })));
const FiscalYearsPage = lazy(() => import("./components/administration/FiscalYearsPage").then(m => ({ default: m.FiscalYearsPage })));
const FiscalYearOverview = lazy(() => import("./components/administration/FiscalYearOverview").then(m => ({ default: m.FiscalYearOverview })));
const QuotesView = lazy(() => import("./components/quotes/QuotesView").then(m => ({ default: m.QuotesView })));
const VouchersView = lazy(() => import("./components/administration/VouchersView").then(m => ({ default: m.VouchersView })));
const CustomerVouchersView = lazy(() => import("./components/administration/CustomerVouchersView").then(m => ({ default: m.CustomerVouchersView })));
const SupplierVouchersView = lazy(() => import("./components/administration/SupplierVouchersView").then(m => ({ default: m.SupplierVouchersView })));
const SupplierPaymentVouchersView = lazy(() => import("./components/administration/SupplierPaymentVouchersView").then(m => ({ default: m.SupplierPaymentVouchersView })));
const PurchaseBillsView = lazy(() => import("./components/administration/PurchaseBillsView").then(m => ({ default: m.PurchaseBillsView })));
const ExtensionsTestView = lazy(() => import("./components/administration/ExtensionsTestView").then(m => ({ default: m.ExtensionsTestView })));
const PbxExtensionsTestView = lazy(() => import("./components/administration/PbxExtensionsTestView").then(m => ({ default: m.PbxExtensionsTestView })));
const PbxRecordingsView = lazy(() => import("./components/administration/PbxRecordingsView").then(m => ({ default: m.PbxRecordingsView })));
const FreePBXTestPage = lazy(() => import("./pages/FreePBXTestPage"));
const CrmShell = lazy(() => import("./features/crm").then(m => ({ default: m.CrmShell })));
const CrmDashboardPage = lazy(() => import("./features/crm").then(m => ({ default: m.CrmDashboardPage })));
const CrmCustomersPage = lazy(() => import("./features/crm").then(m => ({ default: m.CrmCustomersPage })));
const Customer360Page = lazy(() => import("./features/crm").then(m => ({ default: m.Customer360Page })));

// ── مكونات الكول سنتر ──
const CustomerManagementDashboard = lazy(() => import("./components/call-center/CustomerManagementDashboard").then(m => ({ default: m.CustomerManagementDashboard })));
const CrmDirectoryPage = lazy(() => import("./components/call-center/CrmDirectoryPage").then(m => ({ default: m.CrmDirectoryPage })));
const CustomerPhoneSearch = lazy(() => import("./components/call-center/CustomerPhoneSearch").then(m => ({ default: m.CustomerPhoneSearch })));
const ComplaintsManagement = lazy(() => import("./components/call-center/ComplaintsManagement").then(m => ({ default: m.ComplaintsManagement })));
const OccasionsPage = lazy(() => import("./components/call-center/OccasionsPage").then(m => ({ default: m.OccasionsPage })));
const TopCustomersTable = lazy(() => import("./components/call-center/TopCustomersTable").then(m => ({ default: m.TopCustomersTable })));
const CallCenterEmployees = lazy(() => import("./components/call-center/CallCenterEmployees").then(m => ({ default: m.CallCenterEmployees })));
const CallCenterPOS = lazy(() => import("./components/call-center/CallCenterPOS").then(m => ({ default: m.CallCenterPOS })));
const ActiveOrdersPage = lazy(() => import("./components/call-center/ActiveOrdersPage").then(m => ({ default: m.ActiveOrdersPage })));

/** يظهر أثناء تحميل جزء من الشاشة (route) بشكل كسول */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  حماية الأدوار — تمنع الوصول لمن لا يملك الدور المطلوب
 * ══════════════════════════════════════════════════════════════ */

/** الأدوار المسموح بها في مسارات /admin/* */
const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.BRANCH_MANAGER];

/** الأدوار المسموح بها في مسارات /pos/* */
const POS_ROLES = [
  ROLES.CASHIER,
  ROLES.HOSPITALITY,
  ROLES.DEPT_STAFF,
  ROLES.SUPER_ADMIN,
  ROLES.ACCOUNTANT,
  ROLES.BRANCH_MANAGER,
];

/** الأدوار المسموح بها في مسارات /Hospitality/* */
const HOSPITALITY_ROLES = [
  ROLES.HOSPITALITY,
  ROLES.SUPER_ADMIN,
  ROLES.ACCOUNTANT,
  ROLES.BRANCH_MANAGER,
];

/** الأدوار المسموح بها في مسارات /call-center/* */
const CALL_CENTER_ROLES = [
  ROLES.CALL_CENTER,
  ROLES.SUPER_ADMIN,
  ROLES.ACCOUNTANT,
  ROLES.BRANCH_MANAGER,
];

/**
 * RoleGuard — layout route يفحص الدور ثم يعرض المحتوى عبر Outlet
 * لا يلف المحتوى بـ children بل يستخدم Outlet (النمط الصحيح في React Router)
 */
function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = user.roles.some((r) => allowedRoles.includes(r));

  if (!hasAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

/* ══════════════════════════════════════════════════════════════
 *  صفحات مساعدة (Wrappers) — تمرر المعاملات الصحيحة للمكونات
 * ══════════════════════════════════════════════════════════════ */

/** تحويل مسار URL إلى initialView لـ FinancePortal */
const financeViewMap: Record<string, string> = {
  dashboard: "DASHBOARD",
  branches: "BRANCHES",
  departments: "DEPARTMENTS",
  menu: "MENU",
  "item-tree": "ITEM_TREE",
  "items-index": "ITEMS_INDEX",
  orders: "ORDERS",
  sales: "SALES",
  customers: "CUSTOMERS",
  suppliers: "SUPPLIERS",
  employees: "EMPLOYEES",
  accounting: "ACCOUNTING",
  reports: "REPORTS",
  audit: "AUDIT_LOG",
  archive: "ARCHIVE",
  settings: "SETTINGS",
  orgstructure: "ORGSTRUCTURE",
  "financial-invoices": "FINANCIAL_INVOICES",
  discounts: "DISCOUNTS",
  "shift-day-closing": "SHIFT_DAY_CLOSING",
};

/**
 * FinanceView — يقرأ الـ view مباشرة من الرابط (useLocation)
 * هذا يضمن تحديث المحتوى عند تغيير الرابط
 */
function FinanceView() {
  const location = useLocation();
  // استخراج الجزء الأخير من الرابط: /admin/branches → "branches"
  const pathParts = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1] || "dashboard";
  const mapped = financeViewMap[lastSegment] || "DASHBOARD";
  return <FinancePortal key={lastSegment} initialView={mapped as any} />;
}

/** AccountingView — يقرأ الـ tab مباشرة من الرابط */
function AccountingView() {
  const location = useLocation();
  const pathParts = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1] || "dashboard";
  const tabMap: Record<string, string> = {
    dashboard: "DASHBOARD",
    gl: "GL",
    ar: "AR",
    ap: "AP",
    cash: "CASH",
    hr: "HR",
  };
  return (
    <AccountingPortal
      key={lastSegment}
      initialTab={tabMap[lastSegment] as any}
    />
  );
}

/** SalesInvoicesView — page-based list ↔ form for new sales invoices module */
function SalesInvoicesView() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<number | undefined>(undefined);

  const handleOpenForm = (id?: number) => {
    setEditId(id);
    setView("form");
  };

  const handleBack = () => {
    setView("list");
    setEditId(undefined);
  };

  if (view === "form") {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar">
        <SalesInvoiceFormPage
          invoiceId={editId}
          onBack={handleBack}
          onSaved={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <SalesInvoiceListPage onOpenForm={handleOpenForm} />
    </div>
  );
}

/** صفحة 404 مخصصة */
function NotFoundPage() {
  return (
    <div
      className="min-h-screen bg-slate-950 flex items-center justify-center text-white"
      dir="rtl"
    >
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-black text-red-600">404</h1>
        <p className="text-slate-400 text-lg">الصفحة غير موجودة</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
        >
          العودة للرئيسية
        </a>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  تعريف المسارات (Routes)
 * ══════════════════════════════════════════════════════════════ */

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* ── مسارات عامة ── */}
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* ── مسارات عامة ── */}
      <Route path="/freepbx/test" element={<FreePBXTestPage />} />

     {/* ══════════════════════════════════════════════════════════════
    * مسارات طلبات الطاولات عبر الـ QR Code (عامة للزبائن بدون تسجيل دخول)
    * ══════════════════════════════════════════════════════════════ */}
    <Route 
      path="/customer/:qrCode" 
      element={
        <CustomerTableProvider>
          <Outlet />
        </CustomerTableProvider>
      }
    >
      {/* الصفحة الرئيسية للطاولة عند مسح الـ QR مباشرة */}
      <Route index element={<TablePage />} /> 

      <Route path="menu" element={<MenuPage />} />
      <Route path="cart" element={<CartPage />} />
    </Route>

      {/* ── مسارات محمية (تحتاج تسجيل دخول فقط) ── */}
      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        {/* ═══ مسارات الإدارة العامة ═══
            RoleGuard يفحص الدور → AdminLayout يعرض السايد بار → FinanceView يعرض المحتوى
        */}
        <Route element={<AdminLayout />}>
          <Route
            path="/admin/crm"
            element={<CrmRouteGuard><CrmShell /></CrmRouteGuard>}
          >
            <Route index element={<CrmDashboardPage />} />
            <Route path="customers" element={<CrmCustomersPage />} />
            <Route path="customers/:customerId/*" element={<Customer360Page />} />
          </Route>
        </Route>
        <Route element={<RoleGuard allowedRoles={ADMIN_ROLES} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin">
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<FinanceView />} />
              <Route path="branches" element={<FinanceView />} />
              <Route path="departments" element={<DepartmentsPage />} />
              <Route path="menu" element={<FinanceView />} />
              <Route path="item-tree" element={<FinanceView />} />
              <Route path="items-index" element={<FinanceView />} />
              <Route path="orders" element={<FinanceView />} />
              <Route path="sales" element={<FinanceView />} />
              <Route path="customers" element={<FinanceView />} />
              <Route path="suppliers" element={<FinanceView />} />
              <Route path="employees" element={<FinanceView />} />
              <Route path="reports" element={<FinanceView />} />
              <Route path="audit" element={<FinanceView />} />
              <Route path="archive" element={<FinanceView />} />
              <Route path="settings" element={<FinanceView />} />
              <Route path="orgstructure" element={<FinanceView />} />
              <Route path="financial-invoices" element={<FinanceView />} />
              <Route path="sales-invoices" element={<SalesInvoicesView />} />
              <Route path="quotes" element={<QuotesView />} />
              <Route path="vouchers" element={<VouchersView />} />
              <Route
                path="vouchers/customers"
                element={<CustomerVouchersView />}
              />
              <Route
                path="vouchers/suppliers"
                element={<SupplierVouchersView />}
              />
              <Route
                path="supplier-payment-vouchers"
                element={<SupplierPaymentVouchersView />}
              />
              <Route path="purchase-bills" element={<PurchaseBillsView />} />
              <Route path="extensions-test" element={<ExtensionsTestView />} />
              <Route path="pbx-extensions" element={<PbxExtensionsTestView />} />
              <Route path="pbx-recordings" element={<PbxRecordingsView />} />
              <Route path="discounts" element={<FinanceView />} /> 
              <Route path="shift-day-closing" element={<FinanceView />} />
              <Route path="shift-closings" element={<ShiftClosingsPage />} />
              <Route path="fiscal-years" element={<FiscalYearsPage />} />
              <Route path="fiscal-years/:id" element={<FiscalYearOverview />} />
              <Route path="business-day" element={<BusinessDayClosingPage />} />
              <Route path="printers" element={<PrintersManagement />} />
              <Route path="accounting">
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path=":tab" element={<AccountingView />} />
              </Route>
              <Route path="users" element={<UsersManagementPage />} />
              <Route path="permissions" element={<RolesPermissionsPage />} />
              <Route path="pos-registers" element={<PosRegistersPage />} />
              <Route
                path="hospitality-devices"
                element={<HospitalityDevicesPage />}
              />
              <Route
                path="call-center-devices"
                element={<CallCenterDevicesPage />}
              />
              <Route path="dining-zones" element={<DiningZonesPage />} />
              <Route path="dining-dashboard" element={<DiningTablesDashboard />} />
              <Route path="pos" element={<AdminPOSWrapper />} />
            </Route>
          </Route>
        </Route>

        {/* ═══ مسارات نقطة البيع ═══
            RoleGuard يفحص الدور → POSLayout يعرض السايد بار
        */}
        <Route element={<RoleGuard allowedRoles={POS_ROLES} />}>
          <Route element={<PosRouteGuard />}>
            <Route element={<POSLayout />}>
              <Route path="/pos">
                <Route index element={<POS onViewTables={() => {}} />} />
                <Route path="orders" element={<OrdersView />} />
                <Route path="tables" element={<TablesView />} />
                <Route path="deferred" element={<DeferredTables />} />
                <Route path="shift" element={<ShiftView />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* ═══ مسارات قسم الضيافة ═══
            RoleGuard يفحص الدور → HospitalityLayout يعرض السايد بار الخاص بالضيافة
            يستخدم مكونات خاصة بالضيافة
        */}
        <Route element={<RoleGuard allowedRoles={HOSPITALITY_ROLES} />}>
          <Route element={<HospitalityLayout />}>
            <Route path="/Hospitality">
              <Route index element={<HospitalityPOS />} />
              <Route path="orders" element={<HospitalityOrders />} />
              <Route path="tables" element={<HospitalityTables />} />
            </Route>
          </Route>
        </Route>

        {/* ═══ مسارات الكول سنتر ═══
            RoleGuard يفحص الدور → CallCenterGuard يفحص تفعيل الجهاز → CallCenterLayout يعرض السايد بار
        */}
        <Route element={<RoleGuard allowedRoles={CALL_CENTER_ROLES} />}>
          <Route element={<CallCenterGuard />}>
            <Route element={<CallCenterLayout />}>
              <Route path="/call-center">
                <Route index element={<CustomerManagementDashboard />} />
                <Route path="pos" element={<CallCenterPOS />} />
                <Route path="orders" element={<ActiveOrdersPage />} />
                <Route path="crm" element={<CrmDirectoryPage />} />
                <Route path="search" element={<CustomerPhoneSearch />} />
                <Route path="complaints" element={<ComplaintsManagement />} />
                <Route path="occasions" element={<OccasionsPage />} />
                <Route path="top-customers" element={<TopCustomersTable />} />
                <Route path="employees" element={<CallCenterEmployees />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* ── إدارة الشفت ── */}
        <Route
          path="/shift"
          element={React.createElement(ShiftView as any, {
            currentShift: null,
            summary: null,
            shiftLoading: false,
            currentUserName: "",
            onOpen: async () => {},
            onClose: async () => {},
            onFetchSummary: async () => {},
          })}
        />

        {/* ── إغلاق اليوم ── */}
        <Route path="/admin/day-close" element={<DayClosePage />} />

        {/* ── لوحة التسوية المالية ── */}
        <Route path="/admin/reconciliation" element={<ReconciliationBoard />} />

        {/* ── الصفحة الافتراضية ── */}
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
      </Route>

      {/* ── 404 ── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

/* ══════════════════════════════════════════════════════════════
 *  المكون الرئيسي
 * ══════════════════════════════════════════════════════════════ */

function App() {
  useEffect(() => {
    const handler = () => {
      sound.init();
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler, { once: true });
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastContainer />
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
