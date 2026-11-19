import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export type Reply = { status: number; data?: unknown } | 'network' | 'timeout';
export type Handler = (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>;

export interface FakeServer {
  adapter: AxiosAdapter;
  calls: InternalAxiosRequestConfig[];
  callsTo(path: string): InternalAxiosRequestConfig[];
}

export function pathOf(config: InternalAxiosRequestConfig): string {
  return (config.url ?? '').split('?')[0];
}

export function authHeader(config: InternalAxiosRequestConfig): string | undefined {
  const v = AxiosHeaders.from(config.headers).get('Authorization');
  return typeof v === 'string' ? v : undefined;
}

export function body(config: InternalAxiosRequestConfig): Record<string, unknown> {
  if (typeof config.data === 'string') return JSON.parse(config.data);
  return (config.data ?? {}) as Record<string, unknown>;
}

/** A tiny fake axios adapter: behaves like axios' real adapters (rejects on non-2xx). */
export function fakeServer(handler: Handler): FakeServer {
  const calls: InternalAxiosRequestConfig[] = [];
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const reply = await handler(config);
    if (reply === 'network') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {});
    }
    if (reply === 'timeout') {
      throw new AxiosError('timeout of 15000ms exceeded', AxiosError.ECONNABORTED, config, {});
    }
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: String(reply.status),
      headers: {},
      config,
    };
    if (reply.status >= 200 && reply.status < 300) return response;
    throw new AxiosError(
      `Request failed with status code ${reply.status}`,
      reply.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
      config,
      {},
      response,
    );
  };
  return {
    adapter,
    calls,
    callsTo: (path) => calls.filter((c) => pathOf(c) === path),
  };
}

export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const ok = (data: unknown) => ({ status: 200, data: { success: true, data } });
export const fail = (status: number, error = 'nope') => ({ status, data: { success: false, error } });
