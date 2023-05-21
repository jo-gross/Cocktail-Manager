import React from 'react';

interface SingleFormLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SingleFormLayout(props: SingleFormLayoutProps) {
  return (
    <div className={'grid xl:grid-cols-3 grid-cols-1 xl:p-12 p-2 xl:gap-4 gap-2'}>
      <div></div>
      <div className={'card'}>
        <div className={'card-body'}>
          <div className={'text-2xl font-bold text-center'}>{props.title}</div>
          <div className={'divider'}></div>
          {props.children}
        </div>
      </div>
    </div>
  );
}
