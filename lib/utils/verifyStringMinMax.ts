import { DBString, DBObject, ISchema } from "../types/schema";

export async function verifyStringMinMax(fields: ISchema, item: any, nestedPath: string, self?: any) {
  let minValues: any = {};
  let maxValues: any = {};
  let customSelf = self ?? item;

  for (const field of Object.keys(fields)) {
    const fType = fields[field].type;

    if (fType == "S") {
      const minValue = (fields[field] as DBString).minLength;
      const maxValue = (fields[field] as DBString).maxLength;

      if (typeof minValue == "number") {
        minValues[field] = minValue;
      } else if (typeof minValue == "function") {
        const minValueFunc = minValue as unknown as Function;
        minValues[field] = await minValueFunc(customSelf);

        if (typeof minValues[field] !== "number") {
          throw Error(`Custom defined 'min' function on '${nestedPath}.${field}' must return a number, received '${typeof maxValues[field]}'!`);
        }
      }

      if (typeof maxValue == "number") {
        maxValues[field] = maxValue;
      } else if (typeof maxValue == "function") {
        const maxValueFunc = maxValue as unknown as Function;
        maxValues[field] = await maxValueFunc(customSelf);

        if (typeof maxValues[field] !== "number") {
          throw Error(`Custom defined 'max' function on '${nestedPath}.${field}' must return a number, received '${typeof maxValues[field]}'!`);
        }
      }
    } else if (fType == "M" && typeof item[field] == "object") {
      const fieldObj = fields[field] as DBObject;
      if (fieldObj.fields) {
        await verifyStringMinMax(fieldObj.fields, item[field], `${nestedPath}.${field}`, customSelf);
      }
    }
  }

  Object.keys(item).forEach((field) => {
    if (field in minValues && item[field].length < minValues[field]) {
      throw Error(`Minimum allowed length for '${nestedPath}.${field}' is ${minValues[field]}`);
    }

    if (field in maxValues && item[field].length > maxValues[field]) {
      throw Error(`Maximum allowed length for '${nestedPath}.${field}' is ${maxValues[field]}`);
    }
  });
}
