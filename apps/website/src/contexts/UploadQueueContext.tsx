"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";

export type UploadStage = "queued" | "uploading" | "extracting" | "saving" | "complete" | "error";
export type UploadStatus = "queued" | "running" | "complete" | "error";

export type UploadJob = {
  id: string;
  filename: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  status: UploadStatus;
  stage: UploadStage;
  message?: string;
  error?: string;
  poNumber?: string;
};

type EnqueuePayload = {
  file: File;
  clientName: string;
  clientId?: string;
  clientMapping?: string;
  expectedItems?: string;
};

type UploadQueueContextValue = {
  jobs: UploadJob[];
  enqueueUploads: (payloads: EnqueuePayload[]) => void;
  clearCompleted: () => void;
  dismissJob: (id: string) => void;
};

const UploadQueueContext = createContext<UploadQueueContextValue | undefined>(undefined);

const MAX_CONCURRENT = 3;

function makeId() {
  // good-enough unique id for UI state
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  // simple in-memory queue
  const pendingRef = useRef<Array<{ jobId: string; payload: EnqueuePayload }>>([]);
  const runningCountRef = useRef(0);

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const runNext = useCallback(() => {
    while (runningCountRef.current < MAX_CONCURRENT && pendingRef.current.length > 0) {
      const next = pendingRef.current.shift();
      if (!next) break;

      runningCountRef.current += 1;
      const { jobId, payload } = next;

      void (async () => {
        try {
          updateJob(jobId, {
            status: "running",
            stage: "uploading",
            startedAt: Date.now(),
            message: "Uploading...",
            error: undefined,
          });

          const form = new FormData();
          form.append("file", payload.file);
          form.append("clientName", payload.clientName);
          if (payload.clientId) form.append("clientId", payload.clientId);
          if (payload.clientMapping) form.append("clientMapping", payload.clientMapping);
          if (payload.expectedItems?.trim()) form.append("expectedItems", payload.expectedItems.trim());

          // We can't get real upload % with fetch; show stage-based progress instead.
          updateJob(jobId, { stage: "extracting", message: "Extracting..." });

          const res = await authenticatedFetch("/po/upload", { method: "POST", body: form });
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: "Upload failed" }));
            const errorMessage = errorData.message || errorData.error || "Upload failed";
            throw new Error(errorMessage);
          }

          updateJob(jobId, { stage: "saving", message: "Saving..." });

          const result = await res.json().catch(() => ({}));
          const poNumber = result?.po?.PONumber || result?.poNumber;

          updateJob(jobId, {
            status: "complete",
            stage: "complete",
            message: "Done",
            poNumber: typeof poNumber === "string" ? poNumber : undefined,
            finishedAt: Date.now(),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Upload failed";
          updateJob(jobId, {
            status: "error",
            stage: "error",
            message: "Failed",
            error: msg,
            finishedAt: Date.now(),
          });
        } finally {
          runningCountRef.current -= 1;
          runNext();
        }
      })();
    }
  }, [updateJob]);

  const enqueueUploads = useCallback(
    (payloads: EnqueuePayload[]) => {
      const newJobs: UploadJob[] = payloads.map((p) => {
        const id = makeId();
        pendingRef.current.push({ jobId: id, payload: p });
        return {
          id,
          filename: p.file.name,
          createdAt: Date.now(),
          status: "queued",
          stage: "queued",
          message: "Queued",
        };
      });

      setJobs((prev) => [...newJobs, ...prev]);
      runNext();
    },
    [runNext],
  );

  const clearCompleted = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status !== "complete"));
  }, []);

  const dismissJob = useCallback((id: string) => {
    // also remove from pending queue if it hasn't started yet
    pendingRef.current = pendingRef.current.filter((p) => p.jobId !== id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const value = useMemo<UploadQueueContextValue>(
    () => ({ jobs, enqueueUploads, clearCompleted, dismissJob }),
    [jobs, enqueueUploads, clearCompleted, dismissJob],
  );

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) throw new Error("useUploadQueue must be used within an UploadQueueProvider");
  return ctx;
}




