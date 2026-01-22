"use client";

import React from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { UploadQueueProvider } from "@/contexts/UploadQueueContext";
import UploadQueuePanel from "@/components/UploadQueuePanel";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UploadQueueProvider>
        {children}
        <UploadQueuePanel />
      </UploadQueueProvider>
    </AuthProvider>
  );
}




