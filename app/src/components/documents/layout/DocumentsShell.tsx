'use client';

import { Sidebar } from '@/components/warehouse-v2/layout/Sidebar';
import { DocumentsHeader } from './DocumentsHeader';

export function DocumentsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DocumentsHeader />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
