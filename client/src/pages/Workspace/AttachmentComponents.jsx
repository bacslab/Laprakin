import { useEffect, useRef, useState } from 'react';
import { FileText, Plus, X } from 'lucide-react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../../api';
import { inferPendingAttachmentKind } from '../../lib/attachments';

function PdfThumbnail({ url = '', file = null, size = 58 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    let active = true;
    let loadingTask;
    let renderTask;
    const render = async () => {
      const { GlobalWorkerOptions, getDocument: getPdfDocument } = await import('pdfjs-dist/build/pdf.mjs');
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const source = file
        ? { data: new Uint8Array(await file.arrayBuffer()) }
        : { url, withCredentials: true };
      loadingTask = getPdfDocument(source);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      if (!active || !canvasRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: size / baseViewport.width });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = canvasRef.current;
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${Math.ceil(viewport.width)}px`;
      canvas.style.height = `${Math.ceil(viewport.height)}px`;
      renderTask = page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      });
      await renderTask.promise;
    };
    render().catch(() => {});
    return () => {
      active = false;
      try { renderTask?.cancel(); } catch {}
      loadingTask?.destroy();
    };
  }, [file, size, url]);
  return <canvas className="pdf-thumbnail-canvas" ref={canvasRef} aria-hidden="true" />;
}

export function AttachmentThumbnail({ file }) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const image = String(file.mime_type || file.detected_mime || '').startsWith('image/');
  const extension = String(file.original_name || file.name || 'FILE').split('.').pop()?.toUpperCase().slice(0, 5) || 'FILE';
  const pdf = extension === 'PDF' || file.mime_type === 'application/pdf';
  const textDocument = ['TXT', 'MD', 'CSV', 'JSON', 'XLSX'].includes(extension);
  const visualPreview = !previewFailed && (image || extension === 'DOCX');
  useEffect(() => {
    if (!file?.id || (!textDocument && !(extension === 'DOCX' && previewFailed))) return;
    let active = true;
    api(`/chat/attachments/${file.id}/text-preview`)
      .then((data) => { if (active) setExcerpt(String(data.text || '').slice(0, 180)); })
      .catch(() => { if (active) setExcerpt(''); });
    return () => { active = false; };
  }, [file?.id, extension, previewFailed, textDocument]);
  if (pdf) {
    return <span className="attachment-thumb pdf"><PdfThumbnail url={`/api/chat/attachments/${file.id}/preview`} /></span>;
  }
  if (visualPreview) {
    return <span className="attachment-thumb image"><img src={`/api/chat/attachments/${file.id}/preview`} alt={`Preview ${file.original_name || 'lampiran'}`} onError={() => setPreviewFailed(true)} /></span>;
  }
  if (excerpt) {
    return <span className="attachment-thumb text-document"><i>{excerpt}</i><small>{extension}</small></span>;
  }
  return <span className="attachment-thumb document"><FileText size={17} /><small>{extension}</small></span>;
}

export function PendingAttachmentChip({ file, index, onRemove }) {
  const [preview, setPreview] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const pdf = file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '');
  useEffect(() => {
    if (file?.type?.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (/\.(?:txt|md|csv|json)$/i.test(file?.name || '')) {
      let active = true;
      file.text().then((text) => { if (active) setExcerpt(text.replace(/\s+/g, ' ').trim().slice(0, 90)); });
      return () => { active = false; };
    }
    return undefined;
  }, [file]);
  return <span className="pending-file-chip">{pdf ? <PdfThumbnail file={file} size={34} /> : preview ? <img src={preview} alt="" /> : excerpt ? <i>{excerpt}</i> : <FileText size={12} />}<b>{file.name}</b><button type="button" onClick={() => onRemove(index)} aria-label={`Hapus ${file.name}`}><X size={11} /></button></span>;
}

export function SourceBar({ attachments, onOpen, onAdd, compact = false }) {
  return <section className={`source-bar ${compact ? 'message-source-bar' : ''} ${attachments.length > 1 ? 'has-many' : ''}`} aria-label="Bahan terlampir">
    <div className="source-preview-list">{attachments.map((file) => {
      const detectedKind = ['module', 'unknown'].includes(file.kind) ? inferPendingAttachmentKind({ name: file.original_name, type: file.mime_type }) : file.kind;
      return <button type="button" className="source-preview-item" key={file.id} onClick={() => onOpen(file)} title={`Preview ${file.original_name}`}><AttachmentThumbnail file={file} /><span><b>{file.original_name}</b><small>{detectedKind === 'practice_evidence' || detectedKind === 'evidence' ? 'Bukti praktik' : detectedKind === 'module' ? 'Modul' : 'Bahan'}</small></span></button>;
    })}</div>
    {onAdd && <div className="source-bar-actions"><button type="button" onClick={onAdd}><Plus size={13} />Tambah file</button></div>}
  </section>;
}
