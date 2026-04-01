export interface Order {
  id: string;
  number: string;
  customer: string;
  status: 'active' | 'completed';
  documentsCount: number;
  coverage: { type: string; covered: boolean; count: number }[];
  createdAt: string;
}

export interface Certificate {
  id: string;
  number: string;
  grade: string;
  supplier: string;
  standard: string;
  status: 'uploaded' | 'parsed' | 'verified';
  confidence: number;
  createdAt: string;
}

export interface Document {
  id: string;
  number: string;
  orderId: string;
  orderNumber: string;
  version: number;
  certificatesCount: number;
  status: 'draft' | 'issued';
  createdAt: string;
}

export const mockOrders: Order[] = [
  {
    id: 'ord-1',
    number: '#001',
    customer: 'ООО Стройком',
    status: 'active',
    documentsCount: 3,
    coverage: [
      { type: 'metal', covered: true, count: 3 },
      { type: 'coating', covered: true, count: 1 },
      { type: 'welding', covered: false, count: 0 },
    ],
    createdAt: '2026-03-15',
  },
  {
    id: 'ord-2',
    number: '#002',
    customer: 'МеталлПро',
    status: 'active',
    documentsCount: 1,
    coverage: [
      { type: 'metal', covered: true, count: 2 },
      { type: 'welding', covered: true, count: 1 },
    ],
    createdAt: '2026-03-20',
  },
  {
    id: 'ord-3',
    number: '#003',
    customer: 'ТехноСтрой',
    status: 'completed',
    documentsCount: 5,
    coverage: [
      { type: 'metal', covered: true, count: 4 },
      { type: 'coating', covered: true, count: 2 },
      { type: 'welding', covered: true, count: 1 },
    ],
    createdAt: '2026-02-10',
  },
];

export const mockCertificates: Certificate[] = [
  {
    id: 'cert-1',
    number: 'СП-001',
    grade: 'S355',
    supplier: 'НЛМК',
    standard: 'ГОСТ 19281-2014',
    status: 'parsed',
    confidence: 82,
    createdAt: '2026-03-10',
  },
  {
    id: 'cert-2',
    number: 'СП-002',
    grade: '09Г2С',
    supplier: 'Северсталь',
    standard: 'ГОСТ 19281-2014',
    status: 'verified',
    confidence: 98,
    createdAt: '2026-03-08',
  },
  {
    id: 'cert-3',
    number: 'СП-003',
    grade: 'Ст3сп',
    supplier: 'ММК',
    standard: 'ГОСТ 380-2005',
    status: 'uploaded',
    confidence: 0,
    createdAt: '2026-03-25',
  },
  {
    id: 'cert-4',
    number: 'СП-004',
    grade: 'S235',
    supplier: 'НЛМК',
    standard: 'EN 10025-2',
    status: 'verified',
    confidence: 95,
    createdAt: '2026-03-01',
  },
  {
    id: 'cert-5',
    number: 'СП-005',
    grade: '09Г2С',
    supplier: 'ЕВРАЗ',
    standard: 'ГОСТ 19281-2014',
    status: 'parsed',
    confidence: 74,
    createdAt: '2026-03-22',
  },
];

export const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    number: 'Doc-001',
    orderId: 'ord-1',
    orderNumber: '#001',
    version: 1,
    certificatesCount: 3,
    status: 'draft',
    createdAt: '2026-03-16',
  },
  {
    id: 'doc-2',
    number: 'Doc-002',
    orderId: 'ord-1',
    orderNumber: '#001',
    version: 2,
    certificatesCount: 4,
    status: 'issued',
    createdAt: '2026-03-18',
  },
  {
    id: 'doc-3',
    number: 'Doc-003',
    orderId: 'ord-2',
    orderNumber: '#002',
    version: 1,
    certificatesCount: 2,
    status: 'draft',
    createdAt: '2026-03-21',
  },
  {
    id: 'doc-4',
    number: 'Doc-004',
    orderId: 'ord-3',
    orderNumber: '#003',
    version: 1,
    certificatesCount: 5,
    status: 'issued',
    createdAt: '2026-02-15',
  },
];

export const statusLabels = {
  active: 'Активный',
  completed: 'Завершён',
  uploaded: 'Загружен',
  parsed: 'Распознан',
  verified: 'Проверен',
  draft: 'Черновик',
  issued: 'Выпущен',
};

export const statusColors: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
  uploaded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  parsed: 'bg-blue-100 text-blue-800 border-blue-300',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  draft: 'bg-orange-100 text-orange-800 border-orange-300',
  issued: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};
