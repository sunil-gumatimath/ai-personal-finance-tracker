export type ApiRequest = {
  method?: string
  body?: Record<string, unknown>
  headers?: { cookie?: string } & Record<string, string | undefined>
  query?: Record<string, string | undefined>
}

export type ApiResponse = {
  status: (code: number) => ApiResponse
  json: (data: unknown) => ApiResponse
  setHeader: (key: string, value: string | string[]) => ApiResponse
  end: (data?: unknown) => ApiResponse
}
