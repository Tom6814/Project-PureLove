export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Supabase ${operationType}] ${path ?? ''}: ${message}`);
  throw new Error(message);
}
