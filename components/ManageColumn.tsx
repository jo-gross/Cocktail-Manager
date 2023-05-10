import { FaTrashAlt } from "react-icons/fa";

interface ManageColumnProps {
  id: string;
  entity: "cocktails" | "ingredients" | "glasses" | "decorations";
}

export function ManageColumn(props: ManageColumnProps) {
  return <td className={"flex justify-end space-x-2"}>
    <a href={`/manage/${props.entity}/${props.id}`}>
      <div className={"btn btn-outline btn-primary btn-sm"}>Edit</div>
    </a>
    <div className={"btn btn-outline btn-error btn-sm"}
         onClick={async () => {
           try {
             const response = await fetch(`/api/${props.entity}/${props.id}`, {
               method: "DELETE"
             });
             if (response.status == 200) {
               window.location.reload();
             } else {
               console.log(response);
               alert("Fehler beim Löschen");
             }
           } catch (e) {
             console.error(e);
             alert("Fehler beim Löschen");
           }
         }
         }>
      <FaTrashAlt />
    </div>
  </td>;
}
