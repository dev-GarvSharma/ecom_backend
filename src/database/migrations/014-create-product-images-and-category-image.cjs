'use strict';

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('categories', 'image', {
      type: DataTypes.STRING,
      allowNull: true,
    });

    await queryInterface.createTable('product_images', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      product_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      path: {
        type: DataTypes.STRING(1024),
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Preserve existing non-inline image paths when moving away from products.images.
    const [products] = await queryInterface.sequelize.query(
      'SELECT id, images FROM products WHERE images IS NOT NULL',
    );
    const now = new Date();
    const legacyImages = [];
    for (const product of products) {
      let images = product.images;
      if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch { images = []; }
      }
      if (!Array.isArray(images)) continue;
      for (const image of images) {
        if (typeof image === 'string' && image.trim() && !image.startsWith('data:')) {
          legacyImages.push({
            id: require('crypto').randomUUID(),
            product_id: product.id,
            path: image,
            created_at: now,
            updated_at: now,
          });
        }
      }
    }
    if (legacyImages.length) await queryInterface.bulkInsert('product_images', legacyImages);
    await queryInterface.removeColumn('products', 'images');
  },

  down: async (queryInterface) => {
    await queryInterface.addColumn('products', 'images', {
      type: DataTypes.JSON,
      allowNull: true,
    });
    const [images] = await queryInterface.sequelize.query(
      'SELECT product_id, path FROM product_images ORDER BY created_at, id',
    );
    const grouped = new Map();
    for (const image of images) {
      const paths = grouped.get(image.product_id) || [];
      paths.push(image.path);
      grouped.set(image.product_id, paths);
    }
    for (const [productId, paths] of grouped) {
      await queryInterface.bulkUpdate('products', { images: JSON.stringify(paths) }, { id: productId });
    }
    await queryInterface.dropTable('product_images');
    await queryInterface.removeColumn('categories', 'image');
  },
};
