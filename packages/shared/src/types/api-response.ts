export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
