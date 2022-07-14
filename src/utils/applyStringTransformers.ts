import { DBObject, DBString, ISchema } from "../types/schema";

function capitalize(s: string) {
  if (typeof s !== "string") {
    let errMsg = `capitalize can only be applied on string, received:${typeof s}`;
    throw Error(errMsg);
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export async function applyStringTransformers(fields: ISchema, item: any, self?: any): Promise<any> {
  const customSelf = self ?? item;

  for (const k of Object.keys(fields)) {
    const fieldType = fields[k].type;

    if (fieldType == "S") {
      const field = fields[k] as DBString;

      // TRIM STRING
      if (field.trim && typeof item[k] == "string") {
        let shouldTrim: boolean = false;
        if (field.trim === true) {
          shouldTrim = true;
        } else if (typeof field.trim == "function") {
          const trimAsFunc = field.trim as Function;
          shouldTrim = await trimAsFunc(customSelf);
        }
        if (shouldTrim) {
          item[k] = (item[k] as string).trim();
        }
      }

      // LOWERCASE STRING
      if (field.lowercase && typeof item[k] == "string") {
        let shouldLowerCase: boolean = false;
        if (field.lowercase === true) {
          shouldLowerCase = true;
        } else if (typeof field.lowercase == "function") {
          const lowercaseAsFunc = field.lowercase as Function;
          shouldLowerCase = await lowercaseAsFunc(customSelf);
        }
        if (shouldLowerCase) {
          item[k] = (item[k] as string).toLowerCase();
        }
      }
      // UPPERCASE STRING
      if (field.uppercase && typeof item[k] == "string") {
        let shouldUpperCase: boolean = false;
        if (field.uppercase === true) {
          shouldUpperCase = true;
        } else if (typeof field.uppercase == "function") {
          const lowercaseAsFunc = field.uppercase as Function;
          shouldUpperCase = await lowercaseAsFunc(customSelf);
        }
        if (shouldUpperCase) {
          item[k] = (item[k] as string).toUpperCase();
        }
      }

      // CAPITALIZE STRING

      if (field.capitalize && typeof item[k] == "string") {
        let shouldCapitalize: boolean = false;
        if (field.capitalize === true) {
          shouldCapitalize = true;
        } else if (typeof field.capitalize == "function") {
          const capitalizeAsFunc = field.capitalize as Function;
          shouldCapitalize = await capitalizeAsFunc(customSelf);
        }
        if (shouldCapitalize) {
          item[k] = capitalize(item[k] as string);
        }
      }
    } else if (fieldType == "M" && typeof item[k] == "object") {
      const field = fields[k] as DBObject;

      if (field.fields) {
        item[k] = await applyStringTransformers(field.fields, item[k], customSelf);
      }
    }
  }

  return item;
}
