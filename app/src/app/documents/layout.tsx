import { DocumentsShell } from '@/components/documents/layout/DocumentsShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocumentsShell>{children}</DocumentsShell>;
}
