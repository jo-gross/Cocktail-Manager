import { $Enums } from '.prisma/client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { alertService } from '../lib/alertService';
import { Signage } from '@prisma/client';
import { PageCenter } from '../components/layout/PageCenter';
import { Loading } from '../components/Loading';
import MonitorFormat = $Enums.MonitorFormat;

export default function SignagePage() {
  const format: MonitorFormat =
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches ? MonitorFormat.PORTRAIT : MonitorFormat.LANDSCAPE;
  const router = useRouter();

  const { id } = router.query;

  const [content, setContent] = useState<Signage>();
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    if (!imageLoading) {
      setImageLoading(true);
      fetch(`/api/signage/${id}?format=${format}`)
        .then((response) => response.json())
        .then((data) => {
          setContent(data.content);
          setImageLoading(false);
        })
        .catch((error) => {
          console.error('Signage', error);
          alertService.error('Fehler beim Laden der Karte.');
        })
        .finally(() => {
          setImageLoading(false);
        });
    }
  }, [id, format]);

  return (
    <div style={content?.backgroundColor ? { backgroundColor: content.backgroundColor } : {}} className={'h-screen w-screen'}>
      <PageCenter>
        {imageLoading ? (
          <Loading />
        ) : content?.content ? (
          <img src={content?.content} alt={'Keine Karte gefunden.'} className={'h-full w-full object-contain'} />
        ) : (
          <div>Keine Karte gefunden</div>
        )}
      </PageCenter>
    </div>
  );
}
