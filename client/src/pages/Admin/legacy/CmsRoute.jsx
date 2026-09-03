import { useCallback, useState } from 'react';
import { api } from '../../../api';
import { useI18n } from '../../../i18n/context';
import { AdminLandingCmsPanel } from '../AdminLegacyContentPanels';
import { AdminRouteState, useAdminRouteResource } from './shared';

export default function CmsRoute({ setNotice }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => (await api('/admin/cms/landing')).landing || null, []);
  const resource = useAdminRouteResource(load);
  const setLanding = resource.setData;
  const updateLandingMedia = (patch) => setLanding((current) => ({ ...current, media: { ...(current?.media || {}), ...patch } }));
  const uploadLandingMedia = async (event, target) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api('/admin/cms/landing-media', { method: 'POST', body: form, form: true });
      const patches = {
        hero: { heroImageUrl: result.media.url },
        'compare-ai': { compareAiPdfUrl: result.media.url, compareBasicAiPdfUrl: result.media.url },
        'compare-basic-ai': { compareAiPdfUrl: result.media.url, compareBasicAiPdfUrl: result.media.url },
        'compare-laprakin': { compareLaprakinPdfUrl: result.media.url, compareBasicLaprakinPdfUrl: result.media.url },
        'compare-basic-laprakin': { compareLaprakinPdfUrl: result.media.url, compareBasicLaprakinPdfUrl: result.media.url },
        'compare-thinking-ai': { compareThinkingAiPdfUrl: result.media.url },
        'compare-thinking-laprakin': { compareThinkingLaprakinPdfUrl: result.media.url },
        'compare-xtrathink-ai': { compareXtraThinkAiPdfUrl: result.media.url },
        'compare-xtrathink-laprakin': { compareXtraThinkLaprakinPdfUrl: result.media.url },
        'compare-video': { compareVideoUrl: result.media.url },
        'tutorial-video': { tutorialVideoUrl: result.media.url },
      };
      updateLandingMedia(patches[target] || {});
      setNotice(t('admin.console.notices.mediaUploaded'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  const saveLanding = async () => {
    if (!resource.data) return;
    setBusy(true);
    try {
      const data = await api('/admin/cms/landing', { method: 'PUT', body: resource.data });
      setLanding(data.landing);
      setNotice(t('admin.console.notices.landingPublished'));
    } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  };
  return <AdminRouteState resource={resource}>{(landing) => <AdminLandingCmsPanel landing={landing} setLanding={setLanding} updateLandingMedia={updateLandingMedia} uploadLandingMedia={uploadLandingMedia} saveLanding={saveLanding} busy={busy}/>}</AdminRouteState>;
}
