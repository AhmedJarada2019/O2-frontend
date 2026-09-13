
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Order, MenuItem, User,
  Table, Shift, Branch, Department, JobTitle, JobType, Employee,
  FinancialTransaction,
  Customer,
  ActivityLog, Hall,
  Supplier, BankAccount, CashBox,
  BlindDropSubmission, ReconciliationEntry, DayCloseState, BusinessDayState
} from './types';
import {
  OrderStatus, TableStatus, FinancialTransactionType
} from './types';
import { TABLES } from './constants';
import api from './src/api/axios';
import { shiftService } from './src/services/shiftService';


interface AppState {
  // Auth
  currentUser: User | null;
  isLoggedIn: boolean;
  login: (user: User) => void;
  logout: () => void;

  // User Role
  userRole: string | null;

  // Branches & Departments
  branches: Branch[];
  departments: Department[];
  setBranches: (branches: Branch[]) => void;
  setDepartments: (departments: Department[]) => void;

  // Menu Items
  menuItems: MenuItem[];
  diningZones: Hall[];
  tablesLoading: boolean;
  fetchDiningZones: (branchId?: number) => Promise<void>;
  fetchTables: (branchId?: number) => Promise<void>;

  addBranch: (branch: Omit<Branch, 'id'>) => void;
  updateBranch: (id: string, branch: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;
  addDepartment: (dept: Omit<Department, 'id'>) => void;
  updateDepartment: (id: string, dept: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;
  addJobTitle: (jt: Omit<JobTitle, 'id'>) => void;
  updateJobTitle: (id: string, jt: Partial<JobTitle>) => void;
  deleteJobTitle: (id: string) => void;
  addJobType: (jt: Omit<JobType, 'id'>) => void;
  updateJobType: (id: string, jt: Partial<JobType>) => void;
  deleteJobType: (id: string) => void;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Orders
  orders: Order[];
  activeOrders: Order[];
  setOrders: (orders: Order[]) => void;
  setActiveOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  // Tables
  tables: Table[];
  setTables: (tables: Table[]) => void;
  selectedTable: Table | null;
  setSelectedTable: (table: Table | null) => void;
  updateTableStatus: (tableId: string, status: TableStatus, options?: { currentOrderId?: string; seatedAt?: Date; guestCount?: number }) => Promise<boolean>;
  transferTable: (fromId: string, toId: string) => void;
  mergeTables: (tableIds: string[]) => void;
  seatTable: (tableId: string, guests: number) => Promise<boolean>;
  loadOrderToPOS: (orderId: string) => void;
  orderType: string;
  setOrderType: (type: string) => void;

  // Shifts
  currentShift: Shift | null;
  setCurrentShift: (shift: Shift | null) => void;
  openShift: (openingBalance: number, type?: 'MORNING' | 'EVENING' | 'NIGHT') => Promise<boolean>;
  closeShift: (closingBalance: number) => Promise<import('./src/services/shiftService').ShiftReconciliation | null>;
  rollover: (closingBalance?: number) => Promise<{ closedShift: any; newShift: Shift }>;
  fetchCurrentShift: () => Promise<void>;

  // Employees
  employees: Employee[];
  setEmployees: (employees: Employee[]) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  // Job Titles
  jobTitles: JobTitle[];
  setJobTitles: (jobTitles: JobTitle[]) => void;

  // Customers
  customers: Customer[];
  setCustomers: (customers: Customer[]) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  adjustCustomerPoints: (customerId: string, points: number) => void;
  adjustCustomerBalance: (customerId: string, amount: number) => void;

  // Suppliers
  suppliers: Supplier[];
  setSuppliers: (suppliers: Supplier[]) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;

  // Bank Accounts
  bankAccounts: BankAccount[];
  setBankAccounts: (accounts: BankAccount[]) => void;
  addBankAccount: (account: BankAccount) => void;
  updateBankAccount: (account: BankAccount) => void;
  deleteBankAccount: (id: string) => void;

  // Cash Boxes (صندوق نقدية) — كان مستخدم بـCashBankTab بدون ما يكون معرّف
  // أبدًا بالمتجر، فكان app.cashBoxes ترجع undefined ويطيح .reduce()
  cashBoxes: CashBox[];
  setCashBoxes: (boxes: CashBox[]) => void;

  // Financial Transactions
  financialTransactions: FinancialTransaction[];
  setFinancialTransactions: (transactions: FinancialTransaction[]) => void;
  addFinancialTransaction: (transaction: FinancialTransaction) => void;

  // Activity Logs
  activityLogs: ActivityLog[];
  setActivityLogs: (logs: ActivityLog[]) => void;
  addActivityLog: (log: ActivityLog) => void;

  // Notifications
  notifications: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeNotification: (id: string) => void;

  // Blind Drop Submissions
  blindDropSubmissions: BlindDropSubmission[];
  submitBlindDrop: (submission: Omit<BlindDropSubmission, 'id' | 'submittedAt' | 'status'>) => void;

  // Reconciliation Entries
  reconciliationEntries: ReconciliationEntry[];
  getReconciliationData: (date?: string) => ReconciliationEntry[];

  // Day Close State
  dayCloseState: DayCloseState | null;
  businessDayState: BusinessDayState | null;
  openBusinessDay: (userId: string, note?: string) => void;
  closeBusinessDay: (userId: string, note?: string) => void;
  executeDayClose: (managerId: string) => void;
  canExecuteDayClose: () => boolean;

  // Sync bridge
  syncFromContext: (data: { orders?: Order[]; shifts?: Shift[]; financialTransactions?: FinancialTransaction[] }) => void;
}


export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      // Auth
      currentUser: null,
      isLoggedIn: false,
      userRole: null,
      login: (user: User) => set({ currentUser: user, isLoggedIn: true, userRole: user.role }),
      logout: () => set({ currentUser: null, isLoggedIn: false, userRole: null, currentShift: null }),

      // Branches & Departments
      branches: [],
      departments: [],
      setBranches: (branches) => set({ branches }),
      setDepartments: (departments) => set({ departments }),

      // Menu Items
      menuItems: [],
      diningZones: [],
      tablesLoading: false,
      setMenuItems: (menuItems) => set({ menuItems }),
      addMenuItem: (item) => set((state) => ({ menuItems: [...state.menuItems, item] })),
      updateMenuItem: (item) =>
        set((state) => ({
          menuItems: state.menuItems.map((i) => (i.id === item.id ? item : i)),
        })),
      deleteMenuItem: (id) =>
        set((state) => ({
          menuItems: state.menuItems.filter((i) => i.id !== id),
        })),
      fetchDiningZones: async (branchId?: number) => {
        try {
          set({ tablesLoading: true });
          const params: Record<string, any> = {};
          if (branchId) params.branch_id = branchId;
          const response = await api.get('/tables', { params });
          const zones = response.data?.data ?? response.data;
          
          if (Array.isArray(zones)) {
            const halls: Hall[] = [];
            const allTables: Table[] = [];
            
            zones.forEach((zone: any) => {
              halls.push({
                id: String(zone.id),
                name: zone.name,
                code: zone.code,
                branch_id: zone.branch_id,
                status: zone.status,
              });
              
              if (Array.isArray(zone.tables)) {
                zone.tables.forEach((table: any) => {
                  const order = table.current_order;
                  allTables.push({
                    id: String(table.id),
                    number: table.number || parseInt(String(table.id)),
                    table_number: table.table_number || `${zone.code}${table.number || ''}`,
                    label: table.table_number || `${zone.code}${table.number || ''}`,
                    status: table.status || 'AVAILABLE',
                    capacity: table.capacity || 4,
                    hallId: String(zone.id),
                    qr_code: table.qr_code,
                    qr_url: table.qr_url,
                    seatedAt: table.seated_at,
                    guestCount: table.customer_count,
                    currentOrderId: table.current_order_id,
                    mergedWithId: table.merged_with_id ? String(table.merged_with_id) : undefined,
                    mergedWithTableNumber: table.merged_with_table_number || undefined,
                    mergeInfo: table.merge_info || null,
                    waiterCalledAt: table.waiter_called_at || null,
                    orders: table.orders || [],
                    position: { x: (parseInt(table.id) % 10) * 120 + 50, y: Math.floor(parseInt(table.id) / 10) * 120 + 50 },
                  });
                });
              }
            });
            
            set({ diningZones: halls, tables: allTables as any, tablesLoading: false });
          } else {
            set({ tablesLoading: false });
          }
        } catch (error) {
          console.error('Failed to fetch dining zones:', error);
          set({ tablesLoading: false });
        }
      },

      // تحديث الطاولات فقط - يدمج البيانات الجديدة مع الموجودة (تحديث خفيف)
      fetchTables: async (branchId?: number) => {
        try {
          const params: Record<string, any> = {};
          if (branchId) params.branch_id = branchId;
          const response = await api.get('/tables', { params });
          const zones = response.data?.data ?? response.data;
          
          if (Array.isArray(zones)) {
            const updates: Record<string, Partial<Table>> = {};
            
            zones.forEach((zone: any) => {
              if (Array.isArray(zone.tables)) {
                zone.tables.forEach((table: any) => {
                  const order = table.current_order;
                  updates[String(table.id)] = {
                    status: table.status || 'AVAILABLE',
                    seatedAt: table.seated_at ? new Date(table.seated_at) : undefined,
                    guestCount: table.customer_count || undefined,
                    currentOrderId: table.current_order_id || undefined,
                    mergedWithId: table.merged_with_id ? String(table.merged_with_id) : undefined,
                    mergedWithTableNumber: table.merged_with_table_number || undefined,
                    mergeInfo: table.merge_info || null,
                    waiterCalledAt: table.waiter_called_at || null,
                    orders: table.orders || [],
                  };
                });
              }
            });
            
            // دمج التحديثات مع الطاولات الموجودة (تحديث الحقول المتغيرة فقط)
            set((state) => ({
              tables: state.tables.map((t) => {
                const update = updates[t.id];
                if (update) {
                  return { ...t, ...update };
                }
                return t;
              }),
            }));
          }
        } catch (error) {
          console.error('Failed to fetch tables:', error);
        }
      },

      // Orders
      orders: [],
      activeOrders: [],
      setOrders: (orders) => set({ orders }),
      setActiveOrders: (activeOrders) => set({ activeOrders }),
      addOrder: (order) =>
        set((state) => ({
          orders: [...state.orders, order],
          activeOrders: order.status === 'PENDING' || order.status === 'PREPARING' || order.status === 'IN_PROGRESS'
            ? [...state.activeOrders, order]
            : state.activeOrders,
        })),
      updateOrderStatus: (orderId, status) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
          activeOrders:
            status === 'COMPLETED' || status === 'CANCELED' || status === 'REFUNDED'
              ? state.activeOrders.filter((o) => o.id !== orderId)
              : state.activeOrders.map((o) => (o.id === orderId ? { ...o, status } : o)),
        })),

      // Tables
      tables: TABLES,
      setTables: (tables) => set({ tables }),
      selectedTable: null,
      setSelectedTable: (table) => set({ selectedTable: table }),
      updateTableStatus: async (tableId, status, options) => {
        try {
          await api.put(`/tables/${tableId}/status`, { status });
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id === tableId
                ? {
                    ...t,
                    status,
                    currentOrderId: options && 'currentOrderId' in options ? options.currentOrderId : t.currentOrderId,
                    seatedAt: options && 'seatedAt' in options ? options.seatedAt : t.seatedAt,
                    guestCount: options && 'guestCount' in options ? options.guestCount : t.guestCount,
                  }
                : t
            ),
          }));
          return true;
        } catch (error) {
          // كان الخطأ يتبلع هون بصمت — الطاولة تضل بحالتها القديمة بالباك اند
          // بس الواجهة ما بتعرف إنه في مشكلة (مثلاً لو فيها طلب نشط لسا وما
          // انحررت). لازم المتصل يتحقق من القيمة الراجعة ويعرض خطأ للمستخدم.
          console.error('Failed to update table status:', error);
          return false;
        }
      },
      transferTable: (fromId, toId) =>
        set((state) => {
          const fromTable = state.tables.find((t) => t.id === fromId);
          const toTable = state.tables.find((t) => t.id === toId);
          if (!fromTable || !toTable) return state;
          return {
            tables: state.tables.map((t) => {
              if (t.id === fromId) return { ...t, status: TableStatus.AVAILABLE, currentOrderId: undefined, seatedAt: undefined };
              if (t.id === toId) return { ...t, status: fromTable.status, currentOrderId: fromTable.currentOrderId, seatedAt: fromTable.seatedAt };
              return t;
            }),
          };
        }),
      mergeTables: (tableIds) => {
        // Merge logic - mark tables as merged
        set((state) => ({
          tables: state.tables.map((t) =>
            tableIds.includes(t.id) && t.id !== tableIds[0]
              ? { ...t, mergedWithId: tableIds[0] }
              : t
          ),
        }));
      },
      seatTable: async (tableId, guests) => {
        try {
          const count = Math.max(1, guests);
          await api.post(`/tables/${tableId}/seat`, { customer_count: count });
          set((state) => ({
            tables: state.tables.map((t) =>
              t.id === tableId
                ? { ...t, status: TableStatus.OCCUPIED, seatedAt: new Date() }
                : t
            ),
          }));
          return true;
        } catch (error) {
          console.error('Failed to seat table:', error);
          return false;
        }
      },
      loadOrderToPOS: (orderId) => {
        // Load order to POS - this is mainly a navigation hint
        console.debug("loadOrderToPOS", orderId);
      },
      orderType: "dine_in",
      setOrderType: (type) => set({ orderType: type }),

      // Shifts
      currentShift: null,
      shifts: [],
      setCurrentShift: (currentShift) => set({ currentShift }),
      // كانت openShift/closeShift بس بتغيّروا حالة محلية بالمتصفح (openShift كانت
      // تخترع رقم يومية عشوائي، closeShift بس بتصفّر الحالة) بدون أي اتصال
      // بالباك اند إطلاقاً — يعني اليومية الحقيقية بالسيرفر ما إلها علاقة بشو
      // الكاشير شايفه على شاشته. صارت توصل فعلياً بـ /shifts/open و/shifts/close.
      openShift: async (openingBalance: number, type: 'MORNING' | 'EVENING' | 'NIGHT' = 'MORNING') => {
        try {
          const result = await shiftService.open(openingBalance);
          set({
            currentShift: {
              id: String(result.id),
              cashierId: String(result.opened_by),
              startTime: new Date(result.opened_at),
              openingBalance: result.opening_balance,
              status: 'OPEN',
              type,
            } as Shift,
          });
          return true;
        } catch (error) {
          console.error('Failed to open shift:', error);
          return false;
        }
      },
      closeShift: async (closingBalance: number) => {
        try {
          const result = await shiftService.close(closingBalance);
          const closedShift: Shift = {
            id: String(result.shift.id),
            cashierId: String(result.shift.opened_by),
            startTime: new Date(result.shift.opened_at),
            endTime: result.shift.closed_at ? new Date(result.shift.closed_at) : new Date(),
            openingBalance: result.shift.opening_balance,
            closingBalance: result.shift.closing_balance ?? closingBalance,
            totalSales: result.shift.total_sales,
            status: 'CLOSED',
            type: 'MORNING',
          };
          set((state) => ({
            currentShift: null,
            shifts: [closedShift, ...state.shifts],
          }));
          return result.reconciliation;
        } catch (error) {
          console.error('Failed to close shift:', error);
          throw error;
        }
      },
      rollover: async (closingBalance?: number) => {
        try {
          const result = await shiftService.rollover(closingBalance);
          const newShift: Shift = {
            id: String(result.new_shift.id),
            cashierId: String(result.new_shift.opened_by),
            startTime: new Date(result.new_shift.opened_at),
            openingBalance: result.new_shift.opening_balance,
            status: 'OPEN',
            type: 'MORNING',
          };
          set({ currentShift: newShift });
          return { closedShift: result.closed_shift, newShift };
        } catch (error) {
          console.error('Rollover failed:', error);
          throw error;
        }
      },
      fetchCurrentShift: async () => {
        try {
          const result = await shiftService.getCurrent();
          if (result.shift) {
            const shift: Shift = {
              id: String(result.shift.id),
              cashierId: String(result.shift.opened_by),
              startTime: new Date(result.shift.opened_at),
              openingBalance: result.shift.opening_balance,
              status: 'OPEN',
              type: 'MORNING',
            };
            set({ currentShift: shift });
          } else {
            set({ currentShift: null });
          }
        } catch (error) {
          console.error('Failed to fetch current shift:', error);
        }
      },

      // Employees
      employees: [],
      setEmployees: (employees) => set({ employees }),
      addEmployee: (employee) =>
        set((state) => ({ employees: [...state.employees, employee] })),
      updateEmployee: (id, employee) =>
        set((state) => ({
          employees: state.employees.map((e) => (e.id === id ? { ...e, ...employee } : e)),
        })),
      deleteEmployee: (id) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        })),

      // Job Titles
      jobTitles: [],
      setJobTitles: (jobTitles) => set({ jobTitles }),

      // Customers
      customers: [],
      setCustomers: (customers) => set({ customers }),
      addCustomer: (customer) =>
        set((state) => ({ customers: [...state.customers, customer] })),
      updateCustomer: (customer) =>
        set((state) => ({
          customers: state.customers.map((c) => (c.id === customer.id ? customer : c)),
        })),
      deleteCustomer: (id) =>
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        })),
      adjustCustomerPoints: (customerId, points) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === customerId ? { ...c, points: c.points + points } : c
          ),
        })),
      adjustCustomerBalance: (customerId, amount) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === customerId ? { ...c, balance: c.balance + amount } : c
          ),
        })),

      // Suppliers
      suppliers: [],
      setSuppliers: (suppliers) => set({ suppliers }),
      addSupplier: (supplier) =>
        set((state) => ({ suppliers: [...state.suppliers, supplier] })),
      updateSupplier: (supplier) =>
        set((state) => ({
          suppliers: state.suppliers.map((s) => (s.id === supplier.id ? supplier : s)),
        })),
      deleteSupplier: (id) =>
        set((state) => ({
          suppliers: state.suppliers.filter((s) => s.id !== id),
        })),

      // Bank Accounts
      bankAccounts: [],
      setBankAccounts: (bankAccounts) => set({ bankAccounts }),
      addBankAccount: (account) =>
        set((state) => ({ bankAccounts: [...state.bankAccounts, account] })),
      updateBankAccount: (account) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.map((a) => (a.id === account.id ? account : a)),
        })),
      deleteBankAccount: (id) =>
        set((state) => ({
          bankAccounts: state.bankAccounts.filter((a) => a.id !== id),
        })),

      // Cash Boxes
      cashBoxes: [],
      setCashBoxes: (cashBoxes) => set({ cashBoxes }),

      // Financial Transactions
      financialTransactions: [],
      setFinancialTransactions: (financialTransactions) => set({ financialTransactions }),
      addFinancialTransaction: (transaction) =>
        set((state) => ({
          financialTransactions: [...state.financialTransactions, transaction],
        })),

      // Activity Logs
      activityLogs: [],
      setActivityLogs: (activityLogs) => set({ activityLogs }),
      addActivityLog: (log) =>
        set((state) => ({
          activityLogs: [...state.activityLogs, log],
        })),

      // Notifications
      notifications: [],
      addNotification: (message, type = 'info') => {
        const id = Date.now().toString();
        set((state) => ({
          notifications: [...state.notifications, { id, message, type }],
        }));
        setTimeout(() => {
          get().removeNotification(id);
        }, 5000);
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // Blind Drop Submissions
      blindDropSubmissions: [],
      submitBlindDrop: (submission) => {
        const id = `bd-${Date.now()}`;
        const newSubmission: BlindDropSubmission = {
          ...submission,
          id,
          submittedAt: new Date(),
          status: 'PENDING',
        };
        set((state) => ({
          blindDropSubmissions: [...state.blindDropSubmissions, newSubmission],
        }));

        // Auto-generate variance journal entry
        const { reconciliationEntries, shifts, financialTransactions } = get();
        const shift = shifts.find(s => s.id === submission.shiftId);
        if (shift) {
          // Calculate expected amounts from financial transactions
          const shiftStart = new Date(shift.startTime);
          const shiftEnd = new Date();

          const shiftSales = financialTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            return tx.shiftId === shift.id
              && tx.type === FinancialTransactionType.SALE
              && txDate >= shiftStart && txDate <= shiftEnd;
          });
          const totalSales = shiftSales.reduce((sum, tx) => sum + tx.amount, 0);

          // Expected = opening balance + sales (cash portion assumed 80% for blind drop)
          const expectedCash = shift.openingBalance + totalSales * 0.8;
          const expectedCards = totalSales * 0.15;
          const expectedWallets = totalSales * 0.05;

          const cashVariance = submission.cashTotal - expectedCash;
          const cardsVariance = submission.cardTotal - expectedCards;
          const walletsVariance = submission.walletTotal - expectedWallets;
          const totalVariance = cashVariance + cardsVariance + walletsVariance;

          const reconEntry: ReconciliationEntry = {
            id: `recon-${Date.now()}`,
            shiftId: submission.shiftId,
            cashierId: submission.cashierId,
            cashierName: submission.cashierName,
            shiftType: shift.type,
            startTime: shift.startTime,
            endTime: shiftEnd,
            actualCash: submission.cashTotal,
            actualCards: submission.cardTotal,
            actualWallets: submission.walletTotal,
            expectedCash,
            expectedCards,
            expectedWallets,
            cashVariance,
            cardsVariance,
            walletsVariance,
            totalVariance,
            status: Math.abs(totalVariance) < 0.01 ? 'BALANCED' : totalVariance < 0 ? 'SHORTAGE' : 'OVERAGE',
            journalEntryDate: new Date(),
          };

          set((state) => ({
            reconciliationEntries: [...state.reconciliationEntries, reconEntry],
          }));

          // Add activity log
          get().addActivityLog({
            id: `log-${Date.now()}`,
            employeeId: submission.cashierId,
            action: 'Blind Drop Submitted',
            timestamp: new Date(),
            details: {
              shiftId: submission.shiftId,
              cashTotal: submission.cashTotal,
              cardTotal: submission.cardTotal,
              walletTotal: submission.walletTotal,
              variance: totalVariance,
              status: reconEntry.status,
            },
          });
        }
      },

      // Reconciliation Entries
      reconciliationEntries: [],
      getReconciliationData: (date?: string) => {
        const { reconciliationEntries } = get();
        if (!date) return reconciliationEntries;
        return reconciliationEntries.filter(entry => {
          const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
          return entryDate === date;
        });
      },

      // Day Close State
      dayCloseState: null,
      businessDayState: null,

      // Sync bridge: Context pushes data here so Zustand functions can access it
      syncFromContext: (data: { orders?: Order[]; shifts?: Shift[]; financialTransactions?: FinancialTransaction[] }) => {
        set((state) => ({
          orders: data.orders ?? state.orders,
          shifts: data.shifts ?? state.shifts,
          financialTransactions: data.financialTransactions ?? state.financialTransactions,
        }));
      },

      openBusinessDay: (userId: string, note?: string) => {
        const today = new Date().toISOString().split('T')[0];
        const existing = get().businessDayState;
        if (existing?.date === today && existing.status === 'OPEN') return;

        const openState: BusinessDayState = {
          id: `bd-${Date.now()}`,
          date: today,
          status: 'OPEN',
          openedAt: new Date(),
          openedBy: userId,
          openingNote: note,
          totalSales: 0,
          totalRevenue: 0,
          invoiceCount: 0,
          returnCount: 0,
          discountTotal: 0,
          taxTotal: 0,
        };

        set({ businessDayState: openState });
        get().addActivityLog({
          id: `log-${Date.now()}`,
          employeeId: userId,
          action: 'Business Day Opened',
          timestamp: new Date(),
          details: { date: today, note },
        });
      },
      closeBusinessDay: (userId: string, note?: string) => {
        const today = new Date().toISOString().split('T')[0];
        const existing = get().businessDayState;
        if (existing?.date === today && existing.status === 'CLOSED') return;

        const { financialTransactions, reconciliationEntries } = get();

        // Calculate from financial transactions (the real source of truth)
        const todayTx = financialTransactions.filter((tx: any) => {
          const txDate = new Date(tx.timestamp).toISOString().split('T')[0];
          return txDate === today;
        });

        const todayRecons = reconciliationEntries.filter((entry: any) => {
          const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
          return entryDate === today;
        });

        const totalSales = todayRecons.reduce((sum, entry) => sum + entry.actualCash + entry.actualCards + entry.actualWallets, 0);
        const totalExpenses = todayTx.filter(tx => tx.type === FinancialTransactionType.EXPENSE).reduce((sum, tx) => sum + tx.amount, 0);
        const totalRefunds = todayTx.filter(tx => tx.type === FinancialTransactionType.REFUND).reduce((sum, tx) => sum + tx.amount, 0);
        const invoiceCount = todayRecons.length;
        const returnCount = todayTx.filter(tx => tx.type === FinancialTransactionType.REFUND).length;

        const closedState: BusinessDayState = {
          ...(existing ?? {
            id: `bd-${Date.now()}`,
            date: today,
            status: 'OPEN',
            totalSales: 0,
            totalRevenue: 0,
            invoiceCount: 0,
            returnCount: 0,
            discountTotal: 0,
            taxTotal: 0,
          }),
          date: today,
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: userId,
          closingNote: note,
          totalSales,
          totalRevenue: totalSales - totalExpenses,
          invoiceCount,
          returnCount,
          discountTotal: 0,
          taxTotal: 0,
        };

        set({ businessDayState: closedState });
        get().addActivityLog({
          id: `log-${Date.now()}`,
          employeeId: userId,
          action: 'Business Day Closed',
          timestamp: new Date(),
          details: { date: today, note, totalSales, totalRevenue },
        });
      },
      executeDayClose: (managerId: string) => {
        const { reconciliationEntries, blindDropSubmissions, shifts, financialTransactions } = get();
        const today = new Date().toISOString().split('T')[0];

        // Check if all shifts for today are closed
        const todayShifts = shifts.filter(s => {
          const shiftDate = new Date(s.startTime).toISOString().split('T')[0];
          return shiftDate === today;
        });

        const allClosed = todayShifts.every(s => s.status === 'CLOSED');
        if (!allClosed) return;

        // Calculate totals
        const todayReconciliations = reconciliationEntries.filter(entry => {
          const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
          return entryDate === today;
        });

        const totalSales = todayReconciliations.reduce((sum, entry) => sum + entry.actualCash + entry.actualCards + entry.actualWallets, 0);
        const totalExpenses = financialTransactions
          .filter(tx => {
            const txDate = new Date(tx.timestamp).toISOString().split('T')[0];
            return txDate === today && tx.type === FinancialTransactionType.EXPENSE;
          })
          .reduce((sum, tx) => sum + tx.amount, 0);

        const dayClose: DayCloseState = {
          id: `dc-${Date.now()}`,
          date: today,
          status: 'CLOSED',
          totalShifts: todayShifts.length,
          closedShifts: todayShifts.filter(s => s.status === 'CLOSED').length,
          allShiftsClosed: true,
          executedBy: managerId,
          executedAt: new Date(),
          totalSales,
          totalExpenses,
          netRevenue: totalSales - totalExpenses,
        };

        set({ dayCloseState: dayClose, businessDayState: {
          ...(get().businessDayState ?? {
            id: `bd-${Date.now()}`,
            date: today,
            status: 'CLOSED',
            totalSales: 0,
            totalRevenue: 0,
            invoiceCount: 0,
            returnCount: 0,
            discountTotal: 0,
            taxTotal: 0,
          }),
          date: today,
          status: 'CLOSED',
          closedAt: new Date(),
          closedBy: managerId,
          closingNote: 'إغلاق يوم محاسبي من نظام الإغلاق',
          totalSales: dayClose.totalSales,
          totalRevenue: dayClose.netRevenue,
          invoiceCount: dayClose.totalShifts,
          returnCount: 0,
          discountTotal: 0,
          taxTotal: 0,
        } });

        // Add activity log
        get().addActivityLog({
          id: `log-${Date.now()}`,
          employeeId: managerId,
          action: 'Day Close Executed',
          timestamp: new Date(),
          details: {
            date: today,
            totalShifts: dayClose.totalShifts,
            totalSales: dayClose.totalSales,
            totalExpenses: dayClose.totalExpenses,
            netRevenue: dayClose.netRevenue,
          },
        });
      },

      canExecuteDayClose: () => {
        const { shifts, blindDropSubmissions } = get();
        const today = new Date().toISOString().split('T')[0];

        // Get today's shifts
        const todayShifts = shifts.filter(s => {
          const shiftDate = new Date(s.startTime).toISOString().split('T')[0];
          return shiftDate === today;
        });

        // Check if all shifts are closed
        const allClosed = todayShifts.every(s => s.status === 'CLOSED');

        // Check if all cashiers have submitted blind drops
        const todayCashiers = todayShifts.map(s => s.cashierId);
        const submittedCashiers = blindDropSubmissions
          .filter(sub => {
            const subDate = new Date(sub.submittedAt).toISOString().split('T')[0];
            return subDate === today;
          })
          .map(sub => sub.cashierId);

        const allSubmitted = todayCashiers.every(cashierId => submittedCashiers.includes(cashierId));

        return allClosed && allSubmitted && todayShifts.length > 0;
      },
    }),
    {
      name: 'o2-company-storage',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isLoggedIn: state.isLoggedIn,
        userRole: state.userRole,
        currentShift: state.currentShift,
        shifts: state.shifts,
        orders: state.orders,
        financialTransactions: state.financialTransactions,
        activityLogs: state.activityLogs,
        branches: state.branches,
        departments: state.departments,
        employees: state.employees,
        blindDropSubmissions: state.blindDropSubmissions,
        reconciliationEntries: state.reconciliationEntries,
        dayCloseState: state.dayCloseState,
        businessDayState: state.businessDayState,
      }),
    }
  )
);