import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSave, loadSaveSummary } from './save';

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

describe('loadSave with fields of the wrong type', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stored(save: unknown) {
    const storage = memoryStorage({ [KEY]: JSON.stringify(save) });
    vi.stubGlobal('localStorage', storage);
    return storage;
  }

  it('does not crash the save summary when flags and levels are null', () => {
    stored({ gold: 50, flags: null, levels: null });

    expect(() => loadSaveSummary()).not.toThrow();
    expect(loadSaveSummary()?.partyLevels).toBe('Kael L1  Lyra L1  Mira L1');
    expect(loadSave().flags).toEqual([]);
    expect(loadSave().gold).toBe(50);
  });

  it('replaces numbers of the wrong type with defaults', () => {
    const save = (stored({ gold: 'mye', potions: -2, deepest: 0, ngPlus: null, hpBlessings: Infinity }), loadSave());

    expect(save.gold).toBe(0);
    expect(save.potions).toBe(3);
    expect(save.deepest).toBe(1);
    expect(save.ngPlus).toBe(0);
    expect(save.hpBlessings).toBe(0);
  });

  it('drops bad entries but keeps the good ones', () => {
    stored({
      flags: ['intro_seen', 7, null],
      levels: { kael: 4, lyra: 'høy', mira: 0 },
      items: { potion: 2, ether: 'x' },
      equipmentOwned: ['iron_sword', { id: 'x' }],
      equipped: { kael: { weapon: 'iron_sword', armor: 5 }, lyra: 'robe' },
      quests: { first_steps: 'complete', bogus: 'done' },
    });
    const save = loadSave();

    expect(save.flags).toEqual(['intro_seen']);
    expect(save.levels).toEqual({ kael: 4 });
    expect(save.items).toEqual({ potion: 2 });
    expect(save.potions).toBe(2);
    expect(save.equipmentOwned).toContain('iron_sword');
    expect(save.equipmentOwned).not.toContainEqual({ id: 'x' });
    expect(save.equipped.kael).toEqual({ weapon: 'iron_sword' });
    expect(typeof save.equipped.lyra).toBe('object');
    expect(save.quests.bogus).toBeUndefined();
  });

  it('treats a save that is not an object as unreadable', () => {
    const storage = stored([1, 2, 3]);

    expect(loadSave().gold).toBe(0);
    expect(storage.data.get(BACKUP_KEY)).toBe('[1,2,3]');
  });

  it('keeps a valid older save unchanged where it matters', () => {
    stored({ gold: 120, potions: 5, deepest: 4, levels: { kael: 3, bram: 2 }, flags: ['a'] });
    const save = loadSave();

    expect(save).toMatchObject({ gold: 120, potions: 5, deepest: 4, flags: ['a'] });
    expect(save.items.potion).toBe(5);
    expect(loadSaveSummary()?.partyLevels).toBe('Kael L3  Lyra L1  Mira L2');
  });
});
