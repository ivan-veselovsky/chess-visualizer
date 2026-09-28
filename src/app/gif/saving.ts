/**
 * Where an exported GIF goes: a folder the reader chose, or the downloads.
 *
 * A web page cannot be told a path and write to it. What it can do, in the
 * browsers that allow it (Chrome and Edge, not Firefox or Safari), is ask the
 * reader to pick a folder, and then write into that folder for as long as the
 * reader lets it. Everywhere else a file is handed to the browser to download,
 * and goes wherever the browser puts downloads.
 *
 * The folder is kept between visits, the way the reader's other choices are,
 * in IndexedDB — a folder is a handle rather than a path, and a handle is not
 * something that can be written as text. The browser forgets the permission to
 * write to it when the page closes, so it is asked for again on the next
 * export; that asking has to happen inside a click, which is why `readyToWrite`
 * is its own step rather than part of writing.
 */

/* The parts of the File System Access API used here. The standard library's
   types stop short of the ones that are still Chromium's alone. */
interface FolderHandle {
  readonly kind: "directory";
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
}
interface FileHandle {
  createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }>;
}
type WithPicker = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "readwrite";
    startIn?: string;
  }) => Promise<FolderHandle>;
};

export type { FolderHandle };

/** Whether this browser can be given a folder to save into at all. */
export function canChooseFolder(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

const DB = "cv-gif-export";
const STORE = "handles";
const KEY = "folder";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function stored<T>(action: (store: IDBObjectStore) => IDBRequest<T>, write: boolean): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, write ? "readwrite" : "readonly").objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** The folder chosen last time, or null — none chosen, or none this browser can use. */
export async function savedFolder(): Promise<FolderHandle | null> {
  if (!canChooseFolder()) {
    return null;
  }
  try {
    return ((await stored((store) => store.get(KEY), false)) as FolderHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks the reader for a folder, and keeps it. Null when they change their mind.
 * Must be called from a click: the browser will not show its picker otherwise.
 */
export async function chooseFolder(): Promise<FolderHandle | null> {
  const picker = (window as WithPicker).showDirectoryPicker;
  if (picker === undefined) {
    return null;
  }
  try {
    const folder = await picker({ id: "chess-visualizer-gifs", mode: "readwrite", startIn: "pictures" });
    await stored((store) => store.put(folder, KEY), true);
    return folder;
  } catch {
    return null;
  }
}

/** Back to the downloads. */
export async function forgetFolder(): Promise<void> {
  try {
    await stored((store) => store.delete(KEY), true);
  } catch {
    /* Nothing kept, nothing to forget. */
  }
}

/**
 * Whether the folder may be written to now, asking the reader if the browser
 * needs to. Must be called from a click, for the same reason as `chooseFolder`.
 */
export async function readyToWrite(folder: FolderHandle): Promise<boolean> {
  try {
    if ((await folder.queryPermission({ mode: "readwrite" })) === "granted") {
      return true;
    }
    return (await folder.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

/** Whether the folder already holds a file of this name. */
export async function fileExists(folder: FolderHandle, name: string): Promise<boolean> {
  try {
    await folder.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Writes the GIF into the folder, over a file of the same name if there is one. */
export async function writeGif(folder: FolderHandle, name: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
  const file = await folder.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(new Blob([bytes], { type: "image/gif" }));
  await writable.close();
}

/** Hands the GIF to the browser to download, under the name given. */
export function downloadGif(name: string, bytes: Uint8Array<ArrayBuffer>): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/gif" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  /* Not at once: some browsers are still reading from the address when the
     click returns, and a revoked address downloads nothing. */
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
