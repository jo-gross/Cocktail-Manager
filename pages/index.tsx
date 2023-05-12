import React, { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import prisma from "../lib/prisma";
import { FaBuilding, FaSearch } from "react-icons/fa";
import Link from "next/link";
import { BsFillGearFill } from "react-icons/bs";
import { CocktailCardFull } from "../models/CocktailCardFull";
import CocktailRecipeOverviewItem from "../components/CocktailRecipe/CocktailRecipeOverviewItem";
import { CocktailCard } from "@prisma/client";
import { useRouter } from "next/router";

export const getServerSideProps: GetServerSideProps = async (context) => {

    const cards: CocktailCard[] = await prisma.cocktailCard.findMany();

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
  }
;

export default function OverviewPage(props: { cards }) {
  const [showImage, setShowImage] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(props.cards > 0 ? props.cards[0].id : undefined);
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(props.cards > 0 ? props.cards[0].id : undefined);
  const router = useRouter();

  useEffect(() => {
    if (selectedCardId != undefined) {
      try {
        fetch("/api/cards/" + selectedCardId).then((response) => {
          if (response.ok) {
            response.json().then((json) => {
              console.log(json);
              return json;
            }).then(json => setSelectedCard(json));
          }
        });
      } catch (e) {
        console.log(e);
      }
    }
  }, [selectedCardId]);

  useEffect(() => {
    if (selectedCardId == undefined && props.cards.length > 0) {
      setSelectedCardId(props.cards[0].id);
      router.replace("/", { query: { card: props.cards[0].id } });
    }
  }, [props.cards]);

  return (
    <div className={"relative min-h-screen w-screen"}>
      <div className={"flex flex-col overflow-y-auto p-4 rounded-xl"}>
        {selectedCard?.groups?.map((group) => (
          <div key={`card-${selectedCard.id}-group-${group.id}`} className={"border border-base-300 rounded-xl p-2"}>
            <div className={"font-bold text-2xl"}>{group.name}{group.groupPrice && (` - Special Preis: ${group.groupPrice}€`)}</div>
            <div className={"grid 2xl:grid-cols-6 xl:grid-cols-4 md:grid-cols-3 xs:grid-cols-2 grid-cols-1 gap-2 p-2"}>
              {group.items?.map((groupItem, index) => (
                <CocktailRecipeOverviewItem
                  key={`card-${selectedCard.id}-group-${group.id}-cocktail-${groupItem.cocktailId}-${index}`}
                  showImage={showImage}
                  specialPrice={groupItem.specialPrice ?? group.groupPrice}
                  cocktailRecipe={groupItem.cocktail}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={"absolute bottom-5 right-5 flex flex-col space-y-2"}>
        <div className="dropdown dropdown-top dropdown-end pt-2">
          <label tabIndex={0} className={"btn btn-primary btn-square rounded-xl btn-lg"}><BsFillGearFill /></label>
          <div tabIndex={0} className="dropdown-content p-2 shadow bg-base-100 rounded-box w-52">
            <div className={"flex flex-col space-x-2"}>
              <div className={"divider"}>Karte</div>
              <div className={"flex flex-col space-x-2"}>
                {props.cards.map((card) => (
                  <div
                    key={"card-" + card.id}
                    className="form-control">
                    <label className="label">
                      <div className={"label-text"}>
                        {card.name}
                      </div>
                      <input name={"card-radio"}
                             type={"radio"}
                             className={"radio"}
                             value={card.id}
                             defaultChecked={selectedCard?.id == card.id}
                             onClick={() => {
                               setSelectedCardId(card.id);
                               router.replace("/", { query: { card: card.id } });
                             }
                             } />
                    </label>
                  </div>
                ))}
              </div>
              <div className={"divider"}>Anzeige</div>
              <div className="form-control">
                <label className="label">Bilder anzeigen
                  <input type={"checkbox"} className={"toggle toggle-primary"} defaultChecked={showImage} onClick={() => setShowImage(!showImage)} />
                </label>
              </div>

            </div>
          </div>
        </div>

        <div className={"btn btn-primary btn-square rounded-xl btn-lg"}><FaSearch /></div>
        <Link href={"/manage"}>
          <div className={" btn btn-primary btn-square rounded-xl btn-lg"}><FaBuilding /></div>
        </Link>

      </div>
    </div>
  );
}
