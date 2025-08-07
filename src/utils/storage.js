/**
 * Storage Utilities
 * R2 storage operations for file management
 */

export async function findFileInStorage(fileId, env) {
  if (!env.CONTENT_BUCKET) {
    throw new Error('Storage not configured');
  }

  // List objects to find the file with this ID
  // Since we store as uploads/year/month/fileId.ext, we need to search
  const listResult = await env.CONTENT_BUCKET.list({
    prefix: 'uploads/',
    delimiter: ''
  });

  for (const object of listResult.objects) {
    const fileName = object.key.split('/').pop();
    if (fileName && fileName.startsWith(fileId + '.')) {
      return object;
    }
  }

  return null;
}

export async function getFileFromStorage(fileKey, env) {
  if (!env.CONTENT_BUCKET) {
    throw new Error('Storage not configured');
  }

  return await env.CONTENT_BUCKET.get(fileKey);
}

export async function listUserFiles(userId, env) {
  if (!env.CONTENT_BUCKET) {
    throw new Error('Storage not configured');
  }

  const listResult = await env.CONTENT_BUCKET.list({
    prefix: 'uploads/',
    delimiter: ''
  });

  const userFiles = [];
  
  for (const object of listResult.objects) {
    // Get file metadata to check ownership
    const file = await env.CONTENT_BUCKET.get(object.key);
    if (file && file.customMetadata?.uploadedBy === userId) {
      const fileName = object.key.split('/').pop();
      const fileId = fileName.split('.')[0];
      
      userFiles.push({
        id: fileId,
        name: file.customMetadata?.originalName || fileName,
        size: object.size,
        uploadedAt: file.customMetadata?.uploadedAt,
        contentType: file.customMetadata?.contentType
      });
    }
  }

  return userFiles;
}
