import { ISchema, DBObject } from "../types/schema";

export async function applyCustomSetters(fields: ISchema, item: any, self?: any): Promise<any> {
  let customSelf = self ?? item;

  for (const field of Object.keys(item)) {
    if (!fields[field]) {
      continue;
    }
    if (fields[field].set) {
      const setterFunc = fields[field].set as Function;
      item[field] = await setterFunc(customSelf);
    }

    if (fields[field].type == "M" && typeof item[field] == "object" && !Array.isArray(item[field])) {
      const fieldObject = fields[field] as DBObject;
      if (fieldObject.fields) {
        item[field] = await applyCustomSetters(fieldObject.fields, item[field], customSelf);
      }
    }

    if (Array.isArray(item[field]) && fields[field].type!.startsWith("L")) {
    }
  }
  return item;
}
