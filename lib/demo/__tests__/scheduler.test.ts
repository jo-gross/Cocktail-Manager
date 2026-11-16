import { afterEach, describe, expect, it, vi } from 'vitest';

const cleanup = vi.fn();
vi.mock('@lib/demo/cleanup', () => ({ cleanupExpiredDemoWorkspaces: () => cleanup() }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('startDemoCleanupSchedule', () => {
  it('cleans up shortly after the start and then hourly, once per process, and logs failures', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    cleanup.mockRejectedValueOnce(new Error('db down')).mockResolvedValue({ deletedWorkspaces: 0, deletedUsers: 0 });
    const { startDemoCleanupSchedule, DEMO_CLEANUP_INTERVAL_MS } = await import('@lib/demo/scheduler');

    startDemoCleanupSchedule();
    startDemoCleanupSchedule();
    expect(cleanup).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('[DemoCleanup]'), expect.any(Error));

    await vi.advanceTimersByTimeAsync(DEMO_CLEANUP_INTERVAL_MS);
    expect(cleanup).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(DEMO_CLEANUP_INTERVAL_MS);
    expect(cleanup).toHaveBeenCalledTimes(3);
  });
});
