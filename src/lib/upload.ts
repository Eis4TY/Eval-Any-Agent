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

  if (name.endsWith(".csv")) {
    const text = bytes.toString("utf-8");
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data.filter((row) => Object.values(row).some((v) => v !== "" && v !== undefined));
    const columns = parsed.meta.fields ?? [];
    return { rows, columns, fileType: "csv" };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return { rows, columns, fileType: "xlsx" };
  }

  throw new Error("UNSUPPORTED_FILE_TYPE");
}
