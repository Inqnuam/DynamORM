import { Model } from "../lib/model";
import { Schema, DyString, DyNumber } from "../lib/schema";
import { randomUUID } from "crypto";
import { client } from "../db";

const id = DyString({
    partitionKey: true,
    sortKey: true,
    default: randomUUID,
});

const schema: Schema = new Schema({
    id: id,
    firstname: DyString(),
    lastname: DyString(),
    age: DyNumber({
        min: 18, // add min as function
        max: 95, // add max as function
    }),
    sex: DyString({
        enum: ["F", "M"], // add enum as function
        required: (self) => self.isNew,
    }),
    last: DyNumber({
        // enum: [1, 5],
        min: 4,
        max: 8,
    }),
});

schema.virtual.getter("fullname", function (self: any) {
    return `${self.firstname} ${self.lastname}`;
});

export const Players = new Model("Players", schema, client);
