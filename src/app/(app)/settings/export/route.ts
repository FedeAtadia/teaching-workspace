import { getMessages } from "next-intl/server";
import { getDb } from "@/db";
import { loadExport } from "@/db/queries/account";
import { requireTeacherId } from "@/lib/auth";
import { toSheets, type ExportLabels } from "@/lib/dataExport";

type Messages = { dataExport: Omit<ExportLabels, "weekdays"> & { fileName: string }; weekdays: Record<string, string> };

/** DATA-1, DATA-2: the signed-in teacher's data as one Excel file. */
export async function GET() {
  const teacherId = await requireTeacherId();
  const [data, messages, { default: ExcelJS }] = await Promise.all([
    loadExport(getDb(), teacherId),
    getMessages() as unknown as Promise<Messages>,
    import("exceljs"),
  ]);
  const { fileName, ...labels } = messages.dataExport;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Annora";
  for (const sheet of toSheets(data, { ...labels, weekdays: messages.weekdays })) {
    const ws = workbook.addWorksheet(sheet.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(sheet.columns).font = { bold: true };
    ws.addRows(sheet.rows);
    sheet.columns.forEach((title, i) => {
      const column = ws.getColumn(i + 1);
      const longest = Math.max(title.length, ...sheet.rows.map((r) => (r[i] instanceof Date ? 10 : String(r[i] ?? "").length)));
      column.width = Math.min(Math.max(longest + 2, 10), 60);
      // DATA-2: dates stay dates, shown day first.
      if (sheet.rows.some((r) => r[i] instanceof Date)) column.numFmt = "dd/mm/yyyy";
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(await workbook.xlsx.writeBuffer(), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
