export type StoredObject = {
  key: string;
  url: string;
  bytes: number;
};

export type RetrievedObject = {
  body: Buffer;
  contentType: string;
};

/**
 * Storage abstraction: development uses the local disk, production uses any
 * S3-compatible bucket. The media database row stores the key, never a disk
 * path, so switching drivers does not change the schema.
 */
export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<RetrievedObject | null>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
  /** Readiness probe: resolves only when the backing store is reachable and writable. */
  healthCheck(): Promise<void>;
}
