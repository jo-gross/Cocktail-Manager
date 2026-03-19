import React from 'react';

interface FormModalProps<_T> {
  form: React.JSX.Element;
  title: string;
}

export default function FormModal<T>(props: FormModalProps<T>) {
  return (
    <div>
      <div className={'text-2xl font-bold'}>{props.title}</div>
      {props.form}
    </div>
  );
}
