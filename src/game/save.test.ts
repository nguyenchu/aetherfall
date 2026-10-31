import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSave } from './save';

const KEY = 'aetherfall.save.v1';
const BACKUP_KEY = `${KEY}.backup`;

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('loadSave with unreadable data', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the raw save under a backup key before falling back to defaults', () => {
    const storage = memoryStorage({ [KEY]: '{"gold": 120, broken' });
    vi.stubGlobal('localStorage', storage);

    const save = loadSave();

    expect(save.gold).toBe(0);
    expect(storage.data.get(BACKUP_KEY)).toBe('{"gold": 120, broken');
    expect(storage.data.get(KEY)).toBe('{"gold": 120, broken');
  });

  it('does not write a backup for a readable save', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ gold: 120 }) });
    vi.stubGlobal('localStorage', storage);

    expect(loadSave().gold).toBe(120);
    expect(storage.data.has(BACKUP_KEY)).toBe(false);
  });

  it('returns defaults without a backup when there is no save', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);

    expect(loadSave().gold).toBe(0);
    expect(storage.data.has(BACKUP_KEY)).toBe(false);
  });
});
