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
        <button onClick={onClick} className="px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-100">
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
          className="px-2 py-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          {deletingPO === poNumber ? "Deleting..." : "Delete"}
        </button>
      );
    },
    [deletingPO],
  );

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
      { headerName: "Delete", field: "PONumber", sortable: false, filter: false, width: 100, cellRenderer: DeleteCellRenderer },
    ],
    [ActionCellRenderer, DeleteCellRenderer]
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
          <button 
            onClick={onUploadClick} 
            disabled={uploading}
            className="px-3 py-2 rounded border border-gray-300 bg-black text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading..." : "Add PO"}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete Purchase Order</h2>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete PO <strong>{showDeleteConfirm.poNumber}</strong>? This action cannot be undone and will delete:
              <ul className="list-disc list-inside mt-2 text-sm text-gray-600">
                <li>The PO from the database</li>
                <li>All associated items</li>
                <li>All files from S3</li>
                <li>All file metadata</li>
              </ul>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={deletingPO === showDeleteConfirm.poNumber}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePO}
                disabled={deletingPO === showDeleteConfirm.poNumber}
                className="px-4 py-2 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:bg-red-400 disabled:cursor-not-allowed"
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
