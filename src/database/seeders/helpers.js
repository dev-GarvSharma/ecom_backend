import { User } from "../models/index.js";

export const seedBy = async (Model, key, values) => {
  const [record] = await Model.findOrCreate({ where: { [key]: values[key] }, defaults: values });
  await record.update(values);
  return record;
};

export const seedUserByEmail = async (values) => {
  const [user] = await User.unscoped().findOrCreate({
    where: { email: values.email },
    defaults: values,
  });
  await user.update(values);
  return user;
};
