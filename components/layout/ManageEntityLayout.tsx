import { FaArrowLeft } from "react-icons/fa";
import Link from "next/link";

interface ManageEntityLayoutProps {
  children: React.ReactNode;
  backLink: string;
  title?: string;
}

export function ManageEntityLayout(props: ManageEntityLayoutProps) {
  return <div className={"flex flex-col p-4"}>
    <div className={"flex flex-row w-full justify-between items-center"}>
      <Link href={props.backLink} >
      <div className={"btn btn-primary btn-square rounded-xl"}><FaArrowLeft /></div>
      </Link>
      <div className={"text-3xl font-bold"}>{props.title}</div>
      <div></div>
    </div>
    <div className={"p-4"}>
      {props.children}
    </div>
  </div>;
}
