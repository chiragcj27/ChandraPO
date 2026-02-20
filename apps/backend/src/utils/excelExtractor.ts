import * as XLSX from 'xlsx';

export function extractTextFromExcel(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let excelContent = '';

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });
      excelContent += `\n\n=== Sheet: ${sheetName} ===\n`;
      excelContent += csv;
    }

    return excelContent;
  } catch (error) {
    throw new Error(`Failed to extract text from Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
