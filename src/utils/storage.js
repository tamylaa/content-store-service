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
  // Legacy function - kept for backward compatibility
  // Use listUserFilesOptimized for better performance
  console.warn('listUserFiles is deprecated. Use listUserFilesOptimized for better performance.');
  return await listUserFilesOptimized(userId, {}, env);
}

export async function listUserFilesOptimized(userId, options = {}, env, authHeader = null) {
  const {
    page = 1,
    limit = 20,
    period = 'all',
    category = 'all',
    search = '',
    sort = 'recent'
  } = options;

  try {
    // Use data-service for file metadata instead of scanning R2
    const dataServiceUrl = env.DATA_SERVICE_URL || 'https://data-service.tamylatrading.workers.dev';
    
    // Build query parameters - use userId instead of owner_id to match data-service API
    const params = new URLSearchParams({
      userId: userId,
      page: page.toString(),
      limit: limit.toString()
    });
    
    if (period !== 'all') params.set('period', period);
    if (category !== 'all') params.set('category', category);
    if (search) params.set('search', search);
    if (sort) params.set('sort', sort);

    console.log('Querying data-service for user files:', `${dataServiceUrl}/files?${params}`);
    console.log('Using auth header:', authHeader ? `${authHeader.substring(0, 30)}...` : 'NONE');

    let response;
    if (env.DATA_SERVICE) {
      // Use service binding if available
      console.log('Using DATA_SERVICE binding');
      const mockRequest = new Request(`https://data-service/files?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || ''
        }
      });
      response = await env.DATA_SERVICE.fetch(mockRequest);
    } else {
      // Fallback to HTTP
      console.log('Using HTTP request to data-service');
      response = await fetch(`${dataServiceUrl}/files?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || ''
        }
      });
    }

    if (!response.ok) {
      console.error('Data service query failed:', response.status, response.statusText);
      // Fallback to legacy method if data-service fails
      return await listUserFilesLegacy(userId, env);
    }

    const result = await response.json();
    console.log('Data service response:', result);

    if (!result.success && !result.files) {
      console.warn('Data service returned unexpected format, falling back to legacy method');
      return await listUserFilesLegacy(userId, env);
    }

    // Transform data-service response to expected format
    const files = (result.files || result.data || []).map(file => ({
      id: file.id,
      name: file.original_filename || file.name,
      original_filename: file.original_filename,
      size: file.file_size || file.size,
      file_size: file.file_size,
      uploadedAt: file.created_at || file.uploadedAt,
      created_at: file.created_at,
      contentType: file.mime_type || file.contentType,
      category: file.category,
      status: file.status,
      storage_path: file.storage_path,
      file_url: file.file_url,
      // Include processing information if available
      processingStage: file.processing_stage,
      progress: file.progress
    }));

    return {
      files,
      pagination: result.pagination || {
        page: parseInt(page),
        limit: parseInt(limit),
        total: files.length,
        hasNext: false,
        hasPrev: page > 1
      },
      total: result.total || files.length
    };

  } catch (error) {
    console.error('Error in listUserFilesOptimized:', error);
    // Fallback to legacy method on any error
    return await listUserFilesLegacy(userId, env);
  }
}

async function listUserFilesLegacy(userId, env) {
  // Original R2-scanning logic as fallback
  console.warn('Using legacy R2 scanning - this is slow and should be avoided');
  
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
        original_filename: file.customMetadata?.originalName,
        size: object.size,
        file_size: object.size,
        uploadedAt: file.customMetadata?.uploadedAt,
        created_at: file.customMetadata?.uploadedAt,
        contentType: file.customMetadata?.contentType,
        category: file.customMetadata?.category || 'other',
        status: 'complete'
      });
    }
  }

  return {
    files: userFiles,
    pagination: {
      page: 1,
      limit: userFiles.length,
      total: userFiles.length,
      hasNext: false,
      hasPrev: false
    },
    total: userFiles.length
  };
}
