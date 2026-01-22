"use client";

import { useState, useEffect, useRef } from "react";
import { getApiEndpoint } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

interface TrackingStatus {
  status: string;
  timestamp: string;
  location?: string;
  description?: string;
}

interface Tracking {
  id: string;
  trackingId: string;
  provider: string;
  latestStatus: string;
  statusHistory: TrackingStatus[];
  isActive: boolean;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

function TrackingPage() {
  const [trackings, setTrackings] = useState<Tracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, logout } = useAuth();
  const router = useRouter();

  const fetchTrackings = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiEndpoint("/tracking"));
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: `HTTP ${res.status}: ${res.statusText}` }));
        throw new Error(errorData.message || `Failed to load trackings: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setTrackings(data.trackings || []);
    } catch (error) {
      console.error("Failed to fetch trackings", error);
      // Show error to user
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }
      setTrackings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackings();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(getApiEndpoint("/tracking/upload"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(errorData.message || errorData.error || "Upload failed");
      }

      const result = await res.json();
      alert(
        `Upload successful!\nAdded: ${result.results.added}\nSkipped: ${result.results.skipped}${
          result.results.errors.length > 0 ? `\nErrors: ${result.results.errors.length}` : ""
        }`
      );

      // Refresh the list
      await fetchTrackings();
    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const toggleRow = (trackingId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(trackingId)) {
      newExpanded.delete(trackingId);
    } else {
      newExpanded.add(trackingId);
    }
    setExpandedRows(newExpanded);
  };

  const refreshTracking = async (trackingId: string) => {
    setRefreshing(trackingId);
    try {
      const res = await fetch(getApiEndpoint(`/tracking/${trackingId}/refresh`), {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to refresh tracking");
      }

      // Refresh the list
      await fetchTrackings();
    } catch (error) {
      console.error("Refresh error:", error);
      alert(error instanceof Error ? error.message : "Failed to refresh tracking");
    } finally {
      setRefreshing(null);
    }
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes("delivered")) {
      return "bg-green-100 text-green-800 border-green-200";
    } else if (lowerStatus.includes("in transit") || lowerStatus.includes("shipped")) {
      return "bg-blue-100 text-blue-800 border-blue-200";
    } else if (lowerStatus.includes("pending") || lowerStatus.includes("processing")) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    } else if (lowerStatus.includes("error") || lowerStatus.includes("not found")) {
      return "bg-red-100 text-red-800 border-red-200";
    }
    return "bg-slate-100 text-slate-800 border-slate-200";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Shipment Tracking
            </h1>
            <p className="text-sm text-slate-600 mt-1">Track and monitor shipment statuses</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
              </div>
            )}
            {user && (
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
              >
                Back to Dashboard
              </button>
            )}
            {user ? (
              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </header>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Upload Tracking Excel</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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
                  Upload Excel
                </>
              )}
            </button>
          </div>
          <p className="text-sm text-slate-600">
            Upload an Excel file (.xlsx, .xls) with columns: <strong>Tracking ID</strong> and <strong>Provider</strong>.
            Only unique tracking IDs will be added.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Tracking List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">Tracking List</h2>
            <p className="text-sm text-slate-600 mt-1">
              {trackings.length} tracking{trackings.length !== 1 ? "s" : ""} found
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-4 text-slate-600">Loading trackings...</p>
            </div>
          ) : trackings.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-slate-600">No trackings found. Upload an Excel file to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {trackings.map((tracking) => {
                const isExpanded = expandedRows.has(tracking.trackingId);
                return (
                  <div key={tracking.id} className="hover:bg-slate-50 transition-colors">
                    {/* Main Row */}
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Tracking ID</div>
                          <div className="font-semibold text-slate-900">{tracking.trackingId}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Provider</div>
                          <div className="font-medium text-slate-700">{tracking.provider}</div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Latest Status</div>
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              tracking.latestStatus
                            )}`}
                          >
                            {tracking.latestStatus}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-slate-500 mb-1">Last Updated</div>
                          <div className="text-sm text-slate-700">{formatDate(tracking.lastUpdated)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => refreshTracking(tracking.trackingId)}
                          disabled={refreshing === tracking.trackingId || !tracking.isActive}
                          className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          title="Refresh tracking status"
                        >
                          {refreshing === tracking.trackingId ? (
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            "Refresh"
                          )}
                        </button>
                        <button
                          onClick={() => toggleRow(tracking.trackingId)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm flex items-center gap-2"
                        >
                          {isExpanded ? "Hide" : "Show"} History
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Expanded Status History */}
                    {isExpanded && (
                      <div className="px-6 pb-6 bg-slate-50 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-4 mt-4">Status History</h3>
                        {!tracking.statusHistory || tracking.statusHistory.length === 0 ? (
                          <p className="text-sm text-slate-500 italic">No status history available</p>
                        ) : (
                          <div className="space-y-3">
                            {tracking.statusHistory.map((status, index) => (
                              <div
                                key={index}
                                className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                                  {tracking.statusHistory && index < tracking.statusHistory.length - 1 && (
                                    <div className="w-0.5 h-8 bg-slate-300 ml-0.5"></div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <span
                                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                        status.status
                                      )}`}
                                    >
                                      {status.status}
                                    </span>
                                    <span className="text-xs text-slate-500">{formatDate(status.timestamp)}</span>
                                  </div>
                                  {status.location && (
                                    <div className="text-sm text-slate-600 mb-1">
                                      <strong>Location:</strong> {status.location}
                                    </div>
                                  )}
                                  {status.description && (
                                    <div className="text-sm text-slate-600">
                                      <strong>Description:</strong> {status.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrackingPage;

