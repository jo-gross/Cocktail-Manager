import React from "react";

interface SingleFormLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function SingleFormLayout(props: SingleFormLayoutProps) {
  return <div className={"grid md:grid-cols-3 grid-cols-1 p-12 gap-4"}>
    <div></div>
    <div className={"card"}>
      <div className={"card-body"}>
        <div className={"text-2xl font-bold text-center"}>{props.title}</div>
        <div className={"divider"}></div>
        {props.children}
      </div>
    </div>
  </div>;
}
