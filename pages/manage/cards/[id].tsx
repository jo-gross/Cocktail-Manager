import { GetServerSideProps } from "next";
import prisma from "../../../lib/prisma";
import { ManageEntityLayout } from "../../../components/layout/ManageEntityLayout";
import { FieldArray, Formik } from "formik";
import { FaAngleDown, FaAngleLeft, FaAngleRight, FaAngleUp, FaEuroSign, FaTrashAlt } from "react-icons/fa";
import { CompactCocktailRecipeInstruction } from "../../../components/cocktails/CompactCocktailRecipeInstruction";
import React, { useContext } from "react";
import { ModalContext } from "../../../lib/context/ModalContextProvider";
import { SearchModal } from "../../../components/modals/SearchModal";
import { useRouter } from "next/router";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const cocktailsPromise = prisma.cocktailRecipe.findMany({
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

  const [cocktails] = await Promise.all([cocktailsPromise]);
  if (params.id == "create") {
    return {
      props: { cocktails }
    };
  } else {
    const card = await prisma.cocktailCard.findUnique({
      where: {
        id: String(params.id)
      },
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
        cocktails, card: {
          ...card,
          date: card.date.toISOString()
        }
      }
    };
  }
};


export default function EditCocktailRecipe(props: { card; cocktails }) {
  const modalContext = useContext(ModalContext);

  const router = useRouter();

  return <ManageEntityLayout backLink={"/manage/cards"} title={"Karte"} actions={
    props.card != undefined ? <div className={"btn btn-error btn-square btn-outline"}
                                   onClick={async () => {
                                     await fetch(`/api/cards/${props.card.id}`, {
                                       method: "DELETE"
                                     });
                                     window.location.href = "/manage/cards";
                                   }
                                   }
    ><FaTrashAlt />
    </div> : <></>
  }>
    <Formik initialValues={{
      groups: props.card?.groups.sort((a, b) => a.groupNumber - b.groupNumber) ?? [],
      name: props.card?.name ?? "",
      date: (props.card != undefined ? new Date(props.card.date).toISOString() : new Date().toISOString()).split("T")[0]
    }}
            validate={(values) => {
              const errors: any = {};
              if (!values.name || values.name.trim() == "") {
                errors.name = "Required";
              }
              if (!values.date || values.date.trim() == "") {
                errors.date = "Required";
              }

              let groupErrors: any = [];
              values.groups.forEach((group, groupIndex) => {
                const groupError = {};
                if (!group.name || group.name.trim() == "") {
                  groupErrors[groupIndex] = { name: "Required" };
                }
                let itemErrors: any = [];
                group.items.forEach((item, itemIndex) => {
                    const itemError: any = {};
                    if (!item.cocktailId || item.cocktailId.trim() == "") {
                      itemError.cocktailId = "Required";
                    }
                    itemErrors.push(itemError);
                  }
                );
                groupErrors.push(groupError);
              });


              if (groupErrors.filter((lineItemErrors: any) => Object.keys(lineItemErrors).length > 0).length > 0) {
                errors.groups = groupErrors;
              }


              console.log(errors);

              return errors;
            }}
            onSubmit={async (values) => {
              const storeResult = await fetch("/api/cards", {
                method: props.card == undefined ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: props.card?.id,
                  name: values.name,
                  date: new Date(values.date).toISOString(),
                  groups: values.groups.map((group, index) => ({
                    name: group.name,
                    groupNumber: index,
                    groupPrice: group.groupPrice,
                    items: group.items.map((item, itemIndex) => ({
                      ...item,
                      itemNumber: itemIndex
                    }))
                  }))
                })
              });

              if (storeResult.status == 200) {
                router.replace("/manage/cards");
              } else {
                alert("Fehler beim Speichern");
              }
            }}
    >
      {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <form onSubmit={handleSubmit}>
          <div className={"flex flex-col space-y-2"}>
            <div className={"flex flex-row space-x-2 border-base-300 border p-2 rounded-2xl"}>
              <div>
                <label className={"label"}>
                  <div className={"label-text"}>Karte</div>
                  <div className={"label-text-alt text-error"}>
                    <span>{errors.name && touched.name ? errors.name : ""}</span>
                    <span>*</span>
                  </div>
                </label>
                <input
                  type="text"
                  className={`input input-bordered ${errors.name && touched.name ? "input-error" : ""}`}
                  name={`name`}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.name}
                />
              </div>
              <div className={"form-control"}>
                <label className={"label"}>
                  <div className={"label-text"}>Datum</div>
                  <div className={"label-text-alt text-error"}>
                    <span>{errors.date && touched.date ? errors.date : ""}</span>
                    <span>*</span>
                  </div>
                </label>
                <input
                  type={"date"}
                  className={`input input-bordered ${errors.date && touched.date ? "input-error" : ""}}`}
                  name={`date`}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.date}
                />
              </div>
            </div>
            <FieldArray name={"groups"}>
              {({ push: pushGroup, remove: removeGroup }) => (
                <>
                  {values?.groups.sort((a, b) => a.groupNumber - b.groupNumber).map((group, groupIndex) => (
                    <div key={groupIndex} className={"border border-base-300 rounded-2xl p-2"}>
                      <div className={"grid grid-cols-3 items-center gap-2"}>
                        <div className={"flex-1 form-control"}>
                          <label className={"label"}>
                            <div className={"label-text"}>Gruppe</div>
                            <div className={"label-text-alt text-error"}>
                              <span>{errors.groups?.[groupIndex] && errors.groups[groupIndex].name && touched.groups?.[groupIndex] && touched.groups[groupIndex].name ? errors.groups[groupIndex].name : ""}</span>
                              <span>*</span>
                            </div>
                          </label>
                          <input
                            type="text"
                            className={`input input-bordered w-full ${errors.groups?.[groupIndex] && errors.groups[groupIndex].name && touched.groups?.[groupIndex] && touched.groups[groupIndex].name ? "input-error" : ""}`}
                            name={`groups.${groupIndex}.name`}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            value={values.groups[groupIndex].name}
                          />
                        </div>
                        <div className={" flex-1 form-control"}>
                          <label className={"label"}>
                            <div className={"label-text"}>Gruppen Preis</div>
                            <div className={"label-text-alt text-error"}>
                              <span>{errors.groups?.[groupIndex] && errors.groups[groupIndex].groupPrice && touched.groups?.[groupIndex] && touched.groups[groupIndex].groupPrice ? errors.groups[groupIndex].groupPrice : ""}</span>
                            </div>
                          </label>
                          <div className={"input-group"}>
                            <input
                              type="number"
                              className={"input input-bordered w-full"}
                              name={`groups.${groupIndex}.groupPrice`}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              value={values.groups[groupIndex].groupPrice}
                            />
                            <span className={"btn-primary"}><FaEuroSign /></span>
                          </div>
                        </div>
                        <div className={"justify-self-end space-x-2"}>
                          <button type={"button"}
                                  disabled={groupIndex == 0}
                                  className={"btn btn-outline btn-sm btn-square"}
                                  onClick={() => {
                                    const value = values.groups[groupIndex];
                                    const reorderedGroups = values.groups.filter((_, i) => i != groupIndex);
                                    reorderedGroups.splice(groupIndex - 1, 0, value);
                                    setFieldValue("groups", reorderedGroups.map((group, groupIndex) => ({
                                      ...group,
                                      groupNumber: groupIndex
                                    })));
                                  }}
                          >
                            <FaAngleUp />
                          </button>
                          <button type={"button"}
                                  disabled={!(values.groups.length > 1) || group == values.groups.length - 1}
                                  className={"btn btn-outline btn-sm btn-square"}
                                  onClick={() => {
                                    const value = values.groups[groupIndex];
                                    const reorderedGroups = values.groups.filter((_, i) => i != groupIndex);
                                    reorderedGroups.splice(groupIndex + 1, 0, value);
                                    setFieldValue("groups", reorderedGroups.map((group, groupIndex) => ({
                                      ...group,
                                      groupNumber: groupIndex
                                    })));
                                  }}
                          >
                            <FaAngleDown />
                          </button>
                          <button type="button" className={"btn btn-error btn-sm btn-square"} onClick={() => removeGroup(groupIndex)}>
                            <FaTrashAlt />
                          </button>
                        </div>
                      </div>
                      <div className={"border-b border-base-300 p-1"}></div>
                      <div className={"pt-2"}>
                        <FieldArray name={`groups.${groupIndex}.items`}>
                          {({ push: pushItem, remove: removeItem }) => (
                            <div className={"grid grid-cols-3 gap-2"}>
                              {values.groups[groupIndex].items.sort((a, b) => a.itemNumber - b.itemNumber).map((item, itemIndex) => (
                                <div className={"col-span-1"}>
                                  <div className={"card"}>
                                    <div className={"card-body"}>
                                      <div>
                                        <div className={"flex justify-end space-x-2"}>
                                          <button type={"button"}
                                                  disabled={itemIndex == 0}
                                                  className={"btn btn-outline btn-sm btn-square"}
                                                  onClick={() => {
                                                    const value = values.groups[groupIndex].items[itemIndex];
                                                    const reorderedItems = values.groups[groupIndex].items.filter((_, i) => i != itemIndex);
                                                    reorderedItems.splice(itemIndex - 1, 0, value);
                                                    setFieldValue(`groups.${groupIndex}.items`, reorderedItems.map((item, itemIndex) => ({
                                                      ...item,
                                                      itemNumber: itemIndex
                                                    })));
                                                  }}
                                          >
                                            <FaAngleLeft />
                                          </button>
                                          <button type={"button"}
                                                  disabled={!(values.groups[groupIndex].items.length > 1) || itemIndex == values.groups[groupIndex].items.length - 1}
                                                  className={"btn btn-outline btn-sm btn-square"}
                                                  onClick={() => {
                                                    const value = values.groups[groupIndex].items[itemIndex];
                                                    const reorderedItems = values.groups[groupIndex].items.filter((_, i) => i != itemIndex);
                                                    reorderedItems.splice(itemIndex + 1, 0, value);
                                                    setFieldValue(`groups.${groupIndex}.items`, reorderedItems.map((item, itemIndex) => ({
                                                      ...item,
                                                      itemNumber: itemIndex
                                                    })));
                                                  }}
                                          >
                                            <FaAngleRight />
                                          </button>
                                          <div className={"btn btn-outline btn-error btn-square btn-sm"} onClick={() => removeItem(itemIndex)}><FaTrashAlt /></div>
                                        </div>

                                        {props.cocktails.find(cocktail => cocktail.id == item.cocktailId) != undefined ?
                                          <CompactCocktailRecipeInstruction showPrice={true} cocktailRecipe={props.cocktails.find(cocktail => cocktail.id == item.cocktailId)} /> :
                                          <div>Unbekannt</div>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className={"col-span-3 flex justify-end flex-row"}>
                                <button
                                  type="button"
                                  className={"btn btn-secondary btn-sm btn-outline"}
                                  onClick={() => modalContext.openModal(<SearchModal
                                    selectedCocktails={values.groups[groupIndex].items.map(item => item.cocktailId)}
                                    onCocktailSelected={(id) => {
                                      pushItem({ cocktailId: id });
                                    }} />)}>
                                  Cocktail hinzufügen
                                </button>
                              </div>
                            </div>
                          )}
                        </FieldArray>
                      </div>
                    </div>
                  ))}
                  <div className={"flex flex-row justify-end items-center space-x-2"}>
                    <button type="button"
                            className={"btn btn-secondary btn-sm"}
                            onClick={() => pushGroup({ name: "", items: [], date: new Date(), specialPrice: undefined })}>
                      Gruppe hinzufügen
                    </button>
                    <button type="submit"
                            className={`btn btn-primary btn-sm ${isSubmitting ? "loading" : ""}`}
                    >
                      Speichern
                    </button>
                  </div>
                </>
              )}
            </FieldArray>
          </div>
        </form>
      )}
    </Formik>
  </ManageEntityLayout>;
}
