"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ValueFormatterParams, ICellRendererParams } from "ag-grid-community";
import type { PurchaseOrder } from "../types/po";
import { useRouter } from "next/navigation";
import { getApiEndpoint } from "@/lib/api";

// AG Grid styles
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rowData, setRowData] = useState<PurchaseOrder[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingPO, setDeletingPO] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ poNumber: string; clientName: string } | null>(null);
  const router = useRouter();

  const ActionCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, string>) => {
      const poNumber = params.data?.PONumber;
      const onClick = () => {
        if (poNumber) router.push(`/review/${encodeURIComponent(poNumber)}`);
      };
      return (
        <button 
          onClick={onClick} 
          className="px-3 py-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 hover:border-blue-400 transition-colors"
        >
          Review
        </button>
      );
    },
    [router],
  );

  const DeleteCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, string>) => {
      const po = params.data;
      const poNumber = po?.PONumber;
      const onClick = () => {
        if (poNumber && po) {
          setShowDeleteConfirm({ poNumber, clientName: po.ClientName || "Unknown" });
        }
      };
      return (
        <button 
          onClick={onClick} 
          disabled={deletingPO === poNumber}
          className="px-3 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 font-medium hover:bg-red-100 hover:border-red-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {deletingPO === poNumber ? "Deleting..." : "Delete"}
        </button>
      );
    },
    [deletingPO],
  );

  const IncompleteCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, number>) => {
      const value = params.value ?? 0;
      return (
        <div className="flex items-center justify-center h-full">
          {value === 0 ? (
            <span className="text-green-600 font-semibold">0</span>
          ) : (
            <span className="text-red-600 font-semibold">{value}</span>
          )}
        </div>
      );
    },
    [],
  );

  const StatusCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, string>) => {
      const status = params.value || "";
      const statusClass = 
        status.toLowerCase().includes("complete") && !status.toLowerCase().includes("incomplete") 
          ? "bg-green-100 text-green-800 border-green-200" 
          : status.toLowerCase().includes("incomplete") 
          ? "bg-red-100 text-red-800 border-red-200"
          : status.toLowerCase().includes("reviewed") 
          ? "bg-blue-100 text-blue-800 border-blue-200"
          : "bg-slate-100 text-slate-800 border-slate-200";
      
      return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusClass}`}>
          {status}
        </span>
      );
    },
    [],
  );

  const columnDefs = useMemo<ColDef<PurchaseOrder>[]>(
    () => [
      { 
        headerName: "PO No.", 
        field: "PONumber", 
        sortable: true, 
        filter: true,
        width: 150,
        minWidth: 120,
        tooltipValueGetter: (params) => params.value,
      },
      { 
        headerName: "PO Date", 
        field: "PODate", 
        sortable: true, 
        filter: true,
        width: 120,
        minWidth: 100,
      },
      { 
        headerName: "Client Name", 
        field: "ClientName", 
        sortable: true, 
        filter: true,
        width: 180,
        minWidth: 150,
        flex: 1,
        tooltipValueGetter: (params) => params.value,
      },
      { 
        headerName: "Items", 
        field: "TotalItems", 
        sortable: true,
        width: 90,
        minWidth: 80,
      },
      { 
        headerName: "Incomplete", 
        field: "IncompleteItems", 
        sortable: true,
        width: 110,
        minWidth: 100,
        cellRenderer: IncompleteCellRenderer,
      },
      { 
        headerName: "Total Value", 
        field: "TotalValue", 
        sortable: true,
        width: 140,
        minWidth: 120,
        valueFormatter: (p: ValueFormatterParams<PurchaseOrder, number>) => {
          if (p.value == null) return "";
          return `₹${Number(p.value).toLocaleString("en-IN")}`;
        },
      },
      { 
        headerName: "Status", 
        field: "Status", 
        sortable: true, 
        filter: true,
        width: 160,
        minWidth: 140,
        cellRenderer: StatusCellRenderer,
        tooltipValueGetter: (params) => params.value,
      },
      { 
        headerName: "Reminders", 
        field: "ClientReminderCount", 
        sortable: true,
        width: 110,
        minWidth: 100,
        valueFormatter: (p: ValueFormatterParams<PurchaseOrder, number>) => {
          const value = p.value ?? 0;
          return value > 0 ? value.toString() : "0";
        },
      },
      { 
        headerName: "Action", 
        field: "PONumber", 
        sortable: false, 
        filter: false, 
        width: 110,
        minWidth: 100,
        pinned: "right",
        cellRenderer: ActionCellRenderer,
      },
      { 
        headerName: "Delete", 
        field: "PONumber", 
        sortable: false, 
        filter: false, 
        width: 100,
        minWidth: 90,
        pinned: "right",
        cellRenderer: DeleteCellRenderer,
      },
    ],
    [ActionCellRenderer, DeleteCellRenderer, IncompleteCellRenderer, StatusCellRenderer]
  );

  const onUploadClick = () => fileInputRef.current?.click();

  const loadPOs = async () => {
    try {
      const res = await fetch(getApiEndpoint("/po"));
      if (!res.ok) {
        throw new Error("Failed to load purchase orders");
      }
      const payload = await res.json();
      const data: PurchaseOrder[] = Array.isArray(payload) ? payload : payload?.data || [];
      setRowData(Array.isArray(data) ? data : []);
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
    
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(getApiEndpoint("/po/upload"), {
        method: "POST",
        body: form,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || errorData.error || "Upload failed");
      }
      
      const result = await res.json();
      const poNumber = result.po?.PONumber || result.poNumber;
      
      if (poNumber) {
        // Navigate to review page with the extracted PO data
        router.push(`/review/${encodeURIComponent(poNumber)}`);
      } else {
        // Fallback: reload the list if PO number is not available
        await loadPOs();
        alert("PO uploaded successfully");
      }
    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Upload failed. Please try again.";
      alert(errorMessage);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeletePO = async () => {
    if (!showDeleteConfirm) return;

    const { poNumber } = showDeleteConfirm;
    setDeletingPO(poNumber);
    
    try {
      const res = await fetch(getApiEndpoint(`/po/${poNumber}`), {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(errorData.message || errorData.error || "Failed to delete PO");
      }

      // Reload the PO list after successful deletion
      await loadPOs();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete PO. Please try again.";
      alert(errorMessage);
    } finally {
      setDeletingPO(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ChandraPO
            </h1>
            <p className="text-sm text-slate-600 mt-1">Purchase Order Management System</p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              onClick={onUploadClick} 
              disabled={uploading}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add PO
                </>
              )}
            </button>
          </div>
        </header>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="ag-theme-quartz w-full h-[calc(100vh-200px)] min-h-[600px]">
            <AgGridReact<PurchaseOrder>
              rowData={rowData}
              columnDefs={columnDefs}
              animateRows
              pagination
              paginationAutoPageSize
              paginationPageSize={20}
              rowHeight={56}
              headerHeight={56}
              suppressHorizontalScroll={false}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              suppressRowClickSelection={true}
              onRowDoubleClicked={(event) => {
                const poNumber = event.data?.PONumber;
                if (poNumber) {
                  router.push(`/po/${encodeURIComponent(poNumber)}/items`);
                }
              }}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: false,
              }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200">
            <div className="flex items-start gap-4 mb-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Delete Purchase Order</h2>
                <p className="text-slate-700 mb-4">
                  Are you sure you want to delete PO <strong className="text-slate-900">{showDeleteConfirm.poNumber}</strong>? This action cannot be undone and will delete:
                </p>
                <ul className="list-disc list-inside mt-2 text-sm text-slate-600 space-y-1">
                  <li>The PO from the database</li>
                  <li>All associated items</li>
                  <li>All files from S3</li>
                  <li>All file metadata</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingPO === showDeleteConfirm.poNumber}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePO}
                disabled={deletingPO === showDeleteConfirm.poNumber}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed shadow-sm"
              >
                {deletingPO === showDeleteConfirm.poNumber ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
