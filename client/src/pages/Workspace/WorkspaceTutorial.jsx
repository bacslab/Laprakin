import { useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';

export default function WorkspaceTutorial({ onClose }) {
  const steps = [
    { title: 'Ceritakan tugasmu', description: 'Tulis jenis tugas, mata kuliah, dan topik praktik secara singkat di kotak chat.', video: '/tutorial/alur-1.webm' },
    { title: 'Tambahkan bahan utama', description: 'Unggah modul, instruksi dosen, atau template supaya susunannya mengikuti bahan yang benar.', video: '/tutorial/alur-2.webm' },
    { title: 'Lengkapi bukti praktik', description: 'Tambahkan screenshot, foto hasil, data, atau dokumentasi yang memang kamu miliki.', video: '/tutorial/alur-3.webm' },
    { title: 'Review sampai siap diunduh', description: 'Periksa draft, minta revisi bila perlu, lalu selesaikan cek pemahaman untuk membuka download.', video: '/tutorial/alur-4.webm' },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  return <div className="tutorial-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="workspace-tutorial" role="dialog" aria-modal="true" aria-labelledby="workspace-tutorial-title">
      <header><div><small>Langkah {stepIndex + 1} dari {steps.length}</small><h2 id="workspace-tutorial-title">{step.title}</h2><p>{step.description}</p></div><IconButton label="Tutup tutorial" onClick={onClose}><X size={17} /></IconButton></header>
      <div className="tutorial-progress" aria-label={`Langkah ${stepIndex + 1} dari ${steps.length}`}>{steps.map((item, index) => <span key={item.title} className={index <= stepIndex ? 'active' : ''} />)}</div>
      <div className="tutorial-video">
        <video key={step.video} src={step.video} autoPlay muted loop playsInline controls preload="metadata" aria-label={`Video ${step.title}`} />
      </div>
      <footer>
        <button type="button" className="tutorial-previous" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}><ArrowLeft size={15} />Sebelumnya</button>
        <Button type="button" onClick={() => { if (isLastStep) onClose(); else setStepIndex((value) => value + 1); }}>{isLastStep ? 'Mulai chat' : 'Lanjut'}{!isLastStep && <ArrowRight size={15} />}</Button>
      </footer>
    </section>
  </div>;
}
