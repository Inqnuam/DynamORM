import { ISchema, DBString, DBNumber, DBObject, DBArray, VirtualFields } from "./types/schema";
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

export const DyObject = (attributes: DBObject = {}): DBObject => {
  attributes.type = "M";

  if (!("allowUndeclared" in attributes)) {
    attributes.allowUndeclared = false;
  }
  return attributes;
};

export const DyArray = (attributes: DBArray): DBArray => {
  if (!attributes.type) {
    attributes.type = "L";
  }
  return attributes;
};

const JS_CONSTRUCTOR_TO_DDB_TYPE: any = {
  String: "S",
  S: "S",
  Number: "N",
  N: "N",
  Boolean: "BOOL",
  BOOL: "BOOL",
  Object: "M",
  M: "M",
  Array: "L",
  L: "L",
  NS: "NS",
  SS: "SS",
};

const isPrimitiveType = (value: string) => {
  return value == "S" || value == "N" || value == "B";
};
export class Schema {
  fields: ISchema;
  requiredFields: ISchema = {};
  partitionKey: string = "";
  virtualsSetter: VirtualFields = {};
  virtualsGetter: VirtualFields = {};
  AttributeDefinitions: AttributeDefinition[] = [];
  KeySchema: KeySchemaElement[] = [];

  get virtual() {
    return {
      getter: (name: string, callback: (self: any) => any | Promise<any>) => {
        this.checkField(name, callback);
        this.virtualsGetter[name] = callback;
      },
      setter: (name: string, callback: (self: any) => any | Promise<any>) => {
        this.checkField(name, callback);
        this.virtualsSetter[name] = callback;
      },
    };
  }

  #parseSchema(schema: any): any {
    Object.keys(schema).forEach((e) => {
      let key = schema[e] as any;

      if (typeof key == "function") {
        const ddbType = JS_CONSTRUCTOR_TO_DDB_TYPE[key.name];

        if (!ddbType) {
          throw Error(`Unknown type ${key.name}`);
        }
        key = {
          type: ddbType,
        };
      } else if (typeof key == "string" && !JS_CONSTRUCTOR_TO_DDB_TYPE[key]) {
        throw Error(`Unknown type ${key}`);
      }

      if (key.type) {
        if (typeof key.type == "function") {
          const typeName = key.type.name;

          key.type = JS_CONSTRUCTOR_TO_DDB_TYPE[typeName];

          // check if type is a Set
          if (!key.type && typeName == "Set") {
            if (key.itemsType) {
              // TODO: parse Set type
            } else {
              throw Error("Set itemsType is required!");
            }
          }
        } else if (typeof key.type == "string") {
          const parsedType = JS_CONSTRUCTOR_TO_DDB_TYPE[key.type];

          if (!parsedType) {
            throw Error(`Unknown type ${key.type}`);
          }
          key.type = parsedType;
        }
        if (key.type == "M") {
          if (!key.fields) {
            key.fields = {};
          }
          key.fields = this.#parseSchema(key.fields);
        }
        if (isPrimitiveType(key.type)) {
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
        }
      }

      schema[e] = key;
    });

    return schema;
  }
  constructor(schema: any) {
    const parsedSchema = this.#parseSchema(schema);

    if (this.partitionKey == "") {
      throw new Error("Partition key is required on a field");
    }
    this.fields = parsedSchema;
  }

  private checkField(name: string, virtual: (schema: any) => any | Promise<any>) {
    if (typeof virtual !== "function") {
      throw Error("'virtual' param must be a function");
    }

    if (this.fields[name]) {
      throw new Error(`'${name}' field can't be virtual. Chose another field name...`);
    }

    // check  if schema is correctly set
    // example: max value can't be less than min
  }
}
