export type {
  ApiFailure,
  ApiResponse,
  ApiSuccess
} from "@bep-nha-minh/shared/types/api-response";

import type { ApiFailure, ApiSuccess } from "@bep-nha-minh/shared/types/api-response";

export function successResponse<T>(
  data: T,
  init?: ResponseInit & { message?: string }
) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    message: init?.message
  };

  return Response.json(body, { status: init?.status ?? 200 });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, string>
) {
  const body: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      details
    }
  };

  return Response.json(body, { status });
}
