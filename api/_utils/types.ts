export type ApiRequest = {
  method?: string
  body?: Record<string, unknown>
  headers?: { cookie?: string } & Record<string, string | undefined>
  query?: Record<string, string | undefined>
  /** Aborts when the client disconnects; threaded to upstream AI calls (M1). */
  signal?: AbortSignal
}

/** Handle for writing a chunked response body progressively. */
export type ApiResponseStreamWriter = {
  write: (chunk: string) => Promise<void> | void
  close: () => Promise<void> | void
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (data: unknown) => ApiResponse
  setHeader: (key: string, value: string | string[]) => ApiResponse
  end: (data?: unknown) => ApiResponse
  /**
   * Switches the response to a chunked stream (e.g. NDJSON). Once called,
   * the status line and headers are committed — the route handler must not
   * call status()/json()/end() afterwards; errors go through the stream.
   * Returns null when the host cannot stream (caller should fall back to a
   * buffered json() response).
   */
  startChunkedStream?: (
    contentType: string,
  ) => ApiResponseStreamWriter | null
}
