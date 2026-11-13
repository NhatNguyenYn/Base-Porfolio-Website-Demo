import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { RetrievedObject, StorageDriver, StoredObject } from "./types";
import { assertSafeKey } from "./local";

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, MinIO, Backblaze B2…).
 * Activated with STORAGE_DRIVER="s3" plus the S3_* environment variables.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        "S3 storage is selected but S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing.",
      );
    }

    this.bucket = bucket;
    this.publicBase = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  urlFor(key: string): string {
    const safe = assertSafeKey(key);
    if (!this.publicBase) {
      throw new Error("S3_PUBLIC_BASE_URL is required to build media URLs for S3 storage.");
    }
    return `${this.publicBase}/${safe}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    const safe = assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safe,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { key: safe, url: this.urlFor(safe), bytes: body.byteLength };
  }

  async get(key: string): Promise<RetrievedObject | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) }),
      );
      if (!result.Body) return null;
      const bytes = await result.Body.transformToByteArray();
      return {
        body: Buffer.from(bytes),
        contentType: result.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  /**
   * Readiness probe: the bucket must exist and the credentials must allow
   * s3:ListBucket (HeadBucket). A write-only policy will therefore report the
   * service as not ready, which is intentional: uploads need both read and
   * write access to serve media back.
   */
  async healthCheck(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: assertSafeKey(key) }));
  }
}
