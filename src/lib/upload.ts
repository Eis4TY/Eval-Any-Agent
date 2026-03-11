import Papa from "papaparse";
import * as XLSX from "xlsx";

export type DatasetParsed = {
  columns: string[];
  rows: Record<string, unknown>[];
  fileType: "csv" | "xlsx";
};

export async function parseDataset(file: File): Promise<DatasetParsed> {
  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());

  const isNotEmptyRow = (row: Record<string, unknown>) => {
    return Object.values(row).some((v) => {
      if (v === null || v === undefined) return false;
      if (typeof v === "string") return v.trim() !== "";
      return true;
    });
  };

  if (name.endsWith(".csv")) {
    const text = bytes.toString("utf-8");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data.filter(isNotEmptyRow);
    const columns = parsed.meta.fields ?? [];
    return { rows, columns, fileType: "csv" };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
    const rows = allRows.filter(isNotEmptyRow);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { rows, columns, fileType: "xlsx" };
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
