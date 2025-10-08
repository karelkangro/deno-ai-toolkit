// File storage abstraction types
// Supports S3-compatible storage (AWS S3, Cloudflare R2, MinIO, etc.)

/**
 * File storage configuration
 */
export interface FileStorageConfig {
  provider: "s3"; // Future: "local" | "smb" | "azure-blob"
  endpoint?: string; // S3 endpoint (optional for AWS, required for R2/MinIO)
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean; // Required for MinIO
}

/**
 * File upload options
 */
export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * File download result
 */
export interface DownloadResult {
  content: Uint8Array;
  contentType?: string;
  size: number;
  metadata?: Record<string, string>;
}

/**
 * File storage state (functional programming pattern)
 */
export interface FileStorageState {
  config: FileStorageConfig;
  s3Client: any; // AWS SDK S3Client
}

/**
 * Presigned URL options
 */
export interface PresignedUrlOptions {
  expiresIn?: number; // Seconds, default 3600 (1 hour)
}
