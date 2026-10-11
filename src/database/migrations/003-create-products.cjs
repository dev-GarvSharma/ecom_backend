'use strict';

const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('products', {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'categories',
          key: 'id',
        },
      },
      name: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(200),
        unique: true,
      },
      sku: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      description: DataTypes.TEXT,
      price: {
        type: DataTypes.DECIMAL(12,2),
        allowNull: false,
      },
      mrp: {
        type: DataTypes.DECIMAL(12,2),
        allowNull: false,
      },
      stock: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
      },
      weight: DataTypes.STRING,
      images: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
      show_on_shop: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      status: {
        type: DataTypes.ENUM('active','draft','archived'),
        defaultValue: 'active',
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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('products');
  },
};
