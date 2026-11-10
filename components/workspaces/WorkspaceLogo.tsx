import Image from 'next/image';
import { useTranslation } from 'react-i18next';

/** Keep the whole logo visible, without the cover/blur treatment of profile avatars. */
export function WorkspaceLogo({ image, name, className = 'h-16 w-16' }: { image?: string | null; name: string; className?: string }) {
  const { t } = useTranslation('settings');
  if (!image) return null;
  // Relative image paths can consist entirely of base64 characters, too.
  // JPEG is the only supported raw image format whose signature starts with '/'.
  const isLegacyBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(image) && (!image.startsWith('/') || image.startsWith('/9j/'));
  const src = isLegacyBase64 ? `data:image/png;base64,${image}` : image;
  return <Image src={src} alt={t('logo.alt', { name })} width={512} height={512} unoptimized className={`shrink-0 rounded-lg object-contain ${className}`} />;
}
