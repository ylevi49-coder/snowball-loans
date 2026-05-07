"use client";
import { useState, useCallback } from "react";
import { Loan } from "@/types";
import { parseFile, applyMapping, analyzeVariableRate } from "@/lib/importEngine";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Badge } from "./ui/badge";
import { v4 as uuidv4 } from "uuid";
import { today } from "@/lib/utils";
import {
  Upload, Sparkles, CheckCircle2, AlertTriangle,
  FileSpreadsheet, ArrowLeft, FileText, Image, Loader2,
  KeyRound, Activity,
} from "lucide-react";

type Step = "upload" | "mapping" | "preview";
type FileKind = "spreadsheet" | "pdf" | "image";

interface PreviewLoan extends Partial<Loan> {
  _selected: boolean;
}

const SPREADSHEET_EXTS = [".xlsx", ".xls", ".csv", ".ods"];
const ACCEPT = [...SPREADSHEET_EXTS, ".pdf", ".png", ".jpg", ".jpeg", ".webp"].join(",");

const FIELD_OPTIONS = [
  { value: "", label: "— לא ממפה —" },
  { value: "name", label: "שם ההלוואה / מסלול" },
  { value: "originalAmount", label: "סכום מקורי (₪)" },
  { value: "currentBalance", label: "יתרה נוכחית (₪)" },
  { value: "annualInterestRate", label: "ריבית שנתית (%) — אחוז" },
  { value: "monthlyInterestAmount", label: "ריבית חודשית (₪) — סכום" },
  { value: "monthlyPayment", label: "תשלום חודשי כולל (₪)" },
  { value: "principalAmount", label: "קרן חודשית (₪)" },
  { value: "paymentDate", label: "תאריך תשלום" },
  { value: "notes", label: "הערות" },
];

function detectKind(file: File): FileKind {
  const name = file.name.toLowerCase();
  if (SPREADSHEET_EXTS.some((e) => name.endsWith(e))) return "spreadsheet";
  if (name.endsWith(".pdf")) return "pdf";
  return "image";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      resolve(dataUrl.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type AllowedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const ALLOWED_IMAGE_TYPES: AllowedImageType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
  onImport: (loans: Loan[]) => void;
}

export function ImportWizard({ open, onClose, onImport }: ImportWizardProps) {
  const [step, setStep] = useState<Step>("upload");
  const [kind, setKind] = useState<FileKind>("spreadsheet");

  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [aiExplanation, setAiExplanation] = useState("");
  const [aiConfidence, setAiConfidence] = useState(0);
  const [aiUsed, setAiUsed] = useState(false);
  const [aiIsAmortization, setAiIsAmortization] = useState(false);
  const [aiHasVariable, setAiHasVariable] = useState(false);
  const [aiVariableNote, setAiVariableNote] = useState("");

  const [previewLoans, setPreviewLoans] = useState<PreviewLoan[]>([]);
  const [variableDetected, setVariableDetected] = useState(false);
  const [rateInfo, setRateInfo] = useState<{ min: number; max: number; avg: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setStep("upload"); setKind("spreadsheet");
    setHeaders([]); setSampleRows([]); setRawData([]);
    setMapping({});
    setAiExplanation(""); setAiConfidence(0); setAiUsed(false);
    setAiIsAmortization(false); setAiHasVariable(false); setAiVariableNote("");
    setPreviewLoans([]); setVariableDetected(false); setRateInfo(null);
    setLoading(false); setLoadingMsg(""); setError("");
  };

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setLoading(true);
    const fileKind = detectKind(file);
    setKind(fileKind);

    try {
      if (fileKind === "spreadsheet") {
        setLoadingMsg("קורא קובץ...");
        const { headers: h, rows, rawData: rd } = await parseFile(file);
        setHeaders(h);
        setSampleRows(rows.slice(0, 5));
        setRawData(rd);

        setLoadingMsg("AI מנתח עמודות...");
        try {
          const res = await fetch("/api/ai-mapping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers: h, sampleRows: rows.slice(0, 5) }),
          });
          const json = await res.json();
          if (json.mapping && Object.keys(json.mapping).length > 0) {
            const clean: Record<string, string> = {};
            for (const [field, col] of Object.entries(json.mapping)) {
              if (col && h.includes(col as string)) clean[field] = col as string;
            }
            setMapping(clean);
            setAiConfidence(json.confidence ?? 0);
            setAiExplanation(json.explanation ?? "");
            setAiIsAmortization(json.isAmortizationTable ?? false);
            setAiHasVariable(json.hasVariableRate ?? false);
            setAiVariableNote(json.variableRateNote ?? "");
            setAiUsed(Object.keys(clean).length > 0);
          }
        } catch {
          // AI unavailable — fall back to manual
        }
        setStep("mapping");
      } else {
        setLoadingMsg("שולח ל-AI לניתוח...");
        const base64 = await fileToBase64(file);
        const rawType = fileKind === "pdf" ? "application/pdf" : (file.type || "image/png");
        const mediaType = ALLOWED_IMAGE_TYPES.includes(rawType as AllowedImageType) || rawType === "application/pdf"
          ? rawType : "image/png";

        const res = await fetch("/api/ai-pdf-extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: base64, mediaType }),
        });
        const json = await res.json();

        if (res.status === 400 || res.status === 401 || json.error === "NO_API_KEY") {
          setError("NO_API_KEY");
          return;
        }
        if (json.error === "OVERLOADED") {
          setError("OVERLOADED");
          return;
        }
        if (!res.ok) throw new Error(json.error ?? `שגיאת שרת ${res.status}`);

        const loans: PreviewLoan[] = (json.loans ?? []).map((l: Partial<Loan>) => ({ ...l, _selected: true }));
        if (loans.length === 0)
          throw new Error("ה-AI לא מצא הלוואות במסמך.");

        setAiExplanation(json.summary ?? "");
        setAiConfidence(json.confidence ?? 0.9);
        setPreviewLoans(loans);
        setStep("preview");
      }
    } catch (err) {
      setError((err as Error).message || "שגיאה לא ידועה");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const setField = (header: string, fieldKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === header) delete next[k];
      }
      if (fieldKey) next[fieldKey] = header;
      return next;
    });
  };

  const handleConfirmMapping = () => {
    const analysis = analyzeVariableRate(rawData, mapping);
    const loans: PreviewLoan[] = applyMapping(rawData, mapping).map((l) => ({ ...l, _selected: true }));

    if (loans.length === 0) {
      setError("לא נמצאו שורות עם נתונים — ודא שמיפית לפחות 'שם' או 'יתרה'");
      return;
    }

    setVariableDetected(analysis.isVariable);
    if (analysis.isVariable || analysis.isAmortizationTable) {
      setRateInfo({ min: analysis.minRate, max: analysis.maxRate, avg: analysis.avgRate });
    }

    setPreviewLoans(loans);
    setStep("preview");
  };

  const handleImport = () => {
    const chosen = previewLoans.filter((l) => l._selected);
    const fullLoans: Loan[] = chosen.map((l, i) => ({
      id: uuidv4(),
      name: l.name || `הלוואה ${i + 1}`,
      originalAmount: l.originalAmount ?? l.currentBalance ?? 0,
      currentBalance: l.currentBalance ?? 0,
      annualInterestRate: l.annualInterestRate ?? l.rateAvg ?? 0,
      monthlyPayment: l.monthlyPayment ?? 0,
      status: "active" as const,
      priority: i + 1,
      startDate: today(),
      notes: l.notes ?? "",
      rateType: l.rateType,
      rateMin: l.rateMin,
      rateMax: l.rateMax,
      rateAvg: l.rateAvg,
      importedSchedule: l.importedSchedule,
    }));
    onImport(fullLoans);
    reset();
    onClose();
  };

  const toggleSelect = (i: number) =>
    setPreviewLoans((ls) => ls.map((l, idx) => (idx === i ? { ...l, _selected: !l._selected } : l)));

  const renameLoan = (i: number, newName: string) =>
    setPreviewLoans((ls) => ls.map((l, idx) => (idx === i ? { ...l, name: newName } : l)));

  const stepIdx = { upload: 0, mapping: 1, preview: 2 }[step];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="ייבוא הלוואות" size="xl">
      <div className="p-6">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6">
          {(["upload", "mapping", "preview"] as Step[]).map((s, i) => {
            const labels = ["העלאת קובץ", "מיפוי עמודות", "אישור נתונים"];
            const done = i < stepIdx;
            const active = s === step;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${active ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {done ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className={`text-sm hidden sm:inline ${active ? "font-semibold text-blue-700" : "text-slate-500"}`}>
                  {s === "mapping" && kind !== "spreadsheet" ? "ניתוח AI" : labels[i]}
                </span>
                {i < 2 && <ArrowLeft size={14} className="text-slate-300 rotate-180" />}
              </div>
            );
          })}
        </div>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("import-file-input")?.click()}
            >
              <input id="import-file-input" type="file" accept={ACCEPT} className="hidden" onChange={handleInput} />
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={36} className="animate-spin text-blue-600" />
                  <p className="text-blue-700 font-medium">{loadingMsg || "מעבד..."}</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-4 mb-4 text-slate-300">
                    <FileSpreadsheet size={40} /><FileText size={40} /><Image size={40} />
                  </div>
                  <p className="font-semibold text-slate-600 text-lg">גרור קובץ לכאן או לחץ לבחירה</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {[
                      { icon: <FileSpreadsheet size={13} />, label: "Excel / CSV", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                      { icon: <FileText size={13} />, label: "PDF — ניתוח AI", color: "text-red-600 bg-red-50 border-red-200" },
                      { icon: <Image size={13} />, label: "תמונה — ניתוח AI", color: "text-violet-600 bg-violet-50 border-violet-200" },
                    ].map(({ icon, label, color }) => (
                      <span key={label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${color}`}>
                        {icon}{label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {error === "OVERLOADED" ? (
              <div className="p-5 bg-orange-50 border border-orange-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-orange-800 font-bold">
                  <Loader2 size={18} className="text-orange-500" />
                  שרת ה-AI עמוס כרגע
                </div>
                <p className="text-sm text-orange-700">
                  המערכת ניסתה 3 פעמים ולא הצליחה. ניתן לנסות שוב בעוד מספר שניות, או לייבא קובץ Excel במקום.
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => { setError(""); }}>
                    נסה שוב
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setError("")}>חזור לייבוא Excel</Button>
                </div>
              </div>
            ) : error === "NO_API_KEY" ? (
              <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <KeyRound size={18} className="text-amber-600" />
                  נדרש מפתח Anthropic API לניתוח PDF / תמונות
                </div>
                <ol className="text-sm text-amber-800 space-y-1.5 list-decimal list-inside">
                  <li>היכנס ל-<span className="font-mono bg-amber-100 px-1 rounded">console.anthropic.com</span></li>
                  <li>צור מפתח API חדש</li>
                  <li>פתח <span className="font-mono bg-amber-100 px-1 rounded">.env.local</span> בתיקיית הפרויקט</li>
                  <li>הוסף: <span className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY=sk-ant-api...</span></li>
                  <li>הפעל מחדש: <span className="font-mono bg-amber-100 px-1 rounded">npm run dev</span></li>
                </ol>
                <Button variant="secondary" size="sm" onClick={() => setError("")}>חזור לייבוא Excel</Button>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* STEP 2: Column mapping */}
        {step === "mapping" && kind === "spreadsheet" && (
          <div className="space-y-4">
            {aiUsed && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
                <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800">
                    זיהוי AI — ביטחון {Math.round(aiConfidence * 100)}%
                    {aiIsAmortization && <span className="mr-2"><Badge variant="info">טבלת סילוקין</Badge></span>}
                  </p>
                  {aiExplanation && <p className="text-xs text-blue-700 mt-0.5">{aiExplanation}</p>}
                </div>
              </div>
            )}
            {(aiHasVariable || aiIsAmortization) && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-start gap-2">
                <Activity size={16} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-violet-800">
                    {aiHasVariable ? "זוהתה ריבית משתנה" : "טבלת תשלומים — שורה לכל חודש"}
                  </p>
                  {aiVariableNote && <p className="text-xs text-violet-700 mt-0.5">{aiVariableNote}</p>}
                </div>
              </div>
            )}
            {!aiUsed && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">מפה ידנית — בחר לאיזה שדה שייכת כל עמודה.</p>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full rtl-table text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-40">עמודה בקובץ</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">דוגמאות ערכים</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 w-56">מיפוי לשדה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {headers.map((header) => {
                    const currentField = Object.entries(mapping).find(([, v]) => v === header)?.[0] ?? "";
                    const samples = sampleRows.map((r) => r[headers.indexOf(header)]).filter((v) => v?.trim()).slice(0, 3);
                    return (
                      <tr key={header} className={`hover:bg-slate-50 ${currentField === "monthlyInterestAmount" ? "bg-violet-50/40" : ""}`}>
                        <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{header}</td>
                        <td className="px-3 py-2.5 text-slate-500 text-xs max-w-xs truncate">
                          {samples.length ? samples.join(" | ") : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 w-56">
                          <Select options={FIELD_OPTIONS} value={currentField} onChange={(e) => setField(header, e.target.value)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">כיצד לבחור שדה ריבית:</p>
              <p>• <span className="font-medium text-blue-700">ריבית שנתית (%)</span> — אם העמודה מכילה ערכים כמו 4.5, 5.2</p>
              <p>• <span className="font-medium text-violet-700">ריבית חודשית (₪)</span> — אם העמודה מכילה סכומים כמו 800, 1,200</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-700 text-sm">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />{error}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => { setStep("upload"); setError(""); }}>חזור</Button>
              <Button onClick={handleConfirmMapping}><Upload size={14} />אשר מיפוי</Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {aiExplanation && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
                <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">סיכום AI</p>
                  <p className="text-xs text-blue-700 mt-0.5">{aiExplanation}</p>
                </div>
              </div>
            )}
            {(variableDetected || rateInfo) && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl flex items-start gap-2">
                <Activity size={16} className="text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-violet-800 flex items-center gap-2">
                    ריבית משתנה זוהתה <Badge variant="warning">משתנה</Badge>
                  </p>
                  {rateInfo && <p className="text-xs text-violet-700 mt-0.5">טווח: {rateInfo.min.toFixed(2)}%–{rateInfo.max.toFixed(2)}% | ממוצע: {rateInfo.avg.toFixed(2)}%</p>}
                </div>
              </div>
            )}

            <p className="text-sm text-slate-600">
              נמצאו <span className="font-bold text-blue-600">{previewLoans.length}</span> הלוואות — סמן אילו לכלול ועדכן שמות:
            </p>

            <div className="overflow-auto max-h-72 rounded-xl border border-slate-200">
              <table className="w-full rtl-table text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">שם</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">יתרה (₪)</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">ריבית</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">תשלום חודשי</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">הערות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previewLoans.map((loan, i) => (
                    <tr key={i} className={`cursor-pointer transition-colors ${loan._selected ? "hover:bg-slate-50" : "opacity-40 bg-slate-50"}`} onClick={() => toggleSelect(i)}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={loan._selected} readOnly className="rounded" /></td>
                      <td className="px-3 py-2.5 font-medium text-slate-800" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={loan.name ?? ""}
                            onChange={(e) => renameLoan(i, e.target.value)}
                            placeholder={`הלוואה ${i + 1}`}
                            className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                          />
                          {loan.rateType === "variable" && <Badge variant="warning" className="text-xs">משתנה</Badge>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 font-medium">
                        {loan.currentBalance ? `₪${loan.currentBalance.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {loan.rateType === "variable" && loan.rateMin != null ? (
                          <span className="text-violet-700 font-semibold text-xs">{loan.rateMin.toFixed(1)}%–{loan.rateMax?.toFixed(1)}%</span>
                        ) : loan.annualInterestRate ? (
                          <span className={`font-semibold ${loan.annualInterestRate > 8 ? "text-red-600" : loan.annualInterestRate > 4 ? "text-amber-600" : "text-emerald-600"}`}>
                            {loan.annualInterestRate.toFixed(2)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {loan.monthlyPayment ? `₪${loan.monthlyPayment.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs max-w-xs truncate">
                        {loan.notes || (loan.importedSchedule ? `${loan.importedSchedule.length} תשלומים` : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button variant="secondary" onClick={() => setStep(kind === "spreadsheet" ? "mapping" : "upload")}>חזור</Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{previewLoans.filter((l) => l._selected).length} נבחרו</span>
                <Button variant="success" disabled={previewLoans.filter((l) => l._selected).length === 0} onClick={handleImport}>
                  <CheckCircle2 size={14} />ייבא הלוואות
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
