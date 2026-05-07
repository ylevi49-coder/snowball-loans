"use client";
import { useState, useEffect } from "react";
import { Loan, LoanStatus } from "@/types";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { today } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface LoanFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (loan: Loan) => void;
  loan?: Loan | null;
}

const DEFAULT: Partial<Loan> = {
  name: "",
  originalAmount: 0,
  currentBalance: 0,
  annualInterestRate: 0,
  monthlyPayment: 0,
  status: "active",
  notes: "",
};

export function LoanForm({ open, onClose, onSave, loan }: LoanFormProps) {
  const [form, setForm] = useState<Partial<Loan>>(DEFAULT);

  useEffect(() => {
    setForm(loan ?? DEFAULT);
  }, [loan, open]);

  const set = (field: keyof Loan, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = loan?.id ?? uuidv4();
    onSave({
      id: now,
      name: form.name || "הלוואה חדשה",
      originalAmount: Number(form.originalAmount) || Number(form.currentBalance) || 0,
      currentBalance: Number(form.currentBalance) || 0,
      annualInterestRate: Number(form.annualInterestRate) || 0,
      monthlyPayment: Number(form.monthlyPayment) || 0,
      status: (form.status as LoanStatus) || "active",
      priority: loan?.priority ?? 99,
      startDate: loan?.startDate || today(),
      notes: form.notes || "",
    });
    onClose();
  };

  const field = (
    label: string,
    key: keyof Loan,
    type: "text" | "number" = "number",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ""}
        onChange={(e) => set(key, type === "number" ? e.target.value : e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={loan ? "עריכת הלוואה" : "הוספת הלוואה"}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {field("שם ההלוואה", "name", "text", "למשל: משכנתא, הלוואת רכב")}
        {field("סכום מקורי (₪)", "originalAmount", "number", "0")}
        {field("יתרה נוכחית (₪)", "currentBalance", "number", "0")}
        {field("ריבית שנתית (%)", "annualInterestRate", "number", "0")}
        {field("תשלום חודשי (₪)", "monthlyPayment", "number", "0")}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">סטטוס</label>
          <select
            value={form.status || "active"}
            onChange={(e) => set("status", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="active">פעיל</option>
            <option value="grace">גרייס</option>
            <option value="frozen">קפוא</option>
            <option value="paid">שולם</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">הערות</label>
          <textarea
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>ביטול</Button>
          <Button type="submit" variant="success">
            {loan ? "שמור שינויים" : "הוסף הלוואה"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
