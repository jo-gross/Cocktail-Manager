import React, { useEffect, useState } from "react";
import { GetServerSideProps } from "next";
import prisma from "../lib/prisma";
import { FaEye, FaSearch } from "react-icons/fa";
import Link from "next/link";
import { BsFillGearFill, BsSearch } from "react-icons/bs";
import { CocktailCardFull } from "../models/CocktailCardFull";
import CocktailRecipeOverviewItem from "../components/CocktailRecipe/CocktailRecipeOverviewItem";
import { CocktailCard } from "@prisma/client";
import { useRouter } from "next/router";
import { CocktailRecipeFull } from "../models/CocktailRecipeFull";
import { CompactCocktailRecipeInstruction } from "../components/CompactCocktailRecipeInstruction";

export const getServerSideProps: GetServerSideProps = async (context) => {

  const cocktails: CocktailRecipeFull[] = await prisma.cocktailRecipe.findMany({
    include: {
      glass: true,
      decoration: true,
      steps: {
        include: {
          ingredients: {
            include: {
              ingredient: true
            }
          }
        }
      }
    }
  });

  const cards: CocktailCard[] = await prisma.cocktailCard.findMany({
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
          date: new Date(card.date).toISOString()
        };
      }),
      cocktails
    }
    };
  }
;

export default function OverviewPage(props: { cards, cocktails: CocktailRecipeFull[] }) {
  const [showImage, setShowImage] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<string | undefined>(props.cards > 0 ? props.cards[0].id : undefined);
  const [selectedCard, setSelectedCard] = useState<CocktailCardFull | undefined>(props.cards > 0 ? props.cards[0].id : undefined);
  const router = useRouter();

  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.keyCode === 27) {
        if ((document.getElementById("searchModal") as HTMLInputElement | undefined)?.checked) {
          document.getElementById("searchModal").click();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

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
          <label tabIndex={0} className={"btn btn-primary btn-square rounded-xl btn-lg"}><FaEye /></label>
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

        <input type="checkbox" id="searchModal" className="modal-toggle" />
        <label htmlFor="searchModal" className="modal cursor-pointer">
          <label className="modal-box relative" htmlFor="">
            <div className={"p-4 grid grid-cols-1 gap-2"}>
              <div className={"font-bold text-2xl"}>Cocktail suchen</div>
              <div className={"input-group"}>
                <input className={"w-full input input-bordered"} value={search} onChange={(e) => setSearch(e.target.value)} />
                <span className={"btn btn-outline btn-primary"}><BsSearch /></span>
              </div>
              <>
                {props.cocktails.filter((cocktail) => search.trim() != "" && (
                  cocktail.name.toLowerCase().includes(search.toLowerCase()) ||
                  cocktail.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())) ||
                  (cocktail.decoration != undefined && cocktail.decoration.name.toLowerCase().includes(search.toLowerCase())) ||
                  cocktail.steps.some((step) => step.ingredients.filter(ingredient => ingredient.ingredient.name != undefined).some((ingredient) => ingredient.ingredient.name.toLowerCase().includes(search.toLowerCase()) || ingredient.ingredient.shortName.toLowerCase().includes(search.toLowerCase()))))
                ).map((cocktail) => (
                    <div tabIndex={0} className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                      <input type="checkbox" />
                      <div className="collapse-title text-xl font-medium">
                        {cocktail.name}
                      </div>
                      <div className="collapse-content">
                        <div className={"card"}>
                          <div className={"card-body"}>
                            <CompactCocktailRecipeInstruction showPrice={true} cocktailRecipe={cocktail} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                ) ?? <></>}
              </>
            </div>
          </label>
        </label>

        <label htmlFor="searchModal" className={"btn btn-primary btn-square rounded-xl btn-lg"}>
          <FaSearch />
        </label>
        <Link href={"/manage"}>
          <div className={" btn btn-primary btn-square rounded-xl btn-lg"}><BsFillGearFill /></div>
        </Link>

      </div>
    </div>
  );
}
