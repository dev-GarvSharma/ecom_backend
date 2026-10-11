import "dotenv/config";
import { Sequelize } from "sequelize";
const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE,
  process.env.MYSQL_USER,
  process.env.MYSQL_PASSWORD,
  {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    dialect: "mysql",
    logging: false,
    timezone: "+00:00",
    dialectOptions:
      process.env.MYSQL_SSL === "true"
        ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }
        : {},
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { underscored: true, timestamps: true },
  },
);
export default sequelize;
