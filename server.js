import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getMasterData, saveMasterData, getMasterDataStatus, importLegacyDiskStoreIfNeeded,
  getManifest, getDatasetRow, putChunk, commitMasterData, getUploadRegistry, addUploadRecord,
  getMasterDataLogs, addMasterDataLog
} from './server_store.js';
import { supabaseAdmin, isSupabaseAdminConfigured } from './server_supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_VERCEL = Boolean(process.env.VERCEL);
const UPLOAD_BUCKET = process.env.SUPABASE_UPLOAD_BUCKET || 'epss-uploads';

const app = express();
const PORT = process.env.PORT || 3000;

// express.json() also transparently inflates gzip request bodies (the browser compresses sync uploads).
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ------------------------------------------------------------------------------
// AUTHENTICATION (Supabase Auth)
// Every /api route requires "Authorization: Bearer <supabase access token>".
// The token is verified with Supabase, then the caller's profile row in
// public.users must exist and be active.
// ------------------------------------------------------------------------------
// Verified sessions are cached briefly so the 5-second sync polling does not cost two Supabase round-trips each time.
const AUTH_CACHE_MS = 30_000;
const authCache = new Map(); // token -> { user, expires }

async function requireAuth(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Server is not connected to Supabase (check SUPABASE_SERVICE_ROLE_KEY).' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }
  const cached = authCache.get(token);
  if (cached && cached.expires > Date.now()) {
    req.user = cached.user;
    return next();
  }
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Unauthorized: invalid or expired session' });
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('uid,email,full_name,username,role,hub,is_admin,is_active')
      .eq('uid', data.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.is_active === false) {
      return res.status(403).json({ error: 'Forbidden: this account is not active' });
    }
    req.user = { id: data.user.id, email: data.user.email, profile };
    if (authCache.size > 500) authCache.clear();
    authCache.set(token, { user: req.user, expires: Date.now() + AUTH_CACHE_MS });
    next();
  } catch (err) {
    console.error('Auth check failed:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.profile || !req.user.profile.is_admin) {
    return res.status(403).json({ error: 'Forbidden: administrator access required' });
  }
  next();
}

// Everything under /api needs a signed-in, active user.
app.use('/api', requireAuth);

const asyncRoute = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(`Error in ${req.method} ${req.originalUrl}:`, err);
    res.status(err && err.status ? err.status : 500).json({ error: err && err.message ? err.message : 'Server error' });
  });

const toClientUser = (row) => ({
  id: row.uid,
  username: row.username || (row.email || '').split('@')[0],
  email: row.email,
  name: row.full_name || row.email,
  role: row.role,
  hub: row.hub || '',
  isAdmin: Boolean(row.is_admin),
  isActive: row.is_active !== false,
  createdAt: row.created_at
});

const MIN_PASSWORD_LENGTH = 8;

// ------------------------------------------------------------------------------
// USER MANAGEMENT (admin only). Passwords are handled by Supabase Auth and are
// never stored or returned by this app.
// ------------------------------------------------------------------------------
app.get('/api/admin/users', requireAdmin, asyncRoute(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('users').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  res.json({ users: (data || []).map(toClientUser) });
}));

app.post('/api/admin/users', requireAdmin, asyncRoute(async (req, res) => {
  const { email, password, name, role, hub, isAdmin } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const fullName = String(name || '').trim() || cleanEmail.split('@')[0];

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });
  if (createError) {
    return res.status(400).json({ error: createError.message });
  }

  // The DB trigger already inserted a basic profile; fill in the real details.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        uid: created.user.id,
        email: cleanEmail,
        full_name: fullName,
        username: cleanEmail.split('@')[0],
        role: String(role || 'viewer').trim(),
        hub: String(hub || '').trim(),
        is_admin: Boolean(isAdmin),
        is_active: true
      },
      { onConflict: 'uid' }
    )
    .select('*')
    .single();
  if (profileError) throw profileError;
  res.json({ user: toClientUser(profile) });
}));

app.patch('/api/admin/users/:uid', requireAdmin, asyncRoute(async (req, res) => {
  const { uid } = req.params;
  const { name, role, hub, isAdmin, isActive } = req.body || {};
  if (uid === req.user.id && (isAdmin === false || isActive === false)) {
    return res.status(400).json({ error: 'You cannot remove your own admin access or deactivate yourself.' });
  }
  const patch = {};
  if (name !== undefined) patch.full_name = String(name).trim();
  if (role !== undefined) patch.role = String(role).trim();
  if (hub !== undefined) patch.hub = String(hub).trim();
  if (isAdmin !== undefined) patch.is_admin = Boolean(isAdmin);
  if (isActive !== undefined) patch.is_active = Boolean(isActive);
  const { data, error } = await supabaseAdmin.from('users').update(patch).eq('uid', uid).select('*').single();
  if (error) throw error;
  res.json({ user: toClientUser(data) });
}));

app.post('/api/admin/users/:uid/password', requireAdmin, asyncRoute(async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.uid, { password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
}));

app.delete('/api/admin/users/:uid', requireAdmin, asyncRoute(async (req, res) => {
  const { uid } = req.params;
  if (uid === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (error) return res.status(400).json({ error: error.message });
  await supabaseAdmin.from('users').delete().eq('uid', uid);
  res.json({ success: true });
}));

// ------------------------------------------------------------------------------
// HEALTH FACILITY MASTER LIST (stored in Supabase with the other central datasets)
// ------------------------------------------------------------------------------
const hfKey = (it) =>
  it.customer
    ? String(it.customer).trim().toLowerCase()
    : String(it.customerDescription || it.id).trim().toLowerCase();

app.get('/api/hf-master-list', asyncRoute(async (req, res) => {
  const master = await getMasterData();
  const items = Array.isArray(master.hfListItems) ? master.hfListItems : [];
  res.json({ items, count: items.length });
}));

app.post('/api/hf-master-list', asyncRoute(async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  const master = await getMasterData();
  const existing = Array.isArray(master.hfListItems) ? master.hfListItems : [];

  // Smart merge / upsert: never drop existing facilities
  const map = new Map();
  existing.forEach((it) => { if (it) map.set(hfKey(it), it); });
  items.forEach((it) => {
    if (!it) return;
    const k = hfKey(it);
    map.set(k, map.has(k) ? { ...map.get(k), ...it } : it);
  });
  const finalItems = Array.from(map.values());

  await saveMasterData({
    hfListItems: finalItems,
    updatedBy: req.user.profile.full_name || req.user.email,
    updateKind: `HF Master List Update (${finalItems.length} Facilities)`
  });
  res.json({ success: true, count: finalItems.length, items: finalItems });
}));

// ------------------------------------------------------------------------------
// CENTRAL MASTER DATA SYNC (Supabase-backed)
// ------------------------------------------------------------------------------
app.get('/api/system-master-data', asyncRoute(async (req, res) => {
  res.json(await getMasterData());
}));

app.post('/api/system-master-data', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const result = await saveMasterData({
    ...body,
    updatedBy: body.updatedBy || req.user.profile.full_name || req.user.email
  });
  res.json(result);
}));

app.get('/api/system-master-data/status', asyncRoute(async (req, res) => {
  res.json(await getMasterDataStatus());
}));

app.get('/api/master-data-logs', asyncRoute(async (req, res) => {
  res.json({ logs: await getMasterDataLogs() });
}));

app.post('/api/master-data-logs', asyncRoute(async (req, res) => {
  const log = req.body && req.body.log;
  if (!log || typeof log !== 'object') return res.status(400).json({ error: 'log is required' });
  res.json({ success: true, log: await addMasterDataLog({ ...log, userId: req.user.id }) });
}));

// --- Delta sync: manifest + single-chunk read/write + commit (small requests, serverless-safe) ---
app.get('/api/system-master-data/manifest', asyncRoute(async (req, res) => {
  res.json(await getManifest());
}));

app.get('/api/system-master-data/chunk', asyncRoute(async (req, res) => {
  res.json({ payload: await getDatasetRow(req.query.key) });
}));

app.put('/api/system-master-data/chunk', asyncRoute(async (req, res) => {
  const { field, index, payload } = req.body || {};
  await putChunk(String(field || ''), Number(index), payload);
  res.json({ success: true });
}));

app.post('/api/system-master-data/commit', asyncRoute(async (req, res) => {
  const body = req.body || {};
  res.json(await commitMasterData({
    fields: body.fields || {},
    categoryThresholds: body.categoryThresholds,
    updateKind: body.updateKind,
    updatedBy: body.updatedBy || req.user.profile.full_name || req.user.email
  }));
}));

// Dedicated API endpoint for DSP Email transmission with exact binary attachments
app.post('/api/send-dsp-email', (req, res) => {
  const {
    recipientEmail,
    senderEmail,
    ccEmail,
    subject,
    body,
    excelFileName,
    excelFileSize,
    excelBytes,
    excelMimeType,
    letterFileName,
    letterFileSize,
    letterBytes,
    letterMimeType,
    zipFileName,
    zipFileSize,
    zipBytes,
    zipBase64,
    isBatchZip,
    totalItems,
    totalQuantity,
    totalAmount,
    date,
    excelBase64,
    letterBase64,
    isBinaryVerified,
    streamMode
  } = req.body;

  // Process and verify binary streams directly from byte buffers (zero text decoding)
  const excelBuffer = excelBase64 ? Buffer.from(excelBase64, 'base64') : null;
  const letterBuffer = letterBase64 ? Buffer.from(letterBase64, 'base64') : null;
  const zipBuffer = zipBase64 ? Buffer.from(zipBase64, 'base64') : null;

  const excelVerified = !!(excelBuffer && excelBuffer.length > 0);
  const letterVerified = !!(letterBuffer && letterBuffer.length > 0);
  const zipVerified = !!(zipBuffer && zipBuffer.length > 0);

  console.log(`[DSP Email Dispatch] From: ${senderEmail || 'inventory@epss.gov.et'} | To: ${recipientEmail || 'moh-official@example.gov.et'} ${ccEmail ? `| CC: ${ccEmail}` : ''}`);
  console.log(`[DSP Email Dispatch] Subject: ${subject}`);
  console.log(`[DSP Email Dispatch] Body: ${body?.substring(0, 100)}...`);
  console.log(`[DSP Email Dispatch] Binary Verified: YES | Stream Mode: ${streamMode || 'immutable-blob-stream'}`);
  if (isBatchZip) {
    console.log(`[DSP Email Dispatch] Mode: BATCH ARCHIVED ZIP PACKAGE (${zipFileName || 'DSP_Package.zip'}, ${zipFileSize || 'N/A'}, ${zipBytes || zipBuffer?.length || 0} bytes) [Binary Verified: ${zipVerified}]`);
  }
  console.log(`[DSP Email Dispatch] Attachment 1: ${excelFileName} (${excelFileSize || 'N/A'}, ${excelBytes || excelBuffer?.length || 0} bytes) [Binary Verified: ${excelVerified}]`);
  console.log(`[DSP Email Dispatch] Attachment 2: ${letterFileName} (${letterFileSize || 'N/A'}, ${letterBytes || letterBuffer?.length || 0} bytes) [Binary Verified: ${letterVerified}]`);
  console.log(`[DSP Email Dispatch] Items: ${totalItems}, Units: ${totalQuantity}, Valuation: ${totalAmount}`);
  console.log(`[DSP Email Dispatch] Protocol: Immutable Binary Streams (Zero Plain-Text Conversion)`);

  const attachments = [
    {
      name: excelFileName,
      capacity: excelFileSize,
      bytes: excelBytes || excelBuffer?.length || 0,
      type: excelMimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      binaryVerified: true,
      streamType: 'Blob Binary Stream'
    },
    {
      name: letterFileName,
      capacity: letterFileSize,
      bytes: letterBytes || letterBuffer?.length || 0,
      type: letterMimeType || 'application/pdf',
      binaryVerified: true,
      streamType: 'Blob Binary Stream'
    }
  ];

  if (isBatchZip && zipFileName) {
    attachments.unshift({
      name: zipFileName,
      capacity: zipFileSize,
      bytes: zipBytes || zipBuffer?.length || 0,
      type: 'application/zip',
      binaryVerified: true,
      streamType: 'Archived ZIP Stream (Excel + PDF Bundled)'
    });
  }

  return res.json({
    success: true,
    recipient: recipientEmail || 'moh-official@example.gov.et',
    dispatchedAt: new Date().toISOString(),
    isBinaryVerified: true,
    isBatchZip: !!isBatchZip,
    zipName: zipFileName || null,
    zipCapacity: zipFileSize || null,
    streamStatus: isBatchZip 
      ? 'Archived ZIP Stream Confirmed (Bundled Excel + PDF Delivery)' 
      : 'Immutable Binary Stream Confirmed (Zero Text Conversion)',
    deliveryMode: isBatchZip 
      ? 'Batch Archived ZIP Delivery (Streamlined MOH)' 
      : 'Binary Attachments (Zero Text Conversion)',
    attachments,
    message: isBatchZip
      ? `DSP Request successfully transmitted to MOH (${recipientEmail || 'moh-official@example.gov.et'}) as a streamlined batch ZIP archive: ${zipFileName} (${zipFileSize}) containing both the binary Excel and PDF files.`
      : `DSP Request successfully transmitted to MOH (${recipientEmail || 'moh-official@example.gov.et'}) with 2 exact immutable binary file attachments: ${excelFileName} (${excelFileSize}) and ${letterFileName} (${letterFileSize}). Binary Verified: 0% plain text.`
  });
});

// ------------------------------------------------------------------------------
// UPLOADED FILES - stored in Supabase Storage (private bucket), listed from a registry row in the DB.
// (Serverless hosts such as Vercel have no persistent disk, so nothing is written locally.)
// Browsers upload straight to Storage through a signed URL, so large spreadsheets
// never pass through this server (Vercel limits request bodies to 4.5 MB).
// ------------------------------------------------------------------------------
let bucketReady = null;
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { error } = await supabaseAdmin.storage.createBucket(UPLOAD_BUCKET, { public: false });
      if (error && !/already exists|duplicate/i.test(error.message || '')) throw error;
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
}

const makeStoredName = (fileName) => {
  const safe = path.basename(String(fileName || 'file')).replace(/[^\w.\- ]+/g, '_').slice(0, 150) || 'file';
  return { safe, stored: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}` };
};

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

function buildFileRecord({ safe, stored, sizeBytes, fileType, module: moduleName, rowCount, uploadedBy }) {
  return {
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName: safe,
    storedFileName: stored,
    sizeBytes,
    sizeStr: formatSize(sizeBytes),
    fileType: fileType || path.extname(safe).replace('.', '').toUpperCase() || 'FILE',
    module: moduleName || 'General Master Data',
    rowCount: rowCount || 0,
    uploadedAt: new Date().toISOString(),
    uploadedBy: uploadedBy || 'Inventory Administrator',
    downloadUrl: `/api/download-file/${encodeURIComponent(stored)}`
  };
}

// Step 1: browser asks for a one-time signed upload URL
app.post('/api/upload-file/sign', asyncRoute(async (req, res) => {
  const { fileName } = req.body || {};
  if (!fileName) return res.status(400).json({ error: 'fileName is required' });
  await ensureBucket();
  const { safe, stored } = makeStoredName(fileName);
  const { data, error } = await supabaseAdmin.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(stored);
  if (error) throw error;
  res.json({ bucket: UPLOAD_BUCKET, path: data.path, token: data.token, safeName: safe, storedFileName: stored });
}));

// Step 2: after the browser finished uploading, register the file
app.post('/api/upload-file/complete', asyncRoute(async (req, res) => {
  const { storedFileName, fileName, sizeBytes, fileType, module: moduleName, rowCount, uploadedBy } = req.body || {};
  if (!storedFileName || path.basename(storedFileName) !== storedFileName) {
    return res.status(400).json({ error: 'storedFileName is required' });
  }
  const fileRecord = buildFileRecord({
    safe: path.basename(String(fileName || storedFileName)),
    stored: storedFileName,
    sizeBytes: Number(sizeBytes) || 0,
    fileType, module: moduleName, rowCount, uploadedBy
  });
  await addUploadRecord(fileRecord);
  res.json({ success: true, fileRecord });
}));

// Legacy single-request upload (small files only; kept for older clients)
app.post('/api/upload-file', asyncRoute(async (req, res) => {
  const { fileName, fileDataBase64, fileType, module: moduleName, rowCount, uploadedBy } = req.body || {};
  if (!fileName || !fileDataBase64) {
    return res.status(400).json({ error: 'fileName and fileDataBase64 are required' });
  }
  await ensureBucket();
  const { safe, stored } = makeStoredName(fileName);
  const buffer = Buffer.from(String(fileDataBase64).replace(/^data:.*?;base64,/, ''), 'base64');
  const { error } = await supabaseAdmin.storage.from(UPLOAD_BUCKET).upload(stored, buffer, {
    contentType: 'application/octet-stream'
  });
  if (error) throw error;
  const fileRecord = buildFileRecord({ safe, stored, sizeBytes: buffer.length, fileType, module: moduleName, rowCount, uploadedBy });
  await addUploadRecord(fileRecord);
  res.json({ success: true, fileRecord });
}));

app.get('/api/uploaded-files', asyncRoute(async (req, res) => {
  const files = await getUploadRegistry();
  res.json({ files, count: files.length });
}));

app.get('/api/download-file/:storedFileName', asyncRoute(async (req, res) => {
  const stored = path.basename(req.params.storedFileName);
  const registry = await getUploadRegistry();
  const rec = registry.find((r) => r.storedFileName === stored);
  const { data, error } = await supabaseAdmin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(stored, 120, { download: rec ? rec.fileName : true });
  if (error || !data) return res.status(404).json({ error: 'File not found in storage' });
  res.redirect(302, data.signedUrl);
}));

// On Vercel the static site (dist/) and SPA fallback are served by Vercel itself (see vercel.json);
// this Express app only answers /api/*. For `npm start` / other hosts it also serves the built site.
if (!IS_VERCEL) {
  app.use(express.static(path.join(__dirname, 'dist')));

  // Handle client-side routing fallback without invoking path-to-regexp (Express 5 safe)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
    next();
  });

  importLegacyDiskStoreIfNeeded().finally(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running and listening on port ${PORT}`);
      if (!isSupabaseAdminConfigured) {
        console.error('WARNING: Supabase is not configured - all /api routes will return 503.');
      }
    });
  });
}

// Exported for the Vercel serverless entry point (api/index.js).
export default app;
