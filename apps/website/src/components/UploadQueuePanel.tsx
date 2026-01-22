"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadQueue } from "@/contexts/UploadQueueContext";

function stageLabel(stage: string) {
  switch (stage) {
    case "queued":
      return "Queued";
    case "uploading":
      return "Uploading";
    case "extracting":
      return "Extracting";
    case "saving":
      return "Saving";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return stage;
  }
}

export default function UploadQueuePanel() {
  const { jobs, clearCompleted, dismissJob } = useUploadQueue();
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const activeCount = useMemo(() => jobs.filter((j) => j.status === "running" || j.status === "queued").length, [jobs]);
  const errorCount = useMemo(() => jobs.filter((j) => j.status === "error").length, [jobs]);

  if (!jobs.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Upload Queue</span>
            <span className="text-xs text-slate-600">
              {activeCount > 0 ? `${activeCount} active` : "idle"}
              {errorCount > 0 ? ` • ${errorCount} error` : ""}
            </span>
          </div>
          <span className="text-slate-500 text-sm">{open ? "▾" : "▸"}</span>
        </button>

        {open && (
          <>
            <div className="px-4 pb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Clear completed
              </button>
              <div className="text-xs text-slate-500">Runs up to 3 uploads at once</div>
            </div>

            <div className="max-h-[320px] overflow-auto border-t border-slate-100">
              {jobs.slice(0, 8).map((job) => {
                const isDone = job.status === "complete";
                const isError = job.status === "error";
                const pillClass = isDone
                  ? "bg-green-100 text-green-800 border-green-200"
                  : isError
                    ? "bg-red-100 text-red-800 border-red-200"
                    : "bg-blue-100 text-blue-800 border-blue-200";

                return (
                  <div key={job.id} className="px-4 py-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{job.filename}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${pillClass}`}>
                            {stageLabel(job.stage)}
                          </span>
                          <span className="text-xs text-slate-600 truncate">{job.message}</span>
                        </div>
                        {job.error && (
                          <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                            {job.error}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {job.poNumber && (
                          <button
                            type="button"
                            onClick={() => router.push(`/review/${encodeURIComponent(job.poNumber!)}`)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Open
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => dismissJob(job.id)}
                          className="text-xs text-slate-400 hover:text-slate-700"
                          aria-label="Dismiss upload"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}




