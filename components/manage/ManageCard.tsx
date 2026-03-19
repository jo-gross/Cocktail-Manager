import Link from 'next/link';
import React from 'react';

interface ManageCardProps {
  title: string;
  icon?: React.JSX.Element;
  link: string;
}

export function ManageCard(props: ManageCardProps) {
  return (
    <div className={'card'}>
      <div className={'card-body flex flex-row justify-between'}>
        <div className={'card-title'}>
          {props.icon}
          {props.title}
        </div>
        <Link href={props.link}>
          <div className={'btn btn-primary'}>Verwalten</div>
        </Link>
      </div>
    </div>
  );
}
