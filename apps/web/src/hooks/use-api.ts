"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback } from "react";
import type { ApiErrorBody } from "@/lib/api-types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiFetch<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiClientError(error?.message ?? "No pudimos completar la solicitud.", response.status, error?.code);
  }
  return body as T;
}

/** `fetch` autenticado con el access token de Privy (verificado en el servidor). */
export function useApi() {
  const { getAccessToken } = usePrivy();
  return useCallback(
    async <T>(path: string, init: RequestInit = {}) => apiFetch<T>(path, { ...init, token: await getAccessToken() }),
    [getAccessToken],
  );
}
