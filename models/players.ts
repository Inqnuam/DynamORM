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
    trim: true,
    maxLength: (self) => {
      return 8;
    },
    uppercase: false,
  }),
  lastname: DyString({
    capitalize: false,
  }),
  data: DyObject({
    fields: {
      anotherTrimmableFields: { type: "S", trim: true },
      nested: DyObject({
        fields: {
          bobo: DyObject({
            fields: {
              toto: DyObject({
                fields: {
                  lolo: DyString({ trim: true }),
                },
              }),
            },
          }),
        },
      }),
      rank: DyNumber({
        enum: (self) => {
          return self.isNew ? [1, 2, 3] : [0];
        },
      }),
      country: DyString({
        default: (self) => {
          return "France";
        },
        required: (self) => {
          return self.isNew;
        },
      }),
    },
  }),
  age: DyNumber({
    enum: (self) => {
      return self.isNew ? [7, 8] : [1, 2];
    },
  }),
  sex: DyString({
    enum: ["F", "M"],
    required: (self) => self.isNew,
  }),
  last: DyNumber({
    min: 8,
  }),
});

schema.virtual.getter("fullname", (self: any) => {
  return `${self.firstname} ${self.lastname}`;
});

schema.virtual.setter("score_global", (self) => {
  return self.firstname;
});

const clientConfig = { region: "eu-west-3", endpoint: "http://localhost:8000" };
export const Players = new Model("Players", schema, clientConfig);
