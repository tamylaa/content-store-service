// Simple in-memory session cache for upload feedback (per worker instance)
// Not persistent, but sufficient for instant UI feedback in most cases
const sessionUploads = new Map(); // key: userId, value: array of file metadata

export function addUploadToSession(userId, fileMeta) {
  if (!userId) return;
  if (!sessionUploads.has(userId)) sessionUploads.set(userId, []);
  sessionUploads.get(userId).unshift({ ...fileMeta, uploadedAt: Date.now() });
  // Keep only the last 20 uploads per user
  if (sessionUploads.get(userId).length > 20) sessionUploads.get(userId).length = 20;
}

export function getSessionUploads(userId) {
  return sessionUploads.get(userId) || [];
}

export function clearSessionUploads(userId) {
  sessionUploads.delete(userId);
}
