import { ArrowLeft, RefreshCw } from 'lucide-react';
import { BrandMark } from './BrandMark';
import { Link } from '../router';
import { useResolvedTheme } from '../lib/theme';
import { useApp } from '../state/ui-context';

export default function NotFoundPage({ title = 'Tampilan tidak dapat dimuat.', description = 'Halaman yang kamu cari tidak tersedia atau sudah dipindahkan.' }) {
  const { prefs } = useApp();
  const theme = useResolvedTheme(prefs?.theme || 'system');
  return <main className={`not-found-page theme-${theme}`}>
    <div className="not-found-card">
      <BrandMark className="not-found-mark" alt="" />
      <span className="not-found-eyebrow">LAPRAKIN · 404</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="not-found-actions">
        <button type="button" onClick={() => window.location.reload()}><RefreshCw size={14} />Muat ulang</button>
        <Link to="/"><ArrowLeft size={14} />Kembali ke beranda</Link>
      </div>
    </div>
  </main>;
}
