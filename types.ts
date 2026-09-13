export enum OrderType {
  DINE_IN = "DINE_IN",
  TAKEAWAY = "TAKEAWAY",
  DELIVERY = "DELIVERY",
}

export enum OrderStatus {
  PENDING = "PENDING",
  PREPARING = "PREPARING",
  READY = "READY",
  ON_DELIVERY = "ON_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELED = "CANCELED",
  REFUNDED = "REFUNDED",
  COMPLETED = "COMPLETED",
  IN_PROGRESS = "IN_PROGRESS",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  PENDING_PAYMENT = "PENDING_PAYMENT",
  CONFIRMED = "CONFIRMED",
  COLLECTED = "COLLECTED",
}

export enum PaymentMethod {
  CASH = "CASH",
  CREDIT_CARD = "CREDIT_CARD",
  WALLET = "WALLET",
  QR = "QR",
  ONLINE = "ONLINE",
  EMPLOYEE = "EMPLOYEE",
  CUSTOMER = "CUSTOMER",
  SUPPLIER = "SUPPLIER",
}

export interface Transaction {
  id: string;
  date: Date;
  amount: number;
  type: "DEPOSIT" | "PURCHASE" | "REFUND" | "BONUS";
  status: "SUCCESS" | "FAILED" | "PENDING";
  description: string;
}

export interface SavedCard {
  id: string;
  brand: "VISA" | "MASTERCARD";
  last4: string;
  expiry: string;
}

export interface MenuItem {
  id: string;
  name: string;
  nameAr: string;
  shortName?: string;
  code: string; // SKU
  price: number; // Base price
  dineInPrice?: number;
  takeawayPrice?: number;
  deliveryPrice?: number;
  offerPrice?: number;
  offerStartDate?: Date;
  offerEndDate?: Date;
  category: string;
  image: string;
  /** Absolute URL when synced from API (prefer over `image` path). */
  image_url?: string | null;
  description?: string;
  descriptionAr?: string;
  prepTime: number; // in minutes
  status: "AVAILABLE" | "UNAVAILABLE" | "OUT_OF_STOCK";
  displayOrder: number;
  requiresKitchen: boolean;
  barcode?: string;
  kitchenNotes?: string;
  popular?: boolean;
  chefRecommended?: boolean;
  seasonal?: { startDate: Date; endDate: Date };
  visibility: { pos: boolean; qrMenu: boolean; delivery: boolean };
  dietary?: { vegan?: boolean; glutenFree?: boolean; spicyLevel?: number };
  sizes?: { id: string; name: string; price: number }[];
  addons?: { id: string; name: string; price: number; maxQuantity?: number }[];
  removals?: string[]; // Ingredients that can be removed
  isCombo?: boolean;
  comboItems?: { itemId: string; quantity: number }[];
  departmentId: string; // Required
  stats?: { salesCount: number; totalRevenue: number; lastSoldAt?: Date };
}

export interface OrderItem {
  itemId: string;
  uniqueId: string;
  name: string;
  quantity: number;
  price: number;
  basePrice: number;
  departmentId?: string;
  status?: OrderStatus;
  preparedAt?: Date;
  size?: string;
  addons?: string[];
  note?: string;
}

export interface OrderTimeline {
  status: OrderStatus;
  time: Date;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  tableId?: string;
  branchId?: string;
  customerId?: string;
  waiterId?: string;
  createdAt: Date;
  subtotal: number;
  tax: number;
  deliveryFee?: number;
  discount: number;
  total: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  paymentMethod?: PaymentMethod;
  timeline: OrderTimeline[];
  deliveryInfo?: {
    address: string;
    driverName?: string;
    driverPhone?: string;
    eta: string;
  };
  shelfLocation?: string;
  cancelReason?: string;
  refundedAmount?: number;
  guestCount?: number;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "BUSY";
  isMainBranch: boolean;
  parentId?: string;

  // Location
  city: string;
  address: string;
  googleMapUrl?: string;

  // Contact
  phone: string;
  whatsapp?: string;
  email?: string;

  // Operational Settings
  openingTime: string; // "08:00"
  closingTime: string; // "23:00"
  is24Hours: boolean;
  timezone?: string;

  // Financial Settings
  currency: string;
  defaultTax: number;
  allowDiscount: boolean;
  maxDiscountLimit: number;

  // Cashier Settings
  requireShiftOpening: boolean;
  cashierCount: number;
  firstInvoiceNumber: number;
  defaultPrinter?: string;

  // Advanced
  managerId?: string;
  hasDelivery: boolean;
  specialHours?: { day: number; open: string; close: string }[];

  createdAt: Date;
}

export interface Department {
  id: string;
  name: string;
  nameAr: string;
  shortName?: string;
  description?: string;
  parentId?: string;
  branchId: string;
  icon?: string;
  color?: string;
  stationNumber?: string;
  location?: string;
  hasKds: boolean;
  kdsScreenId?: string;
  kdsDeviceName?: string;
  defaultPrepTime: number; // in minutes
  type:
    | "MAIN_KITCHEN"
    | "FAST_FOOD"
    | "BAR"
    | "COLD_PREP"
    | "BAKERY"
    | "DESSERT";
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE" | "BUSY";
  maxConcurrentOrders: number;
  priority: number;
  autoPrintTicket: boolean;
  notifications: {
    sound: boolean;
    flash: boolean;
    push: boolean;
  };
  orderTypeVisibility: OrderType[];
  requiresAssembly: boolean;
}

export interface JobTitle {
  id: string;
  name: string;
  departmentIds: string[];
  description?: string;
}

export interface JobType {
  id: string;
  name: string;
  description?: string;
}

export enum EmployeeStatus {
  ACTIVE = "ACTIVE",
  ON_LEAVE = "ON_LEAVE",
  TERMINATED = "TERMINATED",
  SUSPENDED = "SUSPENDED",
  RESIGNED = "RESIGNED",
}

export interface Employee {
  id: string;
  employeeId: string; // EMP-102
  name: string;
  phone: string;
  email: string;
  address: string;
  nationalId: string;
  dob: Date;
  image?: string;
  jobTitleId: string;
  departmentId: string;
  branchId: string;
  typeId: string;
  managerId?: string;
  hireDate: Date;
  salary: number;
  status: EmployeeStatus;
  role:
    | "CASHIER"
    | "WAITER"
    | "MANAGER"
    | "ADMIN"
    | "BRANCH_MANAGER"
    | "HOSPITALITY"
    | "KITCHEN"
    | "DEPARTMENT_STAFF"
    | "ORDER_AGGREGATOR"
    | "FINANCE"
    | "HEAD_CHEF"
    | "COOK";
  username?: string;
  password?: string;
  pin?: string; // 4 digits
  permissions: string[];
  notes?: string;
  rating?: number;
  performance?: {
    ordersServed: number;
    totalSales: number;
    hoursWorked: number;
  };
}

export enum CustomerType {
  REGULAR = "REGULAR",
  LOYAL = "LOYAL",
  VIP = "VIP",
  COMPANY = "COMPANY",
  EMPLOYEE = "EMPLOYEE",
  SUPPLIER = "SUPPLIER",
}

export interface CustomerAddress {
  id: string;
  label: string; // Home, Work, etc.
  city: string;
  district: string;
  street: string;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: CustomerType;
  points: number;
  totalSpent: number;
  ordersCount: number;
  balance: number; // For credit
  allowCredit: boolean;
  isBlocked: boolean;
  addresses: CustomerAddress[];
  rating: number;
  notes?: string;
  lastVisit?: Date;
  createdAt: Date;
  linkedAccountId?: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role:
    | "CASHIER"
    | "CUSTOMER"
    | "WAITER"
    | "BRANCH_MANAGER"
    | "HOSPITALITY"
    | "KITCHEN"
    | "DEPARTMENT_STAFF"
    | "ORDER_AGGREGATOR"
    | "FINANCE"
    | "ADMIN"
    | "HEAD_CHEF"
    | "COOK"
    | "MANAGER"
    | "EMPLOYEE";
  branchId?: string;
  departmentId?: string;
  points: number;
  balance: number;
  tier: "SILVER" | "GOLD" | "PLATINUM";
  vouchers: any[];
  favorites: string[];
  addresses: any[];
  transactions: Transaction[];
  savedCards: SavedCard[];
  commissionRate?: number;
  linkedAccountId?: string;
}

export enum AccountType {
  ASSET = "ASSET",
  LIABILITY = "LIABILITY",
  EQUITY = "EQUITY",
  REVENUE = "REVENUE",
  EXPENSE = "EXPENSE",
}

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  parentId?: string;
  isPosting: boolean;
  balance: number;
}

export interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
}

export interface FiscalPeriod {
  id: string;
  yearId: string;
  month: number;
  status: "OPEN" | "CLOSED";
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: "OPERATIONAL" | "SUPPORT" | "PROFIT";
  parentId?: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  description: string;
  lines: {
    accountId: string;
    costCenterId?: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
  status: "DRAFT" | "POSTED";
  fiscalYearId: string;
  createdBy: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  balance: number;
  createdAt: string;
  linkedAccountId?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  balance: number;
  linkedAccountId?: string;
}

export interface CashBox {
  id: string;
  name: string;
  branchId: string;
  balance: number;
  linkedAccountId?: string;
}

export enum TableStatus {
  AVAILABLE = "AVAILABLE",
  OCCUPIED = "OCCUPIED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  BILL_PRINTED = "BILL_PRINTED",
  PAID = "PAID",
  RESERVED = "RESERVED",
  CLEANING = "CLEANING",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  MERGED = "MERGED",
}

export interface Hall {
  id: string;
  name: string;
  code?: string;
  branch_id?: number;
  status?: string;
  tables?: Table[];
}

export interface Table {
  id: string;
  number: number;
  table_number: string;
  label?: string;
  status: TableStatus;
  capacity: number;
  hallId: string;
  qr_code?: string;
  qr_url?: string;
  currentOrderId?: string;
  seatedAt?: Date;
  guestCount?: number;
  mergedWithId?: string;
  mergedWithTableNumber?: string;
  waiterCalledAt?: string | null;
  mergeInfo?: {
    is_merged: boolean;
    merged_with_id: string;
    merged_with_table_number: string;
    status_text: string;
    status_color: string;
    status_icon: string;
    hint: string;
  } | null;
  orders?: { id: string; order_number: string; status: string; total: number; customer_name?: string; items?: { id: number; item_name: string; item_name_ar?: string; quantity: number; unit_price: number; total_price: number }[] }[];
  reservationName?: string;
  reservationTime?: string;
  position: { x: number; y: number };
}

export enum FinancialTransactionType {
  SALE = "SALE", // مبيعات
  EXPENSE = "EXPENSE", // مصروفات
  WITHDRAWAL = "WITHDRAWAL", // سحوبات (مدير)
  DEPOSIT = "DEPOSIT", // إيداع (توريد)
  REFUND = "REFUND", // مرتجع
  CASH_DROP = "CASH_DROP", // توريد للبنك/الإدارة
  VOID = "VOID", // إلغاء فاتورة
}

export interface FinancialTransaction {
  id: string;
  shiftId: string;
  cashierId: string;
  type: FinancialTransactionType;
  amount: number;
  reason: string;
  timestamp: Date;
  status: "PENDING" | "APPROVED" | "REJECTED";
  attachment?: string; // Optional image/receipt
}

export interface CustomerFeedback {
  id: string;
  orderId?: string;
  customerId?: string;
  customerName: string;
  type: "COMPLAINT" | "SUGGESTION" | "COMPLIMENT";
  category: "FOOD" | "SERVICE" | "CLEANLINESS" | "ATMOSPHERE" | "OTHER";
  rating: number; // 1-5
  comment: string;
  status: "NEW" | "REVIEWED" | "RESOLVED";
  timestamp: Date;
}

export interface StaffTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // Employee ID
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  dueDate: Date;
}

export interface TableAssignment {
  tableId: string;
  staffId: string; // Employee ID (Captain/Waiter)
  shiftId: string;
}

export interface Shift {
  id: string;
  cashierId: string;
  startTime: Date;
  endTime?: Date;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  totalSales?: number;
  totalExpenses?: number;
  totalWithdrawals?: number;
  status: "OPEN" | "CLOSED";
  type: "MORNING" | "EVENING" | "NIGHT";
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: Date;
  checkIn: Date;
  checkOut?: Date;
  status: "PRESENT" | "LATE" | "ABSENT";
  note?: string;
}

export interface WorkSchedule {
  id: string;
  employeeId: string;
  branchId: string;
  departmentId: string;
  shiftId: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // "08:00"
  endTime: string; // "16:00"
}

export interface ActivityLog {
  id: string;
  employeeId: string;
  action: string; // "Created Order #1025"
  timestamp: Date;
  details?: any;
}

// ── Blind Drop & Day Close Types ─────────────────────────────────────────────

export interface DenominationEntry {
  value: number;
  count: number;
}

export interface BlindDropSubmission {
  id: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  submittedAt: Date;
  denominations: DenominationEntry[];
  cashTotal: number;
  cardTotal: number;
  walletTotal: number;
  grandTotal: number;
  status: "PENDING" | "VERIFIED" | "DISPUTED";
}

export interface ReconciliationEntry {
  id: string;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  shiftType: "MORNING" | "EVENING" | "NIGHT";
  startTime: Date;
  endTime?: Date;
  // Actual amounts (blindly submitted by cashier)
  actualCash: number;
  actualCards: number;
  actualWallets: number;
  // Expected amounts (system-calculated)
  expectedCash: number;
  expectedCards: number;
  expectedWallets: number;
  // Variances
  cashVariance: number;
  cardsVariance: number;
  walletsVariance: number;
  totalVariance: number;
  // Status
  status: "BALANCED" | "SHORTAGE" | "OVERAGE" | "PENDING";
  // Accounting
  journalEntryId?: string;
  journalEntryDate?: Date;
}

export interface DayCloseState {
  id: string;
  date: string; // YYYY-MM-DD
  status: "OPEN" | "LOCKED" | "CLOSED";
  totalShifts: number;
  closedShifts: number;
  allShiftsClosed: boolean;
  executedBy?: string;
  executedAt?: Date;
  totalSales: number;
  totalExpenses: number;
  netRevenue: number;
}

export interface BusinessDayState {
  id: string;
  date: string;
  status: "OPEN" | "CLOSED";
  openedAt?: Date;
  closedAt?: Date;
  openedBy?: string;
  closedBy?: string;
  openingNote?: string;
  closingNote?: string;
  totalSales: number;
  totalRevenue: number;
  invoiceCount: number;
  returnCount: number;
  discountTotal: number;
  taxTotal: number;
}

export interface JournalEntryLine {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface VarianceJournalEntry {
  id: string;
  shiftId: string;
  type: "SHORTAGE" | "OVERAGE";
  amount: number;
  lines: JournalEntryLine[];
  createdAt: Date;
  postedBy: string;
}

// ── Print Router Types ──────────────────────────────────────────────────────

export type PrinterTypeValue = 'CASHIER' | 'KITCHEN' | 'BAR' | 'OTHER';

export interface Printer {
  id: number;
  name: string;
  ip_address: string;
  port: string;
  type: PrinterTypeValue;
  branch_id: number;
  is_active: boolean;
  print_on_direct: boolean;
  linked_pos_register_id?: number | null;
  created_at?: string;
  updated_at?: string;
  // Relations
  linkedPosRegister?: { id: number; name: string; code: string };
  departments?: { id: number; name: string }[];
  items?: { id: number; name: string }[];
}

export type PrintRouteScope = 'CATEGORY' | 'ITEM';

export interface PrintRoute {
  id: number;
  branch_id: number;
  user_id: number | null;
  pos_register_id: number | null;
  hospitality_device_id: number | null;
  category_id: number | null;
  item_id: number | null;
  printer_id: number;
  scope: PrintRouteScope;
  action_type: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  printer?: Printer;
  user?: { id: number; name: string };
  posRegister?: { id: number; name: string; code: string };
  hospitalityDevice?: { id: number; name: string; code: string };
  category?: { id: number; name: string };
  item?: { id: number; name: string };
}

export interface PrintRouteFormData {
  scope: PrintRouteScope;
  user_id?: number | null;
  pos_register_id?: number | null;
  hospitality_device_id?: number | null;
  category_id?: number | null;
  item_id?: number | null;
  printer_id: number;
  action_type?: string;
}

export interface PrinterFormData {
  name: string;
  ip_address: string;
  port?: string;
  type: PrinterTypeValue;
  branch_id?: number;
  print_on_direct?: boolean;
  linked_pos_register_id?: number | null;
  department_ids?: number[];
  item_ids?: number[];
}
