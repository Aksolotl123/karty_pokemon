// Czysta logika synchronizacji kolekcji telefon ↔ chmura.
// Zasada: dla każdej pozycji wygrywa nowsza zmiana (updatedAt). Usunięcie zapisujemy
// w chmurze jako „nagrobek”, żeby inne urządzenie nie wysłało karty z powrotem.
import { sanitizeEntry, type CollectionEntry } from './collection';

export interface Tombstone {
  key: string;
  deleted: true;
  updatedAt: string;
}

export type RemoteDoc = CollectionEntry | Tombstone;

export const isTombstone = (d: RemoteDoc): d is Tombstone => (d as Tombstone).deleted === true;

export function tombstone(key: string, now = new Date()): Tombstone {
  return { key, deleted: true, updatedAt: now.toISOString() };
}

/** Dokument z chmury → pozycja lub nagrobek; uszkodzone dokumenty są pomijane. */
export function parseRemoteDoc(data: unknown): RemoteDoc | null {
  const d = data as Partial<Tombstone> | null;
  if (d && d.deleted === true) {
    return typeof d.key === 'string' && typeof d.updatedAt === 'string' ? { key: d.key, deleted: true, updatedAt: d.updatedAt } : null;
  }
  return sanitizeEntry(data);
}

export interface MergePlan {
  /** Pozycje do zapisania na telefonie (nowsze w chmurze). */
  saveLocal: CollectionEntry[];
  /** Pozycje usunięte na innym urządzeniu. */
  deleteLocal: Tombstone[];
  /** Pozycje do wysłania do chmury (nowsze lub brakujące w chmurze). */
  upload: CollectionEntry[];
}

/**
 * @param remote dokumenty z chmury (pełny stan albo tylko zmienione)
 * @param full czy `remote` to pełny stan — tylko wtedy wysyłamy lokalne pozycje, których chmura nie zna
 */
export function planMerge(local: CollectionEntry[], remote: RemoteDoc[], full: boolean): MergePlan {
  const localByKey = new Map(local.map((e) => [e.key, e]));
  const remoteKeys = new Set<string>();
  const plan: MergePlan = { saveLocal: [], deleteLocal: [], upload: [] };

  for (const r of remote) {
    remoteKeys.add(r.key);
    const l = localByKey.get(r.key);
    if (isTombstone(r)) {
      if (!l) continue;
      if (l.updatedAt <= r.updatedAt) plan.deleteLocal.push(r);
      else plan.upload.push(l); // na tym telefonie dodano ją ponownie po usunięciu
    } else if (!l || l.updatedAt < r.updatedAt) {
      plan.saveLocal.push(r);
    } else if (l.updatedAt > r.updatedAt) {
      plan.upload.push(l);
    }
  }

  if (full) {
    for (const l of local) if (!remoteKeys.has(l.key)) plan.upload.push(l);
  }
  return plan;
}

/** Id dokumentu w Firestore — klucz może zawierać znaki niedozwolone w id (np. „/”). */
export function docId(key: string): string {
  return encodeURIComponent(key).replace(/\./g, '%2E');
}
