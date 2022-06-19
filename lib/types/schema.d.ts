export type schemaPropertyPrimitivType = number | string | boolean | null | NumberConstructor | BooleanConstructor | StringConstructor | FunctionConstructor;
export type schemaPropertySetType = Set<number> | Set<string>;
export type schemaPropertyType = schemaPropertyPrimitivType | ISchema | Array<schemaPropertyPrimitivType> | schemaPropertySetType;

export interface ISchemaOptions {
    type: ISchema | schemaPropertyPrimitivType;
    required?: boolean | "once";
    default?: ISchema;
    min?: number;
    max?: number;
    trim?: boolean;
    partitionKey?: boolean;
    secondaryKey?: boolean;
    globalIndex?: boolean;
    sortKey?: boolean;
}

interface ISchemaString {
    default?: string | ((self?: any) => string);
    trim?: boolean;
    minLength?: number;
    maxLength?: number;
    enum?: string[];
}

interface ISchemaNumber {
    default?: number;
    min?: number;
    max?: number;
    enum?: number[];
}

interface ISchemaBinary {
    min?: number;
    max?: number;
}

interface ISchemaPrimitiveAttributes {
    partitionKey?: boolean;
    secondaryKey?: boolean;
    globalIndex?: boolean;
    sortKey?: boolean;
    required?: boolean | ((self) => boolean);
    set?: FunctionConstructor;
    get?: FunctionConstructor;
    type?: "S" | "N" | "B";
}

export type DBString = ISchemaString & ISchemaPrimitiveAttributes;
export type DBNumber = ISchemaNumber & ISchemaPrimitiveAttributes;

export interface ISchema {
    [attributeName: string]: DBString | DBNumber;
}

export interface VirtualFields {
    [key: string]: Function;
}

export type selectAlias = { [key: string]: string | boolean };

export interface createOptions {
    returnCreated?: boolean;
    applyVirtualSetters?: boolean;
}
