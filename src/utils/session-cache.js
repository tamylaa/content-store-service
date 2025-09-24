// Enhanced session cache for upload feedback (per worker instance)
// Provides instant UI feedback for recent uploads while database updates propagate
const sessionUploads = new Map(); // key: userId, value: array of file metadata
const uploadProgress = new Map(); // key: uploadId, value: progress data

export function addUploadToSession(userId, fileMeta) {
  if (!userId) return;
  if (!sessionUploads.has(userId)) sessionUploads.set(userId, []);
  
  // Add timestamp and session flag for UI feedback
  const sessionFile = {
    ...fileMeta,
    uploadedAt: Date.now(),
    isSessionUpload: true,
    sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  sessionUploads.get(userId).unshift(sessionFile);
  
  // Keep only the last 50 uploads per user (increased for better UX)
  if (sessionUploads.get(userId).length > 50) {
    sessionUploads.get(userId).length = 50;
  }
  
  console.log(`Added upload to session cache for user ${userId}:`, fileMeta.name);
  return sessionFile;
}

export function getSessionUploads(userId) {
  const uploads = sessionUploads.get(userId) || [];
  
  // Filter out uploads older than 30 minutes (auto cleanup)
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  const recentUploads = uploads.filter(upload => upload.uploadedAt > thirtyMinutesAgo);
  
  // Update the cache if we filtered anything
  if (recentUploads.length !== uploads.length) {
    sessionUploads.set(userId, recentUploads);
  }
  
  return recentUploads;
}

export function clearSessionUploads(userId) {
  sessionUploads.delete(userId);
  console.log(`Cleared session uploads for user ${userId}`);
}

// Enhanced functionality for upload progress tracking
export function setUploadProgress(uploadId, progressData) {
  uploadProgress.set(uploadId, {
    ...progressData,
    lastUpdated: Date.now()
  });
}

export function getUploadProgress(uploadId) {
  return uploadProgress.get(uploadId);
}

export function clearUploadProgress(uploadId) {
  uploadProgress.delete(uploadId);
}

// Remove specific upload from session (when confirmed in database)
export function removeUploadFromSession(userId, fileId) {
  if (!sessionUploads.has(userId)) return false;
  
  const uploads = sessionUploads.get(userId);
  const index = uploads.findIndex(upload => upload.id === fileId);
  
  if (index !== -1) {
    uploads.splice(index, 1);
    console.log(`Removed upload ${fileId} from session cache for user ${userId}`);
    return true;
  }
  
  return false;
}

// Get session statistics
export function getSessionStats(userId) {
  const uploads = getSessionUploads(userId);
  const now = Date.now();
  
  return {
    totalUploads: uploads.length,
    recentUploads: uploads.filter(u => now - u.uploadedAt < 5 * 60 * 1000).length, // Last 5 minutes
    oldestUpload: uploads.length > 0 ? Math.min(...uploads.map(u => u.uploadedAt)) : null,
    newestUpload: uploads.length > 0 ? Math.max(...uploads.map(u => u.uploadedAt)) : null
  };
}

// Cleanup function - should be called periodically
export function cleanupExpiredSessions() {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [userId, uploads] of sessionUploads.entries()) {
    const activeUploads = uploads.filter(upload => upload.uploadedAt > oneHourAgo);
    
    if (activeUploads.length === 0) {
      sessionUploads.delete(userId);
      cleaned++;
    } else if (activeUploads.length !== uploads.length) {
      sessionUploads.set(userId, activeUploads);
    }
  }
  
  // Clean upload progress entries older than 1 hour
  for (const [uploadId, progress] of uploadProgress.entries()) {
    if (progress.lastUpdated < oneHourAgo) {
      uploadProgress.delete(uploadId);
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired session caches`);
  }
}
