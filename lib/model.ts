import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand, PutCommandOutput, TranslateConfig, GetCommandInput, GetCommandOutput, QueryCommand, QueryCommandInput, QueryCommandOutput, PutCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient, CreateTableCommand, CreateTableCommandOutput, ListTablesCommand, DescribeTableCommand, DescribeTableCommandInput, DescribeTableInput, DescribeTableOutput, DescribeTableCommandOutput, TableDescription, ReturnValue, PutItemCommandInput } from "@aws-sdk/client-dynamodb";
import { Schema } from "./schema";
import { ISchema, selectAlias, createOptions, DBNumber, DBString } from "./types/schema";
import { EventEmitter } from "events";
import { reservedWords } from "./reservedWords";

export class Model extends EventEmitter {
    // temporary use of EventEmiter for testing in index.ts as top-level await isnt supported
    readonly name: string;
    readonly schema: Schema;
    readonly client: DynamoDBClient;
    readonly docClient: DynamoDBDocumentClient;
    protected TableDescription?: TableDescription;
    static TableNames?: string[];
    static definedModels: Model[] = [];
    readonly defaultCreateOptions: createOptions = { returnCreated: false, applyVirtualSetters: true };
    constructor(name: string, schema: Schema, client: DynamoDBClient, translateConfig?: TranslateConfig) {
        if (Model.definedModels.find((x) => x.name == name)) {
            throw new Error(`Model '${name}' is already declared`);
        }
        super();
        this.name = name;
        this.schema = schema;
        this.client = client;
        this.docClient = DynamoDBDocumentClient.from(client, translateConfig);

        this.init().then(() => {
            this.emit("ready");
        });
    }

    private getCmdInputParams(partitionKey: string | number, select?: string | selectAlias): GetCommandInput {
        const key = this.schema.partitionKey;
        let params: GetCommandInput = {
            TableName: this.name,
            Key: {
                [key]: partitionKey,
            },
        };

        let ExpressionAttributeNames: any = {};
        if (typeof select == "string") {
            params.ProjectionExpression = select;
        } else if (typeof select == "object" && !Array.isArray(select)) {
            const selectAsAlias = Object.keys(select)
                .filter((a) => typeof select[a] === "string")
                .join(",");

            const selector = Object.keys(select)
                .filter((a) => select[a] === true)
                .join(",");
            params.ProjectionExpression = `${selectAsAlias},${selector}`;
        }

        if (params.ProjectionExpression) {
            params.ProjectionExpression = params.ProjectionExpression.replace(/\s/g, "");
            const checkingWords = params.ProjectionExpression.split(",");

            checkingWords.forEach((word) => {
                if (reservedWords.indexOf(word.toUpperCase()) !== -1) {
                    const safeValue = `#Safe${word}`;
                    ExpressionAttributeNames[safeValue] = word;
                    params.ProjectionExpression = params.ProjectionExpression!.replace(word, safeValue);
                }
            });
        }

        if (Object.keys(ExpressionAttributeNames).length) {
            params.ExpressionAttributeNames = ExpressionAttributeNames;
        }

        return params;
    }

    private createTable(): Promise<CreateTableCommandOutput> {
        const createTableCmd = new CreateTableCommand({
            TableName: this.name,
            AttributeDefinitions: this.schema.AttributeDefinitions,
            KeySchema: this.schema.KeySchema,
            ProvisionedThroughput: {
                ReadCapacityUnits: 1,
                WriteCapacityUnits: 1,
            },
        });

        return this.client.send(createTableCmd);
    }

    private async getTableNamesFromDB(): Promise<string[] | undefined> {
        try {
            const { TableNames } = await this.client.send(new ListTablesCommand({}));
            return TableNames;
        } catch (error) {
            console.error(error);
        }
    }

    private async applyVirtualGetters(dynamoItem: any, select?: string | selectAlias): Promise<Object> {
        const virtualFields = this.isSelectAlias(select) ? Object.keys(this.schema.virtualsGetter).filter((a) => (select as selectAlias)[a]) : Object.keys(this.schema.virtualsGetter);

        for (const funcName of virtualFields) {
            const virtualFunc = this.schema.virtualsGetter[funcName] as Function;

            dynamoItem[funcName] = await virtualFunc(dynamoItem);
        }

        return dynamoItem;
    }

    private applyAlias(dynamoItem: any, select: selectAlias) {
        // Currently only top level alias is supported
        if (typeof select == "object" && !Array.isArray(select)) {
            const selectAsAlias = Object.keys(select).filter((a) => typeof select[a] === "string");

            selectAsAlias.forEach((key) => {
                let paths = key.split(".");

                if (paths.length === 1) {
                    const alias = select[paths[0]] as string;
                    if (paths[0] == alias) {
                        return;
                    }

                    const originalObject = dynamoItem[paths[0]];
                    dynamoItem[alias] = originalObject;

                    delete dynamoItem[paths[0]];
                }
            });
        }
        return dynamoItem;
    }

    private async init() {
        try {
            if (!Model.TableNames) {
                Model.TableNames = await this.getTableNamesFromDB();
            }

            if (Model.TableNames && Model.TableNames.indexOf(this.name) == -1) {
                this.TableDescription = (await this.createTable()).TableDescription;
            } else {
                // check if table structure is the same as in Schema
                // Otherwise request update Table

                this.TableDescription = (await this.describe()).Table;
            }
            //  console.log(this.TableDescription);
        } catch (error) {
            console.error(error);
        }
    }

    private isSelectAlias(obj?: string | selectAlias) {
        const selectType = typeof obj;
        return obj && selectType !== "string" && selectType == "object" && !Array.isArray(selectType);
    }

    private describe(): Promise<DescribeTableCommandOutput> {
        const cmd: DescribeTableCommandInput = {
            TableName: this.name,
        };
        return this.client.send(new DescribeTableCommand(cmd));
    }

    private async getRequiredFields(item: any): Promise<string[]> {
        const fields = this.schema.fields;
        let requiredFields: string[] = [];

        for (const field of Object.keys(fields)) {
            const requiredType = typeof fields[field].required;

            if (requiredType == "boolean") {
                requiredFields.push(field);
            } else if (requiredType == "function") {
                const requiredFunc = fields[field].required as unknown as Function;

                const isRequired = await requiredFunc(item);

                if (isRequired) {
                    requiredFields.push(field);
                }
            }
        }

        return requiredFields;
    }

    private async setDefaultFields(item: any, requiredFields: string[]): Promise<any> {
        let sendingItem = { ...item };

        for (const e of requiredFields) {
            if (!item[e]) {
                const keyInSchema = this.schema.fields[e];
                const defaultType = typeof keyInSchema.default;

                if (defaultType == "function") {
                    const func = keyInSchema.default as unknown as FunctionConstructor;
                    sendingItem[e] = await func();
                } else if (defaultType !== "undefined") {
                    sendingItem[e] = keyInSchema.default;
                } else {
                    throw new Error(`${this.name}.${e} is required`);
                }
            }
        }

        return sendingItem;
    }

    private getEnumFields(): any {
        const fields = this.schema.fields;

        const enumFields: any = Object.keys(fields).reduce((accum: any, field: string) => {
            if (fields[field].enum) {
                accum[field] = fields[field].enum;
            }
            return accum;
        }, {});

        return enumFields;
    }
    private verifyEnums(item: any) {
        const enumFields = this.getEnumFields();

        Object.keys(item).forEach((field) => {
            if (enumFields[field] && !enumFields[field].includes(item[field])) {
                const allowedValues = enumFields[field].join(" / ");
                throw Error(`value '${item[field]}' is not supported on field '${this.name}.${field}'. Allowed values are '${allowedValues}'`);
            }
        });
    }

    private verifyStringMinMax(item: any) {}
    private verifyNumberMinMax(item: any) {
        const fields = this.schema.fields;
        let minValues: any = {};
        let maxValues: any = {};

        for (const field of Object.keys(fields)) {
            const minValue = (fields[field] as DBNumber).min;
            const maxValue = (fields[field] as DBNumber).max;

            if (typeof minValue == "number") {
                minValues[field] = minValue;
            }

            if (typeof maxValue == "number") {
                maxValues[field] = maxValue;
            }
        }

        Object.keys(item).forEach((field) => {
            if (field in minValues && item[field] < minValues[field]) {
                throw Error(`Minimum allowed value for '${this.name}.${field}' is '${minValues[field]}', received '${item[field]}'`);
            }

            if (field in maxValues && item[field] > maxValues[field]) {
                throw Error(`Maximum allowed value for '${this.name}.${field}' is '${maxValues[field]}', received '${item[field]}'`);
            }
        });
    }
    private cleanUnusedFields(item: any): any {
        const allowedFields = [...Object.keys(this.schema.fields), ...Object.keys(this.schema.virtualsSetter)];

        Object.keys(item).forEach((field) => {
            if (allowedFields.indexOf(field) == -1) {
                delete item[field];
            }
        });

        return item;
    }

    private verifyFieldsTypes(item: any) {}
    rawQuery(queryInput: QueryCommandInput): Promise<QueryCommandOutput> {
        queryInput.TableName = this.name;

        return this.docClient.send(new QueryCommand(queryInput));
    }

    find() {
        const findRequest: QueryCommandInput = {
            TableName: this.name,
        };

        return this.docClient.send(new QueryCommand(findRequest));
    }

    async create(item: any, options: createOptions = this.defaultCreateOptions): Promise<PutCommandOutput | any> {
        const requiredFields = await this.getRequiredFields(item);

        let sendingItem = await this.setDefaultFields(item, requiredFields);

        this.verifyEnums(sendingItem);
        this.verifyStringMinMax(sendingItem);
        this.verifyNumberMinMax(sendingItem);

        if (options.applyVirtualSetters) {
            // apply virtual Setters,
        }
        sendingItem = this.cleanUnusedFields(sendingItem);

        this.verifyFieldsTypes(sendingItem);
        const putCmdParams: PutItemCommandInput = {
            TableName: this.name,
            Item: sendingItem,
        };

        const putCmd = new PutCommand(putCmdParams);

        let createdItemResponse: any = await this.docClient.send(putCmd);
        if (options.returnCreated) {
            createdItemResponse.Item = sendingItem;
        }

        return createdItemResponse;
    }

    async getByPk(partitionKey: string | number, select?: string | selectAlias): Promise<any> {
        const getCmdParams = this.getCmdInputParams(partitionKey, select);

        let foundItem = (await this.docClient.send(new GetCommand(getCmdParams))).Item;

        if (foundItem) {
            foundItem = await this.applyVirtualGetters(foundItem, select);

            if (typeof select == "object" && !Array.isArray(select)) {
                foundItem = this.applyAlias(foundItem, select);
            }
        }

        return foundItem;
    }
    async deleteByPk(partitionKey: string | number): Promise<boolean> {
        const key = this.schema.partitionKey;
        const deleteCmd = {
            TableName: this.name,
            Key: {
                [key]: partitionKey,
            },
        };

        const { $metadata } = await this.docClient.send(new DeleteCommand(deleteCmd));

        return $metadata.httpStatusCode == 200;
    }
}
