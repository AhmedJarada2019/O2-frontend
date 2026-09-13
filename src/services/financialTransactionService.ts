import api from "../api/axios";
import type { FinancialTransaction, FinancialTransactionType } from "../../types";

const BASE = "/financial-transactions";

async function unwrap<T>(p: Promise<{ data: { data?: T } | T }>): Promise<T> {
  const { data } = await p;
  return (data as any).data !== undefined ? (data as any).data : (data as T);
}

export const financialTransactionService = {
  getAll: (params?: { branch_id?: number; date?: string; shift_id?: number }) =>
    unwrap<FinancialTransaction[]>(api.get(BASE, { params })),

  create: (data: { type: FinancialTransactionType; amount: number; reason?: string }) =>
    unwrap<FinancialTransaction>(api.post(BASE, data)),
};
