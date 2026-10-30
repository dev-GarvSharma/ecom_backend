"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE contact_messages SET phone = '' WHERE phone IS NULL",
    );
    await queryInterface.changeColumn("contact_messages", "phone", {
      type: Sequelize.STRING(30),
      allowNull: false,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn("contact_messages", "phone", {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
  },
};
