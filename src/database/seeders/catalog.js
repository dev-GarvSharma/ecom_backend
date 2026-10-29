import { Category, Product, ProductVariant } from "../models/index.js";
import { seedBy } from "./helpers.js";

export const seedCatalog = async () => {
  const definitions = [
    ["Perfumes", "perfumes", "Fine fragrances for every occasion."],
    ["Discovery Sets", "discovery-sets", "Explore signature scents before choosing a bottle."],
    ["Gift Sets", "gift-sets", "Thoughtful fragrance gifts and curated sets."],
  ];
  const categories = await Promise.all(
    definitions.map(([name, slug, description], index) =>
      seedBy(Category, "slug", {
        name,
        slug,
        description,
        priority: definitions.length - index,
        showOnHomePage: true,
        active: true,
        metaTitle: `${name} | Perfume House`,
        metaDescription: description,
        robotsMetaTag: "index,follow",
      }),
    ),
  );
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const fragrances = [
    {
      name: "Velvet Rose Eau de Parfum",
      slug: "velvet-rose-eau-de-parfum",
      category: "perfumes",
      brand: "Maison Aroma",
      concentration: "Eau de Parfum",
      fragranceFamily: "Floral amber",
      description: "A modern rose fragrance warmed with amber and soft woods.",
      topNotes: ["Pink pepper", "Bergamot"],
      heartNotes: ["Rose", "Jasmine"],
      baseNotes: ["Amber", "Sandalwood"],
      variants: [
        {
          sku: "VR-50-EDP",
          options: { volumeMl: 50 },
          price: 3499,
          compareAtPrice: 3999,
          stock: 40,
        },
        {
          sku: "VR-100-EDP",
          options: { volumeMl: 100 },
          price: 5499,
          compareAtPrice: 6299,
          stock: 25,
        },
      ],
    },
    {
      name: "Cedar Coast Eau de Parfum",
      slug: "cedar-coast-eau-de-parfum",
      category: "perfumes",
      brand: "Maison Aroma",
      concentration: "Eau de Parfum",
      fragranceFamily: "Woody aromatic",
      description: "Bright citrus and aromatic herbs over a lasting cedar base.",
      topNotes: ["Grapefruit", "Cardamom"],
      heartNotes: ["Lavender", "Clary sage"],
      baseNotes: ["Cedar", "Vetiver"],
      variants: [
        {
          sku: "CC-50-EDP",
          options: { volumeMl: 50 },
          price: 3299,
          compareAtPrice: 3799,
          stock: 32,
        },
        {
          sku: "CC-100-EDP",
          options: { volumeMl: 100 },
          price: 5199,
          compareAtPrice: 5999,
          stock: 18,
        },
      ],
    },
    {
      name: "Saffron Dusk Discovery Set",
      slug: "saffron-dusk-discovery-set",
      category: "discovery-sets",
      brand: "Maison Aroma",
      concentration: "Discovery set",
      fragranceFamily: "Amber gourmand",
      description: "A curated set of miniature scents for finding your signature fragrance.",
      topNotes: ["Saffron", "Mandarin"],
      heartNotes: ["Jasmine", "Praline"],
      baseNotes: ["Vanilla", "Musk"],
      variants: [
        {
          sku: "SD-DISCOVERY-SET",
          options: { volumeMl: 5, pieces: 4 },
          price: 1499,
          compareAtPrice: 1799,
          stock: 50,
        },
      ],
    },
  ];
  const products = [];
  for (const details of fragrances) {
    const product = await seedBy(Product, "slug", {
      categoryId: categoryBySlug.get(details.category).id,
      name: details.name,
      slug: details.slug,
      description: details.description,
      brand: details.brand,
      concentration: details.concentration,
      fragranceFamily: details.fragranceFamily,
      topNotes: details.topNotes,
      heartNotes: details.heartNotes,
      baseNotes: details.baseNotes,
      attributes: {},
      showOnShop: true,
      status: "active",
    });
    const variants = [];
    for (const variant of details.variants)
      variants.push(
        await seedBy(ProductVariant, "sku", { productId: product.id, ...variant, active: true }),
      );
    products.push({ ...product.toJSON(), variants, defaultVariant: variants[0] });
  }
  return { categories, products };
};
