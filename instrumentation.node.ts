/**
 * Server start (Node.js runtime, see `instrumentation.ts`): on demo instances (`DEMO_MODE=true`)
 * schedules the hourly cleanup of expired demo workspaces.
 *
 * Keep the imports light: this file is bundled separately, and e.g. the template code pulls in
 * jsdom with a native binary webpack cannot bundle (built-in templates sync lazily on first use).
 */
import { isDemoMode } from '@lib/demo/config';
import { startDemoCleanupSchedule } from '@lib/demo/scheduler';

if (isDemoMode()) startDemoCleanupSchedule();
