import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assertSafeKey } from "./local";
import type { StorageDriver, StoredObject, StoredResult } from "./index";

/**
 * S3-compatible storage driver (AWS S3, Cloudflare R2, MinIO, Backblaze B2).
 * Used when STORAGE_DRIVER="s3". Required env: S3_BUCKET plus S3_ENDPOINT /
 * S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY for non-AWS endpoints.
 * Public URLs come from S3_PUBLIC_BASE_URL when set.
 */
export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly endpoint: string;

  constructor() {
    this.endpoint = (process.env.S3_ENDPOINT || "").replace(/\/+$/, "");
    this.bucket = process.env.S3_BUCKET || "";
    this.publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
    this.client = new S3Client({
      endpoint: this.endpoint || undefined,
      region: process.env.S3_REGION || "auto",
      forcePathStyle: Boolean(this.endpoint),
      credentials: process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
          }
        : undefined,
    });
  }

  urlFor(key: string): string {
    const safe = assertSafeKey(key);
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${safe}`;
    if (this.endpoint) return `${this.endpoint}/${this.bucket}/${safe}`;
    return `https://${this.bucket}.s3.amazonaws.com/${safe}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredResult> {
    const safe = assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safe,
        Body: body,
        ContentType: contentType,
      }),
    );
    return { key: safe, url: this.urlFor(safe), bytes: body.byteLength, contentType };
  }

  async get(key: string): Promise<StoredObject | null> {
    const safe = assertSafeKey(key);
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: safe }),
      );
      if (!out.Body) return null;
      const body = Buffer.from(await out.Body.transformToByteArray());
      return { body, contentType: out.ContentType ?? "application/octet-stream" };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if ((error as { name?: string }).name === "NoSuchKey" || status === 404) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const safe = assertSafeKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: safe }),
    );
  }
}
