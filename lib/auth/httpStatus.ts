import type { UploadFailureReason } from '@StrikerStore/contract';

/**
 * Maps core's failure reasons onto HTTP.
 *
 * Core states *what* went wrong; deciding that "the file did not finish
 * uploading" is a 409 rather than a 400 is a transport decision, and the upload
 * client depends on the distinction — it retries a 409 and reports a 400.
 */
export const UPLOAD_STATUS: Record<UploadFailureReason, number> = {
  NOT_CONFIGURED: 503,
  INVALID: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
};
