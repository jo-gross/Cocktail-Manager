import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { alertService } from '@lib/alertService';
import { $Enums, Signage } from '@generated/prisma/client';
import { PageCenter } from '@components/layout/PageCenter';
import { Loading } from '@components/Loading';
import Image from 'next/image';
import MonitorFormat = $Enums.MonitorFormat;

export default function SignagePage() {
  const format: MonitorFormat =
    typeof window !== 'undefined' && window.matchMedia('(orientation: portrait)').matches ? MonitorFormat.PORTRAIT : MonitorFormat.LANDSCAPE;
  const router = useRouter();

  const { id } = router.query;

  const [content, setContent] = useState<Signage>();
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  const fetchData = useCallback(() => {
    if (!id) return;
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
  }, [id, format]);

  useEffect(() => {
    if (!imageLoading && !content) {
      fetchData();
    }
  }, [content, fetchData, imageLoading]);

  return (
    <div style={content?.backgroundColor ? { backgroundColor: content.backgroundColor } : {}} className={'h-screen w-screen'}>
      <PageCenter>
        {imageLoading ? (
          <Loading />
        ) : content?.content ? (
          <Image src={content.content} layout={'fill'} objectFit={'contain'} alt={'Horizontal monitor'} />
        ) : (
          <div>Keine Karte gefunden</div>
        )}
      </PageCenter>
    </div>
  );
}
