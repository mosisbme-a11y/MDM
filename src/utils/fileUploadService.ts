import { supabase } from '../lib/supabase';

export interface UploadedFileRecord {
  id: string;
  fileName: string;
  storedFileName: string;
  sizeBytes: number;
  sizeStr: string;
  fileType: string;
  module: string;
  rowCount: number;
  uploadedAt: string;
  uploadedBy: string;
  downloadUrl: string;
}

/**
 * Uploads a browser File straight to Supabase Storage through a one-time signed URL
 * (large spreadsheets never pass through the API server), then registers it.
 * Falls back to the small-file base64 endpoint if direct upload is unavailable.
 * Also adds it to the local documents archive and dispatches an update event.
 */
export async function uploadAndRecordFile(
  file: File,
  moduleName: string = 'Master Data',
  rowCount: number = 0,
  uploadedBy: string = 'Inventory Administrator'
): Promise<UploadedFileRecord | null> {
  const fileType = file.name.split('.').pop()?.toUpperCase() || 'FILE';
  const post = (url: string, body: unknown) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  let fileRecord: UploadedFileRecord | null = null;
  try {
    // 1) direct upload
    if (supabase) {
      const signRes = await post('/api/upload-file/sign', { fileName: file.name });
      if (signRes.ok) {
        const sign = await signRes.json();
        const { error } = await supabase.storage.from(sign.bucket).uploadToSignedUrl(sign.path, sign.token, file);
        if (error) throw error;
        const doneRes = await post('/api/upload-file/complete', {
          storedFileName: sign.storedFileName,
          fileName: file.name,
          sizeBytes: file.size,
          fileType,
          module: moduleName,
          rowCount,
          uploadedBy
        });
        if (doneRes.ok) fileRecord = (await doneRes.json()).fileRecord || null;
      }
    }

    // 2) fallback for small files
    if (!fileRecord && file.size < 3 * 1024 * 1024) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await post('/api/upload-file', {
        fileName: file.name, fileDataBase64: base64, fileType, module: moduleName, rowCount, uploadedBy
      });
      if (res.ok) fileRecord = (await res.json()).fileRecord || null;
    }
  } catch (err) {
    console.warn('Failed to upload file to cloud storage:', err);
  }

  if (!fileRecord) return null;

  const docEntry = {
    id: fileRecord.id,
    referenceNumber: `FILE/${Date.now().toString().slice(-6)}`,
    title: `Uploaded File: ${file.name} (${moduleName})`,
    deviceModel: `${moduleName} Dataset (${rowCount} records)`,
    type: `System Uploaded ${moduleName} File`,
    category: 'Technical Documentation',
    fileSize: fileRecord.sizeStr,
    fileType: fileRecord.fileType,
    lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    issuedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    driveLink: fileRecord.downloadUrl,
    manufacturer: 'User File Ingestion',
    senderFacility: 'System Direct Upload',
    recipientFacility: 'EPSS Master System Store',
    status: 'Approved',
    officialSeal: true,
    notes: `Stored in cloud storage at ${fileRecord.downloadUrl}. Includes ${rowCount} records.`,
    fileUrl: fileRecord.downloadUrl
  };

  try {
    const saved = localStorage.getItem('epss_documents_archive');
    const docs = saved ? JSON.parse(saved) : [];
    docs.unshift(docEntry);
    localStorage.setItem('epss_documents_archive', JSON.stringify(docs));
    window.dispatchEvent(new Event('epss:documents:updated'));
  } catch (e) {
    console.warn('Could not update documents archive in localStorage:', e);
  }
  return fileRecord;
}

/**
 * Fetches all uploaded file records stored on server disk
 */
export async function fetchUploadedFilesFromDisk(): Promise<UploadedFileRecord[]> {
  try {
    const res = await fetch('/api/uploaded-files');
    if (res.ok) {
      const data = await res.json();
      return data.files || [];
    }
  } catch (err) {
    console.warn('Could not fetch uploaded files from server disk:', err);
  }
  return [];
}
