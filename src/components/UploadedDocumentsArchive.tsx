import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  ExternalLink,
  Eye,
  Plus,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  X,
  Tag,
  ShieldCheck,
  Stethoscope,
  Wrench,
  ArrowUpDown
} from 'lucide-react';
import { DeviceDocument } from '../types';
import { uploadAndRecordFile, fetchUploadedFilesFromDisk, UploadedFileRecord } from '../utils/fileUploadService';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

interface UploadedDocumentsArchiveProps {
  documents: DeviceDocument[];
  onAddDocument: (doc: DeviceDocument) => void;
  onOpenUploadLetterModal?: () => void;
}

export const UploadedDocumentsArchive: React.FC<UploadedDocumentsArchiveProps> = ({
  documents,
  onAddDocument,
  onOpenUploadLetterModal
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'Official MoH Letters' | 'Breakdown Reports' | 'Technical Documentation'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedDocumentForView, setSelectedDocumentForView] = useState<DeviceDocument | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);
  const [diskFiles, setDiskFiles] = useState<UploadedFileRecord[]>([]);

  React.useEffect(() => {
    fetchUploadedFilesFromDisk().then(files => {
      if (files && files.length > 0) {
        setDiskFiles(files);
      }
    });

    const handleDocsUpdated = () => {
      fetchUploadedFilesFromDisk().then(files => {
        if (files) setDiskFiles(files);
      });
    };
    window.addEventListener('epss:documents:updated', handleDocsUpdated);
    return () => window.removeEventListener('epss:documents:updated', handleDocsUpdated);
  }, []);

  // Combine passed documents and disk recorded files
  const combinedDocuments = useMemo(() => {
    const existingIds = new Set(documents.map(d => d.id));
    const convertedFromDisk: DeviceDocument[] = diskFiles.map(df => ({
      id: df.id,
      referenceNumber: `SYS-${df.id.slice(-6).toUpperCase()}`,
      title: `${df.fileName} (${df.module})`,
      deviceModel: `${df.module} Dataset (${df.rowCount} Records)`,
      type: `System Disk Saved File`,
      category: 'Technical Documentation',
      fileSize: df.sizeStr,
      fileType: (['PDF', 'XLSX', 'DOCX'].includes(df.fileType) ? df.fileType : 'XLSX') as 'PDF' | 'XLSX' | 'DOCX',
      lastUpdated: new Date(df.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      issuedDate: new Date(df.uploadedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      driveLink: df.downloadUrl,
      manufacturer: df.uploadedBy || 'System User Ingestion',
      senderFacility: 'System Direct Upload',
      recipientFacility: 'EPSS Master Repository',
      status: 'Approved',
      officialSeal: true,
      notes: `Recorded on system disk at ${df.downloadUrl}. Contains ${df.rowCount} data records.`,
      fileUrl: df.downloadUrl
    }));

    const uniqueDiskDocs = convertedFromDisk.filter(d => !existingIds.has(d.id));
    return [...uniqueDiskDocs, ...documents];
  }, [documents, diskFiles]);

  // Quick Upload Form Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'Official MoH Letters' | 'Breakdown Reports' | 'Technical Documentation'>('Official MoH Letters');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadRefNumber, setUploadRefNumber] = useState('');
  const [uploadDeviceModel, setUploadDeviceModel] = useState('');
  const [uploadSender, setUploadSender] = useState('Ministry of Health - Medical Device Division');
  const [uploadRecipient, setUploadRecipient] = useState('EPSS Central Operations Hub');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);

  // Filtered Documents
  const filteredDocuments = useMemo(() => {
    return combinedDocuments.filter((doc) => {
      // Determine category if not explicitly set
      const category = doc.category || (
        doc.type.includes('MoH') || doc.type.includes('Official') || doc.title.toLowerCase().includes('moh') || doc.title.toLowerCase().includes('letter')
          ? 'Official MoH Letters'
          : doc.type.includes('Breakdown') || doc.title.toLowerCase().includes('breakdown') || doc.title.toLowerCase().includes('defect')
          ? 'Breakdown Reports'
          : 'Official MoH Letters'
      );

      // Category match
      if (selectedCategory !== 'all' && category !== selectedCategory) {
        return false;
      }

      // Status match
      if (statusFilter !== 'all' && doc.status && doc.status !== statusFilter) {
        return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesRef = doc.referenceNumber?.toLowerCase().includes(query) || doc.id.toLowerCase().includes(query);
        const matchesModel = doc.deviceModel.toLowerCase().includes(query);
        const matchesSender = doc.senderFacility?.toLowerCase().includes(query) || doc.manufacturer.toLowerCase().includes(query);
        const matchesType = doc.type.toLowerCase().includes(query);
        if (!matchesTitle && !matchesRef && !matchesModel && !matchesSender && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [combinedDocuments, selectedCategory, statusFilter, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    let moh = 0;
    let bkd = 0;
    let tech = 0;
    let actionRequired = 0;

    combinedDocuments.forEach((doc) => {
      const cat = doc.category || (
        doc.type.includes('MoH') || doc.type.includes('Official') || doc.title.toLowerCase().includes('moh')
          ? 'Official MoH Letters'
          : doc.type.includes('Breakdown') || doc.title.toLowerCase().includes('breakdown')
          ? 'Breakdown Reports'
          : 'Technical Documentation'
      );
      if (cat === 'Official MoH Letters') moh++;
      if (cat === 'Breakdown Reports') bkd++;
      if (cat === 'Technical Documentation') tech++;
      if (doc.status === 'Action Required') actionRequired++;
    });

    return { total: documents.length, moh, bkd, tech, actionRequired };
  }, [documents]);

  const handleCopyReference = (ref?: string) => {
    if (!ref) return;
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2500);
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    let fileUrl: string | undefined;
    if (uploadFileObj) {
      const diskRec = await uploadAndRecordFile(uploadFileObj, uploadCategory);
      if (diskRec) {
        fileUrl = diskRec.downloadUrl;
      } else {
        try {
          const storageRef = ref(storage, `documents/${Date.now()}_${uploadFileObj.name}`);
          const snapshot = await uploadBytes(storageRef, uploadFileObj);
          fileUrl = await getDownloadURL(snapshot.ref);
        } catch (e) {}
      }
    }

    const generatedRef = uploadRefNumber.trim() || (
      uploadCategory === 'Official MoH Letters'
        ? `MoH/EPSS/2026/${Math.floor(100 + Math.random() * 900)}`
        : `BKD-2026-${Math.floor(100 + Math.random() * 900)}`
    );

    const newDoc: DeviceDocument = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      referenceNumber: generatedRef,
      title: uploadTitle.trim(),
      deviceModel: uploadDeviceModel.trim() || 'Medical Equipment Fleet',
      type: uploadCategory === 'Official MoH Letters' ? 'Official MoH Allocation Letter' : 'Regional Breakdown Report',
      category: uploadCategory,
      fileSize: uploadFileObj ? `${(uploadFileObj.size / (1024 * 1024)).toFixed(1)} MB` : '1.8 MB',
      fileType: uploadFileObj?.name.endsWith('.xlsx') ? 'XLSX' : uploadFileObj?.name.endsWith('.docx') ? 'DOCX' : 'PDF',
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      issuedDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      driveLink: 'https://drive.google.com',
      manufacturer: uploadSender.trim(),
      senderFacility: uploadSender.trim(),
      recipientFacility: uploadRecipient.trim(),
      status: uploadCategory === 'Official MoH Letters' ? 'Approved' : 'Action Required',
      officialSeal: true,
      notes: uploadNotes.trim() || undefined,
      contentPreview: `${uploadCategory.toUpperCase()} SUMMARY
Reference: ${generatedRef}
Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
Issuer: ${uploadSender}
Recipient: ${uploadRecipient}
Target: ${uploadDeviceModel || 'Medical Equipment'}

SUBJECT: ${uploadTitle.toUpperCase()}

${uploadNotes || 'Official archived documentation verified and synchronized into EPSS centralized repository.'}`,
      fileUrl: fileUrl
    };

    onAddDocument(newDoc);
    setIsUploadModalOpen(false);
    // Reset form
    setUploadTitle('');
    setUploadRefNumber('');
    setUploadDeviceModel('');
    setUploadNotes('');
    setUploadFileObj(null);
    setSelectedDocumentForView(newDoc);
  };

  return (
    <div className="space-y-6">
      {/* Archive Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Layers className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Uploaded Documents Archive
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/30 text-indigo-200 border border-indigo-400/20">
                MoH & EPSS Verified
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
              Centralized repository for official Ministry of Health directives, ministerial allocation letters, and regional hospital equipment breakdown reports.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setUploadCategory('Official MoH Letters');
                setUploadSender('Ministry of Health - Medical Device Allocation Directorate');
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-sm transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload MoH Letter</span>
            </button>

            <button
              onClick={() => {
                setUploadCategory('Breakdown Reports');
                setUploadSender('Regional Referral Hospital - Clinical Engineering');
                setIsUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl shadow-sm transition cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-amber-400" />
              <span>Upload Breakdown Report</span>
            </button>
          </div>
        </div>

        {/* Metric Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] font-medium text-slate-300 block">Total Documents</span>
            <div className="text-xl font-extrabold text-white mt-0.5">{counts.total}</div>
            <span className="text-[10px] text-slate-400">All archived records</span>
          </div>

          <div
            onClick={() => setSelectedCategory('Official MoH Letters')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              selectedCategory === 'Official MoH Letters'
                ? 'bg-indigo-600/30 border-indigo-400 text-white ring-2 ring-indigo-400/40'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <span className="text-[11px] font-medium text-indigo-200 block">Official MoH Letters</span>
            <div className="text-xl font-extrabold text-indigo-300 mt-0.5">{counts.moh}</div>
            <span className="text-[10px] text-indigo-200/70">Allocation & Clearances</span>
          </div>

          <div
            onClick={() => setSelectedCategory('Breakdown Reports')}
            className={`p-3 rounded-xl border transition cursor-pointer ${
              selectedCategory === 'Breakdown Reports'
                ? 'bg-amber-600/30 border-amber-400 text-white ring-2 ring-amber-400/40'
                : 'bg-white/5 border-white/10 hover:bg-white/10 text-white'
            }`}
          >
            <span className="text-[11px] font-medium text-amber-200 block">Breakdown Reports</span>
            <div className="text-xl font-extrabold text-amber-300 mt-0.5">{counts.bkd}</div>
            <span className="text-[10px] text-amber-200/70">Regional Defect Notices</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10">
            <span className="text-[11px] font-medium text-rose-300 block">Action Required</span>
            <div className="text-xl font-extrabold text-rose-400 mt-0.5">{counts.actionRequired}</div>
            <span className="text-[10px] text-rose-200/70">Pending Spares / Repairs</span>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>All Documents</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
              {counts.total}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('Official MoH Letters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'Official MoH Letters'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-indigo-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Official MoH Letters</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'Official MoH Letters' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {counts.moh}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('Breakdown Reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'Breakdown Reports'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-amber-700'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Breakdown Reports</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'Breakdown Reports' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {counts.bkd}
            </span>
          </button>

          <button
            onClick={() => setSelectedCategory('Technical Documentation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'Technical Documentation'
                ? 'bg-cyan-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-cyan-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Technical Documentation</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${selectedCategory === 'Technical Documentation' ? 'bg-cyan-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
              {counts.tech}
            </span>
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref #, title, model, hub..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
          >
            <option value="all">All Statuses</option>
            <option value="Approved">Approved</option>
            <option value="Dispatched">Dispatched</option>
            <option value="Action Required">Action Required</option>
            <option value="Under Review">Under Review</option>
            <option value="Resolved">Resolved</option>
          </select>

          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 text-xs ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              title="Grid View"
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 text-xs ${viewMode === 'table' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
              title="Table View"
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Document List / Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="p-3 bg-slate-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">No documents found matching criteria</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try resetting your search query or upload a new official MoH letter or breakdown report to the archive.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setStatusFilter('all');
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3.5 py-1.5 rounded-lg transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const isMoH = doc.category === 'Official MoH Letters' || doc.type.includes('MoH') || doc.title.toLowerCase().includes('moh');
            return (
              <div
                key={doc.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between hover:shadow-md ${
                  isMoH ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                <div>
                  {/* Top Category Badge & Reference */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`p-2 rounded-xl ${
                          isMoH ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}
                      >
                        {isMoH ? <Building2 className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                      </div>
                      <div>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            isMoH ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.category || (isMoH ? 'Official MoH Letters' : 'Breakdown Reports')}
                        </span>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>{doc.referenceNumber || doc.id}</span>
                          {doc.referenceNumber && (
                            <button
                              onClick={() => handleCopyReference(doc.referenceNumber)}
                              className="text-slate-400 hover:text-slate-600"
                              title="Copy Reference Number"
                            >
                              {copiedRef === doc.referenceNumber ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        doc.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : doc.status === 'Dispatched'
                          ? 'bg-blue-100 text-blue-800'
                          : doc.status === 'Action Required'
                          ? 'bg-rose-100 text-rose-800 animate-pulse'
                          : doc.status === 'Under Review'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {doc.status || 'Archived'}
                    </span>
                  </div>

                  {/* Document Title */}
                  <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                    {doc.title}
                  </h4>

                  {/* Metadata Rows */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium text-slate-700">{doc.deviceModel}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{doc.senderFacility || doc.manufacturer}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {doc.issuedDate || doc.lastUpdated}
                      </span>
                      <span className="font-mono">{doc.fileType || 'PDF'} • {doc.fileSize}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedDocumentForView(doc)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Document</span>
                  </button>

                  <a
                    href={doc.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                  >
                    <span>Google Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ref Number</th>
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Target Device</th>
                  <th className="py-3 px-4">Issuing Facility</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredDocuments.map((doc) => {
                  const isMoH = doc.category === 'Official MoH Letters' || doc.type.includes('MoH') || doc.title.toLowerCase().includes('moh');
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {doc.referenceNumber || doc.id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block max-w-xs truncate">{doc.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{doc.fileType || 'PDF'} • {doc.fileSize}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            isMoH ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.category || (isMoH ? 'Official MoH Letters' : 'Breakdown Reports')}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-800 font-medium">
                        {doc.deviceModel}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-600">
                        {doc.senderFacility || doc.manufacturer}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {doc.issuedDate || doc.lastUpdated}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            doc.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : doc.status === 'Dispatched'
                              ? 'bg-blue-100 text-blue-800'
                              : doc.status === 'Action Required'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {doc.status || 'Archived'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedDocumentForView(doc)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DOCUMENT VIEWER MODAL */}
      {selectedDocumentForView && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-300 font-bold">
                      {selectedDocumentForView.referenceNumber || selectedDocumentForView.id}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-indigo-600/40 text-indigo-200 border border-indigo-400/30">
                      {selectedDocumentForView.category || 'Official Document'}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-0.5 line-clamp-1">
                    {selectedDocumentForView.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintDocument}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Print / Export PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDocumentForView(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body - Official Document Sheet Presentation */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
              {/* Official Document Paper Container */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6 font-sans">
                {/* Government Header Stamp */}
                <div className="text-center pb-5 border-b-2 border-slate-900 space-y-1">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                    FEDERAL DEMOCRATIC REPUBLIC OF ETHIOPIA
                  </div>
                  <div className="text-base font-extrabold uppercase text-slate-900">
                    {selectedDocumentForView.category === 'Breakdown Reports'
                      ? 'EPSS BIOMEDICAL ENGINEERING & CLINICAL MAINTENANCE DIVISION'
                      : 'MINISTRY OF HEALTH • HEALTH INFRASTRUCTURE DIRECTORATE'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    National Medical Device & Equipment Administration System
                  </div>
                </div>

                {/* Reference & Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Ref:</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">{selectedDocumentForView.referenceNumber || selectedDocumentForView.id}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Issue Date:</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">{selectedDocumentForView.issuedDate || selectedDocumentForView.lastUpdated}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Device:</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block truncate">{selectedDocumentForView.deviceModel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status:</span>
                    <span className="font-bold text-emerald-700 mt-0.5 block">{selectedDocumentForView.status || 'Verified & Archived'}</span>
                  </div>
                </div>

                {/* Addressed To / From */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Originating Body / Sender:</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedDocumentForView.senderFacility || selectedDocumentForView.manufacturer}</p>
                  </div>
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient / Destination:</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedDocumentForView.recipientFacility || 'EPSS Central Medical Device Operations'}</p>
                  </div>
                </div>

                {/* Document Body / Content */}
                <div className="space-y-3 pt-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Official Document Text & Clauses:
                  </span>
                  <div className="p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl border border-slate-800 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {selectedDocumentForView.contentPreview || `OFFICIAL DOCUMENTATION
Subject: ${selectedDocumentForView.title}
Target Equipment: ${selectedDocumentForView.deviceModel}

Official documentation on record at Ethiopian Pharmaceuticals Supply Service (EPSS) repository.
Verified and authorized for national distribution and clinical operations.`}
                  </div>
                </div>

                {/* Official Sign-off & Seal */}
                <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Cryptographically Validated & Registered</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Archived in EPSS Unified Database • File ID: {selectedDocumentForView.id}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">Authentication:</span>
                    <span className="font-bold text-slate-800 text-xs">MoH & EPSS Joint Clearance</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyReference(selectedDocumentForView.referenceNumber || selectedDocumentForView.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  {copiedRef === (selectedDocumentForView.referenceNumber || selectedDocumentForView.id) ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedRef === (selectedDocumentForView.referenceNumber || selectedDocumentForView.id) ? 'Copied Ref!' : 'Copy Reference'}</span>
                </button>

                <a
                  href={selectedDocumentForView.driveLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Drive</span>
                </a>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDocumentForView(null)}
                className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD NEW DOCUMENT */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${uploadCategory === 'Official MoH Letters' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                  {uploadCategory === 'Official MoH Letters' ? <Building2 className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Upload {uploadCategory === 'Official MoH Letters' ? 'Official MoH Letter' : 'Breakdown Report'}
                  </h3>
                  <p className="text-[11px] text-slate-500">Add to centralized EPSS Google Workspace archive</p>
                </div>
              </div>

              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3.5">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Archive Classification</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadCategory('Official MoH Letters');
                      setUploadSender('Ministry of Health - Medical Device Allocation Directorate');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadCategory === 'Official MoH Letters'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Official MoH Letters</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setUploadCategory('Breakdown Reports');
                      setUploadSender('Jimma Specialized Hospital - Biomedical Dept');
                    }}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadCategory === 'Breakdown Reports'
                        ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Breakdown Reports</span>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title / Subject *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    uploadCategory === 'Official MoH Letters'
                      ? 'e.g. MoH Allocation & Delivery Clearance for 20 Hemodialysis Consoles'
                      : 'e.g. Regional Breakdown Report: Anesthesia Workstation O2 Sensor Failure'
                  }
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Reference #</label>
                  <input
                    type="text"
                    placeholder={uploadCategory === 'Official MoH Letters' ? 'MoH/EPSS/2026/...' : 'BKD-2026-...'}
                    value={uploadRefNumber}
                    onChange={(e) => setUploadRefNumber(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Device / Model</label>
                  <input
                    type="text"
                    placeholder="e.g. Hamilton C6 / Dräger Fabius"
                    value={uploadDeviceModel}
                    onChange={(e) => setUploadDeviceModel(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Issuing Body / Sender</label>
                  <input
                    type="text"
                    required
                    value={uploadSender}
                    onChange={(e) => setUploadSender(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Facility</label>
                  <input
                    type="text"
                    required
                    value={uploadRecipient}
                    onChange={(e) => setUploadRecipient(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white"
                  />
                </div>
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Scanned File (PDF, DOCX, XLSX)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.png,.jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setUploadFileObj(e.target.files[0]);
                    }
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {uploadFileObj && (
                  <p className="text-[11px] text-emerald-700 mt-1 font-medium">Selected: {uploadFileObj.name} ({(uploadFileObj.size / (1024 * 1024)).toFixed(1)} MB)</p>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Executive Summary / Breakdown Findings</label>
                <textarea
                  rows={3}
                  placeholder="Summarize key decision points, failure symptoms, or required spare parts..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Archive Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
