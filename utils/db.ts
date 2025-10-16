import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { HistoryItem, HistoryItemWithAssets } from '../types';

const DB_NAME = 'AI-Video-DB';
const DB_VERSION = 1;
const STORE_NAME = 'creations';

interface AIVideoDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: HistoryItem;
    indexes: { 'createdAt': Date };
  };
}

let dbPromise: Promise<IDBPDatabase<AIVideoDB>> | null = null;

const getDb = (): Promise<IDBPDatabase<AIVideoDB>> => {
    if (!dbPromise) {
        dbPromise = openDB<AIVideoDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('createdAt', 'createdAt');
            },
        });
    }
    return dbPromise;
};

export const addCreation = async (creation: HistoryItem): Promise<number> => {
    const db = await getDb();
    return db.add(STORE_NAME, creation);
};

export const getAllCreations = async (): Promise<HistoryItemWithAssets[]> => {
    const db = await getDb();
    // Sort by most recent first
    return db.getAllFromIndex(STORE_NAME, 'createdAt').then(items => items.reverse());
};

export const deleteCreation = async (id: number): Promise<void> => {
    const db = await getDb();
    return db.delete(STORE_NAME, id);
};
