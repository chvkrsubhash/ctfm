'use client';

import { Suspense } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="spinner" />
        <p className="text-muted">Loading CTF workspace...</p>
      </div>
    }>
      <DashboardShell />
    </Suspense>
  );
}
