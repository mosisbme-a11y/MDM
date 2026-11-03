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
 * Encodes a browser File object to Base64 and posts it to server disk storage at /api/upload-file
 * Also registers it into local documents archive and dispatches update event.
 */
export async function uploadAndRecordFile(
  file: File,
  moduleName: string = 'Master Data',
  rowCount: number = 0,
  uploadedBy: string = 'Inventory Administrator'
): Promise<UploadedFileRecord | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result as string;
        if (!base64) {
          resolve(null);
          return;
        }

        const response = await fetch('/api/upload-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileDataBase64: base64,
            fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE',
            module: moduleName,
            rowCount,
            uploadedBy
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.fileRecord) {
            // Also store document entry in local archive
            const docEntry = {
              id: data.fileRecord.id,
              referenceNumber: `FILE/${Date.now().toString().slice(-6)}`,
              title: `Uploaded File: ${file.name} (${moduleName})`,
              deviceModel: `${moduleName} Dataset (${rowCount} records)`,
              type: `System Uploaded ${moduleName} File`,
              category: 'Technical Documentation',
              fileSize: data.fileRecord.sizeStr,
              fileType: data.fileRecord.fileType,
              lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              issuedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              driveLink: data.fileRecord.downloadUrl,
              manufacturer: 'User File Ingestion',
              senderFacility: 'System Direct Upload',
              recipientFacility: 'EPSS Master System Store',
              status: 'Approved',
              officialSeal: true,
              notes: `Stored permanently on system disk at ${data.fileRecord.downloadUrl}. Includes ${rowCount} records.`,
              fileUrl: data.fileRecord.downloadUrl
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

            resolve(data.fileRecord);
            return;
          }
        }
        resolve(null);
      } catch (err) {
        console.warn('Failed to post uploaded file to server disk:', err);
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
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
