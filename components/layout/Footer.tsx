import Link from 'next/link';

export default function Footer() {
  return (
    <div className={'flex items-center gap-2'}>
      <span>by</span>
      <Link className={'font-bold text-primary underline-offset-2 hover:underline'} href={''}>
        Johannes Groß
      </Link>
    </div>
  );
}
