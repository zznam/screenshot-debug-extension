type StorageCategory = 'captures' | 'ai' | 'diagnostics';
interface ManagedStorageEntry {
  id: string;
  category: StorageCategory;
  title: string;
  url: string;
  updatedAt: number;
  sizeBytes: number;
}
export type { ManagedStorageEntry, StorageCategory };
