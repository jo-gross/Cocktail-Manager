import React from 'react';

interface SingleFormLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SingleFormLayout(props: SingleFormLayoutProps) {
  return (
    <div className={'flex w-full flex-col items-center gap-2 p-2 xl:gap-4 xl:p-12'}>
      <div className={'card w-fit'}>
        <div className={'card-body'}>
          <div className={'text-center text-2xl font-bold'}>{props.title}</div>
          <div className={'divider'}></div>
          {props.children}
        </div>
      </div>
    </div>
  );
}
