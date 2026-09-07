import { LoaderCircle } from '../icons';
import { useI18n } from '../i18n/context';

export default function LoadingScreen() {
  const { t } = useI18n();
  return <div className="loading-screen" role="status" aria-live="polite"><LoaderCircle className="spin" size={20} /><span>{t('common.loading')}</span></div>;
}
