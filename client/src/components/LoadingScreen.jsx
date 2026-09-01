import { LoaderCircle } from 'lucide-react';

export default function LoadingScreen() {
  return <div className="loading-screen" role="status" aria-live="polite"><LoaderCircle className="spin" size={20} /><span>Menyiapkan Laprakin...</span></div>;
}
