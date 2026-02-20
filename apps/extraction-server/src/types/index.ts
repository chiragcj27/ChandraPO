export interface ExtractedLine {
  VendorStyleCode: string;
  Category: string;
  ItemSize?: string | null;
  OrderQty: number;
  Metal: string;
  Tone: string;
  ItemPoNo: string;
  ItemRefNo: string;
  StockType?: string | null;
  MakeType?: string | null;
  CustomerProductionInstruction?: string | null;
  SpecialRemarks?: string | null;
  DesignProductionInstruction?: string | null;
  StampInstruction?: string | null;
}

export interface ExtractedPOResponse {
  total_value: number | null;
  client_name: string;
  invoice_number: string;
  total_entries: number;
  invoice_date: string;
  items: ExtractedLine[];
}
