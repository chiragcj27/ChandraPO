"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ValueFormatterParams, ICellRendererParams } from "ag-grid-community";
import type { PurchaseOrder } from "../types/po";
import { useRouter } from "next/navigation";

// AG Grid styles
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rowData, setRowData] = useState<PurchaseOrder[]>([]);
  const router = useRouter();

  const ActionCellRenderer = (params: ICellRendererParams<PurchaseOrder, string>) => {
    const poNumber = params.data?.PONumber;
    const onClick = () => {
      if (poNumber) router.push(`/review/${encodeURIComponent(poNumber)}`);
    };
    return (
      <button onClick={onClick} className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100">
        Review
      </button>
    );
  };

  const columnDefs = useMemo<ColDef<PurchaseOrder>[]>(
    () => [
      { headerName: "PO No.", field: "PONumber", sortable: true, filter: true },
      { headerName: "PODate", field: "PODate", sortable: true, filter: true },
      { headerName: "ClientName", field: "ClientName", sortable: true, filter: true },
      { headerName: "Total Items", field: "TotalItems", sortable: true },
      { headerName: "IncompleteItems", field: "IncompleteItems", sortable: true },
      { headerName: "Total Value", field: "TotalValue", sortable: true, valueFormatter: (p: ValueFormatterParams<PurchaseOrder, number>) => (p.value != null ? Number(p.value).toLocaleString() : "") },
      { headerName: "Status", field: "Status", sortable: true, filter: true },
      { headerName: "Reminder Count", field: "ClientReminderCount", sortable: true },
      { headerName: "Action", field: "PONumber", sortable: false, filter: false, width: 120, cellRenderer: ActionCellRenderer },
    ],
    []
  );

  const onUploadClick = () => fileInputRef.current?.click();

  const loadPOs = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/pos");
      const data: PurchaseOrder[] = await res.json();
      setRowData(data);
    } catch {
      // noop for now
    }
  };

  useEffect(() => {
    loadPOs();
  }, []);

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:4000/api/pos/upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      await loadPOs();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>ChandraPO</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button onClick={onUploadClick} className="px-3 py-2 rounded border border-gray-300 bg-black text-white">
            Upload PO (PDF)
          </button>
        </div>
      </header>

      <div className="ag-theme-quartz w-full h-[70vh]">
        <AgGridReact<PurchaseOrder>
          rowData={rowData}
          columnDefs={columnDefs}
          animateRows
          pagination
          paginationAutoPageSize
        />
      </div>
    </div>
  );
}
