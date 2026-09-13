'use client'

import { useParams } from 'react-router-dom'
import { useCustomerTable } from '../../hooks/useCustomerTable'
import { CartProvider } from './cart-provider'
import { Loader2 } from 'lucide-react'
import { TableWaitingPage } from './TableWaitingPage'

const OCCUPIED_STATUSES = ['OCCUPIED', 'PAYMENT_PENDING', 'BILL_PRINTED', 'PENDING_CONFIRMATION']

export function CustomerTableProvider({ children }: { children: React.ReactNode }) {
  const { qrCode } = useParams<{ qrCode: string }>()
  const { table, categories, allItems, restaurant, loading, error } = useCustomerTable(qrCode)

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0f12]" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-[#c8a44e]" />
          <p className="text-sm text-[#8b949e]">جاري تحميل بيانات الطاولة...</p>
        </div>
      </main>
    )
  }

  if (error || !table) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0f12] px-6" dir="rtl">
        <div className="text-center">
          <p className="font-serif text-xl font-bold text-white">خطأ</p>
          <p className="mt-2 text-sm text-[#8b949e]">{error || 'الطاولة غير موجودة'}</p>
        </div>
      </main>
    )
  }

  // إذا الطاولة مش مشغولة → صفحة الانتظار
  if (!OCCUPIED_STATUSES.includes(table.status)) {
    return (
      <TableWaitingPage table={table} restaurantName={restaurant.name} />
    )
  }

  return (
    <CartProvider
      tableInfo={table}
      categories={categories}
      allItems={allItems}
      restaurant={restaurant}
      qrCode={qrCode}
    >
      {children}
    </CartProvider>
  )
}
