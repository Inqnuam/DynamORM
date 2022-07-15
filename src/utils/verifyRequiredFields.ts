import { DBObject, DBString, ISchema } from "../types/schema";

async function getIsRequired(reqValue: any, self: any): Promise<boolean> {
  let isRequired = false;
  if (typeof reqValue == "boolean") {
    isRequired = reqValue;
  } else if (typeof reqValue == "function") {
    const requiredAsFunc = reqValue as Function;
    isRequired = await requiredAsFunc(self);
  }
  return isRequired;
}

export async function verifyRequiredFields(fields: ISchema, item: any, nestedPath: string, self?: any): Promise<string[]> {
  let customSelf = self ?? item;
  let errors: string[] = [];
  for (const field of Object.keys(fields)) {
    const fieldObject = fields[field];
    let isRequired = await getIsRequired(fieldObject.required, customSelf);

    if (isRequired && !(field in item)) {
      errors.push(`${nestedPath}.${field} is required`);
    }
    if (fieldObject.type == "M" && fieldObject.fields && typeof item[field] == "object" && !Array.isArray(item[field])) {
      const childErrors = await verifyRequiredFields(fieldObject.fields, item[field], `${nestedPath}.${field}`, customSelf);
      if (childErrors.length) {
        errors = errors.concat(childErrors);
      }
    }
  }
  return errors;
}
