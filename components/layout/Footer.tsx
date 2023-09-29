import Link from 'next/link';

export default function Footer() {
  return (
    <div className={'flex items-center space-x-2'}>
      <span>by</span>
      <Link className={'link font-bold'} href={''}>
        Johannes Groß
      </Link>
    </div>
  );
}
