import { ISchema, DBString, DBNumber, VirtualFields } from "./types/schema";
import { AttributeDefinition, KeySchemaElement } from "@aws-sdk/client-dynamodb";

export const DyString = (attributes: DBString = {}): DBString => {
    attributes.type = "S";

    if (attributes.partitionKey || attributes.secondaryKey) {
        attributes.required = true;
    }
    return attributes;
};

export const DyNumber = (attributes: DBNumber = {}): DBNumber => {
    attributes.type = "N";

    if (attributes.partitionKey || attributes.secondaryKey) {
        attributes.required = true;
    }
    return attributes;
};

export class Schema {
    fields: ISchema;
    requiredFields: ISchema = {};
    partitionKey: string = "";
    virtualsSetter: VirtualFields = {};
    virtualsGetter: VirtualFields = {};
    AttributeDefinitions: AttributeDefinition[] = [];
    KeySchema: KeySchemaElement[] = [];

    readonly virtual = {
        getter: (name: string, callback: (schema: any) => any | Promise<any>) => {
            this.checkField(name, callback);
            this.virtualsGetter[name] = callback;
        },
        setter: (name: string, callback: (schema: any) => any | Promise<any>) => {
            this.checkField(name, callback);
            this.virtualsSetter[name] = callback;
        },
    };
    constructor(schema: ISchema) {
        Object.keys(schema).forEach((e) => {
            const key = schema[e];

            if (key.partitionKey || key.secondaryKey || key.globalIndex) {
                if (key.partitionKey) {
                    if (this.partitionKey == "") {
                        this.partitionKey = e;
                    } else {
                        throw new Error(`partitionKey is already set on field '${this.partitionKey}'`);
                    }
                }

                this.AttributeDefinitions.push({
                    AttributeName: e,
                    AttributeType: key.type,
                });

                this.KeySchema.push({
                    AttributeName: e,
                    KeyType: key.sortKey ? "HASH" : "RANGE",
                });
            }
        });

        if (this.partitionKey == "") {
            throw new Error("Partition key is required on a field");
        }
        this.fields = schema;
    }

    private checkField(name: string, virtual: (schema: any) => any | Promise<any>) {
        if (typeof virtual !== "function") {
            throw Error("'virtual' param must be a function");
        }

        if (this.fields[name]) {
            throw new Error(`'${name}' field can't be virtual. Chose another field name...`);
        }
    }
}
