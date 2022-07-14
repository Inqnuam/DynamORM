import { DBNumber, DBObject, ISchema } from "../types/schema";

export async function verifyNumberMinMax(fields: ISchema, item: any, nestedPath: string, self?: any) {
  let minValues: any = {};
  let maxValues: any = {};
  let customSelf = self ?? item;

  for (const field of Object.keys(fields)) {
    const fType = fields[field].type;
    if (fType == "N") {
      const minValue = (fields[field] as DBNumber).min;
      const maxValue = (fields[field] as DBNumber).max;

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
        await verifyNumberMinMax(fieldObj.fields, item[field], `${nestedPath}.${field}`, customSelf);
      }
    }
  }

  Object.keys(item).forEach((field) => {
    if (field in minValues && item[field] < minValues[field]) {
      throw Error(`Minimum allowed value for '${nestedPath}.${field}' is '${minValues[field]}', received ${item[field]}`);
    }

    if (field in maxValues && item[field] > maxValues[field]) {
      throw Error(`Maximum allowed value for '${nestedPath}.${field}' is '${maxValues[field]}', received ${item[field]}`);
    }
  });
}
