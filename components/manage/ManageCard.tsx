import Link from "next/link";

interface ManageCardProps {
  title: string;
  link: string;
}

export function ManageCard(props: ManageCardProps) {
  return (
    <div className={"card"}>
      <div className={"card-body"}>
        <div className={"card-title"}>{props.title}</div>
        <div className={"card-actions"}>
          <Link href={props.link}>
            <div className={"btn btn-primary"}>Verwalten</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
