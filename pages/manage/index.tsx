import { ManageCard } from "../../components/manage/ManageCard";
import { ManageEntityLayout } from "../../components/layout/ManageEntityLayout";

export default function ManagePage() {
  return (
    <ManageEntityLayout backLink={"/"} title={"Verwalten"}>
      <div className={"grid grid-cols-2 gap-4"}>
        <ManageCard title={"Cocktails"} link={"/manage/cocktails"} />
        <ManageCard title={"Karten"} link={"/manage/cards"} />
        <ManageCard title={"Zutaten"} link={"/manage/ingredients"} />
        <ManageCard title={"Dekorationen"} link={"/manage/decorations"} />
        <ManageCard title={"Gläser"} link={"/manage/glasses"} />
      </div>
    </ManageEntityLayout>
  );
}
