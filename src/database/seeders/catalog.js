import { Category, Product, ProductVariant } from "../models/index.js";

// --------------------------------------------------
// CATEGORIES
// --------------------------------------------------

const categories = [
  {
    name: "Perfumes",
    slug: "perfumes",
    description: "Explore the signature ELSE fragrance collection.",
  },
  {
    name: "Discovery Sets",
    slug: "discovery-sets",
    description: "Discover all four signature ELSE fragrances.",
  },
  {
    name: "Perfume Duo Sets",
    slug: "perfume-duo-sets",
    description: "Two signature fragrances, paired together.",
  },
  {
    name: "Gift Sets",
    slug: "gift-sets",
    description: "Thoughtfully paired fragrance gifts from ELSE.",
  },
];

// --------------------------------------------------
// INDIVIDUAL PERFUMES
// --------------------------------------------------

const perfumes = [
  {
    name: "Affection",
    slug: "affection",
    brand: "ELSE",
    concentration: "Eau de Parfum",
    fragranceFamily: "Floral Woody Musk",

    description:
      "A soft expression of warmth and intimacy. Affection opens with delicate freshness, unfolds into an elegant floral heart, and settles into a comforting blend of musk, sandalwood and vanilla.",

    topNotes: ["Bergamot", "Pink Pepper", "Pear"],
    heartNotes: ["Rose", "Jasmine", "Orange Blossom"],
    baseNotes: ["White Musk", "Sandalwood", "Vanilla"],

    attributes: {
      mood: "Romantic",
      intensity: "Soft",
      gender: "Unisex",
      occasion: ["Everyday", "Date Night", "Special Occasions"],
      season: ["Spring", "Autumn"],
      personality: "Warm and intimate",
    },

    variants: [
      {
        sku: "ELSE-AFFECTION-50ML",
        options: { volumeMl: 50 },
        price: 599,
        compareAtPrice: 699,
        stock: 100,
        active: true,
      },
      {
        sku: "ELSE-AFFECTION-100ML",
        options: { volumeMl: 100 },
        price: 899,
        compareAtPrice: 999,
        stock: 100,
        active: true,
      },
    ],
  },

  {
    name: "Obsession",
    slug: "obsession",
    brand: "ELSE",
    concentration: "Eau de Parfum",
    fragranceFamily: "Spicy Amber Woody",

    description:
      "Bold, magnetic and impossible to ignore. Obsession opens with a striking blend of spice and citrus, develops into a warm aromatic heart, and leaves behind a deep trail of amber, patchouli and vanilla.",

    topNotes: ["Black Pepper", "Cardamom", "Bergamot"],
    heartNotes: ["Cinnamon", "Lavender", "Geranium"],
    baseNotes: ["Amber", "Patchouli", "Vanilla", "Cedarwood"],

    attributes: {
      mood: "Intense",
      intensity: "Strong",
      gender: "Unisex",
      occasion: ["Evening", "Parties", "Special Occasions"],
      season: ["Winter", "Autumn"],
      personality: "Confident and magnetic",
    },

    variants: [
      {
        sku: "ELSE-OBSESSION-50ML",
        options: { volumeMl: 50 },
        price: 599,
        compareAtPrice: 699,
        stock: 100,
        active: true,
      },
      {
        sku: "ELSE-OBSESSION-100ML",
        options: { volumeMl: 100 },
        price: 899,
        compareAtPrice: 999,
        stock: 100,
        active: true,
      },
    ],
  },

  {
    name: "After Life",
    slug: "after-life",
    brand: "ELSE",
    concentration: "Eau de Parfum",
    fragranceFamily: "Woody Oud Amber",

    description:
      "Mysterious, deep and quietly captivating. After Life blends luminous spice with a smoky, textured heart before settling into a rich trail of oud, amber and earthy woods.",

    topNotes: ["Saffron", "Bergamot", "Black Pepper"],
    heartNotes: ["Incense", "Leather Accord", "Cedarwood"],
    baseNotes: ["Oud Accord", "Amber", "Vetiver", "Patchouli"],

    attributes: {
      mood: "Mysterious",
      intensity: "Strong",
      gender: "Unisex",
      occasion: ["Evening", "Formal Events", "Special Occasions"],
      season: ["Winter", "Autumn"],
      personality: "Deep and intriguing",
    },

    variants: [
      {
        sku: "ELSE-AFTER-LIFE-50ML",
        options: { volumeMl: 50 },
        price: 599,
        compareAtPrice: 699,
        stock: 100,
        active: true,
      },
      {
        sku: "ELSE-AFTER-LIFE-100ML",
        options: { volumeMl: 100 },
        price: 899,
        compareAtPrice: 999,
        stock: 100,
        active: true,
      },
    ],
  },

  {
    name: "Still",
    slug: "still",
    brand: "ELSE",
    concentration: "Eau de Parfum",
    fragranceFamily: "Fresh Aromatic Woody",

    description:
      "A quiet moment in a world that never slows down. Still opens with refreshing citrus and green tea, moves into an airy aromatic heart, and settles into a clean blend of musk, cedarwood and vetiver.",

    topNotes: ["Bergamot", "Mandarin", "Green Tea"],
    heartNotes: ["Neroli", "Lavender", "Violet Leaf"],
    baseNotes: ["White Musk", "Cedarwood", "Vetiver"],

    attributes: {
      mood: "Calm",
      intensity: "Moderate",
      gender: "Unisex",
      occasion: ["Everyday", "Office", "Casual"],
      season: ["Summer", "Spring"],
      personality: "Minimal and composed",
    },

    variants: [
      {
        sku: "ELSE-STILL-50ML",
        options: { volumeMl: 50 },
        price: 599,
        compareAtPrice: 699,
        stock: 100,
        active: true,
      },
      {
        sku: "ELSE-STILL-100ML",
        options: { volumeMl: 100 },
        price: 899,
        compareAtPrice: 999,
        stock: 100,
        active: true,
      },
    ],
  },
];

// --------------------------------------------------
// DISCOVERY COLLECTION
// --------------------------------------------------

const discoveryCollection = {
  name: "ELSE Discovery Collection",
  slug: "else-discovery-collection",
  brand: "ELSE",
  concentration: "Eau de Parfum",
  fragranceFamily: "Mixed Fragrance Collection",

  description:
    "Four moods. One essence. Discover the complete ELSE fragrance collection with four signature scents in convenient 10ml bottles. Find the fragrance that feels like you.",

  topNotes: ["Bergamot", "Pink Pepper", "Cardamom", "Saffron"],

  heartNotes: ["Rose", "Jasmine", "Lavender", "Incense"],

  baseNotes: ["White Musk", "Amber", "Sandalwood", "Oud Accord"],

  attributes: {
    mood: "Discover",
    gender: "Unisex",
    packType: "Discovery Set",
    bottleCount: 4,
    volumePerBottleMl: 10,
    totalVolumeMl: 40,
    fragrances: ["Affection", "Obsession", "After Life", "Still"],
  },

  variants: [
    {
      sku: "ELSE-DISCOVERY-4X10",
      options: {
        pack: "4 x 10ml",
        bottleCount: 4,
        volumePerBottleMl: 10,
        totalVolumeMl: 40,
      },
      price: 399,
      compareAtPrice: 499,
      stock: 100,
      active: true,
    },
  ],
};

// --------------------------------------------------
// DUO COMBINATIONS
// --------------------------------------------------

const duoCombinations = [
  {
    comboName: "The Embrace",
    fragrances: ["Affection", "Obsession"],
    fragranceSlugs: ["affection", "obsession"],
    sku: "ELSE-DUO-EMBRACE",
  },
  {
    comboName: "The Enigma",
    fragrances: ["Affection", "After Life"],
    fragranceSlugs: ["affection", "after-life"],
    sku: "ELSE-DUO-ENIGMA",
  },
  {
    comboName: "The Balance",
    fragrances: ["Affection", "Still"],
    fragranceSlugs: ["affection", "still"],
    sku: "ELSE-DUO-BALANCE",
  },
  {
    comboName: "The Allure",
    fragrances: ["Obsession", "After Life"],
    fragranceSlugs: ["obsession", "after-life"],
    sku: "ELSE-DUO-ALLURE",
  },
  {
    comboName: "The Contrast",
    fragrances: ["Obsession", "Still"],
    fragranceSlugs: ["obsession", "still"],
    sku: "ELSE-DUO-CONTRAST",
  },
  {
    comboName: "The Harmony",
    fragrances: ["After Life", "Still"],
    fragranceSlugs: ["after-life", "still"],
    sku: "ELSE-DUO-HARMONY",
  },
];

const signatureDuoSet = {
  name: "ELSE Signature Duo Set",
  slug: "else-signature-duo-set",
  brand: "ELSE",
  concentration: "Eau de Parfum",
  fragranceFamily: "Mixed Fragrance Collection",

  description:
    "Two fragrances. One perfect pairing. Explore the ELSE Signature Duo Set and choose from six thoughtfully curated combinations. Each set includes two 50ml Eau de Parfum bottles.",

  topNotes: ["Bergamot", "Pink Pepper", "Cardamom", "Saffron"],

  heartNotes: ["Rose", "Jasmine", "Lavender", "Incense"],

  baseNotes: ["White Musk", "Amber", "Sandalwood", "Oud Accord"],

  attributes: {
    mood: "Pairing",
    gender: "Unisex",
    packType: "Duo Set",
    bottleCount: 2,
    volumePerBottleMl: 50,
    totalVolumeMl: 100,
    availableCombinations: duoCombinations.map((item) => item.comboName),
  },

  variants: duoCombinations.map((item) => ({
    sku: item.sku,

    options: {
      comboName: item.comboName,
      fragrances: item.fragrances,
      fragranceSlugs: item.fragranceSlugs,
      quantity: 2,
      volumePerBottleMl: 50,
      totalVolumeMl: 100,
    },

    price: 1099,
    compareAtPrice: 1398,
    stock: 100,
    active: true,
  })),
};

// --------------------------------------------------
// UPDATE OR CREATE HELPERS
// --------------------------------------------------

const updateOrCreate = async (Model, where, data) => {
  const existing = await Model.findOne({ where });

  if (existing) {
    await existing.update(data);
    return existing;
  }

  return await Model.create(data);
};

// --------------------------------------------------
// MAIN SEED FUNCTION
// KEEPING ORIGINAL EXPORT NAME
// --------------------------------------------------

export const seedCatalog = async () => {
  try {
    const categoryMap = {};

    // Create categories if missing; update their details if existing.
    for (const categoryData of categories) {
      const category = await updateOrCreate(Category, { slug: categoryData.slug }, categoryData);

      categoryMap[categoryData.slug] = category;
    }

    const seedProduct = async (categorySlug, productData) => {
      const { variants, ...productFields } = productData;

      const product = await updateOrCreate(
        Product,
        { slug: productFields.slug },
        {
          ...productFields,
          categoryId: categoryMap[categorySlug].id,
          showOnShop: true,
          status: "active",
        },
      );

      // Update existing variants by SKU or create missing ones.
      for (const variantData of variants) {
        await updateOrCreate(
          ProductVariant,
          { sku: variantData.sku },
          {
            ...variantData,
            productId: product.id,
          },
        );
      }

      return product;
    };

    const seededProducts = [];

    // Individual fragrances
    for (const perfume of perfumes) {
      const product = await seedProduct("perfumes", perfume);
      seededProducts.push(product);
    }

    // Discovery Collection
    const discovery = await seedProduct("discovery-sets", discoveryCollection);

    seededProducts.push(discovery);

    // Signature Duo Set
    const duo = await seedProduct("perfume-duo-sets", signatureDuoSet);

    seededProducts.push(duo);

    console.log("ELSE catalogue seeded successfully.");

    return {
      categories: Object.keys(categoryMap).length,
      products: seededProducts.length,
    };
  } catch (error) {
    console.error("ELSE catalogue seeding failed:", error);
    throw error;
  }
};
