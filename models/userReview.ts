import { Model } from "../lib/model";
import { Schema, DyString } from "../lib/schema";
import { randomUUID } from "crypto";

const schema: Schema = new Schema({
  id: DyString({
    partitionKey: true,
    sortKey: true,
    default: randomUUID,
  }),
  author_id: DyString({
    required: true,
  }),
  category: DyString({
    default: () => {
      return "";
    },
  }),
  comment: DyString(),
  comment_disliked: DyString(),
  comment_liked: DyString(),
  comment_problem: DyString(),
  conso_moyenne: DyString(),
  created_date: DyString(),
  energy: DyString(),
  entretien: DyString({
    enum: ["centreauto", "concession", "garagiste", "moimeme"],
  }),
  family: DyString({
    enum: ["auto", "moto"],
  }),
  hk1: DyString(),
  hk2: DyString(),
  hk3: DyString(),
  km_per_year: DyString(),
  millesime: DyString(),
  moderated_date: DyString(),
  possession: DyString(),
  rk1: DyString(),
  rk2: DyString(),
  rk3: DyString(),
  scores: DyString(),
  status: DyString({
    enum: ["UNVALIDATED", "VALIDATED", "SELECTED", "DELETED"],
  }),
  tag_id: DyString(),
  trimLevel: DyString(),
  type_road: DyString({
    enum: ["urbain", "extraurbain", "autoroute", "montagne"],
  }),
  type_use: DyString({
    enum: ["quotidien", "vacances", "weekend"],
  }),
  use: DyString(),
  user_id: DyString(),
  version: DyString(),
  version_id: DyString(),
});

schema.virtual.setter("score_global", (self) => {});

const clientConfig = { region: "eu-west-3", endpoint: "http://localhost:8000" };
export const UserReview = new Model("caradisiac-user-review-api-dev", schema, clientConfig);
