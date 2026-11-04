import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAVE_NOTICE_INTERVAL_MS, onSaveFailure, reportSaveResult, resetSaveStatus } from './saveStatus';

describe('reportSaveResult', () => {
  afterEach(() => {
    onSaveFailure(null);
    resetSaveStatus();
  });

  it('does nothing when the save worked', () => {
    const notify = vi.fn();
    onSaveFailure(notify);

    reportSaveResult(true, 1000);

    expect(notify).not.toHaveBeenCalled();
  });

  it('tells the player about a failed save', () => {
    const notify = vi.fn();
    onSaveFailure(notify);

    reportSaveResult(false, 1000);

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('shows at most one notice per interval while saves keep failing', () => {
    const notify = vi.fn();
    onSaveFailure(notify);

    reportSaveResult(false, 1000);
    reportSaveResult(false, 2000);
    reportSaveResult(false, 1000 + SAVE_NOTICE_INTERVAL_MS - 1);
    expect(notify).toHaveBeenCalledTimes(1);

    reportSaveResult(false, 1000 + SAVE_NOTICE_INTERVAL_MS);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('does not throw when no one is listening', () => {
    expect(() => reportSaveResult(false, 1000)).not.toThrow();
  });
});
