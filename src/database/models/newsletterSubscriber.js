import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const NewsletterSubscriber = sequelize.define(
  "NewsletterSubscriber",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: true, unique: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: true },
    status: {
      type: DataTypes.ENUM("subscribed", "unsubscribed"),
      allowNull: false,
      defaultValue: "subscribed",
    },
    subscribedAt: DataTypes.DATE,
    unsubscribedAt: DataTypes.DATE,
  },
  { tableName: "newsletter_subscribers", underscored: true, timestamps: true },
);

export default NewsletterSubscriber;
