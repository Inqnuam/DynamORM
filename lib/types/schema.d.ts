export type schemaPropertyPrimitivType = number | string | boolean | null | NumberConstructor | BooleanConstructor | StringConstructor | FunctionConstructor;
export type schemaPropertySetType = Set<number> | Set<string>;
export type schemaPropertyType = schemaPropertyPrimitivType | ISchema | Array<schemaPropertyPrimitivType> | schemaPropertySetType;

interface ISchemaString {
  default?: string | ((self?: any) => string);
  trim?: boolean | ((self?: any) => boolean);
  lowercase?: boolean | ((self?: any) => boolean);
  uppercase?: boolean | ((self?: any) => boolean);
  capitalize?: boolean | ((self?: any) => boolean);
  minLength?: number | ((self?: any) => number);
  maxLength?: number | ((self?: any) => number);
  enum?: string[] | ((self?: any) => string[]);
  set?: (self?: any) => string;
}

interface ISchemaNumber {
  default?: number | ((self?: any) => number);
  min?: number | ((self?: any) => number);
  max?: number | ((self?: any) => number);
  enum?: number[] | ((self?: any) => number[]);
  set?: (self?: any) => number;
}

interface ISchemaBinary {
  min?: number | ((self?: any) => number);
  max?: number | ((self?: any) => number);
}

interface ISchemaObject {
  type?: "M";
  default?: object | ((self?: any) => object);
  required?: boolean | ((self) => boolean);
  set?: (self?: any) => ISchema;
  ignoreUndeclared?: boolean;
  fields?: ISchema;
}

interface ISchemaArray {
  type?: "L";
  default?: array | ((self?: any) => array);
  required?: boolean | ((self) => boolean);
  set?: (self?: any) => array;
}

interface ISchemaBool {
  type?: "BOOL";
  default?: boolean | ((self?: any) => boolean);
  required?: boolean | ((self) => boolean);
  set?: (self?: any) => boolean;
  get?: (self?: any) => boolean;
}
interface ISchemaPrimitiveAttributes {
  partitionKey?: boolean;
  secondaryKey?: boolean;
  globalIndex?: boolean;
  sortKey?: boolean;
  required?: boolean | ((self) => boolean);
  get?: (self?: any) => any;
  type?: "S" | "N" | "B";
}

export type DBString = ISchemaString & ISchemaPrimitiveAttributes;
export type DBNumber = ISchemaNumber & ISchemaPrimitiveAttributes;
export type DBObject = ISchemaObject;
export type DBArray = ISchemaArray;
export type DBBool = ISchemaBool;
export interface ISchema {
  [attributeName: string]: DBString | DBNumber | DBObject | DBBool | DBArray;
}

export interface VirtualFields {
  [key: string]: Function;
}

export type selectAlias = { [key: string]: string | boolean | selectAlias };

export interface createOptions {
  returnCreated?: boolean;
  applyVirtualSetters?: boolean;
  applyVirtualGetters?: boolean;
}
