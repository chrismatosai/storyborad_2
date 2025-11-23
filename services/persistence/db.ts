
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Graph, ProjectMetadata } from '../../types/graph';

interface StoryboardDB extends DBSchema {
  projects: {
    key: string;
    value: Graph;
  };
}

const DB_NAME = 'ai-storyboard-db';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

/**
 * Singleton database connection promise to avoid opening multiple connections.
 */
let dbPromise: Promise<IDBPDatabase<StoryboardDB>> | null = null;

const getDB = async () => {
  if (!dbPromise) {
    dbPromise = openDB<StoryboardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.log('[DB] Creating object store:', STORE_NAME);
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Saves a project to IndexedDB.
 * Upserts based on the ID.
 */
export const saveProject = async (id: string, data: Graph): Promise<void> => {
  try {
    const db = await getDB();
    // Ensure the ID in the data matches the requested ID
    const projectToSave = { ...data, id };
    await db.put(STORE_NAME, projectToSave);
    console.log(`[DB] Project saved: ${id} (${data.nodes.length} nodes)`);
  } catch (error) {
    console.error(`[DB] Failed to save project ${id}:`, error);
    throw error;
  }
};

/**
 * Loads a full project graph by ID.
 */
export const loadProject = async (id: string): Promise<Graph | undefined> => {
  try {
    const db = await getDB();
    const project = await db.get(STORE_NAME, id);
    if (project) {
        console.log(`[DB] Project loaded: ${id}`);
    } else {
        console.warn(`[DB] Project not found: ${id}`);
    }
    return project;
  } catch (error) {
    console.error(`[DB] Failed to load project ${id}:`, error);
    throw error;
  }
};

/**
 * Returns a list of all projects (metadata only) sorted by lastModified descending.
 */
export const getAllProjects = async (): Promise<ProjectMetadata[]> => {
  try {
    const db = await getDB();
    const allProjects = await db.getAll(STORE_NAME);
    
    // Convert to lightweight metadata
    const metadata: ProjectMetadata[] = allProjects.map(p => ({
      id: p.id,
      name: p.name,
      lastModified: p.lastModified
    }));

    // Sort by newest first
    return metadata.sort((a, b) => b.lastModified - a.lastModified);
  } catch (error) {
    console.error('[DB] Failed to get all projects:', error);
    throw error;
  }
};

/**
 * Deletes a project from IndexedDB by ID.
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
    console.log(`[DB] Project deleted: ${id}`);
  } catch (error) {
    console.error(`[DB] Failed to delete project ${id}:`, error);
    throw error;
  }
};
