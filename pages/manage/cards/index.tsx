import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";
import prisma from "../../../lib/prisma";
import { FaRegEdit } from "react-icons/fa";
import { CocktailCardFull } from "../../../models/CocktailCardFull";
import { GetStaticProps } from "next";

export const getStaticProps: GetStaticProps = async () => {
  const cards: CocktailCardFull[] = await prisma.cocktailCard.findMany({ include: { groups: { include: { items: true } } } });
  return {
    props: {
      cards: cards.map((card) => {
        return {
          ...card,
          date: new Date(card.date).toISOString()
        };
      })
    }
  };
};

export default function CardsOverviewPage(props: { cards }) {
  return <ManageEntityLayout backLink={"/manage"} title={"Karten"}>
    <div className={"grid grid-cols-2 gap-4"}>
      {props.cards.map((card) => (
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
              <button className="btn btn-primary"><FaRegEdit /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </ManageEntityLayout>;
}
