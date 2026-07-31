export class ApiResponseDto<T> {
  success!: boolean;
  data!: T;
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}
