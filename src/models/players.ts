import { Model } from "../model";
import { Schema, DyString, DyNumber, DyObject } from "../schema";
import { randomUUID } from "crypto";

const id = {
  type: String,
  partitionKey: true,
  sortKey: true,
  default: randomUUID,
};

const schema: Schema = new Schema({
  id: id,
  firstname: {
    type: String,
    trim: true,
    maxLength: (self: any) => {
      return 8;
    },
    uppercase: false,
  },
  lastname: {
    type: String,
    capitalize: false,
  },
  data: {
    type: Object,
    fields: {
      anotherTrimmableFields: { type: "String", trim: true },
      nested: {
        type: Object,
        fields: {
          bobo: {
            type: Object,
            fields: {
              toto: {
                type: Object,
                fields: {
                  lolo: Number,
                },
              },
            },
          },
        },
      },
      rank: {
        type: Number,
        enum: (self: any) => {
          return self.isNew ? [1, 2, 3] : [0];
        },
      },
      country: {
        type: String,
        default: (self: any) => {
          return "France";
        },
        required: (self: any) => {
          return self.isNew;
        },
      },
    },
  },
  age: {
    type: Number,
    enum: (self: any) => {
      return self.isNew ? [7, 8] : [1, 2];
    },
  },
  sex: {
    type: String,
    enum: ["F", "M"],
    required: (self: any) => self.isNew,
  },
  last: Number,
  resultsBySport: {
    type: Object,
    required: true,
    allowUndeclared: true,
    fields: {
      tennis: Number,
      football: Number,
    },
  },
});

schema.virtual.getter("fullname", (self: any) => {
  return `${self.firstname} ${self.lastname}`;
});

schema.virtual.setter("score_global", (self) => {
  return self.firstname;
});

const clientConfig = { region: "eu-west-3", endpoint: "http://localhost:8000" };
export const Players = new Model("Players", schema, clientConfig);
