import { DataTypes } from "sequelize";
import sequelize from "../../config/database.js";

const CampaignDelivery = sequelize.define(
  "CampaignDelivery",
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false },
    status: { type: DataTypes.ENUM("queued", "accepted", "failed", "skipped"), allowNull: false },
    providerMessageId: DataTypes.STRING(255),
    error: DataTypes.STRING(1000),
    acceptedAt: DataTypes.DATE,
  },
  {
    tableName: "campaign_deliveries",
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ["campaign_id", "user_id"] }],
  },
);

export default CampaignDelivery;
