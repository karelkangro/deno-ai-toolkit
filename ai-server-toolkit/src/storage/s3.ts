// S3-compatible file storage implementation
// Supports AWS S3, Cloudflare R2, MinIO, and other S3-compatible services
// Uses AWS SDK v3 for Deno

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "npm:@aws-sdk/client-s3@^3.0.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@^3.0.0";
import type {
  DownloadResult,
  FileStorageConfig,
  FileStorageState,
  PresignedUrlOptions,
  UploadOptions,
} from "./types.ts";

/**
 * Create S3-compatible file storage client
 *
 * Works with:
 * - AWS S3 (endpoint optional, inferred from region)
 * - Cloudflare R2 (custom endpoint)
 * - MinIO (custom endpoint + forcePathStyle)
 * - Other S3-compatible services
 *
 * @param config File storage configuration
 * @returns FileStorageState with S3 client
 *
 * @example
 * ```ts
 * // AWS S3
 * const storage = createS3Storage({
 *   provider: "s3",
 *   region: "us-east-1",
 *   bucket: "my-bucket",
 *   accessKeyId: "...",
 *   secretAccessKey: "..."
 * });
 *
 * // Cloudflare R2
 * const storage = createS3Storage({
 *   provider: "s3",
 *   endpoint: "https://abc123.r2.cloudflarestorage.com",
 *   region: "auto",
 *   bucket: "my-bucket",
 *   accessKeyId: "...",
 *   secretAccessKey: "..."
 * });
 *
 * // MinIO (self-hosted)
 * const storage = createS3Storage({
 *   provider: "s3",
 *   endpoint: "http://localhost:9000",
 *   region: "us-east-1",
 *   bucket: "my-bucket",
 *   accessKeyId: "minioadmin",
 *   secretAccessKey: "minioadmin",
 *   forcePathStyle: true
 * });
 * ```
 */
export function createS3Storage(config: FileStorageConfig): FileStorageState {
  const s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  console.log(
    `✅ S3 storage initialized: ${config.endpoint || "AWS S3"} / ${config.bucket}`,
  );

  return {
    config,
    s3Client,
  };
}

/**
 * Upload file to S3-compatible storage
 *
 * @param state File storage state
 * @param key Storage key/path (e.g., "workspaces/abc123/document.pdf")
 * @param content File content as Uint8Array
 * @param options Upload options (content type, metadata)
 * @returns Promise resolving to storage key
 *
 * @example
 * ```ts
 * const fileContent = await Deno.readFile("./document.pdf");
 * await uploadFile(storage, "workspaces/abc123/document.pdf", fileContent, {
 *   contentType: "application/pdf",
 *   metadata: { originalName: "Project Plan.pdf" }
 * });
 * ```
 */
export async function uploadFile(
  state: FileStorageState,
  key: string,
  content: Uint8Array,
  options?: UploadOptions,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: state.config.bucket,
    Key: key,
    Body: content,
    ContentType: options?.contentType || "application/octet-stream",
    Metadata: options?.metadata,
  });

  await state.s3Client.send(command);
  console.log(`✅ Uploaded file: ${key} (${content.length} bytes)`);
  return key;
}

/**
 * Download file from S3-compatible storage
 *
 * @param state File storage state
 * @param key Storage key/path
 * @returns Promise resolving to file content and metadata
 */
export async function downloadFile(
  state: FileStorageState,
  key: string,
): Promise<DownloadResult> {
  const command = new GetObjectCommand({
    Bucket: state.config.bucket,
    Key: key,
  });

  const response = await state.s3Client.send(command);

  if (!response.Body) {
    throw new Error(`Failed to download file: ${key} - no body in response`);
  }

  const content = await response.Body.transformToByteArray();

  console.log(`✅ Downloaded file: ${key} (${content.length} bytes)`);

  return {
    content,
    contentType: response.ContentType,
    size: content.length,
    metadata: response.Metadata,
  };
}

/**
 * Delete file from S3-compatible storage
 *
 * @param state File storage state
 * @param key Storage key/path
 * @returns Promise resolving to true if deleted
 */
export async function deleteFile(
  state: FileStorageState,
  key: string,
): Promise<boolean> {
  const command = new DeleteObjectCommand({
    Bucket: state.config.bucket,
    Key: key,
  });

  await state.s3Client.send(command);
  console.log(`✅ Deleted file: ${key}`);
  return true;
}

/**
 * Check if file exists
 *
 * @param state File storage state
 * @param key Storage key/path
 * @returns Promise resolving to true if file exists
 */
export async function fileExists(
  state: FileStorageState,
  key: string,
): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: state.config.bucket,
      Key: key,
    });
    await state.s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file metadata without downloading content
 *
 * @param state File storage state
 * @param key Storage key/path
 * @returns Promise resolving to file metadata
 */
export async function getFileMetadata(
  state: FileStorageState,
  key: string,
): Promise<{ size: number; contentType?: string; metadata?: Record<string, string> } | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: state.config.bucket,
      Key: key,
    });
    const response = await state.s3Client.send(command);
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType,
      metadata: response.Metadata,
    };
  } catch {
    return null;
  }
}

/**
 * Generate presigned URL for direct client upload/download
 *
 * Useful for allowing clients to upload/download directly to/from S3
 * without routing through your server.
 *
 * @param state File storage state
 * @param key Storage key/path
 * @param operation "upload" or "download"
 * @param options Presigned URL options
 * @returns Promise resolving to presigned URL
 *
 * @example
 * ```ts
 * // Generate upload URL for client
 * const uploadUrl = await getPresignedUrl(storage, "workspaces/abc/file.pdf", "upload", {
 *   expiresIn: 3600 // 1 hour
 * });
 *
 * // Client can now upload directly:
 * // await fetch(uploadUrl, { method: "PUT", body: fileContent });
 * ```
 */
export async function getPresignedUrl(
  state: FileStorageState,
  key: string,
  operation: "upload" | "download",
  options?: PresignedUrlOptions,
): Promise<string> {
  const command = operation === "upload"
    ? new PutObjectCommand({
      Bucket: state.config.bucket,
      Key: key,
    })
    : new GetObjectCommand({
      Bucket: state.config.bucket,
      Key: key,
    });

  const url = await getSignedUrl(state.s3Client, command, {
    expiresIn: options?.expiresIn || 3600,
  });

  console.log(`✅ Generated presigned URL for ${operation}: ${key}`);
  return url;
}

/**
 * Generate workspace-scoped storage key
 *
 * Helper to create consistent key structure: workspaces/{workspaceId}/files/{filename}
 *
 * @param workspaceId Workspace ID
 * @param filename File name
 * @returns Storage key
 */
export function generateStorageKey(
  workspaceId: string,
  filename: string,
): string {
  return `workspaces/${workspaceId}/files/${filename}`;
}
