import { DBNumber, DBString, DBObject, ISchema } from "../types/schema";

async function getEnumFields(fields: ISchema, item: any, self: any): Promise<any> {
  let enumFields: any = {};

  for (const field of Object.keys(fields)) {
    const fType = fields[field].type;
    let enumField: string[] | number[] = [];
    if (fType == "S") {
      enumField = (fields[field] as DBString).enum as string[];
    }
    if (fType == "N") {
      enumField = (fields[field] as DBNumber).enum as number[];
    }
    if (Array.isArray(enumField)) {
      enumFields[field] = enumField;
    } else if (typeof enumField == "function") {
      const enumFunc = enumField as Function;
      enumFields[field] = await enumFunc(self);
    }

    if (enumFields[field] && !enumFields[field].length) {
      delete enumFields[field];
    }
  }
  return enumFields;
}

export async function verifyEnums(fields: ISchema, item: any, nestedPath: string, self?: any) {
  let customSelf = self ?? item;
  const enumFields = await getEnumFields(fields, item, customSelf);

  for (const field of Object.keys(item)) {
    const tField = typeof item[field];

    if (tField == "string" || tField == "number") {
      if (enumFields[field] && !enumFields[field].includes(item[field])) {
        const allowedValues = enumFields[field].join(" / ");
        throw Error(`value '${item[field]}' is not supported on field '${nestedPath}.${field}'. Allowed values are '${allowedValues}'`);
      }
    }

    if (tField == "object" && !Array.isArray(item[field]) && fields[field].type == "M") {
      const fieldObject = fields[field] as DBObject;
      if (fieldObject.fields) {
        await verifyEnums(fieldObject.fields, item[field], `${nestedPath}.${field}`, customSelf);
      }
    }
  }
}
