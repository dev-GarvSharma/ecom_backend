import { Op } from "sequelize";
import {
  Campaign,
  CampaignDelivery,
  CartItem,
  CartSession,
  UserInteractionEvent,
} from "../database/models/index.js";

// Mark campaign sends interrupted by a process restart as failed before serving requests.
async function failInterruptedCampaigns() {
  const campaigns = await Campaign.findAll({
    where: { status: "Sending" },
    attributes: ["id"],
  });

  for (const campaign of campaigns) {
    await CampaignDelivery.update(
      {
        status: "failed",
        error: "Sending process stopped before completion; review provider activity before retrying.",
      },
      { where: { campaignId: campaign.id, status: "queued" } },
    );
    await campaign.update({ status: "Failed" });
  }
}

// Abandon active carts that have items and have been idle for at least 24 hours.
async function expireStaleCarts() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleSessions = await CartSession.findAll({
    where: { status: "active", lastActivityAt: { [Op.lt]: cutoff } },
    limit: 500,
  });

  for (const session of staleSessions) {
    if (!(await CartItem.count({ where: { cartId: session.cartId } }))) continue;

    const [changed] = await CartSession.update(
      { status: "abandoned", abandonedAt: new Date() },
      { where: { id: session.id, status: "active" } },
    );
    if (changed) {
      await UserInteractionEvent.create({
        cartId: session.cartId,
        eventType: "cart.auto_abandoned",
        details: { idleHours: 24 },
      });
    }
  }
}

export async function runStartupMaintenance() {
  await failInterruptedCampaigns();
  await expireStaleCarts().catch((error) =>
    process.stderr.write(`Abandoned cart job failed: ${error.message}\n`),
  );

  // Recheck stale carts every 15 minutes; unref lets shutdown proceed without waiting on this timer.
  setInterval(
    () =>
      expireStaleCarts().catch((error) =>
        process.stderr.write(`Abandoned cart job failed: ${error.message}\n`),
      ),
    15 * 60 * 1000,
  ).unref();
}
