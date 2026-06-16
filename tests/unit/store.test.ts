import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StoreManager } from '../../src/store.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function makeTmpPath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'auchan-store-test-'));
  return path.join(dir, 'store-state.json');
}

describe('StoreManager.setActiveStore / getActiveStore', () => {
  let statePath: string;

  beforeEach(async () => {
    statePath = await makeTmpPath();
  });

  afterEach(async () => {
    try { await fs.unlink(statePath); } catch { /* ignoré */ }
  });

  it('persiste storeId et storeName dans le fichier JSON', async () => {
    const manager = new StoreManager(statePath);
    await manager.setActiveStore('drive-caluire', 'Drive Caluire');

    const state = await manager.getActiveStore();
    expect(state).not.toBeNull();
    expect(state!.storeId).toBe('drive-caluire');
    expect(state!.storeName).toBe('Drive Caluire');
    expect(state!.setAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('persiste sans storeName (champ optionnel)', async () => {
    const manager = new StoreManager(statePath);
    await manager.setActiveStore('drive-test');

    const state = await manager.getActiveStore();
    expect(state!.storeId).toBe('drive-test');
    expect(state!.storeName).toBeUndefined();
  });

  it('retourne null si le fichier n\'existe pas et AUCHAN_STORE_ID n\'est pas défini', async () => {
    delete process.env.AUCHAN_STORE_ID;
    const manager = new StoreManager(path.join(os.tmpdir(), 'fichier-inexistant-99999.json'));
    const state = await manager.getActiveStore();
    expect(state).toBeNull();
  });

  it('retourne un état depuis AUCHAN_STORE_ID si le fichier n\'existe pas', async () => {
    process.env.AUCHAN_STORE_ID = 'drive-env';
    const manager = new StoreManager(path.join(os.tmpdir(), 'fichier-inexistant-99999.json'));
    const state = await manager.getActiveStore();
    expect(state).not.toBeNull();
    expect(state!.storeId).toBe('drive-env');
    delete process.env.AUCHAN_STORE_ID;
  });

  it('écrase le store précédent lors d\'un second setActiveStore', async () => {
    const manager = new StoreManager(statePath);
    await manager.setActiveStore('drive-a', 'Drive A');
    await manager.setActiveStore('drive-b', 'Drive B');

    const state = await manager.getActiveStore();
    expect(state!.storeId).toBe('drive-b');
    expect(state!.storeName).toBe('Drive B');
  });

  it('retourne null sur un fichier JSON invalide (ne crash pas)', async () => {
    await fs.writeFile(statePath, 'not valid json', 'utf-8');
    const manager = new StoreManager(statePath);
    const state = await manager.getActiveStore();
    expect(state).toBeNull();
  });
});

describe('StoreManager.clearActiveStore', () => {
  let statePath: string;

  beforeEach(async () => {
    statePath = await makeTmpPath();
  });

  it('supprime le fichier d\'état', async () => {
    const manager = new StoreManager(statePath);
    await manager.setActiveStore('drive-a');
    await manager.clearActiveStore();

    await expect(fs.access(statePath)).rejects.toThrow();
  });

  it('ne lève pas d\'erreur si le fichier n\'existe pas (ENOENT)', async () => {
    const manager = new StoreManager('/tmp/fichier-inexistant-99999.json');
    await expect(manager.clearActiveStore()).resolves.not.toThrow();
  });
});
