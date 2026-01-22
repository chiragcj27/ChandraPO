"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  ValueFormatterParams,
  ICellRendererParams,
  GridApi,
  GridReadyEvent,
} from "ag-grid-community";
import type { PurchaseOrder } from "../types/po";
import { useRouter } from "next/navigation";
import { authenticatedFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DropdownFilter from "@/components/DropdownFilter";

// AG Grid styles
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

type ClientRecord = {
  _id?: string;
  name: string;
  mapping: string;
  description?: string | null;
};

function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gridApiRef = useRef<GridApi<PurchaseOrder> | null>(null);
  const [rowData, setRowData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingPO, setDeletingPO] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ poNumber: string; clientName: string } | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientMapping, setNewClientMapping] = useState("");
  const [pendingClientSelection, setPendingClientSelection] = useState<{ clientId?: string; clientName: string; clientMapping?: string } | null>(null);
  const [expectedItems, setExpectedItems] = useState<string>("");
  const [editingMapping, setEditingMapping] = useState<string | null>(null);
  const [editedMapping, setEditedMapping] = useState<string>("");
  const [savingMapping, setSavingMapping] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    stage: 'uploading' | 'extracting' | 'saving' | 'complete' | 'error';
    message: string;
    error?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { isAdmin, user, logout } = useAuth();

  const PONumberCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, string>) => {
      const poNumber = params.value;
      if (!poNumber) return <span></span>;
      
      const onClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (poNumber) {
          router.push(`/po/${encodeURIComponent(poNumber)}/items`);
        }
      };
      
      return (
        <div 
          onClick={onClick}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors cursor-pointer h-full flex items-center"
          style={{ cursor: 'pointer' }}
        >
          {poNumber}
        </div>
      );
    },
    [router],
  );

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
          {isAdmin ? "Review" : "View"}
        </button>
      );
    },
    [router, isAdmin],
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

  const TotalValueCellRenderer = useCallback(
    (params: ICellRendererParams<PurchaseOrder, number>) => {
      const value = params.value;
      if (value == null) return <span></span>;
      
      return (
        <div className="flex items-center justify-end h-full pr-2">
          <span className="font-medium">
            ${Number(value).toLocaleString("en-US")}
          </span>
        </div>
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
        cellRenderer: PONumberCellRenderer,
      },
      { 
        headerName: "PO Date", 
        field: "PODate", 
        sortable: true,
        width: 120,
        minWidth: 100,
      },
      { 
        headerName: "Client Name", 
        field: "ClientName", 
        sortable: true, 
        filter: DropdownFilter,
        filterParams: {
          values: clients.map(c => c.name).sort(),
        },
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
        cellRenderer: TotalValueCellRenderer,
      },
      { 
        headerName: "Status", 
        field: "Status", 
        sortable: true, 
        filter: DropdownFilter,
        filterParams: {
          values: ['New', 'In Review', 'Reviewed', 'Reviewed & Incomplete', 'Completed', 'Cancelled'],
        },
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
      ...(isAdmin ? [{
        headerName: "Delete", 
        field: "PONumber", 
        sortable: false, 
        filter: false, 
        width: 100,
        minWidth: 90,
        pinned: "right",
        cellRenderer: DeleteCellRenderer,
      } as ColDef<PurchaseOrder>] : []),
    ],
    [ActionCellRenderer, DeleteCellRenderer, IncompleteCellRenderer, StatusCellRenderer, PONumberCellRenderer, TotalValueCellRenderer, isAdmin, clients]
  );

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      // First, get the total count by fetching a small batch
      const countRes = await authenticatedFetch(`/po?startRow=0&endRow=1`);
      if (!countRes.ok) {
        throw new Error("Failed to load purchase orders");
      }
      const countPayload = await countRes.json();
      const totalCount = typeof countPayload?.rowCount === "number"
        ? countPayload.rowCount
        : 0;

      // Fetch all data
      const res = await authenticatedFetch(`/po?startRow=0&endRow=${Math.max(totalCount, 1000)}`);
      if (!res.ok) {
        throw new Error("Failed to load purchase orders");
      }
      const payload = await res.json();
      const rows: PurchaseOrder[] = Array.isArray(payload)
        ? payload
        : payload?.rowData || payload?.data || [];
      setRowData(rows);
    } catch (error) {
      console.error("Failed to fetch purchase orders", error);
      setRowData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshGrid = useCallback(() => {
    void fetchPOs();
  }, [fetchPOs]);

  const onGridReady = useCallback(
    (params: GridReadyEvent<PurchaseOrder>) => {
      gridApiRef.current = params.api;
    },
    [],
  );

  // Filter rowData based on search query
  const filteredRowData = useMemo(() => {
    if (!searchQuery.trim()) {
      return rowData;
    }
    const query = searchQuery.toLowerCase().trim();
    return rowData.filter((po) => {
      const poNumber = po.PONumber?.toLowerCase() || "";
      const clientName = po.ClientName?.toLowerCase() || "";
      return poNumber.includes(query) || clientName.includes(query);
    });
  }, [rowData, searchQuery]);

  // Fetch data on mount
  useEffect(() => {
    void fetchPOs();
    void loadClients();
  }, [fetchPOs]);

  const loadClients = async () => {
    setClientLoading(true);
    try {
      const res = await authenticatedFetch("/po/clients");
      if (!res.ok) {
        throw new Error("Failed to load clients");
      }
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch clients", error);
      alert("Could not load clients. Please try again.");
    } finally {
      setClientLoading(false);
    }
  };

  const onUploadClick = () => {
    setClientModalOpen(true);
    if (!clients.length && !clientLoading) {
      void loadClients();
    }
  };

  const resetClientSelection = () => {
    setPendingClientSelection(null);
    setSelectedClientId(null);
    setNewClientName("");
    setNewClientMapping("");
    setExpectedItems("");
    setClientMode("existing");
    setEditingMapping(null);
    setEditedMapping("");
  };

  const handleClientConfirm = () => {
    if (clientMode === "existing") {
      const selected = clients.find((c) => c._id === selectedClientId);
      if (!selected) {
        alert("Please select a client");
        return;
      }
      setPendingClientSelection({ clientId: selected._id, clientName: selected.name, clientMapping: selected.mapping });
    } else {
      if (!newClientName.trim() || !newClientMapping.trim()) {
        alert("Enter client name and mapping");
        return;
      }
      setPendingClientSelection({ clientName: newClientName.trim(), clientMapping: newClientMapping.trim() });
    }

    setClientModalOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (!pendingClientSelection) {
      alert("Select a client before uploading.");
      return;
    }
    // Basic validation for expected items (optional but recommended)
    const trimmedExpected = expectedItems.trim();
    if (trimmedExpected) {
      const num = Number(trimmedExpected);
      if (!Number.isInteger(num) || num <= 0) {
        alert("Expected number of items must be a positive whole number.");
        return;
      }
    }
    
    setUploading(true);
    const fileCount = files.length;
    setUploadProgress({
      stage: 'uploading',
      message: `Uploading ${fileCount} file${fileCount > 1 ? 's' : ''} to server...`,
    });

    const uploadSingleFile = async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("clientName", pendingClientSelection.clientName);
      if (pendingClientSelection.clientId) form.append("clientId", pendingClientSelection.clientId);
      if (pendingClientSelection.clientMapping) form.append("clientMapping", pendingClientSelection.clientMapping);
      if (expectedItems.trim()) {
        form.append("expectedItems", expectedItems.trim());
      }

      const res = await authenticatedFetch("/po/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Upload failed" }));
        const errorMessage = errorData.message || errorData.error || "Upload failed";
        throw new Error(errorMessage);
      }

      // We don't auto-navigate for each file; just ensure the PO list is refreshed after all uploads.
      await res.json();
    };

    try {
      setUploadProgress({
        stage: 'extracting',
        message: 'Processing document extraction for all files... This may take a minute.',
      });

      await Promise.all(files.map((file) => uploadSingleFile(file)));

      setUploadProgress({
        stage: 'complete',
        message: fileCount > 1 ? 'All POs uploaded successfully!' : 'Upload successful!',
      });

      // Small delay to show success message
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh the grid to show newly uploaded POs
      refreshGrid();
    } catch (err) {
      console.error("Upload error:", err);
      const errorMessage = err instanceof Error ? err.message : "Upload failed. Please try again.";

      let errorDetail = errorMessage;

      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        errorDetail = 'The extraction is taking longer than expected. The FastAPI service may be slow or unresponsive.';
      } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Cannot connect')) {
        errorDetail = 'Cannot connect to the extraction service. Please check if FastAPI is running.';
      } else if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
        errorDetail = 'The extraction service returned an error. The FastAPI service may be down or overloaded.';
      }

      setUploadProgress({
        stage: 'error',
        message: 'Upload failed',
        error: errorDetail,
      });
    } finally {
      setUploading(false);
      // Don't reset uploadProgress here - let user see the error/success state
      e.target.value = "";
    }
  };

  const closeProgressModal = () => {
    setUploadProgress(null);
    resetClientSelection();
  };

  const handleDeletePO = async () => {
    if (!showDeleteConfirm) return;

    const { poNumber } = showDeleteConfirm;
    setDeletingPO(poNumber);
    
    try {
      const res = await authenticatedFetch(`/po/${poNumber}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Delete failed" }));
        throw new Error(errorData.message || errorData.error || "Failed to delete PO");
      }

      // Reload the PO list after successful deletion
      refreshGrid();
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to delete PO. Please try again.";
      alert(errorMessage);
    } finally {
      setDeletingPO(null);
    }
  };

  const handleStartEditMapping = (clientId: string) => {
    const client = clients.find((c) => c._id === clientId);
    if (client) {
      setEditingMapping(clientId);
      setEditedMapping(client.mapping);
    }
  };

  const handleCancelEditMapping = () => {
    setEditingMapping(null);
    setEditedMapping("");
  };

  const handleSaveMapping = async (clientId: string) => {
    const client = clients.find((c) => c._id === clientId);
    if (!client) return;

    if (!editedMapping.trim()) {
      alert("Mapping cannot be empty");
      return;
    }

    setSavingMapping(true);
    try {
      const res = await authenticatedFetch("/po/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: client.name,
          mapping: editedMapping.trim(),
          description: client.description ?? null,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Save failed" }));
        throw new Error(errorData.message || errorData.error || "Failed to save mapping");
      }

      // Reload clients to get updated data
      await loadClients();
      setEditingMapping(null);
      setEditedMapping("");
    } catch (err) {
      console.error("Save mapping error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to save mapping. Please try again.";
      alert(errorMessage);
    } finally {
      setSavingMapping(false);
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
            <p className="text-sm text-slate-600 mt-1">
              Purchase Order Management System
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">
                  {user.name}
                </span>
                {user.clientName && (
                  <span className="text-xs text-slate-500">
                    ({user.clientName})
                  </span>
                )}
              </div>
            )}
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
              </>
            )}
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by PO number or client name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-3 py-2 text-slate-500 hover:text-slate-700 transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="ag-theme-quartz w-full h-[calc(100vh-280px)] min-h-[600px]">
            <AgGridReact<PurchaseOrder>
              rowData={filteredRowData}
              columnDefs={columnDefs}
              animateRows
              loading={loading}
              pagination={true}
              paginationPageSize={25}
              paginationPageSizeSelector={[10, 25, 50, 100]}
              rowHeight={56}
              headerHeight={56}
              suppressHorizontalScroll={false}
              enableCellTextSelection={true}
              ensureDomOrder={true}
              suppressRowClickSelection={true}
              onGridReady={onGridReady}
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

      {/* Client selection dialog */}
      {clientModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full mx-4 border border-slate-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Choose client mapping</h2>
                <p className="text-slate-600 text-sm mt-1">
                  Select an existing client or add a new mapping before uploading the PO PDF.
                </p>
              </div>
              <button
                onClick={() => {
                  setClientModalOpen(false);
                  resetClientSelection();
                }}
                className="text-slate-500 hover:text-slate-700"
                aria-label="Close client dialog"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-4 mb-4">
              <button
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  clientMode === "existing"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
                onClick={() => setClientMode("existing")}
              >
                Use existing client
              </button>
              <button
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  clientMode === "new"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-700"
                }`}
                onClick={() => setClientMode("new")}
              >
                Create new mapping
              </button>
            </div>

            {clientMode === "existing" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Select client</label>
                  <button
                    onClick={() => void loadClients()}
                    className="text-sm text-blue-600 hover:text-blue-700"
                    disabled={clientLoading}
                  >
                    {clientLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedClientId ?? ""}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={clientLoading}
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client._id ?? client.name} value={client._id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {selectedClientId && (
                  <div className="space-y-2">
                    {editingMapping === selectedClientId ? (
                      <>
                        <textarea
                          value={editedMapping}
                          onChange={(e) => setEditedMapping(e.target.value)}
                          rows={8}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Add column mapping and extraction notes"
                          disabled={savingMapping}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={handleCancelEditMapping}
                            disabled={savingMapping}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveMapping(selectedClientId)}
                            disabled={savingMapping}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                          >
                            {savingMapping ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-40 overflow-auto text-sm whitespace-pre-line">
                          {clients.find((c) => c._id === selectedClientId)?.mapping}
                        </div>
                        <button
                          onClick={() => handleStartEditMapping(selectedClientId)}
                          className="w-full px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 hover:border-blue-400 transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Mapping
                        </button>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expected number of items in this PO (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={expectedItems}
                    onChange={(e) => setExpectedItems(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 92"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Helps the AI ensure it extracts exactly this many item rows from the PO.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client name</label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter client name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mapping / instructions</label>
                  <textarea
                    value={newClientMapping}
                    onChange={(e) => setNewClientMapping(e.target.value)}
                    rows={8}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add column mapping and extraction notes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Expected number of items in this PO (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={expectedItems}
                    onChange={(e) => setExpectedItems(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 92"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Helps the AI ensure it extracts exactly this many item rows from the PO.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setClientModalOpen(false);
                  resetClientSelection();
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClientConfirm}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                Continue & upload PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Modal */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-200">
            {uploadProgress.stage === 'error' ? (
              <>
                <div className="flex items-start gap-4 mb-6">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Failed</h2>
                    <p className="text-slate-700 mb-3">{uploadProgress.message}</p>
                    {uploadProgress.error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                        {uploadProgress.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={closeProgressModal}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : uploadProgress.stage === 'complete' ? (
              <>
                <div className="flex items-start gap-4 mb-6">
                  <div className="shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Upload Successful!</h2>
                    <p className="text-slate-700">{uploadProgress.message}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={closeProgressModal}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4 mb-6">
                  <div className="shrink-0">
                    <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Processing Purchase Order</h2>
                    <p className="text-slate-700 mb-4">{uploadProgress.message}</p>
                    
                    {/* Progress Steps */}
                    {(() => {
                      const stage = uploadProgress.stage as 'uploading' | 'extracting' | 'saving' | 'complete' | 'error';
                      const isUploading = stage === 'uploading';
                      const isExtracting = stage === 'extracting';
                      const isSaving = stage === 'saving';
                      const isComplete = stage === 'complete';
                      const isPastUploading = isExtracting || isSaving || isComplete;
                      const isPastExtracting = isSaving || isComplete;
                      
                      const uploadOpacity = isUploading ? 'opacity-100' : isPastUploading ? 'opacity-60' : 'opacity-40';
                      const uploadBg = isUploading ? 'bg-blue-600' : isPastUploading ? 'bg-green-600' : 'bg-slate-300';
                      const uploadIcon = isUploading ? 'spinner' : isPastUploading ? 'check' : null;
                      
                      const extractOpacity = isExtracting ? 'opacity-100' : isPastExtracting ? 'opacity-60' : 'opacity-40';
                      const extractBg = isExtracting ? 'bg-blue-600' : isPastExtracting ? 'bg-green-600' : 'bg-slate-300';
                      const extractIcon = isExtracting ? 'spinner' : isPastExtracting ? 'check' : null;
                      
                      const saveOpacity = isSaving ? 'opacity-100' : isComplete ? 'opacity-60' : 'opacity-40';
                      const saveBg = isSaving ? 'bg-blue-600' : isComplete ? 'bg-green-600' : 'bg-slate-300';
                      const saveIcon = isComplete ? 'check' : isSaving ? 'spinner' : null;
                      
                      return (
                        <div className="space-y-3 mt-4">
                          <div className={`flex items-center gap-3 ${uploadOpacity}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${uploadBg}`}>
                              {uploadIcon === 'check' ? (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : uploadIcon === 'spinner' ? (
                                <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : null}
                            </div>
                            <span className="text-sm text-slate-700">Uploading file to server</span>
                          </div>
                          
                          <div className={`flex items-center gap-3 ${extractOpacity}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${extractBg}`}>
                              {extractIcon === 'check' ? (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : extractIcon === 'spinner' ? (
                                <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : null}
                            </div>
                            <span className="text-sm text-slate-700">Extracting data from document</span>
                          </div>
                          
                          <div className={`flex items-center gap-3 ${saveOpacity}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${saveBg}`}>
                              {saveIcon === 'check' ? (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : saveIcon === 'spinner' ? (
                                <svg className="animate-spin w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : null}
                            </div>
                            <span className="text-sm text-slate-700">Saving to database</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {uploadProgress.stage === 'extracting' && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-800">
                      <strong>Note:</strong> Document extraction can take 30-60 seconds depending on file size and complexity. Please wait...
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

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

export default function DashboardPageWithAuth() {
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}
