import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";
import prisma from "../../../lib/prisma";
import { FaRegEdit } from "react-icons/fa";
import { CocktailCardFull } from "../../../models/CocktailCardFull";
import { GetStaticProps } from "next";
import Link from "next/link";

export const getStaticProps: GetStaticProps = async () => {
  const cards: CocktailCardFull[] = await prisma.cocktailCard.findMany({
    include: {
      groups: {
        include: {
          items: true
        }
      }
    }
  });
  return {
    props: {
      cards: cards.map((card) => {
        return {
          ...card,
          date: card.date != undefined ? new Date(card.date).toISOString() : null
        };
      })
    }
  };
};

export default function CardsOverviewPage(props: { cards }) {
  return <ManageEntityLayout backLink={"/manage"} title={"Karten"} actions={<Link href={"/manage/cards/create"}>
    <div className={"btn btn-primary"}>Hinzufügen</div>
  </Link>}>
    <div className={"grid grid-cols-2 gap-4"}>
      {props.cards.sort((a, b) => a.name.localeCompare(b.name)).map((card) => (
        <div
          key={"card-" + card.id}
          className={"card"}>
          <div className={"card-body"}>
            <div className={"card-title"}>{card.name} {card.date != undefined ? (`(${new Date(card.date).toLocaleDateString()})`) : ""}</div>
            <div className={"grid grid-cols-2"}>
              <div>{card.groups?.length} Gruppen</div>
              <div>{card.groups?.reduce((acc, group) => acc + group.items.length, 0)} Cocktails</div>
            </div>
            <div className="card-actions justify-end">
              <Link href={`/manage/cards/${card.id}`}>
                <div className="btn btn-primary"><FaRegEdit /></div>
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  </ManageEntityLayout>;
}
