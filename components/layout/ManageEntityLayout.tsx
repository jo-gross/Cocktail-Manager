import { FaArrowLeft } from 'react-icons/fa';
import Link from 'next/link';
import Head from 'next/head';
import React from 'react';

interface ManageEntityLayoutProps {
  children: React.ReactNode;
  backLink: string;
  title?: string | React.ReactNode;
  actions?: React.ReactNode;
}

export function ManageEntityLayout(props: ManageEntityLayoutProps) {
  return (
    <>
      <Head>
        <>
          {typeof props.title === 'string' ? (
            <title>{`${props.title} - The Cocktail-Manager`}</title>
          ) : (
            <title>The Cocktail-Manager</title>
          )}
        </>
      </Head>
      <div className={'flex flex-col md:p-4 p-1 print:p-1'}>
        <div className={'grid grid-cols-3 print:grid-cols-1 w-full justify-center items-center justify-items-center'}>
          <div className={'col-span-1 justify-self-start print:hidden'}>
            <Link href={props.backLink}>
              <div className={'btn btn-primary btn-square rounded-xl'}>
                <FaArrowLeft />
              </div>
            </Link>
          </div>
          <div className={'justify-items-center text-3xl font-bold print:text-2xl'}>{props.title}</div>
          <div className={'justify-self-end space-x-2 items-center flex print:hidden'}>{props.actions}</div>
        </div>
        <div className={'md:p-8 p-2 print:p-2'}>{props.children}</div>
      </div>
    </>
  );
}
