import { useEffect, useRef, useState } from 'react';
import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { renderAsync as renderDocx } from 'docx-preview';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from '../../api';
import { IconButton } from '../../components/IconButton';

/**
 * Preview PDF yang seluruh halamannya dirender berurutan ke bawah.
 *
 * Satu effect memegang seluruh siklus hidup dokumen PDF supaya operasi yang
 * masih tertunda ditangani saat modal ditutup dan tidak menjadi unhandled rejection.
 */
function PdfAttachmentPreview({ file }) {
  const containerRef = useRef(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let pdf = null;
    const container = containerRef.current;
    setError('');
    setPageCount(0);

    const renderAll = async () => {
      try {
        const { GlobalWorkerOptions, getDocument: getPdfDocument } = await import('pdfjs-dist/build/pdf.mjs');
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        pdf = await getPdfDocument({ url: `/api/chat/attachments/${file.id}/file`, withCredentials: true }).promise;
        if (disposed) return;
        setPageCount(pdf.numPages);
        for (let number = 1; number <= pdf.numPages; number += 1) {
          if (disposed || !container) return;
          const page = await pdf.getPage(number);
          if (disposed || !container) return;
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement('canvas');
          canvas.className = 'attachment-pdf-page';
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
      } catch (previewError) {
        if (!disposed && previewError?.name !== 'RenderingCancelledException') setError('PDF tidak dapat ditampilkan.');
      }
    };
    renderAll();

    return () => {
      disposed = true;
      try { pdf?.destroy?.()?.catch?.(() => {}); } catch { /* sudah terlanjur tertutup */ }
      if (container) container.replaceChildren();
    };
  }, [file.id]);

  return <div className="attachment-pdf-preview">
    {error && <div className="attachment-preview-error"><CircleAlert size={17}/>{error}</div>}
    <div ref={containerRef} className="attachment-pdf-pages" aria-label={pageCount ? `Dokumen ${pageCount} halaman` : 'Memuat dokumen'} />
  </div>;
}

function DocxAttachmentPreview({ file }) {
  const hostRef = useRef(null);
  const renderRef = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const render = async () => {
      try {
        setStatus('loading');
        const response = await fetch(`/api/chat/attachments/${file.id}/file`, { credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) throw new Error('Dokumen Word tidak dapat dimuat.');
        const blob = await response.blob();
        if (disposed || !renderRef.current) return;
        renderRef.current.replaceChildren();
        await renderDocx(blob, renderRef.current, undefined, {
          className: 'laprakin-source-docx',
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          experimental: true,
        });
        if (!disposed) setStatus('ready');
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') setStatus(error.message || 'Dokumen Word tidak dapat ditampilkan.');
      }
    };
    render();
    return () => { disposed = true; controller.abort(); };
  }, [file.id]);
  useEffect(() => {
    if (status !== 'ready' || !hostRef.current || !renderRef.current) return undefined;
    const resize = () => {
      const available = Math.max(300, hostRef.current.clientWidth - 20);
      renderRef.current.style.zoom = String(Math.min(1, available / 816));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [status]);
  return <div className="attachment-docx-preview" ref={hostRef}>
    {status === 'loading' && <div className="attachment-preview-loading"><LoaderCircle className="spin" size={17}/>Memuat dokumen Word asli...</div>}
    {status !== 'loading' && status !== 'ready' && <div className="attachment-preview-error"><CircleAlert size={17}/>{status}</div>}
    <div className={status === 'ready' ? 'is-ready' : 'is-loading'} ref={renderRef} />
  </div>;
}

function TextAttachmentPreview({ file, extension }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        if (extension === 'XLSX') {
          const result = await api(`/chat/attachments/${file.id}/text-preview`);
          if (!disposed) setContent(result.text || '');
          return;
        }
        const response = await fetch(`/api/chat/attachments/${file.id}/file`, { credentials: 'same-origin' });
        if (!response.ok) throw new Error();
        const text = await response.text();
        if (!disposed) setContent(text.slice(0, 200000));
      } catch {
        if (!disposed) setError('Isi file tidak dapat ditampilkan.');
      }
    };
    load();
    return () => { disposed = true; };
  }, [extension, file.id]);
  if (error) return <div className="attachment-preview-error"><CircleAlert size={17}/>{error}</div>;
  if (!content) return <div className="attachment-preview-loading"><LoaderCircle className="spin" size={17}/>Memuat isi file...</div>;
  return <pre className="attachment-text-preview">{content}</pre>;
}

export default function AttachmentPreviewModal({ file, onClose }) {
  const extension = String(file.original_name || '').split('.').pop()?.toUpperCase() || '';
  const mimeType = String(file.detected_mime || file.mime_type || '');
  const image = mimeType.startsWith('image/') || ['PNG', 'JPG', 'JPEG', 'WEBP'].includes(extension);
  return <div className="attachment-preview-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="attachment-preview-modal" role="dialog" aria-modal="true" aria-label={`Preview ${file.original_name}`}>
      <header><div><small>Preview file asli</small><b>{file.original_name}</b></div><IconButton label="Tutup preview" onClick={onClose}><X size={17}/></IconButton></header>
      <div className="attachment-preview-body">
        {extension === 'PDF' || mimeType === 'application/pdf'
          ? <PdfAttachmentPreview file={file} />
          : extension === 'DOCX'
            ? <DocxAttachmentPreview file={file} />
            : image
              ? <img className="attachment-image-preview" src={`/api/chat/attachments/${file.id}/file`} alt={file.original_name} />
              : <TextAttachmentPreview file={file} extension={extension} />}
      </div>
    </section>
  </div>;
}
