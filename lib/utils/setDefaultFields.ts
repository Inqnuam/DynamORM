import { DBObject, DBString, ISchema } from "../types/schema";

export async function setDefaultFields(fields: ISchema, item: any, self?: any): Promise<any> {
  let customSelf = self ?? item;

  for (const field of Object.keys(fields)) {
    const fieldObject = fields[field];

    if (fieldObject.default && !item[field]) {
      if (typeof fieldObject.default == "function") {
        const defaultAsFunc = fieldObject.default as Function;
        item[field] = await defaultAsFunc(customSelf);
      } else {
        item[field] = fieldObject.default;
      }
    }

    if (fieldObject.type == "M" && fieldObject.fields && typeof item[field] == "object" && !Array.isArray(item[field])) {
      item[field] = await setDefaultFields(fieldObject.fields!, item[field], customSelf);
    }
  }

  return item;
}
