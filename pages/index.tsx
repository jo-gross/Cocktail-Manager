import React, { useState } from "react";
import { GetStaticProps } from "next";
import prisma from "../lib/prisma";
import { CocktailRecipeFull } from "../models/CocktailRecipeFull";
import CocktailRecipeOverviewItem from "../components/CocktailRecipe/CocktailRecipeOverviewItem";
import { FaBuilding, FaSearch } from "react-icons/fa";
import Link from "next/link";
import { BsFillGearFill } from "react-icons/bs";

export const getStaticProps: GetStaticProps = async () => {
  const cocktailRecipes = await prisma.cocktailRecipe.findMany({
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

  return {
    props: { cocktailRecipes },
    revalidate: 10
  };
};

interface OverviewPageProps {
  cocktailRecipes: CocktailRecipeFull[];
}

export default function OverviewPage(props: OverviewPageProps) {

  const [showImage, setShowImage] = useState(false);

  return (
    <div className={"relative min-h-screen w-screen"}>
      <div className={"grid 2xl:grid-cols-6 xl:grid-cols-4 md:grid-cols-3 xs:grid-cols-2 grid-cols-1 gap-4 p-4"}>
        {props.cocktailRecipes.map((recipe) => (
          <CocktailRecipeOverviewItem showImage={showImage} cocktailRecipe={recipe} key={recipe.id} />
        ))}
      </div>
      <div className={"absolute bottom-5 right-5 flex flex-col space-y-2"}>
        <div className="dropdown dropdown-top dropdown-end pt-2">
          <label tabIndex={0} className={"btn btn-primary btn-square rounded-xl btn-lg"}><BsFillGearFill /></label>
          <div tabIndex={0} className="dropdown-content p-2 shadow bg-base-100 rounded-box w-52">
            <div className={"flex flex-col space-x-2"}>
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
