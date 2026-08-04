/**
 * Central zod entry point with the OpenAPI extension applied once.
 * Import `z` from here (instead of 'zod') in any schema that uses `.openapi(...)`.
 */
import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export { z };
