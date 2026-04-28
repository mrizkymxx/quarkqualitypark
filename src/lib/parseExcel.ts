import * as XLSX from "xlsx";

export type ParsedPlanningRow = {
  spk_number: string;
  schedule_date: string | null;
  delivery_date: string | null;
  customer_name: string;
  customer_po_number: string;
  article: string;
  box_plot: string;
  paper: string;
  specifications: string;
  orders: number;
  note: string;
  p_mm: string;
  l_mm: string;
  audit_date: string;
  remark: string;
};

/** Convert an Excel date value (serial number OR "dd/mm/yyyy" string) to "YYYY-MM-DD" */
function toISODate(val: unknown): string | null {
  if (!val && val !== 0) return null;
  if (typeof val === "number") {
    // Excel serial date: days since 1900-01-00 (with the leap-year bug offset)
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;
    // dd/mm/yyyy or d/m/yyyy
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return null;
}

function str(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

/**
 * Parse any PPIC Planning Excel file.
 * Auto-detects if row 1 is a title row (contains "PLANNING PRODUKSI")
 * and uses row 2 as headers in that case.
 */
export async function parsePlanningExcel(file: File): Promise<ParsedPlanningRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Always read raw rows first with array headers
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });

  if (rawRows.length < 2) return [];

  // Determine header row index (0 = row 1)
  const firstCellText = str(rawRows[0]?.[0]).toUpperCase();
  const headerRowIdx = firstCellText.includes("PLANNING PRODUKSI") ? 1 : 0;

  const headers = (rawRows[headerRowIdx] as unknown[]).map((h) => str(h));
  const dataRows = rawRows.slice(headerRowIdx + 1);

  const col = (row: unknown[], name: string): unknown => {
    const idx = headers.indexOf(name);
    return idx >= 0 ? row[idx] : "";
  };

  const results: ParsedPlanningRow[] = [];

  for (const row of dataRows) {
    const spk_number = str(col(row as unknown[], "Number SPK"));
    // Skip completely empty rows
    if (!spk_number && !str(col(row as unknown[], "customer name"))) continue;

    results.push({
      spk_number,
      schedule_date: toISODate(col(row as unknown[], "Schedule date")),
      delivery_date: toISODate(col(row as unknown[], "Delivery date")),
      customer_name: str(col(row as unknown[], "customer name")),
      customer_po_number: str(col(row as unknown[], "Customer order number")),
      article: str(col(row as unknown[], "customer article number")),
      box_plot: str(col(row as unknown[], "box plot")),
      paper: str(col(row as unknown[], "paper")),
      specifications: str(col(row as unknown[], "specifications")),
      orders: Number(col(row as unknown[], "orders")) || 0,
      note: str(col(row as unknown[], "note")),
      p_mm: str(col(row as unknown[], "P")),
      l_mm: str(col(row as unknown[], "L")),
      audit_date: str(col(row as unknown[], "Audit date")),
      remark: str(col(row as unknown[], "Remark")),
    });
  }

  return results;
}

/**
 * Map a ParsedPlanningRow to a purchase_orders insert payload.
 * - po_number      = "PO-{spk_number}"
 * - material_type  = paper + specifications (full material spec)
 * - supplier_name  = Remark (sumber bahan: SHEET GUDANG / SHEET SLITTER)
 * - is_stock_po    = always false (never auto-activated)
 * - ordered_qty    = orders column
 * - notes          = P + L dimensions detail
 */
export function rowToPORecord(r: ParsedPlanningRow, salesOrderId: string) {
  // material_type: gabungan kertas + dimensi box (spesifikasi lengkap)
  const materialParts = [r.paper, r.specifications].filter(Boolean);
  const material_type = materialParts.join(" | ") || "Kertas";

  // notes: detail dimensi P × L
  const notesParts = [
    r.p_mm ? `P: ${r.p_mm} mm` : "",
    r.l_mm ? `L: ${r.l_mm} mm` : "",
    r.note ? `Catatan: ${r.note}` : "",
  ];
  const notes = notesParts.filter(Boolean).join(" | ") || null;

  return {
    po_number: `PO-${r.spk_number}`,
    sales_order_id: salesOrderId,
    material_type,
    ordered_quantity: r.orders,
    supplier_name: r.remark || null,  // SHEET GUDANG / SHEET SLITTER
    is_stock_po: false,               // tidak pernah diaktifkan otomatis
    notes,
  };
}

/**
 * Map a ParsedPlanningRow to a sales_orders insert payload.
 * - so_number        = spk_number  (Number SPK is the main key)
 * - product_name     = article (customer article number)
 * - product_type     = "box_plot | paper | specifications | P:{p} L:{l}"
 * - notes            = "note | Audit date | Remark"
 */
export function rowToSORecord(r: ParsedPlanningRow) {
  const productTypeParts = [r.box_plot, r.paper, r.specifications];
  if (r.p_mm) productTypeParts.push(`P:${r.p_mm}`);
  if (r.l_mm) productTypeParts.push(`L:${r.l_mm}`);
  const product_type = productTypeParts.filter(Boolean).join(" | ") || null;

  const notesParts = [r.note, r.audit_date, r.remark];
  const notes = notesParts.filter(Boolean).join(" | ") || null;

  return {
    so_number: r.spk_number,
    client_name: r.customer_name,
    product_name: r.article || r.spk_number,
    product_type,
    quantity: r.orders,
    due_date: r.delivery_date,
    schedule_date: r.schedule_date,
    customer_po_number: r.customer_po_number,
    notes,
  };
}
