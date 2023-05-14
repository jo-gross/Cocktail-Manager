import { CocktailRecipeFull } from "../../models/CocktailRecipeFull";
import { IceType } from "../../models/IceType";
import { FaAngleDown, FaAngleUp, FaEuroSign, FaPlus, FaTrashAlt } from "react-icons/fa";
import { TagsInput } from "react-tag-input-component";
import { Field, FieldArray, Formik } from "formik";
import React from "react";
import { useRouter } from "next/router";
import { Decoration, Glass, Ingredient } from "@prisma/client";
import { updateTags, validateTag } from "../../models/tags/TagUtils";
import { UploadDropZone } from "../UploadDropZone";
import { convertToBase64 } from "../../lib/Base64Converter";
import { CocktailUtensil } from "../../models/CocktailUtensil";
import { CocktailTool } from "../../models/CocktailTool";
import { CocktailIngredientUnit } from "../../models/CocktailIngredientUnit";
import { CocktailRecipeStepFull } from "../../models/CocktailRecipeStepFull";
import CocktailRecipeOverviewItem from "./CocktailRecipeOverviewItem";

interface CocktailRecipeFormProps {
  glasses: Glass[];
  decorations: Decoration[];
  ingredients: Ingredient[];
  cocktailRecipe?: CocktailRecipeFull;
}

export function CocktailRecipeForm(props: CocktailRecipeFormProps) {
  const router = useRouter();
  return (
    <Formik
      initialValues={
        props.cocktailRecipe == undefined
          ? {
            name: "",
            price: 3.4,
            description: "",
            tags: [],
            glassWithIce: IceType.Ball,
            image: undefined,
            glass: undefined,
            decoration: undefined,
            steps: [],
            showImage: false,
            showTags: false
          }
          : {
            name: props.cocktailRecipe.name,
            description: props.cocktailRecipe.description ?? "",
            price: props.cocktailRecipe.price,
            tags: props.cocktailRecipe.tags,
            glassWithIce: props.cocktailRecipe.glassWithIce,
            image: props.cocktailRecipe.image,
            glass: props.cocktailRecipe.glassId,
            decoration: props.cocktailRecipe.decorationId ?? undefined,
            steps: (props.cocktailRecipe.steps ?? []).map((step) => {
              return {
                id: step.id,
                mixing: step.mixing,
                tool: step.tool,
                stepNumber: step.stepNumber,
                cocktailRecipeId: props.cocktailRecipe.id,
                ingredients: (step.ingredients ?? []).map((ingredient) => {
                  return {
                    id: ingredient.id,
                    amount: ingredient.amount ?? undefined,
                    ingredientNumber: ingredient.ingredientNumber,
                    unit: ingredient.unit ?? undefined,
                    ingredient: props.ingredients.find((i) => i.id == ingredient.ingredientId) ?? undefined,
                    ingredientId: ingredient.ingredientId ?? undefined,
                    cocktailRecipeStepId: step.id
                  };
                }).sort((a, b) => a.ingredientNumber - b.ingredientNumber)
              };
            }).sort((a, b) => a.stepNumber - b.stepNumber),
            showImage: false,
            showTags: false
          }
      }
      validate={(values) => {
        const errors: any = {};
        if (!values.name || values.name.trim() == "") {
          errors.name = "Required";
        }
        if (!values.price) {
          errors.price = "Required";
        }
        if (!values.glass || values.glass == "") {
          errors.glass = "Required";
        }
        if (!values.glassWithIce || values.glass == "") {
          errors.glassWithIce = "Required";
        }

        const stepsErrors: any = [];
        values.steps.map((step, index) => {
          const stepErrors: any = {};
          if (step.mixing == undefined) {
            stepErrors.mixing = "Required";
          }
          if (!step.tool) {
            stepErrors.tool = "Required";
          }

          const ingredientsErrors: any = [];
          if (step.mixing) {
            step.ingredients.map((ingredient, index) => {
              const ingredientErrors: any = {};
              if (!ingredient.amount) {
                ingredientErrors.amount = "Required";
              }
              if (!ingredient.unit || ingredient.unit == "") {
                ingredientErrors.unit = "Required";
              }
              if (!ingredient.ingredientId || ingredient.ingredientId == "") {
                ingredientErrors.ingredientId = "Required";
              }
              ingredientsErrors.push(ingredientErrors);
            });
            stepErrors.ingredients = ingredientsErrors;
          }
          stepsErrors.push(stepErrors);
        });

        let hasErrors = false;
        stepsErrors.map((stepErrors) => {
          stepErrors.ingredients?.map((ingredientErrors) => {
              if (Object.keys(ingredientErrors).length > 0) {
                hasErrors = true;
              }
            }
          );
        });
        if (hasErrors) {
          errors.steps = stepsErrors;
        }
        console.log(errors);
        return errors;
      }}
      onSubmit={async (values) => {
        try {
          const body = {
            id: props.cocktailRecipe == undefined ? undefined : props.cocktailRecipe.id,
            name: values.name,
            description: values.description.trim() === "" ? undefined : values.description,
            price: values.price,
            glassId: values.glass,
            decorationId: values.decoration,
            image: values.image,
            tags: values.tags,
            glassWithIce: values.glassWithIce,
            steps: values.steps.map((step, index) => {
              return {
                ...step,
                stepNumber: index,
                ingredients: step.ingredients.map((ingredient, index) => {
                  return {
                    ...ingredient,
                    ingredientNumber: index
                  };
                })
              };
            })
          };
          const result = await fetch("/api/cocktails", {
            method: props.cocktailRecipe == undefined ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
          if (result.status.toString().startsWith("2")) {
            await router.replace("/manage/cocktails");
          } else {
            alert(result.status + " " + result.statusText);
          }
        } catch (error) {
          console.error(error);
        }
      }}
    >
      {({ values, setFieldValue, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting }) => (
        <form onSubmit={handleSubmit}>
          <div className={"grid md:grid-cols-3 grid-cols-1 gap-4"}>
            <div className={"card md:col-span-2 grid-cols-1"}>
              <div className={"card-body"}>
                <div className={"text-2xl font-bold text-center"}>Cocktail erfassen</div>
                <div className={"divider"}></div>
                <div className={"grid grid-cols-2 gap-4"}>
                  <div className={"col-span-2"}>
                    <label className={"label"}>
                      <span className={"label-text"}>Name</span>
                      <span className={"text-error label-text-alt"}>{errors.name && touched.name && errors.name} *</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      className={`input input-bordered w-full ${errors.name && touched.name && "input-error"}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.name}
                    />
                  </div>
                  <div className={"col-span-2"}>
                    <label className={"label"}>
                      <span className={"label-text"}>Beschreibung</span>
                      <span className={"text-error label-text-alt"}>
                      {errors.description && touched.description && errors.description}
                    </span>
                    </label>
                    <textarea
                      name="description"
                      className={`textarea textarea-bordered w-full ${
                        errors.description && touched.description && "textarea-error"
                      }`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.description}
                    />
                  </div>
                  <div>
                    <label className={"label"}>
                      <span className={"label-text"}>Preis</span>
                      <span className={"text-error label-text-alt"}>
                      {errors.price && touched.price && errors.price} *
                    </span>
                    </label>
                    <div className={"input-group w-full"}>
                      <input
                        type="number"
                        className={`input input-bordered w-full ${errors.price && touched.price && "input-error"}`}
                        name="price"
                        onChange={handleChange}
                        onBlur={handleBlur}
                        value={values.price}
                      />
                      <span className={"btn-secondary"}>
                      <FaEuroSign />
                    </span>
                    </div>
                  </div>
                  <div>
                    <label className={"label"}>
                      <span className={"label-text"}>Tags</span>
                      <span className={"text-error label-text-alt"}>{errors.tags && touched.tags && errors.tags}</span>
                    </label>
                    <TagsInput
                      value={values.tags}
                      onChange={(tags) =>
                        setFieldValue(
                          "tags",
                          updateTags(tags, (text) => (errors.tags = text))
                        )
                      }
                      name="tags"
                      beforeAddValidate={(tag, _) => validateTag(tag, (text) => (errors.tags = text))}
                      onBlur={handleBlur}
                    />
                  </div>
                  <div>
                    <label className={"label"}>
                      <span className={"label-text"}>Glas</span>
                      <span className={"text-error label-text-alt"}>
                      {errors.glass && touched.glass && errors.glass} *
                    </span>
                    </label>
                    <select
                      name="glass"
                      className={`select select-bordered w-full ${errors.glass && touched.glass && "select-error"}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.glass}
                    >
                      <option value={""}>Auswählen</option>
                      {props.glasses.map((glass) => (
                        <option key={`form-recipe-glasses${glass.id}`} value={glass.id}>
                          {glass.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={"label"}>
                      <span className={"label-text"}>Glas mit Eis</span>
                      <span className={"text-error label-text-alt"}>
                      {errors.glassWithIce && touched.glassWithIce && errors.glassWithIce}
                    </span>
                    </label>
                    <select
                      name="glassWithIce"
                      className={`select select-bordered w-full ${
                        errors.glassWithIce && touched.glassWithIce && "select-error"
                      }`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.glassWithIce}
                    >
                      <option value={""}>Auswählen</option>
                      {Object.values(IceType).map((iceType) => (
                        <option key={`form-recipe-icetypes-${iceType}`} value={iceType}>
                          {iceType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={"col-span-2 divider"}>Darstellung</div>
                  <div className={"col-span-2"}>
                    {values.image != undefined ? (
                      <label className={"label"}>
                        <span className={"label-text"}>Vorschau Bild</span>
                      </label>
                    ) : (
                      <></>
                    )}
                    {values.image == undefined ? (
                      <UploadDropZone
                        onSelectedFilesChanged={async (file) => setFieldValue("image", await convertToBase64(file))}
                      />
                    ) : (
                      <div className={"relative"}>
                        <div
                          className={"absolute top-2 right-2 btn-error btn btn-outline btn-sm btn-square"}
                          onClick={() => setFieldValue("image", undefined)}
                        >
                          <FaTrashAlt />
                        </div>
                        <img className={"rounded-lg h-32"} src={values.image} alt={"Cocktail Image"} />
                      </div>
                    )}
                  </div>
                  <div className={"col-span-2 divider"}>Zubereitung</div>
                  <FieldArray name={"steps"}>
                    {({ push: pushStep, remove: removeStep }) => (
                      <div className={"col-span-2 space-y-2"}>
                        {values.steps.map((step, indexStep) => (
                          <div key={`form-recipe-step-${step.id}`} className={"flex flex-col justify-between w-full space-y-2 border border-neutral rounded-xl p-4"}>
                            <div className={"grid grid-cols-3 gap-4"}>
                              <div className={"font-bold"}>Schritt {indexStep + 1}</div>
                              <div className={"form-control"}>
                                <label className={"label"}>
                                  <span className={"label-text"}>Andere</span>
                                  <input type="checkbox"
                                         checked={values.steps[indexStep].mixing}
                                         onChange={(e) => {
                                           handleChange(e);
                                           if (values.steps[indexStep].mixing) {
                                             setFieldValue(`steps.${indexStep}.tool`, CocktailTool.STRAIN);
                                           } else {
                                             setFieldValue(`steps.${indexStep}.tool`, CocktailUtensil.SHAKE);
                                           }
                                         }}
                                         onBlur={handleBlur}
                                         className={"toggle toggle-primary"}
                                         name={`steps.${indexStep}.mixing`}
                                  />
                                  <span className={"label-text"}>Mixen</span>
                                </label>
                              </div>
                              <div className={"space-x-2 justify-self-end"}>
                                <button type={"button"}
                                        disabled={indexStep == 0}
                                        className={"btn btn-outline btn-sm btn-square"}
                                        onClick={() => {
                                          const value = values.steps[indexStep];
                                          const reorderedSteps = values.steps.filter((_, i) => i != indexStep);
                                          reorderedSteps.splice(indexStep - 1, 0, value);
                                          setFieldValue("steps", reorderedSteps.map((step, index) => ({ ...step, stepNumber: index })));
                                        }}
                                >
                                  <FaAngleUp />
                                </button>
                                <button type={"button"}
                                        disabled={!(values.steps.length > 1) || indexStep == values.steps.length - 1}
                                        className={"btn btn-outline btn-sm btn-square"}
                                        onClick={() => {
                                          const value = values.steps[indexStep];
                                          const reorderedSteps = values.steps.filter((_, i) => i != indexStep);
                                          reorderedSteps.splice(indexStep + 1, 0, value);
                                          setFieldValue("steps", reorderedSteps.map((step, index) => ({ ...step, stepNumber: index })));
                                        }}
                                >
                                  <FaAngleDown />
                                </button>
                                <button type={"button"}
                                        className={"btn btn-error btn-sm btn-square"}
                                        onClick={() => removeStep(indexStep)}
                                >
                                  <FaTrashAlt />
                                </button>
                              </div>
                            </div>
                            {step.mixing ? (
                              <>
                                <div className={"w-full flex flex-row justify-center items-center space-x-2"}>
                                  {Object.values(CocktailUtensil).map((value) => (
                                    <div key={`form-recipe-step-${step.id}-tool-${value}`} className={"flex flex-col justify-center items-center space-y-2"}>
                                      {/*<img className={"h-20"}*/}
                                      {/*     src={"https://res.cloudinary.com/lusini/w_1500,h_1500,q_80,c_pad,f_auto/pim/7f30f8/bf7939/ff5def/23f663/419537/65/7f30f8bf7939ff5def23f66341953765.jpeg"} />*/}
                                      <div>{value}</div>
                                      <Field type="radio"
                                             name={`steps.${indexStep}.tool`}
                                             value={value}
                                             className={"radio radio-primary"}
                                             onBlur={handleBlur}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <FieldArray name={`steps.${indexStep}.ingredients`}>
                                  {({ push: pushIngredient, remove: removeIngredient }) => (
                                    <>
                                      {step.ingredients.sort((a, b) => a.ingredientNumber - b.ingredientNumber).map((ingredient, indexIngredient) => (
                                        <div className={"flex flex-row"}>
                                          <div className={"input-group input-group-vertical"}>
                                            <button type={"button"}
                                                    disabled={indexIngredient == 0}
                                                    className={"btn btn-outline btn-xs btn-square"}
                                                    onClick={() => {
                                                      const value = values.steps[indexStep].ingredients[indexIngredient];
                                                      const reorderedGroups = values.steps[indexStep].ingredients.filter((_, i) => i != indexIngredient);
                                                      reorderedGroups.splice(indexIngredient - 1, 0, value);
                                                      setFieldValue(`steps.${indexStep}.ingredients`, reorderedGroups.map((group, groupIndex) => ({
                                                        ...group,
                                                        ingredientNumber: groupIndex
                                                      })));
                                                    }}
                                            >
                                              <FaAngleUp />
                                            </button>
                                            <button type={"button"}
                                                    disabled={!(values.steps[indexStep].ingredients.length > 1) || indexIngredient == values.steps[indexStep].ingredients.length - 1}
                                                    className={"btn btn-outline btn-xs btn-square"}
                                                    onClick={() => {
                                                      const value = values.steps[indexStep].ingredients[indexIngredient];
                                                      const reorderedGroups = values.steps[indexStep].ingredients.filter((_, i) => i != indexIngredient);
                                                      reorderedGroups.splice(indexIngredient + 1, 0, value);
                                                      setFieldValue(`steps.${indexStep}.ingredients`, reorderedGroups.map((group, groupIndex) => ({
                                                        ...group,
                                                        ingredientNumber: groupIndex
                                                      })));
                                                    }}
                                            >
                                              <FaAngleDown />
                                            </button>
                                          </div>
                                          <div key={`form-recipe-step${step.id}-ingredient-${ingredient.id}`} className={"input-group flex-row w-full"}>
                                            <select
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.ingredientId`}
                                              className={`select select-bordered flex-1 ${(errors.steps?.[indexStep] as any)?.ingredients?.[indexIngredient]?.ingredientId && "select-error"} `}
                                              onChange={(e) => {
                                                handleChange(e);
                                                const ingredient = props.ingredients.find((ingredient) => ingredient.id == e.target.value);
                                                setFieldValue(`steps.${indexStep}.ingredients.${indexIngredient}.ingredient`, ingredient);
                                              }}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].ingredientId}
                                            >
                                              <option value={""}>Auswählen</option>
                                              {props.ingredients.sort((a, b) => a.name.localeCompare(b.name)).map((ingredient) => (
                                                <option key={`form-recipe-step${step.id}-ingredients-${ingredient.id}`} value={ingredient.id}>
                                                  {ingredient.name}
                                                </option>
                                              ))}
                                            </select>
                                            <input
                                              type="number"
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.amount`}
                                              className={"input input-bordered"}
                                              onChange={handleChange}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].amount}
                                            />
                                            <select
                                              name={`steps.${indexStep}.ingredients.${indexIngredient}.unit`}
                                              className={`select select-bordered ${(errors.steps?.[indexStep] as any)?.ingredients?.[indexIngredient]?.unit ? "select-error" : ""}`}
                                              onChange={handleChange}
                                              onBlur={handleBlur}
                                              value={values.steps[indexStep].ingredients[indexIngredient].unit}
                                            >
                                              <option value={""}>Auswählen</option>
                                              {Object.values(CocktailIngredientUnit).map((value) => (
                                                <option key={`steps.${indexStep}.ingredients.${indexIngredient}.units-${value}`} value={value}>
                                                  {value}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type={"button"}
                                              className={"btn btn-error btn-square"}
                                              disabled={values.steps[indexStep].ingredients.length == 1}
                                              onClick={() => removeIngredient(indexIngredient)}>
                                              <FaTrashAlt />
                                            </button>
                                          </div>
                                        </div>
                                      ))}

                                      <div className={"w-full flex justify-end"}>
                                        <button
                                          type={"button"}
                                          className={"btn btn-outline btn-sm btn-secondary space-x-2"}
                                          onClick={() => pushIngredient({ amount: 0, unit: CocktailIngredientUnit.CL, ingredient: undefined })}
                                        >
                                          <FaPlus /><span>Zutat hinzufügen</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </FieldArray>
                              </>
                            ) : (
                              <div className={"flex flex-row justify-center items-center space-x-2"}>
                                {Object.values(CocktailTool).map((value) => (
                                  <div key={`form-recipe-step${step.id}-nomixing-${value}`} className={"flex flex-col justify-center items-center space-y-2"}>
                                    {/*<img className={"h-20"}*/}
                                    {/*     src={"https://res.cloudinary.com/lusini/w_1500,h_1500,q_80,c_pad,f_auto/pim/7f30f8/bf7939/ff5def/23f663/419537/65/7f30f8bf7939ff5def23f66341953765.jpeg"} />*/}
                                    <div>{value}</div>
                                    <Field
                                      type="radio"
                                      name={`steps.${indexStep}.tool`}
                                      value={value}
                                      className="radio radio-primary"
                                      onBlur={handleBlur}
                                    />
                                  </div>

                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        <div className={"flex justify-center"}>
                          <div className={"btn btn-sm btn-primary space-x-2"} onClick={() => {
                            const step: CocktailRecipeStepFull = {
                              id: "",
                              cocktailRecipeId: "",
                              tool: CocktailUtensil.SHAKE,
                              mixing: true,
                              stepNumber: values.steps.length,
                              ingredients: [{
                                id: "",
                                amount: 0,
                                ingredientId: "",
                                cocktailRecipeStepId: "",
                                unit: CocktailIngredientUnit.CL,
                                ingredient: undefined,
                                ingredientNumber: 0
                              }]
                            };
                            pushStep(step);
                          }}>
                            <FaPlus /> <span>Schritt hinzufügen</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </FieldArray>
                  <div className={"col-span-2 divider"}>Deko</div>
                  <div className={"col-span-2"}>

                    <label className={"label"}>
                      <span className={"label-text"}>Deko</span>
                      <span className={"text-error label-text-alt"}>
                      {errors.decoration && touched.decoration && errors.decoration} *
                    </span>
                    </label>
                    <select
                      name="decoration"
                      className={`select select-bordered w-full ${errors.decoration && touched.decoration && "select-error"}`}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      value={values.decoration}
                    >
                      <option value={""}>Auswählen</option>
                      {props.decorations.map((decoration) => (
                        <option key={`form-recipe-decoration-${decoration.id}`} value={decoration.id}>
                          {decoration.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className={"card"}>
                <div className={"card-body"}>

                  <div className={"text-2xl font-bold text-center"}>Vorschau</div>
                  <div className={"divider"}></div>
                  <div className={"form-control"}>
                    <label className={"label"}>
                      <span className={"label-text"}>Zeige Bilder</span>
                      <span className={"text-error label-text-alt"}>
                    </span>
                      <input
                        type={"checkbox"}
                        className={"toggle toggle-primary"}
                        name={"showImage"}
                        onChange={handleChange}
                        defaultChecked={false}
                        checked={values.showImage}
                        onBlur={handleBlur}
                      />
                    </label>
                  </div>
                  <div className={"form-control"}>
                    <label className={"label"}>
                      <span className={"label-text"}>Zeige Tags</span>
                      <span className={"text-error label-text-alt"}>
                    </span>
                      <input
                        type={"checkbox"}
                        className={"toggle toggle-primary"}
                        name={"showTags"}
                        onChange={handleChange}
                        defaultChecked={false}
                        checked={values.showTags}
                        onBlur={handleBlur}
                      />
                    </label>
                  </div>
                  <CocktailRecipeOverviewItem cocktailRecipe={{
                    id: "0",
                    image: values.image,
                    name: values.name,
                    description: values.description,
                    tags: values.tags,
                    price: values.price,
                    glassWithIce: values.glassWithIce,
                    glassId: values.glass,
                    glass: props.glasses.find((glass) => glass.id === values.glass),
                    decorationId: values.decoration,
                    decoration: props.decorations.find((decoration) => decoration.id === values.decoration),
                    steps: values.steps
                  }}
                                              showInfo={true}
                                              showTags={values.showTags}
                                              showImage={values.showImage}
                  />
                </div>

              </div>
              <div className={"p-4"}>
                <button type="submit" className={`btn btn-primary w-full ${isSubmitting ?? "loading"}`}>
                  {props.cocktailRecipe == undefined ? "Erstellen" : "Aktualisieren"}
                </button>
              </div>


              <div className={"card"}>
                <div className={"card-body"}>

                  <div className={"text-2xl font-bold text-center"}>Finanzen</div>
                  <div className={"divider"}></div>
                  <div className={"grid grid-cols-2 gap-1"}>
                    <>
                      {values.steps.filter((step) => step.ingredients.some(ingredient => ingredient.ingredient != undefined)).length > 0 ? (values.steps.map((step, indexStep) => (step.ingredients.filter(ingredient => ingredient.ingredient != undefined))).flat()?.map((ingredient, indexIngredient) => (
                        <>
                          <div key={`price-calculation-step-${indexIngredient}-name`}>{ingredient.ingredient.shortName ?? ingredient.ingredient.name}</div>
                          <div
                            key={`price-calculation-step-${indexIngredient}-price`}
                            className={"grid grid-cols-2"}
                          >
                            <div>{ingredient.amount} x {(ingredient.ingredient.price / ingredient.ingredient.volume).toFixed(2)}</div>
                            <div
                              className={"text-end"}>{indexIngredient > 0 ? "+ " : ""}{((ingredient.ingredient.price / ingredient.ingredient.volume) * ingredient.amount).toFixed(2)}€
                            </div>
                          </div>
                        </>
                      ))) : <></>}
                    </>
                    <div className={"col-span-2 border-b border-base-200"}></div>
                    <div>Summe</div>
                    <div className={"grid grid-cols-3"}>
                      <div></div>
                      <div></div>
                      <div className={"font-bold text-end"}>
                        {values.steps.filter((step) => step.ingredients.some(ingredient => ingredient.ingredient != undefined)).length > 0 ? (
                          values.steps.map((step, indexStep) => (step.ingredients.filter(ingredient => ingredient.ingredient != undefined))).flat().map(ingredient => ((ingredient.ingredient.price / ingredient.ingredient.volume) * ingredient.amount))
                            .reduce((summ, sum) => (summ + sum)).toFixed(2) + " €"
                        ) : (
                          "0.00 €"
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </Formik>
  );
}
