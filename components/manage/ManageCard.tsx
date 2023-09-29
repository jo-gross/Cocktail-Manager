import Link from 'next/link';

interface ManageCardProps {
  title: string;
  link: string;
}

export function ManageCard(props: ManageCardProps) {
  return (
    <div className={'card'}>
      <div className={'card-body flex flex-row justify-between'}>
        <div className={'card-title'}>{props.title}</div>
        <Link href={props.link}>
          <div className={'btn btn-primary'}>Verwalten</div>
        </Link>
      </div>
    </div>
  );
}
