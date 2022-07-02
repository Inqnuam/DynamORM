import { Model } from "../lib/model";
import { Schema, DyString, DyNumber, DyObject } from "../lib/schema";
import { randomUUID } from "crypto";

const id = DyString({
  partitionKey: true,
  sortKey: true,
  default: randomUUID,
});

const schema: Schema = new Schema({
  id: id,
  firstname: DyString({
    maxLength: (self) => {
      return 8;
    },
  }),
  lastname: DyString({
    minLength: (self) => {
      return 4;
    },
  }),
  data: DyObject({ fields: {} }),
  age: DyNumber({
    enum: (self) => {
      return self.isNew ? [7, 8] : [1, 2];
    },
  }),
  sex: DyString({
    enum: ["F", "M"], // add enum as function
    required: (self) => self.isNew,
  }),
  last: DyNumber({
    min: 4,
    max: (self) => {
      return self.isNew ? 5 : 3;
    },
    set: (self) => {
      return self.age < 18 ? self.last - 1 : self.last;
    },
  }),
});

schema.virtual.getter("fullname", (self: any) => {
  return `${self.firstname} ${self.lastname}`;
});

const clientConfig = { region: "eu-west-3", endpoint: "http://localhost:8000" };
export const Players = new Model("Players", schema, clientConfig);
