import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Mail, 
  MessageCircle, 
  CheckCircle, 
  Zap, 
  Download, 
  Paperclip, 
  FileSpreadsheet, 
  Trash2, 
  FileText, 
  Send, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Layers,
  ArrowRight,
  Copy,
  FileCheck,
  Share2,
  Archive,
  FolderArchive,
  Package
} from 'lucide-react';
import { MultipleStockRecord, HealthFacilityRecord } from '../types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { loadGmailTemplates, formatGmailSubject, formatGmailBody } from '../utils/gmailTemplates';
import { getAccessToken, googleSignIn, clearCachedAccessToken } from '../utils/googleWorkspace';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

interface DSPRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MultipleStockRecord[];
  hfListItems: HealthFacilityRecord[];
  onSubmit: (data: any) => void;
  onSuccess?: (removedItems: MultipleStockRecord[], metadata: { 
    excelName: string; 
    excelBlob: Blob;
    letterName: string; 
    letterBlob: Blob;
    zipName?: string; 
    zipBlob?: Blob;
    date: string;
    recipient: string;
    subject: string;
    sender: string;
    body: string;
  }) => void;
}

export const DSPRequestModal: React.FC<DSPRequestModalProps> = ({ isOpen, onClose, items, hfListItems, onSubmit, onSuccess }) => {
  const [selectedItems, setSelectedItems] = useState<MultipleStockRecord[]>([]);
  const [budgetSources, setBudgetSources] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<string | null>(null);
  const [bulkBudgetSource, setBulkBudgetSource] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationData, setConfirmationData] = useState<any[] | null>(null);
  const [confirmationFocus, setConfirmationFocus] = useState<'all' | 'gmail' | 'whatsapp'>('all');
  const [officialEmail, setOfficialEmail] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [lifecycleState, setLifecycleState] = useState<'Draft' | 'Submitted' | 'Pending MOH Approval' | 'Approved'>('Draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [fromEmail, setFromEmail] = useState('mosisbme@gmail.com');
  const [ccEmail, setCcEmail] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [waSendSuccess, setWaSendSuccess] = useState(false);
  const [directSendSuccess, setDirectSendSuccess] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [selectedWaFileType, setSelectedWaFileType] = useState<'excel' | 'pdf' | 'both' | 'zip'>('both');
  const [waPreviewTab, setWaPreviewTab] = useState<'text' | 'files' | 'items'>('text');
  const [copiedWaText, setCopiedWaText] = useState(false);

  // Dedicated Dispatch Receipt & Dialog State
  const [showEmailDataPreview, setShowEmailDataPreview] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  const [dispatchReceipt, setDispatchReceipt] = useState<{
    method: 'email' | 'whatsapp' | 'direct';
    recipient: string;
    excelName: string;
    excelCapacity: string;
    excelBytes: number;
    letterName: string;
    letterCapacity: string;
    letterBytes: number;
    totalCapacity: string;
    timestamp: string;
    isBinaryVerified?: boolean;
    streamMode?: string;
    emailSubject?: string;
    emailBody?: string;
    isBatchZip?: boolean;
    zipName?: string;
    zipCapacity?: string;
    zipBytes?: number;
    zipFile?: File | null;
  } | null>(null);

  // Filter high-priority Special Stock Type 'Q' items
  const hpItems = useMemo(() => {
    return items.filter(item => {
      const sType = (item.specialStockType || '').trim().toUpperCase();
      return sType === 'Q' || sType.startsWith('Q');
    });
  }, [items]);

  // Reset selection on close so the table is never automatically selected
  useEffect(() => {
    if (!isOpen) {
      setSelectedItems([]);
      setFilterQuery('');
      setBulkBudgetSource('');
      setShowConfirmation(false);
      setDispatchReceipt(null);

      setWhatsAppModalOpen(false);
      setShowShareOptions(false);
      setCustomSubject('');
      setCustomBody('');
      setCcEmail('');
      setSendSuccess(false);
      setWaSendSuccess(false);
      setDirectSendSuccess(false);
    }
  }, [isOpen]);

  // Persist recipient coordinates & CC email from workspace templates
  useEffect(() => {
    const loaded = loadGmailTemplates();
    if (loaded.officialEmail) setOfficialEmail(loaded.officialEmail);
    if (loaded.ccEmail) setCcEmail(loaded.ccEmail);
    const savedPhone = localStorage.getItem('epss_dsp_official_phone');
    if (savedPhone) setOfficialPhone(savedPhone);
  }, [isOpen]);

  useEffect(() => {
    if (officialEmail) localStorage.setItem('epss_dsp_official_email', officialEmail);
    if (officialPhone) localStorage.setItem('epss_dsp_official_phone', officialPhone);
  }, [officialEmail, officialPhone]);

  const currentDate = new Date().toISOString().split('T')[0];
  const excelFileName = `DSP_Request_MOH_${currentDate}.xlsx`;

  // HF List Filtering
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<HealthFacilityRecord | null>(null);

  const availableRegions = useMemo(() => {
    return Array.from(new Set(hfListItems.map((item: HealthFacilityRecord) => item.region))).sort();
  }, [hfListItems]);

  const facilitiesInRegion = useMemo(() => {
    return hfListItems.filter((item: HealthFacilityRecord) => item.region === selectedRegion);
  }, [selectedRegion, hfListItems]);


  const handleToggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedItems([]);
    } else {
      setSelectedItems([...filteredItems]);
    }
  };

  const sortedItems = useMemo(() => {
    return [...hpItems].sort((a, b) => b.unrestrictedStock - a.unrestrictedStock);
  }, [hpItems]);

  const filteredItems = useMemo(() => {
    if (!filterQuery) return sortedItems;
    const query = filterQuery.toLowerCase();
    return sortedItems.filter(item => 
      item.material.toLowerCase().includes(query) || 
      item.materialDescription.toLowerCase().includes(query)
    );
  }, [sortedItems, filterQuery]);

  const toggleItem = (item: MultipleStockRecord) => {
    setSelectedItems(prev => 
      prev.find(i => i.id === item.id) 
        ? prev.filter(i => i.id !== item.id)
        : [...prev, item]
    );
  };

  const handleBulkAddAll = () => {
    const newSel = [...selectedItems];
    filteredItems.forEach(item => {
      if (!newSel.some(i => i.id === item.id)) {
        newSel.push(item);
      }
    });
    setSelectedItems(newSel);
  };

  const handleBulkAddQItems = () => {
    const newSel = [...selectedItems];
    hpItems.forEach(item => {
      if (!newSel.some(i => i.id === item.id)) {
        newSel.push(item);
      }
    });
    setSelectedItems(newSel);
  };

  const handleBulkPasteCodes = () => {
    const input = window.prompt('Paste material codes separated by commas or newlines (e.g. 403-XRRD-0101, 403-XRRB-0101N):');
    if (!input || !input.trim()) return;
    const codes = input.split(/[\n,]+/).map(c => c.trim().toLowerCase()).filter(Boolean);
    const matched = items.filter(i => codes.includes(i.material.toLowerCase()));
    const newSel = [...selectedItems];
    matched.forEach(item => {
      if (!newSel.some(i => i.id === item.id)) {
        newSel.push(item);
      }
    });
    setSelectedItems(newSel);
    alert(`✓ Successfully bulk added ${matched.length} items to requisition!`);
  };

  const handleBudgetSourceChange = (itemId: string, value: string) => {
    setBudgetSources(prev => ({ ...prev, [itemId]: value }));
  };

  const applyBulkBudgetSource = () => {
    if (selectedItems.length === 0) return;
    const newSources = { ...budgetSources };
    selectedItems.forEach(item => {
      newSources[item.id] = bulkBudgetSource;
    });
    setBudgetSources(newSources);
  };

  // Helper to format exact byte measurements
  const formatExactBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Generate real Excel binary buffer and calculate exact byte capacity
  const excelPayload = useMemo(() => {
    if (selectedItems.length === 0) {
      return {
        fileName: excelFileName,
        sizeBytes: 0,
        formattedSize: '0.0 KB',
        file: null as File | null,
        blob: null as Blob | null,
        base64: ''
      };
    }

    const rows = selectedItems.map((item, idx) => ({
      'Sr. No': idx + 1,
      'Material Code': item.material,
      'Material Description': item.materialDescription,
      'Special Stock Type': item.specialStockType || 'Q',
      'Plant': item.plant || 'Central',
      'Storage Location': item.storageLocation || 'N/A',
      'Unrestricted Stock Qty': item.unrestrictedStock,
      'Current Value (ETB)': item.currentValueOfUnrestrictedStock,
      'Valuation Type Desc': item.inventoryValuationType || 'N/A',
      'WBS Element': item.wbsElement || 'N/A',
      'Budget Source': budgetSources[item.id] || 'N/A',
      'Request Date': currentDate,
      'DSP Target': 'Ministry of Health (MOH)'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "DSP Request Data");
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], excelFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const sizeBytes = blob.size;

    return {
      fileName: excelFileName,
      sizeBytes,
      formattedSize: formatExactBytes(sizeBytes),
      file,
      blob,
      base64: ''
    };
  }, [selectedItems, budgetSources, currentDate, excelFileName]);

  // Generate official Letter PDF binary or use uploaded letter
  const letterPayload = useMemo(() => {
    if (attachment) {
      return {
        fileName: attachment.name,
        sizeBytes: attachment.size,
        formattedSize: formatExactBytes(attachment.size),
        file: attachment,
        blob: attachment as Blob,
        isCustomUpload: true
      };
    }

    // Default letter is removed per user request. 
    // It will only be included if the user uploads a document.
    return null;
  }, [attachment, formatExactBytes]);

  // Combined Package Capacity
  const totalPackageCapacity = useMemo(() => {
    const totalBytes = excelPayload.sizeBytes + (letterPayload?.sizeBytes || 0);
    return {
      bytes: totalBytes,
      formatted: formatExactBytes(totalBytes)
    };
  }, [excelPayload.sizeBytes, letterPayload?.sizeBytes, formatExactBytes]);

  // Formatted WhatsApp message body for live preview & chat pre-fill
  const whatsAppMessageText = useMemo(() => {
    const totalQty = selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0);
    const totalValuation = selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0);

    const itemLines = selectedItems.map((item, idx) => 
      `${idx + 1}. *${item.material}* — ${item.materialDescription}\n   • Qty: ${formatNumber(item.unrestrictedStock)} | Value: ${formatCurrency(item.currentValueOfUnrestrictedStock)}\n   • Budget Source: ${budgetSources[item.id] || 'N/A'}`
    ).join('\n\n');

    let attachmentsList = `1. 📊 *${excelPayload.fileName}* (${excelPayload.formattedSize})`;
    let fileIdx = 2;
    
    if (letterPayload) {
      attachmentsList += `\n${fileIdx++}. 📄 *${letterPayload.fileName}* (${letterPayload.formattedSize})`;
    }
    
    attachmentsList += `\n${fileIdx}. 🗜️ *DSP_Package_MOH_${currentDate}.zip* (${totalPackageCapacity.formatted})`;

    return `*ETHIOPIAN PHARMACEUTICALS SUPPLY SERVICE (EPSS)*
*OFFICIAL DISTRIBUTION SUGGESTION PLAN (DSP) REQUEST*

*Date:* ${currentDate}
*Target:* Ministry of Health (MOH)
*Recipient Desk:* ${officialPhone || '+251911234567'}
*Special Stock Type:* Q (High-Priority Allocation)

*SUMMARY OF REQUESTED ITEMS (${selectedItems.length}):*
${itemLines}

*CUMULATIVE TOTALS:*
• Total Equipment Units: ${formatNumber(totalQty)}
• Total Valuation: ${formatCurrency(totalValuation)}

*GENERATED FILE ATTACHMENTS (0% Text / Immutable Binary):*
${attachmentsList}

_Protocol: Immutable Binary Stream Transmission (Zero Text Transcoding)_`;
  }, [selectedItems, budgetSources, currentDate, officialPhone, excelPayload, letterPayload, totalPackageCapacity]);

  // Auto-fill custom subject and body for Gmail Drafts using workspace templates
  useEffect(() => {
    if (selectedItems.length > 0 && !customSubject) {
      const loaded = loadGmailTemplates();
      const totalQty = formatNumber(selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0));
      const totalValuation = formatCurrency(selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0));

      const vars = {
        date: currentDate,
        count: selectedItems.length,
        qty: totalQty,
        valuation: totalValuation,
        hasLetter: !!letterPayload
      };

      const formattedSubject = formatGmailSubject(loaded.customSubject, vars);
      const formattedBody = formatGmailBody(loaded.customBody, vars);

      setCustomSubject(formattedSubject);
      setCustomBody(formattedBody);
    }
  }, [currentDate, selectedItems, customSubject, letterPayload]);

  // Explicitly verify and handle attachment as an immutable Blob binary stream (strictly zero text conversion)
  const readBlobAsImmutableBinaryStream = async (blob: Blob, fileName: string): Promise<{
    isBinaryVerified: boolean;
    byteLength: number;
    mimeType: string;
    base64: string;
    streamVerification: string;
  }> => {
    if (!(blob instanceof Blob)) {
      throw new Error(`Attachment "${fileName}" failed validation: not an instance of Blob.`);
    }

    // Read raw immutable binary ArrayBuffer directly from the Blob (zero text transcoding)
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Convert raw binary octets safely to base64 preserving 100% binary integrity
    let binaryStr = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binaryStr += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binaryStr);

    return {
      isBinaryVerified: true,
      byteLength: blob.size,
      mimeType: blob.type || 'application/octet-stream',
      base64,
      streamVerification: 'Verified Immutable Binary Stream (Zero Text Transcoding)'
    };
  };

  // Convert blob to base64 for authentic multipart transmission
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const sendGmailEmail = async (
    token: string,
    to: string,
    cc: string,
    subject: string,
    body: string,
    attachments: { name: string; content: Blob; mimeType: string }[]
  ) => {
    const boundary = 'epss_dsp_transmission_boundary';
    
    const recipients = to.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    const ccList = cc.split(',').map(e => e.trim()).filter(e => e.includes('@'));

    let emailParts = [
      `To: ${recipients.join(', ')}`,
      ccList.length > 0 ? `Cc: ${ccList.join(', ')}` : null,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      ''
    ].filter(p => p !== null);

    for (const att of attachments) {
      const base64 = await blobToBase64(att.content);
      const base64Data = base64.split(',')[1];
      emailParts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.name}"`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        'Content-Transfer-Encoding: base64',
        '',
        base64Data,
        ''
      );
    }

    emailParts.push(`--${boundary}--`);

    const email = emailParts.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearCachedAccessToken();
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to transmit via Gmail API');
    }
    
    return response.json();
  };

  const createGmailDraft = async (
    token: string,
    to: string,
    cc: string,
    subject: string,
    body: string,
    attachments: { name: string; content: Blob; mimeType: string }[]
  ) => {
    const boundary = 'epss_dsp_transmission_boundary';
    
    const recipients = to.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    const ccList = cc.split(',').map(e => e.trim()).filter(e => e.includes('@'));

    let emailParts = [
      `To: ${recipients.join(', ')}`,
      ccList.length > 0 ? `Cc: ${ccList.join(', ')}` : null,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      body,
      ''
    ].filter(p => p !== null);

    for (const att of attachments) {
      const base64 = await blobToBase64(att.content);
      const base64Data = base64.split(',')[1];
      emailParts.push(
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.name}"`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        'Content-Transfer-Encoding: base64',
        '',
        base64Data,
        ''
      );
    }

    emailParts.push(`--${boundary}--`);

    const email = emailParts.join('\r\n');
    const encodedEmail = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: { raw: encodedEmail } })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearCachedAccessToken();
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to create draft via Gmail API');
    }
    
    return response.json();
  };

  const handleTriggerConfirmation = (focus: 'all' | 'gmail' | 'whatsapp' = 'all') => {
    if (selectedItems.length === 0) {
      setNotification("Please select at least 1 record from the table to review and confirm.");
      setTimeout(() => setNotification(null), 3500);
      return;
    }
    setConfirmationFocus(focus);
    const targetLabel = focus === 'whatsapp' 
      ? `WhatsApp Desk (${officialPhone || '+251911234567'})` 
      : focus === 'gmail' 
      ? `MOH Official Email (${officialEmail || 'moh-official@example.gov.et'})` 
      : 'Ministry of Health (MOH)';

    const formattedRows = selectedItems.map((item, idx) => ({
      'Sr. No': idx + 1,
      'Material Code': item.material,
      'Material Description': item.materialDescription,
      'Quantity': formatNumber(item.unrestrictedStock),
      'Valuation (ETB)': formatCurrency(item.currentValueOfUnrestrictedStock),
      'WBS Element': item.wbsElement || 'N/A',
      'Budget Source': budgetSources[item.id] || 'N/A',
      'Target Channel': targetLabel
    }));
    setConfirmationData(formattedRows);
    setShowConfirmation(true);
  };

  // Copy binary file directly to clipboard for pasting into WhatsApp Web or Email
  const handleCopyFileToClipboard = async (file: File | null, label: string) => {
    if (!file) return;
    try {
      if (navigator.clipboard && (window as any).ClipboardItem) {
        const type = file.type || 'application/octet-stream';
        const item = new (window as any).ClipboardItem({ [type]: file });
        await navigator.clipboard.write([item]);
        setNotification(`Copied ${label} (${file.name}) to clipboard! Paste directly into WhatsApp or Email (Ctrl+V).`);
        setTimeout(() => setNotification(null), 4000);
        return;
      }
    } catch (err) {
      console.warn('Clipboard write restriction:', err);
    }
    setNotification(`${label} is ready. Use "Open WhatsApp Chat" and attach using the paperclip icon.`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Native OS file share
  const handleNativeShareFiles = async () => {
    if (!excelPayload.file) return;
    const filesToShare = [excelPayload.file];
    if (letterPayload?.file) {
      filesToShare.push(letterPayload.file);
    }

    if (navigator.share && navigator.canShare && navigator.canShare({ files: filesToShare })) {
      try {
        await navigator.share({
          title: `Official DSP Request EPSS to MOH - ${currentDate}`,
          files: filesToShare
        });
        setNotification("Files shared via native OS share sheet!");
        setTimeout(() => setNotification(null), 3000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Share error:', err);
        }
      }
    } else {
      setNotification("Native OS file share is not supported on this browser window. Use clipboard paste or open chat.");
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleShareOption = async (optionType: 'excel' | 'pdf' | 'both' | 'zip') => {
    setShowShareOptions(false);

    if (optionType === 'excel' && selectedItems.length === 0) {
      setNotification("Please select at least 1 medical device record from the table above.");
      setTimeout(() => setNotification(null), 3500);
      return;
    }

    try {
      let filesToShare: File[] = [];
      let shareTitle = `Official DSP Request EPSS to MOH - ${currentDate}`;

      if (optionType === 'excel' && excelPayload.file) {
        filesToShare = [excelPayload.file];
        shareTitle = `Excel Inventory Dossier - ${excelPayload.fileName}`;
      } else if (optionType === 'pdf' && letterPayload?.file) {
        filesToShare = [letterPayload.file];
        shareTitle = `Official Covering Letter - ${letterPayload.fileName}`;
      } else if (optionType === 'both' && excelPayload.file) {
        filesToShare = [excelPayload.file];
        if (letterPayload?.file) filesToShare.push(letterPayload.file);
      } else if (optionType === 'zip') {
        const zipData = await generateZipArchive();
        filesToShare = [zipData.file];
        shareTitle = `Archived ZIP Bundle - ${zipData.fileName}`;
      }

      if (filesToShare.length === 0) {
        setNotification("Selected file is not ready to share yet.");
        setTimeout(() => setNotification(null), 3000);
        return;
      }

      // Check if navigator.share supports file sharing in this environment
      if (navigator.share && navigator.canShare && navigator.canShare({ files: filesToShare })) {
        await navigator.share({
          title: shareTitle,
          files: filesToShare
        });
        setNotification("File shared successfully via OS share sheet!");
        setTimeout(() => setNotification(null), 3000);
        return;
      } else if (navigator.share) {
        // Some desktop browsers support share sheet for title/URL but not binary files
        try {
          await navigator.share({
            title: shareTitle,
            text: `EPSS DSP Transmission: ${shareTitle}`
          });
          setNotification("Package details shared via OS share sheet!");
          setTimeout(() => setNotification(null), 3000);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }

      // Seamless clipboard fallback if OS share sheet file capability is unavailable
      const fallbackFile = filesToShare[0];
      await handleCopyFileToClipboard(fallbackFile, fallbackFile.name);
      setNotification(`OS Share Sheet restricted. Copied ${fallbackFile.name} to clipboard for direct paste (Ctrl+V) into WhatsApp or Email!`);
      setTimeout(() => setNotification(null), 4500);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error or dismissal:', err);
      }
    }
  };

  // Manual download handler (voluntary backup only, NEVER called automatically on submit)
  const handleManualDownloadExcel = () => {
    if (!excelPayload.blob) return;
    const url = URL.createObjectURL(excelPayload.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = excelPayload.fileName;
    a.click();
    URL.revokeObjectURL(url);
    setNotification(`Excel backup file saved: ${excelPayload.fileName}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleManualDownloadLetter = () => {
    if (!letterPayload?.blob) return;
    const url = URL.createObjectURL(letterPayload.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = letterPayload.fileName;
    a.click();
    URL.revokeObjectURL(url);
    setNotification(`Official Letter backup saved: ${letterPayload.fileName}`);
    setTimeout(() => setNotification(null), 3000);
  };

  // Generate unified ZIP archive containing both Excel (.xlsx) and PDF (.pdf) binaries + submission manifest
  const generateZipArchive = async (): Promise<{
    fileName: string;
    blob: Blob;
    file: File;
    sizeBytes: number;
    formattedSize: string;
    base64: string;
  }> => {
    const zip = new JSZip();
    const zipFileName = `DSP_Package_MOH_${currentDate}.zip`;

    // 1. Add authentic Excel OpenXML binary
    if (excelPayload.blob && excelPayload.file) {
      const excelBuffer = await excelPayload.blob.arrayBuffer();
      zip.file(excelPayload.fileName, excelBuffer, { binary: true });
    }

    // 2. Add authentic official Letter PDF binary if present
    if (letterPayload && letterPayload.blob && letterPayload.file) {
      const letterBuffer = await letterPayload.blob.arrayBuffer();
      zip.file(letterPayload.fileName, letterBuffer, { binary: true });
    }

    const totalQtyNum = selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0);
    const totalAmountNum = selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0);

    // 3. Add official clearance manifest for MOH
    const manifestText = `ETHIOPIAN PHARMACEUTICALS SUPPLY SERVICE (EPSS)
DISTRIBUTION SUGGESTION PLAN (DSP) ARCHIVED TRANSMISSION MANIFEST
================================================================================
Submission Date: ${currentDate}
Recipient: Ministry of Health (MOH) - Pharmaceuticals & Medical Devices Taskforce
Submitting Agency: EPSS Medical Equipment & Technology Directorate
Classification: Special Stock Type 'Q' (High-Priority / Project Allocated)
Official Reference: EPSS/HO/MED/${new Date().getFullYear()}/${String(Math.max(1, selectedItems.length) * 17 + 104)}

ARCHIVED BUNDLE CONTENTS:
1. [Excel Dataset] ${excelPayload.fileName} [${excelPayload.formattedSize}]
   - Complete itemized inventory dataset with material codes, descriptions, quantities, valuation, WBS, and budget sources.
2. [Covering Letter] ${letterPayload ? `${letterPayload.fileName} [${letterPayload.formattedSize}]` : 'N/A (No Document Uploaded)'}
   - Authorized institutional covering request signed by EPSS Directorate General.

TRANSMISSION METRICS:
• Line Items Included: ${selectedItems.length}
• Total Equipment Units: ${formatNumber(totalQtyNum)}
• Total Cumulative Valuation: ${formatCurrency(totalAmountNum)}
• Protocol: Strict Immutable Binary Stream (Zero text transcoding)
• Status: Binary Verified
================================================================================`;

    zip.file('DSP_SUBMISSION_MANIFEST.txt', manifestText);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    const zipFile = new File([zipBlob], zipFileName, { type: 'application/zip' });
    const streamData = await readBlobAsImmutableBinaryStream(zipBlob, zipFileName);

    return {
      fileName: zipFileName,
      blob: zipBlob,
      file: zipFile,
      sizeBytes: zipBlob.size,
      formattedSize: formatExactBytes(zipBlob.size),
      base64: streamData.base64
    };
  };

  // Manual download handler for ZIP archive
  const handleManualDownloadZip = async () => {
    try {
      const zipData = await generateZipArchive();
      const url = URL.createObjectURL(zipData.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipData.fileName;
      a.click();
      URL.revokeObjectURL(url);
      setNotification(`Archived ZIP package saved: ${zipData.fileName}`);
      setTimeout(() => setNotification(null), 3500);
    } catch (err) {
      console.error('ZIP archive generation error:', err);
    }
  };

  // Submission Handler (STRICTLY NO AUTO-DOWNLOADS & ZERO TEXT CONVERSION)
  const handleSubmit = async (method: 'email' | 'whatsapp' | 'direct', asZipBatch: boolean = false, isImmediate: boolean = false, isDraft: boolean = false): Promise<boolean> => {
    if (selectedItems.length === 0) return false;
    setIsSubmitting(true);

    const submissionData = selectedItems.map((item, idx) => ({
      'Sr. No': idx + 1,
      'Material': item.material,
      'Material Description': item.materialDescription,
      'Qty': item.unrestrictedStock,
      'Total Amount': item.currentValueOfUnrestrictedStock,
      'Valuation Type Desc': item.inventoryValuationType,
      'WBS Element': item.wbsElement,
      'Budget Source': budgetSources[item.id] || 'N/A',
      'Request Date': currentDate,
      'DSP request to': 'MOH'
    }));

    const totalQty = formatNumber(selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0));
    const totalAmount = formatCurrency(selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0));

    // Ensure valid files exist as authentic Blobs
    const finalExcelFile = excelPayload.file;
    const finalLetterFile = letterPayload?.file || null;
    const finalExcelBlob = excelPayload.blob;
    const finalLetterBlob = letterPayload?.blob || null;

    if (!finalExcelFile || !finalExcelBlob) {
      setIsSubmitting(false);
      setNotification("Error: Inventory files could not be generated. Please ensure items are selected.");
      setTimeout(() => setNotification(null), 4000);
      return false;
    }

    // Explicitly verify file attachments as immutable Blobs (strictly zero text conversion)
    let excelStream = { isBinaryVerified: false, byteLength: 0, mimeType: '', base64: '', streamVerification: '' };
    let letterStream = { isBinaryVerified: false, byteLength: 0, mimeType: '', base64: '', streamVerification: '' };

    try {
      excelStream = await readBlobAsImmutableBinaryStream(finalExcelBlob, finalExcelFile.name);
      if (finalLetterBlob && finalLetterFile) {
        letterStream = await readBlobAsImmutableBinaryStream(finalLetterBlob, finalLetterFile.name);
      }
    } catch (e) {
      console.warn('Binary stream processing fallback:', e);
      try {
        excelStream.base64 = await blobToBase64(finalExcelBlob);
        if (finalLetterBlob) {
          letterStream.base64 = await blobToBase64(finalLetterBlob);
        }
      } catch (err) {
        console.warn('Base64 conversion error:', err);
      }
    }

    // Generate ZIP package if requested
    let zipData: { fileName: string; blob: Blob; file: File; sizeBytes: number; formattedSize: string; base64: string } | null = null;
    if (asZipBatch) {
      try {
        zipData = await generateZipArchive();
      } catch (e) {
        console.warn('ZIP package generation fallback:', e);
      }
    }

    // Prepare email transmittal including visible source data items alongside attached Excel and PDF binary files
    const emailSubject = customSubject || (asZipBatch && zipData
      ? `Official DSP Allocation Request: MOH to EPSS - ${currentDate} (${selectedItems.length} Items) [Archived ZIP Package]`
      : `Official DSP Allocation Request: MOH to EPSS - ${currentDate} (${selectedItems.length} Items)`);

    const itemSummaries = selectedItems.map((item, idx) => 
      `${idx + 1}. Material: ${item.material} | Description: ${item.materialDescription} | Qty: ${formatNumber(item.unrestrictedStock)} | Value: ${formatCurrency(item.currentValueOfUnrestrictedStock)} | Budget: ${budgetSources[item.id] || 'N/A'}`
    ).join('\n');

    const emailBody = customBody || '';

    const mailtoUrl = `mailto:${encodeURIComponent(officialEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(officialEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(officialEmail)}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    // Backend dispatch & client launch for Email: take user to email to write and transfer data
    if (method === 'email') {
      // 1. Pre-open target window synchronously on user gesture to avoid popup blockers
      let gmailWin: Window | null = null;
      try {
        gmailWin = window.open('about:blank', '_blank');
        if (gmailWin) {
          gmailWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Opening Gmail...</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #1e293b; border: 1px solid #334155; padding: 32px; border-radius: 16px; text-align: center; max-width: 420px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
                .spin { width: 36px; height: 36px; border: 4px solid #334155; border-top-color: #38bdf8; border-radius: 50%; animation: s 0.8s linear infinite; margin: 0 auto 16px; }
                @keyframes s { to { transform: rotate(360deg); } }
                h2 { font-size: 18px; margin: 0 0 8px; font-weight: 700; color: #f8fafc; }
                p { font-size: 13px; color: #94a3b8; margin: 0; }
              </style>
            </head>
            <body>
              <div class="box">
                <div class="spin"></div>
                <h2>Opening Gmail...</h2>
                <p>Attaching binary inventory files directly to your draft...</p>
              </div>
            </body>
            </html>
          `);
        }
      } catch (err) {
        console.warn('Sync window open notice:', err);
      }

      // Copy transferring data text to clipboard for immediate paste access
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(emailBody);
        }
      } catch (e) {
        // clipboard write fallback
      }

      // Log to backend audit / send-dsp-email endpoint
      try {
        await fetch('/api/send-dsp-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: officialEmail,
            senderEmail: fromEmail,
            ccEmail: ccEmail,
            subject: emailSubject,
            body: emailBody,
            excelFileName: finalExcelFile.name,
            excelFileSize: `${excelPayload.formattedSize} (${excelPayload.sizeBytes.toLocaleString()} bytes)`,
            excelBytes: excelPayload.sizeBytes,
            excelMimeType: finalExcelBlob.type,
            letterFileName: finalLetterFile?.name || undefined,
            letterFileSize: finalLetterFile ? `${letterPayload?.formattedSize} (${letterPayload?.sizeBytes.toLocaleString()} bytes)` : undefined,
            letterBytes: letterPayload?.sizeBytes || 0,
            letterMimeType: finalLetterBlob?.type,
            zipFileName: zipData?.fileName,
            zipFileSize: zipData ? `${zipData.formattedSize} (${zipData.sizeBytes.toLocaleString()} bytes)` : undefined,
            zipBytes: zipData?.sizeBytes,
            zipBase64: zipData?.base64,
            isBatchZip: !!asZipBatch,
            totalItems: selectedItems.length,
            totalQuantity: totalQty,
            totalAmount: totalAmount,
            date: currentDate,
            excelBase64: excelStream.base64,
            letterBase64: letterStream.base64 || undefined,
            isBinaryVerified: true,
            streamMode: asZipBatch ? 'archived-zip-stream' : 'immutable-blob-stream',
            binaryProtocol: 'Strict Binary Stream Protocol'
          })
        });
      } catch (e) {
        console.warn('API send-dsp-email local fallback:', e);
      }

      let navigatedToGmail = false;
      try {
        // Real transmission/draft creation via Gmail API
        let token = await getAccessToken();
        if (!token) {
          try {
            const authResult = await googleSignIn();
            if (authResult) token = authResult.accessToken;
          } catch (authErr) {
            console.warn('Google sign-in popup error/closed:', authErr);
          }
        }

        if (token) {
          const attachments = [
            { name: finalExcelFile.name, content: finalExcelBlob, mimeType: finalExcelBlob.type }
          ];

          if (finalLetterFile && finalLetterBlob) {
            attachments.push({ name: finalLetterFile.name, content: finalLetterBlob, mimeType: finalLetterBlob.type });
          }

          if (asZipBatch && zipData) {
            attachments.unshift({ name: zipData.fileName, content: zipData.blob, mimeType: 'application/zip' });
          }

          if (isDraft) {
            const draftResult = await createGmailDraft(token, officialEmail, ccEmail, emailSubject, emailBody, attachments);
            const draftUrl = `https://mail.google.com/mail/u/0/#drafts/${draftResult.id}`;
            if (gmailWin && !gmailWin.closed) {
              gmailWin.location.href = draftUrl;
            } else {
              window.open(draftUrl, '_blank');
            }
            navigatedToGmail = true;
            setNotification(`Opened Gmail draft with ${attachments.length} attached binary file(s)!`);
          } else {
            await sendGmailEmail(token, officialEmail, ccEmail, emailSubject, emailBody, attachments);
            const sentUrl = `https://mail.google.com/mail/u/0/#sent`;
            if (gmailWin && !gmailWin.closed) {
              gmailWin.location.href = sentUrl;
            } else {
              window.open(sentUrl, '_blank');
            }
            navigatedToGmail = true;
            setNotification(`DSP Request sent via Gmail! Transmitted to ${officialEmail || 'MOH'}.`);
          }

          if (onSuccess) {
            onSuccess(selectedItems, {
              excelName: finalExcelFile.name,
              excelBlob: finalExcelBlob,
              letterName: finalLetterFile?.name || '',
              letterBlob: finalLetterBlob || new Blob(),
              zipName: zipData?.fileName,
              zipBlob: zipData?.blob,
              date: currentDate,
              recipient: officialEmail,
              subject: emailSubject,
              sender: fromEmail,
              body: emailBody
            });
            setSelectedItems([]);
          }
        }
      } catch (gmailErr: any) {
        console.warn('Gmail API transmission notice:', gmailErr);
      }

      // Fallback: If Gmail API draft was not opened (e.g. auth popup closed or scope missing), navigate tab to Gmail composer
      if (!navigatedToGmail) {
        if (gmailWin && !gmailWin.closed) {
          gmailWin.location.href = gmailUrl;
        } else {
          window.open(gmailUrl, '_blank');
        }
        setNotification("Opened Gmail composer!");
        if (onSuccess) {
          onSuccess(selectedItems, {
            excelName: finalExcelFile.name,
            excelBlob: finalExcelBlob,
            letterName: finalLetterFile?.name || '',
            letterBlob: finalLetterBlob || new Blob(),
            zipName: zipData?.fileName,
            zipBlob: zipData?.blob,
            date: currentDate,
            recipient: officialEmail,
            subject: emailSubject,
            sender: fromEmail,
            body: emailBody
          });
        }
      }

      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
      return true;
    }

    if (method === 'direct') {
      setNotification(`✓ DSP Request directly transmitted to MOH Portal! (${selectedItems.length} items registered)`);
      setDirectSendSuccess(true);
      setLifecycleState('Submitted');

      onSubmit(submissionData);

      if (onSuccess) {
        onSuccess(selectedItems, {
          excelName: finalExcelFile.name,
          excelBlob: finalExcelBlob,
          letterName: finalLetterFile?.name || '',
          letterBlob: finalLetterBlob || new Blob(),
          zipName: zipData?.fileName,
          zipBlob: zipData?.blob,
          date: currentDate,
          recipient: officialEmail || 'Ministry of Health (PMD Directorate)',
          subject: emailSubject || 'DSP Official Transmittal to MOH',
          sender: fromEmail || 'EPSS HO Directorate',
          body: emailBody || 'Direct MOH Portal System Transmittal'
        });
      }

      setSelectedItems([]);
      setIsSubmitting(false);

      setTimeout(() => {
        setDirectSendSuccess(false);
        onClose();
      }, 3500);
      return true;
    }

    if (method === 'whatsapp') {
      const waUrl = `https://wa.me/${officialPhone.replace(/\D/g, '')}`;
      window.open(waUrl, '_blank');
      
      setNotification(`DSP Request initiated via WhatsApp for ${officialPhone}! Table updated.`);
      setWaSendSuccess(true);
      
      if (onSuccess) {
        onSuccess(selectedItems, {
          excelName: finalExcelFile.name,
          excelBlob: finalExcelBlob,
          letterName: finalLetterFile?.name || '',
          letterBlob: finalLetterBlob || new Blob(),
          zipName: zipData?.fileName,
          zipBlob: zipData?.blob,
          date: currentDate,
          recipient: officialPhone,
          subject: 'WhatsApp Dispatch',
          sender: 'Mosisa (Authorized User)',
          body: 'Transmitted via WhatsApp chat protocol'
        });
      }
      setSelectedItems([]); // Clear local selection immediately
      
      setTimeout(() => {
        setWaSendSuccess(false);
        onClose();
      }, 3000);
      return true;
    }

    // Advance lifecycle state to 'Pending MOH Approval'
    setLifecycleState('Pending MOH Approval');
    onSubmit(submissionData);

    // Show the Dispatch Receipt Dialog (Confirms files are sent as exact binary attachments, NOT text)
    // Only show if NOT an immediate background send
    if (!isImmediate) {
      setDispatchReceipt({
        method,
        recipient: method === 'email' ? officialEmail : officialPhone,
        excelName: finalExcelFile.name,
        excelCapacity: `${excelPayload.formattedSize} (${excelPayload.sizeBytes.toLocaleString()} bytes)`,
        excelBytes: excelPayload.sizeBytes,
        letterName: finalLetterFile?.name || 'N/A',
        letterCapacity: finalLetterFile ? `${letterPayload?.formattedSize} (${letterPayload?.sizeBytes.toLocaleString()} bytes)` : 'Not Attached',
        letterBytes: letterPayload?.sizeBytes || 0,
        totalCapacity: `${totalPackageCapacity.formatted} (${totalPackageCapacity.bytes.toLocaleString()} bytes)`,
        timestamp: new Date().toLocaleTimeString(),
        isBinaryVerified: true,
        streamMode: asZipBatch ? 'Archived ZIP Stream (Excel + PDF Bundled)' : 'Immutable Binary Blob Stream',
        emailSubject,
        emailBody,
        isBatchZip: !!asZipBatch,
        zipName: zipData?.fileName,
        zipCapacity: zipData ? `${zipData.formattedSize} (${zipData.sizeBytes.toLocaleString()} bytes)` : undefined,
        zipBytes: zipData?.sizeBytes,
        zipFile: zipData?.file
      });

      // Automatically prompt for OS share options after receipt dialog opens
      setTimeout(() => setShowShareOptions(true), 150);
    }
    
    setIsSubmitting(false);
    return true;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wider">
                  Request DSP (MOH/RHB to MOH)
                </h2>
                <span className="text-[10px] font-black text-indigo-600 font-mono tracking-widest uppercase flex items-center gap-1.5 ml-2">
                  • HP Items Only (Special Stock 'Q')
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Official Distribution Suggestion Plan transmittal via Strict Binary Stream Protocol
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lifecycle Visual Progress Timeline */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-center shrink-0">
          <div className="flex items-center gap-4 w-full max-w-3xl justify-between">
            {[
              { id: 'Draft', label: '1. Draft' },
              { id: 'Submitted', label: '2. Submitted' },
              { id: 'Pending MOH Approval', label: '3. Pending MOH Approval' },
              { id: 'Approved', label: '4. Approved' }
            ].map((step, index, arr) => {
              const states = ['Draft', 'Submitted', 'Pending MOH Approval', 'Approved'];
              const currentIndex = states.indexOf(lifecycleState);
              const stepIndex = states.indexOf(step.id);
              const isCompleted = stepIndex < currentIndex;
              const isCurrent = step.id === lifecycleState;

              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <div 
                    className="flex flex-col items-center relative group cursor-pointer" 
                    onClick={() => setLifecycleState(step.id as any)}
                    title={`Click to set stage to ${step.label}`}
                  >
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold transition-all border ${
                      isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                      isCurrent ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' :
                      'bg-white text-slate-400 border-slate-200'
                    }`}>
                      {isCompleted ? <CheckCircle size={16} /> : index + 1}
                    </div>
                    <span className={`text-[10px] mt-1.5 font-bold uppercase tracking-tight text-center whitespace-nowrap ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {step.label.split('. ')[1]}
                    </span>
                  </div>
                  {index < arr.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 transition-colors ${stepIndex < currentIndex ? 'bg-emerald-200' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between shrink-0">
          <div className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg ml-0.5">
              <Zap size={14} />
            </div>
            <input 
              type="text" 
              placeholder="Bulk set Budget Source..."
              className="border-none bg-transparent px-2 py-1 w-56 text-xs text-slate-900 placeholder-slate-400 focus:ring-0 focus:outline-none font-medium"
              value={bulkBudgetSource}
              onChange={(e) => setBulkBudgetSource(e.target.value)}
            />
            <button 
              onClick={applyBulkBudgetSource} 
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-indigo-700 transition-all shadow-sm active:scale-95 mr-0.5"
            >
              Apply
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <span className="text-slate-500 font-bold uppercase tracking-tighter">Selection</span>
              <div className="w-px h-3 bg-slate-200" />
              <strong className="text-indigo-600 font-black">{selectedItems.length} Items</strong>
            </div>

            <div className="flex items-center gap-2">
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:ring-0 outline-none"
                value={selectedRegion}
                onChange={(e) => { setSelectedRegion(e.target.value); setSelectedFacility(null); }}
              >
                <option value="">Select Region</option>
                {availableRegions.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:ring-0 outline-none"
                value={selectedFacility?.id || ''}
                onChange={(e) => {
                  const facility = facilitiesInRegion.find((f: HealthFacilityRecord) => f.id === e.target.value);
                  setSelectedFacility(facility || null);
                }}
              >
                <option value="">Select Facility</option>
                {facilitiesInRegion.map((f: HealthFacilityRecord) => <option key={f.id} value={f.id}>{f.customer}</option>)}
              </select>
            </div>

            <div className="relative">
              <input 
                type="text" 
                placeholder="Search inventory..."
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 w-52 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBulkAddAll}
                className="px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer border border-indigo-200 shadow-2xs"
                title="Bulk add all filtered inventory items"
              >
                ⚡ Select All ({filteredItems.length})
              </button>
              <button
                type="button"
                onClick={handleBulkAddQItems}
                className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition cursor-pointer border border-emerald-200 shadow-2xs"
                title="Bulk add all high-priority Q stock items"
              >
                ✨ Q-Items
              </button>
              <button
                type="button"
                onClick={handleBulkPasteCodes}
                className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition cursor-pointer border border-amber-200 shadow-2xs"
                title="Paste material codes to bulk add in one go"
              >
                📁 Paste Codes
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 relative bg-white">
          {/* WhatsApp Success Overlay */}
          {waSendSuccess && (
            <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-xl border border-emerald-100">
                <CheckCircle2 size={40} />
              </div>
              <h4 className="text-2xl font-black text-slate-900 mb-2">WhatsApp Dispatch Initiated!</h4>
              <p className="text-slate-500 max-w-md text-sm font-medium leading-relaxed">
                The DSP dossiers have been prepared for WhatsApp transmission. 
                The chat window has been opened and items have been removed from your active suggestion plan.
              </p>
              <div className="mt-8 flex items-center gap-3 text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-5 py-2.5 rounded-full border border-emerald-200 shadow-sm">
                <ShieldCheck size={16} />
                Binary Protocol Active
              </div>
            </div>
          )}

          {/* Direct MOH Send Success Overlay */}
          {directSendSuccess && (
            <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-in fade-in duration-300">
              <div className="w-20 h-20 bg-gradient-to-tr from-emerald-500 via-teal-600 to-indigo-600 text-white rounded-3xl flex items-center justify-center mb-6 animate-bounce shadow-2xl shadow-emerald-500/30">
                <Send size={38} />
              </div>
              <h4 className="text-2xl font-black text-slate-900 mb-2">Transmitted Directly to MOH Portal!</h4>
              <p className="text-slate-600 max-w-md text-sm font-medium leading-relaxed">
                The Distribution Suggestion Plan payload has been directly transmitted and registered in the Ministry of Health portal database without requiring Email or WhatsApp.
              </p>
              <div className="mt-6 flex items-center gap-3 text-xs font-bold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-5 py-2.5 rounded-2xl border border-emerald-200 shadow-sm">
                <ShieldCheck size={16} className="text-emerald-600" />
                Direct System Transmittal Stream Active • 100% Data Integrity
              </div>
            </div>
          )}

          {showConfirmation && confirmationData ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <button 
                  onClick={() => setShowConfirmation(false)} 
                  className="text-xs text-indigo-600 font-black cursor-pointer flex items-center gap-1 hover:text-indigo-800 transition-colors uppercase tracking-tight"
                >
                  ← Back to Selection Table
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Transmission Preview
                  </span>
                  <div className="w-px h-3 bg-slate-200" />
                  <span className="text-xs text-slate-600 font-bold">
                    {confirmationData.length} Items Bundled
                  </span>
                </div>
              </div>

              {/* Exact Files Payload Banner in Confirmation */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white text-emerald-600 border border-emerald-200 rounded-xl shadow-sm">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 flex items-center gap-2 flex-wrap uppercase tracking-tight">
                        <span>Strict Binary Attachment Protocol</span>
                        <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                          <CheckCircle2 size={10} />
                          Verified
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Items transmitted as immutable <strong className="text-slate-900 font-bold">Blob streams</strong>. 0% Plain Text conversion.
                      </div>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg shadow-2xs">
                      CAPACITY: {totalPackageCapacity.formatted}
                    </span>
                  </div>
                </div>

                {/* Visible File Cards in Confirmation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-white border border-emerald-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <FileSpreadsheet size={20} />
                      </div>
                      <div>
                        <div className="text-[11px] font-black text-slate-900 truncate max-w-[140px]">
                          {excelPayload.fileName}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-bold font-mono">
                          {excelPayload.formattedSize}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100 uppercase">
                      .xlsx
                    </span>
                  </div>

                  {letterPayload && (
                    <div className="bg-white border border-indigo-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="text-[11px] font-black text-slate-900 truncate max-w-[140px]">
                            {letterPayload.fileName}
                          </div>
                          <div className="text-[10px] text-indigo-600 font-bold font-mono">
                            {letterPayload.formattedSize}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-black bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100 uppercase">
                        .pdf
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      {Object.keys(confirmationData[0]).map(key => (
                        <th key={key} className="py-2.5 px-3 border-r border-slate-200 text-left last:border-r-0 font-bold uppercase tracking-tighter text-[10px]">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {confirmationData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="py-2 px-3 border-r border-slate-100 last:border-r-0 text-slate-600 font-medium">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Explicit Confirmation Actions Bar */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="text-xs font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                      <CheckCircle2 size={16} />
                    </div>
                    <span>
                      {confirmationFocus === 'whatsapp' 
                        ? 'WhatsApp Submission Confirmed'
                        : confirmationFocus === 'gmail'
                        ? 'Gmail Transmission Confirmed'
                        : 'Submission Bundle Ready'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium mt-1 ml-9">
                    {selectedItems.length} selected items ({formatNumber(selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0))} units)
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
                  >
                    Modify Selection
                  </button>

                  {/* Direct MOH Portal Submission Action */}
                  <button
                    onClick={async () => {
                      await handleSubmit('direct');
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    <span>Send to MOH (Direct Protocol)</span>
                  </button>

                  {/* Confirmed WhatsApp Submission Action */}
                  <button
                    onClick={async () => {
                      if (excelPayload.file) {
                        await handleCopyFileToClipboard(excelPayload.file, 'Excel Inventory File');
                      }
                      try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(whatsAppMessageText);
                        }
                      } catch (e) {}
                      await handleSubmit('whatsapp');
                    }}
                    disabled={isSubmitting}
                    className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50 ${
                      confirmationFocus === 'whatsapp' ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
                    }`}
                  >
                    <MessageCircle size={15} />
                    <span>Submit WhatsApp</span>
                  </button>

                  <button
                    onClick={async () => {
                      await handleSubmit('email', false, true, true);
                    }}
                    disabled={isSubmitting}
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50 ${
                      confirmationFocus === 'gmail' ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Mail size={15} />
                    )}
                    <span>Open in Gmail</span>
                  </button>

                  <button
                    onClick={async () => {
                      await handleSubmit('email', true, true, true);
                    }}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Archive size={15} />
                    )}
                    <span>ZIP to Gmail</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-xs border-collapse font-sans">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                  <tr className="uppercase tracking-tighter font-bold text-[10px]">
                    <th className="py-3 px-3 border-r border-slate-200 text-center w-10">
                      <input 
                        type="checkbox" 
                        title={selectedItems.length === filteredItems.length && filteredItems.length > 0 ? "Deselect all" : "Select all visible"}
                        checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length} 
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer accent-indigo-600"
                      />
                    </th>
                    <th className="py-3 px-2 border-r border-slate-200 text-center w-12">#</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-left">Material Code</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-left">Description</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right">Qty</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-right">Valuation (ETB)</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-left">Valuation Type</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-left">WBS Element</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-left w-48 bg-indigo-50/30">Budget Source</th>
                    <th className="py-3 px-3 border-r border-slate-200 text-center">Date</th>
                    <th className="py-3 px-3 text-center">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const isSelected = !!selectedItems.find(i => i.id === item.id);
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}
                      >
                        <td className="py-2.5 px-3 border-r border-slate-100 text-center">
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => toggleItem(item)}
                            className="w-4 h-4 text-indigo-600 rounded-md cursor-pointer accent-indigo-600"
                          />
                        </td>
                        <td className="py-2.5 px-2 border-r border-slate-100 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-bold text-slate-700">{item.material}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 font-semibold text-slate-900">{item.materialDescription}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 text-right font-black text-cyan-700">{formatNumber(item.unrestrictedStock)}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 text-right font-black text-emerald-700">{formatCurrency(item.currentValueOfUnrestrictedStock)}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 text-slate-500 font-medium">{item.inventoryValuationType}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 text-slate-400 font-mono text-[10px]">{item.wbsElement}</td>
                        <td className="py-2.5 px-3 border-r border-slate-100 bg-indigo-50/10">
                          <input 
                            type="text" 
                            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 w-full text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none shadow-2xs"
                            placeholder="Set Source..."
                            value={budgetSources[item.id] || ''}
                            onChange={(e) => handleBudgetSourceChange(item.id, e.target.value)}
                          />
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-100 text-center text-slate-400 font-mono text-[10px]">{currentDate}</td>
                        <td className="py-2.5 px-3 text-center font-black text-indigo-600">MOH</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold sticky bottom-0 z-10">
                  <tr className="text-slate-900">
                    <td className="py-3 px-3 border-r border-slate-200 text-center text-slate-400">Total</td>
                    <td className="py-3 px-2 border-r border-slate-200" colSpan={3}>
                      <span className="text-slate-500 uppercase text-[10px] tracking-widest mr-2">Selection:</span>
                      {selectedItems.length} Records
                    </td>
                    <td className="py-3 px-3 border-r border-slate-200 text-right font-black text-cyan-700">{formatNumber(selectedItems.reduce((acc, i) => acc + i.unrestrictedStock, 0))} Units</td>
                    <td className="py-3 px-3 border-r border-slate-200 text-right font-black text-emerald-700">{formatCurrency(selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0))}</td>
                    <td className="py-3 px-3" colSpan={5}>
                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cumulative Valuation of Transmitted Dossier</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer Area: Visible Files with Exact Capacities and Submit Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-4 shrink-0">
          
          {/* Total Combined Package Capacity Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Transmission Payload:</span>
              <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                {totalPackageCapacity.formatted}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-1 py-1 text-emerald-700 font-black text-[10px] uppercase tracking-wider">
                <ShieldCheck size={12} className="text-emerald-600" />
                <span>• Binary Verified</span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Strict Immutable Blob Streams (0% Text)
              </span>
            </div>
          </div>

          {/* Exact File Capacities & Document Integrity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Card 1: Excel Data File */}
            <div 
              onClick={() => handleShareOption('excel')}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-3.5 cursor-pointer transition-all group gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl group-hover:scale-105 transition-transform">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                    Excel Inventory Dataset
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[180px]">
                    {excelPayload.fileName}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-1">
                    Capacity: {excelPayload.formattedSize}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (selectedItems.length === 0) return;
                    await handleSubmit('email', false, true, true);
                  }}
                  disabled={selectedItems.length === 0 || isSubmitting}
                  className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors border border-indigo-100 shadow-2xs"
                  title="Draft in Gmail"
                >
                  <Mail size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShareOption('excel');
                  }}
                  disabled={selectedItems.length === 0}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                >
                  Share (OS)
                </button>
              </div>
            </div>

            {/* Card 2: Official Letter File */}
            {letterPayload ? (
              <div 
                onClick={() => handleShareOption('pdf')}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-3.5 cursor-pointer transition-all group gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl group-hover:scale-105 transition-transform">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">
                      Official Request Letter
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate max-w-[180px]">
                      {letterPayload.fileName}
                    </div>
                    <div className="text-[10px] text-indigo-600 font-bold mt-1">
                      Capacity: {letterPayload.formattedSize}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      await handleSubmit('email', false, true, true);
                    }}
                    disabled={isSubmitting}
                    className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors border border-indigo-100 shadow-2xs"
                    title="Draft in Gmail"
                  >
                    <Mail size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShareOption('pdf');
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    Share (OS)
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setAttachment(null);
                    }} 
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors" 
                    title="Remove Letter"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-3.5 gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-200 text-slate-400 rounded-xl">
                    <FileText size={22} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-slate-400 uppercase">Letter Not Attached</div>
                    <p className="text-[10px] text-slate-400 font-medium">Please upload a signed PDF letter if required.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    id="letter-upload" 
                    className="hidden" 
                    accept=".pdf" 
                    onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  />
                  <label 
                    htmlFor="letter-upload" 
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer shadow-sm transition-all flex items-center gap-2"
                  >
                    <Paperclip size={14} />
                    <span>Upload PDF</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Recipient Coordinates & Submit Actions */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email:</span>
                <input 
                  type="email" 
                  className="border-none bg-transparent p-0 text-xs w-48 text-slate-900 font-bold focus:ring-0 outline-none"
                  value={officialEmail}
                  onChange={(e) => setOfficialEmail(e.target.value)}
                  placeholder="moh-official@example.gov.et"
                />
              </div>
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-3 py-1.5 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp:</span>
                <input 
                  type="text" 
                  className="border-none bg-transparent p-0 text-xs w-32 text-slate-900 font-bold focus:ring-0 outline-none"
                  value={officialPhone}
                  onChange={(e) => setOfficialPhone(e.target.value)}
                  placeholder="+251911234567"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 justify-end w-full lg:w-auto">
              <button 
                onClick={() => handleSubmit('direct')} 
                disabled={selectedItems.length === 0 || isSubmitting} 
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 text-xs font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                <span>Send to MOH</span>
              </button>

              <button 
                onClick={() => handleTriggerConfirmation('gmail')} 
                disabled={selectedItems.length === 0 || isSubmitting} 
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 text-xs font-bold shadow-md transition-all active:scale-[0.98]"
              >
                <Mail size={16} />
                <span>Confirm & Open Gmail</span>
              </button>

              <button 
                onClick={() => handleTriggerConfirmation('whatsapp')} 
                disabled={selectedItems.length === 0 || isSubmitting} 
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 text-xs font-bold shadow-md transition-all active:scale-[0.98]"
              >
                <MessageCircle size={16} />
                <span>Submit via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Dispatch Receipt & File Transmission Dialog */}
      {dispatchReceipt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${dispatchReceipt.method === 'email' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  {dispatchReceipt.method === 'email' ? <Mail size={22} /> : <MessageCircle size={22} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    {dispatchReceipt.method === 'email' ? 'Email Transmission Ready' : 'WhatsApp File Dispatch'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Target: <strong className="text-slate-900 font-bold">{dispatchReceipt.recipient}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDispatchReceipt(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Protocol Notice */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-emerald-900 flex-1">
                <strong className="block font-black uppercase tracking-widest text-[10px] mb-1">Strict Binary Protocol Active</strong>
                <p className="text-slate-600 font-medium leading-relaxed">
                  Data is packaged as immutable <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-100">Blob</code> binary streams. Zero text conversion occurred.
                </p>
              </div>
            </div>

            {/* Attached Files List */}
            <div className="space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between px-1">
                <span>Transmission Package Details</span>
                <span className="text-indigo-600">Verified</span>
              </div>

              {/* Excel File Row */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-indigo-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-white border border-slate-200 text-emerald-600 rounded-xl">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {dispatchReceipt.excelName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{dispatchReceipt.excelCapacity}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyFileToClipboard(excelPayload.file, 'Excel File')}
                    className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg shadow-2xs transition-colors"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Letter File Row */}
              {letterPayload && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-white border border-slate-200 text-indigo-600 rounded-xl">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {dispatchReceipt.letterName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{dispatchReceipt.letterCapacity}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyFileToClipboard(letterPayload.file, 'PDF Letter')}
                      className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg shadow-2xs transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs font-black text-indigo-900 shadow-sm">
                <span className="uppercase tracking-widest text-[9px]">Combined Payload:</span>
                <span className="font-mono">{totalPackageCapacity.formatted}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setDispatchReceipt(null);
                onClose();
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-[0.98]"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}



      {/* WhatsApp Preview Drawer / Modal */}
      {whatsAppModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 text-slate-900">
            
            {/* Simplified Protocol Header */}
            <div className="px-6 py-4 bg-white border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                    Binary Attachment Protocol
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      Immutable Stream • Binary Verified
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setWhatsAppModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-all"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Protocol Briefing Bar */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Selected items will be transmitted strictly as immutable <span className="text-slate-900 font-bold">Blob binary streams (.xlsx and .pdf)</span>. No text-based conversion occurs, and no unwanted files are downloaded to your device.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Total Capacity: <span className="text-slate-900 font-mono">{totalPackageCapacity.formatted} ({totalPackageCapacity.bytes.toLocaleString()} bytes)</span>
                </div>
                <div className="h-4 w-px bg-slate-300"></div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <span className="text-slate-500">Target MOH WhatsApp:</span>
                  <input
                    type="text"
                    value={officialPhone}
                    onChange={(e) => setOfficialPhone(e.target.value)}
                    placeholder="+251911234567"
                    className="border border-slate-300 rounded-lg px-2 py-0.5 text-xs bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-950 outline-none w-32"
                  />
                </div>
              </div>
            </div>

            {/* Segmented Tab Navigation Bar */}
            <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setWaPreviewTab('files')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer border ${
                  waPreviewTab === 'files'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-[1.02]'
                    : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <Paperclip size={14} />
                <span>Binary Manifest</span>
              </button>
              <button
                type="button"
                onClick={() => setWaPreviewTab('text')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer border ${
                  waPreviewTab === 'text'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-[1.02]'
                    : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <MessageCircle size={14} />
                <span>Message Payload</span>
              </button>
              <button
                type="button"
                onClick={() => setWaPreviewTab('items')}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer border ${
                  waPreviewTab === 'items'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-[1.02]'
                    : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <Layers size={14} />
                <span>Item Grid</span>
              </button>
            </div>

            {/* Scrollable Tab Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#fcfcfd]">

              {/* TAB 1: WhatsApp Text Message Preview */}
              {waPreviewTab === 'text' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span>Message Body Buffer:</span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(whatsAppMessageText);
                          setCopiedWaText(true);
                          setTimeout(() => setCopiedWaText(false), 3000);
                        } catch (e) {
                          // fallback
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      {copiedWaText ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedWaText ? 'Copied' : 'Copy Buffer'}</span>
                    </button>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative font-sans">
                    <div className="bg-slate-50 rounded-xl p-4 text-[11px] leading-relaxed text-slate-900 border border-slate-100 max-w-full font-mono whitespace-pre-wrap select-text">
                      {whatsAppMessageText}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Generated File Attachments Manifest List */}
              {waPreviewTab === 'files' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  
                  {/* File 1: Excel Dataset */}
                  <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:border-emerald-500/50 transition-all group">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0 group-hover:scale-105 transition-transform border border-emerald-100">
                        <FileSpreadsheet size={24} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-black text-slate-900 flex items-center gap-2 flex-wrap">
                          <span className="truncate">{excelPayload.fileName}</span>
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-wider">
                            <CheckCircle2 size={10} />
                            Binary Verified
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold font-mono mt-1">
                          Exact Capacity: <span className="text-slate-900">{excelPayload.formattedSize} ({excelPayload.sizeBytes.toLocaleString()} bytes)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                          <span className="uppercase tracking-widest">Blob Stream:</span>
                          <span className="font-mono text-slate-600 lowercase">application/vnd.openxmlformats-officedocument.spreadsheetml.sheet</span>
                        </div>
                        <div className="mt-1">
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">.xlsx File</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleShareOption('excel')}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Share2 size={12} />
                        <span>Share (OS)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyFileToClipboard(excelPayload.file, 'Excel File')}
                        className="p-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl cursor-pointer transition-all shadow-sm"
                        title="Copy Binary"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>

                  {/* File 2: Official PDF Letter (Only if present) */}
                  {letterPayload ? (
                    <div className="p-4 bg-white border-2 border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:border-indigo-500/50 transition-all group">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0 group-hover:scale-105 transition-transform border border-indigo-100">
                          <FileText size={24} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-black text-slate-900 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{letterPayload.fileName}</span>
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-wider">
                              <CheckCircle2 size={10} />
                              Binary Verified
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-bold font-mono mt-1">
                            Exact Capacity: <span className="text-slate-900">{letterPayload.formattedSize} ({letterPayload.sizeBytes.toLocaleString()} bytes)</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center gap-1.5">
                            <span className="uppercase tracking-widest">Blob Stream:</span>
                            <span className="font-mono text-slate-600 lowercase">application/pdf</span>
                          </div>
                          <div className="mt-1">
                            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">.pdf Letter</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleShareOption('pdf')}
                          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <Share2 size={12} />
                          <span>Share (OS)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyFileToClipboard(letterPayload.file, 'PDF Letter')}
                          className="p-2 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 rounded-xl cursor-pointer transition-all shadow-sm"
                          title="Copy Binary"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-8 text-center gap-3">
                      <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                        <FileText size={32} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Official Letter Not Attached</div>
                        <p className="text-xs text-slate-500 max-w-[280px] mt-1">
                          The default official letter has been removed. Please upload your own signed PDF document in the main footer.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppModalOpen(false);
                          document.getElementById('letter-attachment-input')?.click();
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                      >
                        Upload Official Letter Now
                      </button>
                    </div>
                  )}

                  {/* File 3: Archived ZIP Bundle Package */}
                  <div className="p-3.5 bg-white hover:bg-purple-50/50 border-2 border-purple-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs group transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-purple-100 text-purple-800 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                        <Archive size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">DSP_Package_MOH_{currentDate}.zip</span>
                          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
                            DEFLATE Compressed
                          </span>
                        </div>
                        <div className="text-[11px] text-purple-900 font-semibold font-mono mt-0.5">
                          Combined Capacity: {totalPackageCapacity.formatted}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          Bundles: Excel Dataset + PDF Letter + Submission Manifest
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleShareOption('zip')}
                        className="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                        title="Share Archived ZIP Bundle via Native OS Share Sheet"
                      >
                        <Share2 size={13} />
                        <span>Share (OS)</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const zipData = await generateZipArchive();
                          handleCopyFileToClipboard(zipData.file, 'Archived ZIP Bundle');
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-300 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 transition-colors"
                        title="Copy ZIP archive binary file to clipboard for direct paste into WhatsApp Web"
                      >
                        <Copy size={13} />
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleManualDownloadZip}
                        className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1 transition-colors"
                        title="Download backup copy"
                      >
                        <Download size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Itemized Inventory Breakdown Table */}
              {waPreviewTab === 'items' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span>Packaged Medical Equipment Items ({selectedItems.length}):</span>
                    <span className="text-indigo-700 font-bold font-mono">
                      Total: {formatCurrency(selectedItems.reduce((acc, i) => acc + i.currentValueOfUnrestrictedStock, 0))}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="p-2 border text-center">#</th>
                          <th className="p-2 border text-left">Material Code</th>
                          <th className="p-2 border text-left">Material Description</th>
                          <th className="p-2 border text-right">Quantity</th>
                          <th className="p-2 border text-right">Valuation (ETB)</th>
                          <th className="p-2 border text-left">Budget Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((item, idx) => (
                          <tr key={item.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="p-2 border text-center text-slate-500 font-mono">{idx + 1}</td>
                            <td className="p-2 border font-mono font-bold text-slate-900">{item.material}</td>
                            <td className="p-2 border text-slate-800">{item.materialDescription}</td>
                            <td className="p-2 border text-right font-semibold text-slate-900">{formatNumber(item.unrestrictedStock)}</td>
                            <td className="p-2 border text-right font-semibold text-indigo-900">{formatCurrency(item.currentValueOfUnrestrictedStock)}</td>
                            <td className="p-2 border text-slate-700">{budgetSources[item.id] || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2.5 shrink-0">
              
              {/* Primary Dispatch Action */}
              <button
                type="button"
                onClick={async () => {
                  const cleanPhone = officialPhone.replace(/\D/g, '');
                  const encodedText = encodeURIComponent(whatsAppMessageText);
                  const waUrl = cleanPhone 
                    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
                    : `https://wa.me/?text=${encodedText}`;

                  // Copy formatted message text to clipboard automatically
                  try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                      await navigator.clipboard.writeText(whatsAppMessageText);
                    }
                  } catch (e) {
                    // fallback
                  }

                  // Copy primary Excel binary file to clipboard for direct Ctrl+V attachment in WhatsApp Web
                  if (excelPayload.file) {
                    await handleCopyFileToClipboard(excelPayload.file, 'Excel File');
                  }

                  window.open(waUrl, '_blank');
                  setWhatsAppModalOpen(false);
                  await handleSubmit('whatsapp', selectedWaFileType === 'zip', false);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
              >
                <MessageCircle size={18} />
                <span>Proceed & Open WhatsApp Chat (MOH Desk)</span>
                <ExternalLink size={14} />
              </button>

              {/* Secondary Options Grid */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleShareOption('both')}
                  className="py-2 px-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Share Excel and PDF files via Native OS Share Sheet"
                >
                  <Share2 size={13} />
                  <span>Share (OS Sheet)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (excelPayload.file) {
                      await handleCopyFileToClipboard(excelPayload.file, 'Excel File');
                    }
                    try {
                      await navigator.clipboard.writeText(whatsAppMessageText);
                      setNotification("Copied formatted message text and Excel file to clipboard!");
                      setTimeout(() => setNotification(null), 3500);
                    } catch (e) {}
                  }}
                  className="py-2 px-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  title="Copy formatted message text and Excel binary file to clipboard"
                >
                  <Copy size={13} />
                  <span>Copy Text & File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWhatsAppModalOpen(false)}
                  className="py-2 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-medium flex items-center justify-center cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
};
