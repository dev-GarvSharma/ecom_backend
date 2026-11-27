"use strict";
const { DataTypes } = require("sequelize");

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.createTable("newsletter_subscribers", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: true, unique: true, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(120), allowNull: true },
      status: { type: DataTypes.ENUM("subscribed", "unsubscribed"), allowNull: false, defaultValue: "subscribed" },
      subscribed_at: DataTypes.DATE,
      unsubscribed_at: DataTypes.DATE,
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.sequelize.query(`
      INSERT INTO newsletter_subscribers (id, user_id, email, name, status, subscribed_at, unsubscribed_at, created_at, updated_at)
      SELECT UUID(), id, email, name,
        CASE WHEN marketing_email_subscribed = 1 THEN 'subscribed' ELSE 'unsubscribed' END,
        marketing_email_subscribed_at, marketing_email_unsubscribed_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM users WHERE email IS NOT NULL
    `);

    await queryInterface.addColumn("campaign_deliveries", "subscriber_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "newsletter_subscribers", key: "id" },
      onDelete: "CASCADE",
    });
    await queryInterface.changeColumn("campaign_deliveries", "user_id", {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    });
    await queryInterface.addIndex("campaign_deliveries", ["campaign_id", "subscriber_id"], {
      unique: true,
      name: "campaign_deliveries_campaign_subscriber_unique",
    });

    await queryInterface.removeColumn("users", "marketing_email_unsubscribed_at");
    await queryInterface.removeColumn("users", "marketing_email_subscribed_at");
    await queryInterface.removeColumn("users", "marketing_email_subscribed");
  },
  down: async (queryInterface) => {
    await queryInterface.addColumn("users", "marketing_email_subscribed", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn("users", "marketing_email_subscribed_at", { type: DataTypes.DATE, allowNull: true });
    await queryInterface.addColumn("users", "marketing_email_unsubscribed_at", { type: DataTypes.DATE, allowNull: true });
    await queryInterface.sequelize.query(`
      UPDATE users u JOIN newsletter_subscribers n ON n.user_id = u.id
      SET u.marketing_email_subscribed = (n.status = 'subscribed'),
          u.marketing_email_subscribed_at = n.subscribed_at,
          u.marketing_email_unsubscribed_at = n.unsubscribed_at
    `);
    await queryInterface.sequelize.query("DELETE FROM campaign_deliveries WHERE user_id IS NULL");
    await queryInterface.removeIndex("campaign_deliveries", "campaign_deliveries_campaign_subscriber_unique");
    await queryInterface.removeColumn("campaign_deliveries", "subscriber_id");
    await queryInterface.changeColumn("campaign_deliveries", "user_id", {
      type: DataTypes.UUID, allowNull: false,
      references: { model: "users", key: "id" }, onDelete: "CASCADE",
    });
    await queryInterface.dropTable("newsletter_subscribers");
  },
};
