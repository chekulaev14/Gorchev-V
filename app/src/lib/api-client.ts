import { toast } from "sonner";

interface ApiErrorData {
  error: string;
  details?: unknown[];
  shortages?: { name: string; needed: number; available: number }[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorData,
  ) {
    super(data.error);
    this.name = "ApiError";
  }
}

interface FetchOptions {
  silent?: boolean;
}

async function request<T>(url: string, init?: RequestInit, options?: FetchOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    const errorData = data as ApiErrorData;
    if (!options?.silent) {
      toast.error(errorData.error || "Ошибка сервера");
    }
    throw new ApiError(res.status, errorData);
  }

  return data as T;
}

export const api = {
  get: <T>(url: string, options?: FetchOptions) =>
    request<T>(url, undefined, options),

  post: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, options),

  put: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, options),

  patch: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, options),

  del: <T>(url: string, body?: unknown, options?: FetchOptions) =>
    request<T>(url, {
      method: "DELETE",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, options),
};
