/**
 * Next.js instrumentation hook: runs once per server start. Node.js-only work lives in
 * `instrumentation.node.ts` (the edge compilation must not see its imports).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
