import { Address, sequelize } from "../database/models/index.js";
import { ok, fail } from "../utils/http.js";

const fields = [
  "recipient",
  "phone",
  "line1",
  "line2",
  "city",
  "state",
  "postalCode",
  "country",
  "isDefault",
];
const addressValues = (body, partial = false) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (Object.keys(body).some((key) => !fields.includes(key))) return null;
  const values = Object.fromEntries(
    fields.filter((key) => key in body).map((key) => [key, body[key]]),
  );
  if (!partial) {
    for (const key of ["recipient", "phone", "line1", "city", "state", "postalCode"])
      if (typeof values[key] !== "string" || !values[key].trim()) return null;
  }
  for (const key of ["recipient", "phone", "line1", "line2", "city", "state", "postalCode"])
    if (values[key] !== undefined && typeof values[key] !== "string") return null;
  if (values.country !== undefined && !/^[A-Za-z]{2}$/.test(values.country)) return null;
  if (values.isDefault !== undefined && typeof values.isDefault !== "boolean") return null;
  for (const [key, limit] of Object.entries({
    recipient: 120,
    phone: 32,
    line1: 255,
    line2: 255,
    city: 120,
    state: 120,
    postalCode: 20,
  }))
    if (values[key] !== undefined) values[key] = values[key].trim().slice(0, limit);
  if (values.country) values.country = values.country.toUpperCase();
  return values;
};

export const addresses = async (req, res) =>
  ok(
    res,
    await Address.findAll({
      where: { userId: req.user.id },
      order: [
        ["isDefault", "DESC"],
        ["createdAt", "DESC"],
      ],
    }),
    "Addresses loaded.",
  );

export const addressAdd = async (req, res) => {
  const values = addressValues(req.body);
  if (!values) return fail(res, 400, "Provide a complete valid address.");
  const address = await sequelize.transaction(async (transaction) => {
    if (values.isDefault)
      await Address.update({ isDefault: false }, { where: { userId: req.user.id }, transaction });
    return Address.create({ ...values, userId: req.user.id }, { transaction });
  });
  return ok(res, address, "Address saved.", null, 201);
};

export const addressUpdate = async (req, res) => {
  const values = addressValues(req.body, true);
  if (!values || !Object.keys(values).length)
    return fail(res, 400, "Provide valid address fields.");
  const address = await Address.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!address) return fail(res, 404, "Address not found.");
  await sequelize.transaction(async (transaction) => {
    if (values.isDefault)
      await Address.update({ isDefault: false }, { where: { userId: req.user.id }, transaction });
    await address.update(values, { transaction });
  });
  return ok(res, address, "Address updated.");
};

export const addressDelete = async (req, res) => {
  const deleted = await Address.destroy({
    where: { id: req.params.id, userId: req.user.id },
  });
  return deleted ? ok(res, null, "Address removed.") : fail(res, 404, "Address not found.");
};
