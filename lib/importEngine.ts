import type * as XLSXType from "xlsx";
import { Loan, ImportedPaymentRow, VariableRateAnalysis } from "@/types";

export interface ParsedFile {
  headers: string[];
  rows: string[][];
  rawData: Record<string, string>[];
}

async function getXLSX(): Promise<typeof XLSXType> {
  const mod = await import("xlsx");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ("default" in mod ? (mod as any).default : mod) as typeof XLSXType;
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result instanceof ArrayBuffer) resolve(result);
      else reject(new Error("לא ניתן לקרוא את הקובץ"));
    };
    reader.onerror = () => reject(new Error("שגיאה בקריאת הקובץ"));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const XLSX = await getXLSX();
  const buffer = await readFileAsArrayBuffer(file);
  const data = new Uint8Array(buffer);

  const workbook = XLSX.read(data, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("הקובץ ריק — לא נמצאה גיליון");

  const sheet = workbook.Sheets[sheetName];
  const json: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  const headerRowIdx = json.findIndex((row) =>
    row.some((c) => String(c).trim() !== "")
  );
  if (headerRowIdx === -1 || json.length <= headerRowIdx + 1) {
    throw new Error("הקובץ ריק או חסרות שורות נתונים");
  }

  const headers = json[headerRowIdx]
    .map((h) => String(h).trim())
    .filter(Boolean);
  const dataRows = json.slice(headerRowIdx + 1);

  const rows = dataRows
    .filter((row) => row.some((c) => String(c).trim() !== ""))
    .map((row) => headers.map((_, i) => String(row[i] ?? "").trim()));

  const rawData = rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });

  if (rows.length === 0) throw new Error("לא נמצאו שורות נתונים לאחר כותרת");

  return { headers, rows, rawData };
}

export function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s₪$€£]/g, "").replace(/%$/, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function analyzeVariableRate(
  rawData: Record<string, string>[],
  mapping: Record<string, string>
): VariableRateAnalysis {
  const empty: VariableRateAnalysis = {
    isVariable: false,
    isAmortizationTable: false,
    avgRate: 0,
    minRate: 0,
    maxRate: 0,
    rateSpread: 0,
    rowCount: rawData.length,
  };

  if (rawData.length < 2) return empty;

  const hasDate = !!mapping.paymentDate;
  const hasInterestAmount = !!mapping.monthlyInterestAmount;
  const hasBalance = !!mapping.currentBalance;
  const hasPrincipal = !!mapping.principalAmount;

  const isAmortizationTable =
    rawData.length >= 3 && hasDate && (hasInterestAmount || hasPrincipal);

  if (!hasInterestAmount || !hasBalance) {
    return { ...empty, isAmortizationTable };
  }

  const rates: number[] = [];
  for (const row of rawData) {
    const interest = parseNum(row[mapping.monthlyInterestAmount]);
    const balance = parseNum(row[mapping.currentBalance]);
    if (interest !== null && balance !== null && balance > 1000) {
      const annual = (interest / balance) * 12 * 100;
      if (annual > 0.5 && annual < 50) rates.push(annual);
    }
  }

  if (rates.length < 2) return { ...empty, isAmortizationTable };

  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  const spread = max - min;

  return {
    isVariable: spread > 0.3,
    isAmortizationTable,
    avgRate: Math.round(avg * 100) / 100,
    minRate: Math.round(min * 100) / 100,
    maxRate: Math.round(max * 100) / 100,
    rateSpread: Math.round(spread * 100) / 100,
    rowCount: rawData.length,
  };
}

export function buildImportedSchedule(
  rawData: Record<string, string>[],
  mapping: Record<string, string>
): ImportedPaymentRow[] {
  return rawData
    .map((row) => {
      const interest = mapping.monthlyInterestAmount
        ? (parseNum(row[mapping.monthlyInterestAmount]) ?? undefined)
        : undefined;
      const balance = mapping.currentBalance
        ? (parseNum(row[mapping.currentBalance]) ?? undefined)
        : undefined;
      const annualRate =
        interest !== undefined && balance !== undefined && balance > 0
          ? Math.round(((interest / balance) * 12 * 100) * 100) / 100
          : undefined;
      return {
        date: mapping.paymentDate ? row[mapping.paymentDate] : undefined,
        payment: mapping.monthlyPayment
          ? (parseNum(row[mapping.monthlyPayment]) ?? undefined)
          : undefined,
        principal: mapping.principalAmount
          ? (parseNum(row[mapping.principalAmount]) ?? undefined)
          : undefined,
        interest,
        balance,
        annualRate,
      };
    })
    .filter((r) => r.interest !== undefined || r.balance !== undefined || r.payment !== undefined);
}

export function applyMapping(
  rawData: Record<string, string>[],
  mapping: Record<string, string>
): Partial<Loan>[] {
  const analysis = analyzeVariableRate(rawData, mapping);
  if (analysis.isAmortizationTable) {
    return applyAmortizationMapping(rawData, mapping, analysis);
  }
  return rawData
    .filter((row) => Object.values(row).some((v) => v.trim() !== ""))
    .map((row) => loanFromRow(row, mapping))
    .filter((l) => l.name || l.currentBalance);
}

function loanFromRow(
  row: Record<string, string>,
  mapping: Record<string, string>
): Partial<Loan> {
  const loan: Partial<Loan> = {};
  if (mapping.name) loan.name = row[mapping.name]?.trim() ?? "";
  if (mapping.originalAmount) {
    const v = parseNum(row[mapping.originalAmount]);
    if (v !== null) loan.originalAmount = v;
  }
  if (mapping.currentBalance) {
    const v = parseNum(row[mapping.currentBalance]);
    if (v !== null) loan.currentBalance = v;
  }
  if (mapping.annualInterestRate) {
    let v = parseNum(row[mapping.annualInterestRate]);
    if (v !== null) {
      if (v > 0 && v < 1) v = v * 100;
      loan.annualInterestRate = v;
    }
  }
  if (!loan.annualInterestRate && mapping.monthlyInterestAmount && mapping.currentBalance) {
    const interest = parseNum(row[mapping.monthlyInterestAmount]);
    const balance = parseNum(row[mapping.currentBalance]);
    if (interest !== null && balance !== null && balance > 0) {
      loan.annualInterestRate = Math.round(((interest / balance) * 12 * 100) * 100) / 100;
    }
  }
  if (mapping.monthlyPayment) {
    const v = parseNum(row[mapping.monthlyPayment]);
    if (v !== null) loan.monthlyPayment = v;
  } else if (mapping.principalAmount && mapping.monthlyInterestAmount) {
    const p = parseNum(row[mapping.principalAmount]);
    const i = parseNum(row[mapping.monthlyInterestAmount]);
    if (p !== null && i !== null) loan.monthlyPayment = p + i;
  }
  if (mapping.notes) loan.notes = row[mapping.notes]?.trim() ?? "";
  return loan;
}

function applyAmortizationMapping(
  rawData: Record<string, string>[],
  mapping: Record<string, string>,
  analysis: VariableRateAnalysis
): Partial<Loan>[] {
  const schedule = buildImportedSchedule(rawData, mapping);
  if (schedule.length === 0) return [];

  const firstRow = rawData[0];
  const name = mapping.name ? firstRow[mapping.name]?.trim() : undefined;
  const currentBalance =
    (mapping.currentBalance ? parseNum(firstRow[mapping.currentBalance]) : null) ??
    schedule[0]?.balance ?? 0;
  const annualInterestRate =
    (mapping.annualInterestRate ? parseNum(firstRow[mapping.annualInterestRate]) ?? null : null) ??
    analysis.avgRate;
  const monthlyPayment =
    schedule[0]?.payment ?? ((schedule[0]?.principal ?? 0) + (schedule[0]?.interest ?? 0));

  const loan: Partial<Loan> = {
    name: name || "הלוואה מיובאת",
    currentBalance,
    annualInterestRate,
    monthlyPayment,
    rateType: analysis.isVariable ? "variable" : "fixed",
    rateMin: analysis.minRate,
    rateMax: analysis.maxRate,
    rateAvg: analysis.avgRate,
    importedSchedule: schedule,
  };

  return [loan];
}
