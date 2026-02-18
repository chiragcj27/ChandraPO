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
import { authenticatedFetch} from "@/lib/api";
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

type UploadStatus = 'uploading' | 'extracting' | 'saving' | 'complete' | 'error';

type UploadTask = {
  id: string;
  fileName: string;
  status: UploadStatus;
  message: string;
  error?: string;
  startTime: number;
};

function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const gridApiRef = useRef<GridApi<PurchaseOrder> | null>(null);
  const searchQueryRef = useRef<string>("");
  const activeFiltersRef = useRef<{ clientName?: string; status?: string }>({});
  const [loading, setLoading] = useState(false);
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
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
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

  const refreshGrid = useCallback(() => {
    const api = gridApiRef.current as (GridApi<PurchaseOrder> & { refreshInfiniteCache?: () => void }) | null;
    if (api?.refreshInfiniteCache) {
      api.refreshInfiniteCache();
    }
  }, []);

  // Callbacks for filter changes
  const handleClientNameFilterChange = useCallback((value: string | null) => {
    activeFiltersRef.current.clientName = value || undefined;
    refreshGrid();
  }, [refreshGrid]);

  const handleStatusFilterChange = useCallback((value: string | null) => {
    activeFiltersRef.current.status = value || undefined;
    refreshGrid();
  }, [refreshGrid]);

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
          onFilterChange: handleClientNameFilterChange,
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
          onFilterChange: handleStatusFilterChange,
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
    [ActionCellRenderer, DeleteCellRenderer, IncompleteCellRenderer, StatusCellRenderer, PONumberCellRenderer, TotalValueCellRenderer, isAdmin, clients, handleClientNameFilterChange, handleStatusFilterChange]
  );

  // Create datasource once - it reads from searchQueryRef so it doesn't need to be recreated
  const infiniteDatasource = useMemo(() => ({
    getRows: (params: {
      startRow: number;
      endRow: number;
      successCallback: (rows: PurchaseOrder[], lastRow?: number) => void;
      failCallback: () => void;
      sortModel?: Array<{ colId: string; sort: 'asc' | 'desc' }>;
      filterModel?: Record<string, { filter?: string; filterType?: string }>;
    }) => {
      const { startRow, endRow, successCallback, failCallback, sortModel, filterModel } = params;
      // Read search from ref so datasource doesn't need to be recreated when search changes
      const search = searchQueryRef.current.trim() || undefined;
      const filters = activeFiltersRef.current;

      const qp = new URLSearchParams();
      qp.set("startRow", String(startRow));
      qp.set("endRow", String(endRow));
      if (search) qp.set("search", search);
      if (filters.clientName) qp.set("clientName", filters.clientName);
      if (filters.status) qp.set("status", filters.status);
      
      // Add sort parameters
      if (sortModel && sortModel.length > 0) {
        qp.set("sortField", sortModel[0].colId);
        qp.set("sortOrder", sortModel[0].sort);
      }
      
      // Add PO number filter if present
      if (filterModel?.PONumber) {
        const poFilter = filterModel.PONumber;
        if (poFilter.filter) {
          qp.set("poNumber", poFilter.filter);
        }
      }
      
      const endpoint = `/po?${qp.toString()}`;

      setLoading(true);
      authenticatedFetch(endpoint)
        .then(async (res) => {
          if (!res.ok) {
            failCallback();
            return;
          }
          const payload = await res.json();
          const rows: PurchaseOrder[] = Array.isArray(payload)
            ? payload
            : payload?.rowData ?? payload?.data ?? [];
          const rowCount = typeof payload?.rowCount === "number" ? payload.rowCount : undefined;
          const lastRow = rowCount != null ? rowCount : (rows.length < endRow - startRow ? startRow + rows.length : undefined);
          successCallback(rows, lastRow);
        })
        .catch((err) => {
          console.error("Failed to fetch POs (infinite)", err);
          failCallback();
        })
        .finally(() => setLoading(false));
    },
  }), []); // Empty deps - datasource is created once and never changes

  const onGridReady = useCallback(
    (params: GridReadyEvent<PurchaseOrder>) => {
      gridApiRef.current = params.api;
      // Set datasource once when grid is ready
      params.api.setGridOption("datasource", infiniteDatasource);
    },
    [infiniteDatasource],
  );

  const SEARCH_DEBOUNCE_MS = 500;

  // When search changes, debounce before updating the ref and refreshing the grid (avoids an API call on every keystroke)
  useEffect(() => {
    const t = setTimeout(() => {
      searchQueryRef.current = searchQuery;
      if (gridApiRef.current) {
        refreshGrid();
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery, refreshGrid]);

  // Load clients on mount for admins
  useEffect(() => {
    if (isAdmin) {
      void loadClients();
    } else {
      setClients([]);
    }
  }, [isAdmin]);

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

  const updateUploadTask = (id: string, updates: Partial<UploadTask>) => {
    setUploadTasks(prev => prev.map(task => 
      task.id === id ? { ...task, ...updates } : task
    ));
  };

  const removeUploadTask = (id: string) => {
    setUploadTasks(prev => prev.filter(task => task.id !== id));
  };

  const uploadSingleFile = async (
    file: File, 
    taskId: string,
    clientSelection: { clientId?: string; clientName: string; clientMapping?: string },
    expectedItemCount: string
  ) => {
    try {
      updateUploadTask(taskId, {
        status: 'uploading',
        message: 'Uploading to server...'
      });

      const form = new FormData();
      form.append("file", file);
      form.append("clientName", clientSelection.clientName);
      if (clientSelection.clientId) form.append("clientId", clientSelection.clientId);
      if (clientSelection.clientMapping) form.append("clientMapping", clientSelection.clientMapping);
      if (expectedItemCount.trim()) {
        form.append("expectedItems", expectedItemCount.trim());
      }

      updateUploadTask(taskId, {
        status: 'extracting',
        message: 'Extracting data from document...'
      });

      const res = await authenticatedFetch("/po/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errorData: Record<string, unknown> | null = null;
        let rawText: string | null = null;

        try {
          if (contentType.includes("application/json")) {
            errorData = await res.json();
          } else {
            rawText = await res.text();
          }
        } catch {
          try {
            rawText = await res.text();
          } catch {
            rawText = null;
          }
        }

        const message =
          (typeof errorData?.message === "string" && errorData.message.trim()) ? errorData.message.trim() : "";
        const detail =
          (typeof errorData?.error === "string" && errorData.error.trim()) ? errorData.error.trim() : "";
        const fallbackText = (rawText && rawText.trim()) ? rawText.trim() : "";

        const errorMessage =
          detail && message && message !== detail
            ? `${message}: ${detail}`
            : (detail || message || fallbackText || `Upload failed (${res.status})`);

        throw new Error(errorMessage);
      }

      updateUploadTask(taskId, {
        status: 'saving',
        message: 'Saving to database...'
      });

      await res.json();

      updateUploadTask(taskId, {
        status: 'complete',
        message: 'Upload complete!'
      });

      // Auto-remove successful uploads after 5 seconds
      setTimeout(() => {
        removeUploadTask(taskId);
      }, 5000);

      // Refresh grid to show new PO
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

      updateUploadTask(taskId, {
        status: 'error',
        message: 'Upload failed',
        error: errorDetail
      });
    }
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
    
    // Create upload tasks for each file
    const newTasks: UploadTask[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      status: 'uploading' as UploadStatus,
      message: 'Preparing upload...',
      startTime: Date.now()
    }));

    setUploadTasks(prev => [...prev, ...newTasks]);
    setShowUploadPanel(true);

    // Store current client selection for this batch
    const currentClientSelection = { ...pendingClientSelection };
    const currentExpectedItems = expectedItems;

    // Reset the form
    e.target.value = "";
    resetClientSelection();

    // Start uploads in parallel (background)
    newTasks.forEach((task, index) => {
      uploadSingleFile(files[index], task.id, currentClientSelection, currentExpectedItems);
    });
  };

  const closeUploadTask = (taskId: string) => {
    removeUploadTask(taskId);
    // If no more tasks, hide the panel
    if (uploadTasks.length <= 1) {
      setShowUploadPanel(false);
    }
  };

  const clearAllCompletedTasks = () => {
    setUploadTasks(prev => prev.filter(task => 
      task.status !== 'complete' && task.status !== 'error'
    ));
  };

  const hasActiveTasks = uploadTasks.some(task => 
    task.status === 'uploading' || task.status === 'extracting' || task.status === 'saving'
  );

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
                  disabled={hasActiveTasks}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-md hover:shadow-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 flex items-center gap-2"
                >
                  {hasActiveTasks ? (
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
              rowModelType="infinite"
              datasource={infiniteDatasource}
              cacheBlockSize={50}
              maxBlocksInCache={10}
              getRowId={(params) => params.data?.PONumber ?? ""}
              columnDefs={columnDefs}
              animateRows
              loading={loading}
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

      {/* Background Upload Panel */}
      {uploadTasks.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-96 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <h3 className="font-semibold text-slate-900">
                  Uploads ({uploadTasks.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!hasActiveTasks && uploadTasks.length > 0 && (
                  <button
                    onClick={clearAllCompletedTasks}
                    className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={() => setShowUploadPanel(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Upload Tasks List */}
            <div className="overflow-y-auto max-h-[500px]">
              {uploadTasks.map((task) => (
                <div
                  key={task.id}
                  className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Status Icon */}
                    <div className="shrink-0 mt-1">
                      {task.status === 'complete' ? (
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : task.status === 'error' ? (
                        <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="animate-spin w-4 h-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate" title={task.fileName}>
                        {task.fileName}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {task.message}
                      </p>
                      {task.error && (
                        <p className="text-xs text-red-600 mt-1 bg-red-50 rounded px-2 py-1">
                          {task.error}
                        </p>
                      )}
                      {task.status !== 'complete' && task.status !== 'error' && (
                        <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-blue-600 h-full rounded-full transition-all duration-300"
                            style={{ 
                              width: task.status === 'uploading' ? '33%' : 
                                     task.status === 'extracting' ? '66%' : 
                                     task.status === 'saving' ? '90%' : '0%'
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Close Button */}
                    {(task.status === 'complete' || task.status === 'error') && (
                      <button
                        onClick={() => closeUploadTask(task.id)}
                        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Upload Indicator (when panel is hidden) */}
      {uploadTasks.length > 0 && !showUploadPanel && (
        <button
          onClick={() => setShowUploadPanel(true)}
          className="fixed bottom-6 right-6 z-50 bg-white rounded-full shadow-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 hover:shadow-xl transition-all hover:scale-105"
        >
          {hasActiveTasks ? (
            <>
              <svg className="animate-spin w-5 h-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-slate-900">
                {uploadTasks.filter(t => t.status === 'uploading' || t.status === 'extracting' || t.status === 'saving').length} uploading...
              </span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-900">
                {uploadTasks.filter(t => t.status === 'complete').length} completed
              </span>
            </>
          )}
        </button>
      )}

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
