/**
 * store.ts — Persistance du drive Auchan actif entre les sessions MCP
 *
 * Priorité de lecture :
 *   1. Fichier store-state.json (écrit par set_store)
 *   2. Variable d'environnement AUCHAN_STORE_ID (config statique)
 *   3. null (aucun drive configuré)
 */

import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoreState {
  storeId: string;
  storeName?: string;
  setAt: string; // ISO 8601
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}

export class StoreManager {
  private readonly statePath: string;

  constructor(statePath?: string) {
    this.statePath = statePath ?? path.join(process.cwd(), 'store-state.json');
  }

  async getActiveStore(): Promise<StoreState | null> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      return JSON.parse(data) as StoreState;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        // Fallback : variable d'environnement
        const storeId = process.env.AUCHAN_STORE_ID;
        if (storeId) {
          return { storeId, setAt: new Date().toISOString() };
        }
        return null;
      }
      // JSON parse error ou autre : retourner null plutôt que crasher
      return null;
    }
  }

  async setActiveStore(storeId: string, storeName?: string): Promise<void> {
    const state: StoreState = {
      storeId,
      storeName,
      setAt: new Date().toISOString(),
    };
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
  }

  async clearActiveStore(): Promise<void> {
    try {
      await fs.unlink(this.statePath);
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') return;
      throw err;
    }
  }
}
