interface PageCenterProps {
  children: React.ReactNode;
}

export function PageCenter(props: PageCenterProps) {
  return <div className="flex flex-col items-center justify-center w-full h-screen">{props.children}</div>;
}
