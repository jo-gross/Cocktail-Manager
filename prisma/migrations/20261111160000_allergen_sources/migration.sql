-- CreateEnum
CREATE TYPE "AllergenSource" AS ENUM ('WHEAT', 'SPELT', 'KHORASAN_WHEAT', 'RYE', 'BARLEY', 'OATS', 'ALMONDS', 'HAZELNUTS', 'WALNUTS', 'CASHEWS', 'PECANS', 'BRAZIL_NUTS', 'PISTACHIOS', 'MACADAMIA_NUTS');

-- AlterTable
ALTER TABLE "Garnish" ADD COLUMN     "allergenSources" "AllergenSource"[] DEFAULT ARRAY[]::"AllergenSource"[];

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "allergenSources" "AllergenSource"[] DEFAULT ARRAY[]::"AllergenSource"[];
