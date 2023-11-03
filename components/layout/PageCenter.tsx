interface PageCenterProps {
  children: React.ReactNode;
}

export function PageCenter(props: PageCenterProps) {
  return <div className="flex h-screen w-full flex-col items-center justify-center">{props.children}</div>;
}
