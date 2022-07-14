import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
  PutCommandOutput,
  TranslateConfig,
  GetCommandInput,
  GetCommandOutput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  PutCommandInput,
  UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBClient,
  DynamoDBClientConfig,
  CreateTableCommand,
  CreateTableCommandOutput,
  ListTablesCommand,
  DescribeTableCommand,
  DescribeTableCommandInput,
  DescribeTableInput,
  DescribeTableOutput,
  DescribeTableCommandOutput,
  TableDescription,
  ReturnValue,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { Schema } from "./schema";
import { ISchema, selectAlias, createOptions, DBNumber, DBString, DBObject } from "./types/schema";
import { EventEmitter } from "events";
import { reservedWords } from "./reservedWords";
import { applyStringTransformers } from "./utils/applyStringTransformers";
import { applyCustomSetters } from "./utils/applyCustomSetters";
import { verifyNumberMinMax } from "./utils/verifyNumberMinMax";
import { verifyStringMinMax } from "./utils/verifyStringMinMax";
import { verifyEnums } from "./utils/verifyEnums";
import { setDefaultFields } from "./utils/setDefaultFields";
import { verifyRequiredFields } from "./utils/verifyRequiredFields";
import { getUpdateExpressions } from "./utils/getUpdateExpressions";
import { ExpressionAttributes, AttributeValue, serializeConditionExpression, ConditionExpression } from "@aws/dynamodb-expressions";
import { convertToNative, unmarshall } from "@aws-sdk/util-dynamodb";
import { getConditionExpressions } from "./utils/getConditionExpressions";
export class Model extends EventEmitter {
  // temporary use of EventEmiter for testing in index.ts as top-level await isnt supported
  readonly name: string;
  readonly schema: Schema;
  readonly client: DynamoDBClient;
  readonly docClient: DynamoDBDocumentClient;
  protected TableDescription?: TableDescription;
  static TableNames?: string[];
  static definedModels: Model[] = [];
  #defaultCreateOptions: createOptions = { returnCreated: false, applyVirtualSetters: true, applyVirtualGetters: true };

  constructor(name: string, schema: Schema, clientConfig: DynamoDBClientConfig, translateConfig?: TranslateConfig) {
    if (Model.definedModels.find((x) => x.name == name)) {
      throw new Error(`Model '${name}' is already declared`);
    }
    super();
    this.name = name;
    this.schema = schema;
    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, translateConfig);

    this.#init().then(() => {
      this.emit("ready");
    });
  }

  #buildSelectableString(select: any, nestedPath?: string) {
    let selectString: string[] = [];

    for (const field of Object.keys(select)) {
      if (typeof select[field] === "string" || select[field] === true) {
        selectString.push(nestedPath ? `${nestedPath}.${field}` : field);
      } else if (typeof select[field] == "object") {
        let aliasedField = field;
        if (field.includes(":")) {
          aliasedField = field.split(":")[0];
        }
        const parsedChild = this.#buildSelectableString(select[field], nestedPath ? `${nestedPath}.${aliasedField}` : aliasedField);
        selectString = [...selectString, ...parsedChild];
      }
    }

    return selectString;
  }
  #getCmdInputParams(partitionKey: string | number, select?: string | selectAlias): GetCommandInput {
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
      let selectString: string[] = this.#buildSelectableString(select);

      params.ProjectionExpression = selectString.join(",");
    }

    if (params.ProjectionExpression) {
      params.ProjectionExpression = params.ProjectionExpression.replace(/\s/g, "");
      const checkingWords = params.ProjectionExpression.split(",")
        .map((w) => applyDynamoSelectExpressions(ExpressionAttributeNames, w))
        .join(",");
      params.ProjectionExpression = checkingWords;
    }

    if (Object.keys(ExpressionAttributeNames).length) {
      params.ExpressionAttributeNames = ExpressionAttributeNames;
    }

    return params;
  }

  async #createTable(): Promise<CreateTableCommandOutput> {
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

  async #getTableNamesFromDB(): Promise<string[] | undefined> {
    try {
      const { TableNames } = await this.client.send(new ListTablesCommand({}));
      return TableNames;
    } catch (error) {
      console.error(error);
    }
  }

  async #applyVirtualGetters(dynamoItem: any, select?: string | selectAlias): Promise<Object> {
    const virtualFields = this.#isSelectAlias(select) ? Object.keys(this.schema.virtualsGetter).filter((a) => (select as selectAlias)[a]) : Object.keys(this.schema.virtualsGetter);

    for (const funcName of virtualFields) {
      const virtualFunc = this.schema.virtualsGetter[funcName] as Function;

      dynamoItem[funcName] = await virtualFunc(dynamoItem);
    }

    return dynamoItem;
  }

  async #applyVirtualSetters(dynamoItem: any): Promise<Object> {
    const virtualFields = Object.keys(this.schema.virtualsSetter);

    for (const funcName of virtualFields) {
      const virtualFunc = this.schema.virtualsSetter[funcName] as Function;

      dynamoItem[funcName] = await virtualFunc(dynamoItem);
    }

    return dynamoItem;
  }

  async #init() {
    try {
      if (!Model.TableNames) {
        Model.TableNames = await this.#getTableNamesFromDB();
      }

      if (Model.TableNames && Model.TableNames.indexOf(this.name) == -1) {
        this.TableDescription = (await this.#createTable()).TableDescription;
      } else {
        // check if table structure is the same as in Schema
        // Otherwise request update Table

        this.TableDescription = (await this.#describe()).Table;
      }
      //  console.log(this.TableDescription);
    } catch (error) {
      console.error(error);
    }
  }

  #isSelectAlias(obj?: string | selectAlias) {
    const selectType = typeof obj;
    return obj && selectType !== "string" && selectType == "object" && !Array.isArray(selectType);
  }

  #describe(): Promise<DescribeTableCommandOutput> {
    const cmd: DescribeTableCommandInput = {
      TableName: this.name,
    };
    return this.client.send(new DescribeTableCommand(cmd));
  }

  #cleanUnusedFields(item: any): any {
    const allowedFields = [...Object.keys(this.schema.fields), ...Object.keys(this.schema.virtualsSetter)];

    Object.keys(item).forEach((field) => {
      if (allowedFields.indexOf(field) == -1) {
        delete item[field];
      }
    });

    return item;
  }

  #nativeTypeToDDBType(field: any): string | null {
    const typeOfField = typeof field;

    switch (typeOfField) {
      case "object":
        if (Array.isArray(field)) {
          return "L";
        } else if (field instanceof Set) {
          const values = Array.from(field.values());
          if (values.every((x) => typeof x == "number")) {
            return "NS";
          } else if (values.every((x) => typeof x == "string")) {
            return "SS";
          }
          return null;
        } else {
          return "M";
        }

      case "string":
        return "S";
      case "number":
        return "N";
      case "boolean":
        return "BOOL";

      default:
        return null;
    }
  }
  #verifyTypes(fields: ISchema, item: any, nestedPath?: string) {
    Object.keys(item).forEach((key) => {
      const field = item[key];
      const fieldDDBType = this.#nativeTypeToDDBType(field);
      const fieldInSchema = fields[key];
      if (!fieldInSchema) {
        return;
      }
      const typeInSchema = fieldInSchema.type;

      if (!typeInSchema) {
        return;
      }
      const currentPath = nestedPath ? `${nestedPath}.${key}` : key;
      if (fieldDDBType !== typeInSchema) {
        throw Error(`Ìnvalid type for ${this.name}.${currentPath}\nExcepted: ${typeInSchema}\nReceived: ${fieldDDBType}`);
      }

      if (fieldDDBType == "M" && (fieldInSchema as DBObject).fields) {
        this.#verifyTypes((fieldInSchema as DBObject).fields!, field, currentPath);
      }
    });
  }
  async #verifyFields(item: any) {
    await verifyRequiredFields(this.schema.fields, item, this.name);

    this.#verifyTypes(this.schema.fields, item);
    await verifyEnums(this.schema.fields, item, this.name);
    await verifyStringMinMax(this.schema.fields, item, this.name);
    await verifyNumberMinMax(this.schema.fields, item, this.name);
  }

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

  async prepareDoc(item: any, applyVirtualSetters?: boolean): Promise<any> {
    let preparingDoc = await setDefaultFields(this.schema.fields, item);
    preparingDoc = await applyStringTransformers(this.schema.fields, preparingDoc);
    preparingDoc = await applyCustomSetters(this.schema.fields, preparingDoc);

    if (applyVirtualSetters) {
      preparingDoc = await this.#applyVirtualSetters(preparingDoc);
    }

    await this.#verifyFields(preparingDoc);

    preparingDoc = this.#cleanUnusedFields(preparingDoc);

    return preparingDoc;
  }

  #applyAlias(item: any, select: selectAlias) {
    const selectAsAlias = Object.keys(select);

    selectAsAlias.forEach((key) => {
      let originalKey = key;
      let aliasKey = key;
      if (key.includes(":")) {
        originalKey = key.split(":")[0];
        aliasKey = key.split(":")[1];
      }

      if (!item[originalKey]) {
        return;
      }

      if (typeof select[key] == "string") {
        const aliasName = select[key] as string;
        item[aliasName] = item[originalKey];
        delete item[originalKey];
      } else if (typeof select[key] == "object" && typeof item[originalKey] == "object") {
        item[aliasKey] = this.#applyAlias(item[originalKey], select[key] as selectAlias);
        if (originalKey !== aliasKey) {
          delete item[originalKey];
        }
      }
    });

    return item;
  }
  async create(item: any, options: createOptions = this.#defaultCreateOptions): Promise<PutCommandOutput | any> {
    let creatingItem = await this.prepareDoc(item, options.applyVirtualSetters);

    const putCmdParams: PutItemCommandInput = {
      TableName: this.name,
      Item: creatingItem,
    };

    const putCmd = new PutCommand(putCmdParams);

    let createdItemResponse: any = await this.docClient.send(putCmd);
    if (options.returnCreated) {
      createdItemResponse.Item = creatingItem;
    }

    return createdItemResponse;
  }

  async getByPk(partitionKey: string | number, select?: string | selectAlias | selectAndExclude): Promise<any> {
    // check params !!

    let customSelect = undefined;
    let exclude = undefined; // TODO: add exclude handler

    if (typeof select == "string") {
      customSelect = select as string;
    } else if (typeof select == "object") {
      if (select.select || (!select.select && !select.exclude)) {
        customSelect = select as selectAlias;
      }
      if (select.exclude) {
        exclude = select.exclude;
      }
    }
    const getCmdParams = this.#getCmdInputParams(partitionKey, customSelect);

    let foundItem = (await this.docClient.send(new GetCommand(getCmdParams))).Item;

    if (foundItem) {
      foundItem = await this.#applyVirtualGetters(foundItem, customSelect);

      if (typeof customSelect == "object" && !Array.isArray(customSelect)) {
        foundItem = this.#applyAlias(foundItem, customSelect);
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

  async update(partitionKey: string | number, updateExpr: updateExpr, ifConditions?: any) {
    const key = this.schema.partitionKey;

    const cleanedExpressions = getUpdateExpressions(updateExpr);

    let attributeeees = new ExpressionAttributes();
    const queryString = cleanedExpressions.serialize(attributeeees);

    let resolvedConditionExpression: string = "";

    if (ifConditions) {
      const condExpr = getConditionExpressions(ifConditions);
      //console.log("condExpr", condExpr.conditions[1].conditions);
      resolvedConditionExpression = serializeConditionExpression(condExpr, attributeeees);
    }

    let updateCmd: UpdateCommandInput = {
      TableName: this.name,
      Key: {
        [key]: partitionKey,
      },
      UpdateExpression: queryString,
      ExpressionAttributeNames: attributeeees.names,
      ReturnValues: "ALL_NEW",
    };

    if (Object.keys(attributeeees.values).length) {
      updateCmd.ExpressionAttributeValues = unmarshall(new AttributeValue(attributeeees.values).marshalled);
    }

    if (resolvedConditionExpression != "") {
      updateCmd.ConditionExpression = resolvedConditionExpression;
      console.log("resolvedConditionExpression", resolvedConditionExpression);
    }

    return this.docClient.send(new UpdateCommand(updateCmd));
  }
}

function applyDynamoSelectExpressions(ExpressionAttributeNames: any = {}, word: string): string {
  let safeWord = word;
  if (safeWord.includes(".")) {
    safeWord = safeWord
      .split(".")
      .map((w) => applyDynamoSelectExpressions(ExpressionAttributeNames, w))
      .join(".");
  } else if (safeWord.includes("[")) {
    safeWord = safeWord
      .split("[")
      .map((w) => applyDynamoSelectExpressions(ExpressionAttributeNames, w))
      .join("[");
  } else {
    if (reservedWords.indexOf(word.toUpperCase()) !== -1) {
      safeWord = `#Safe${word}`;
      ExpressionAttributeNames[safeWord] = word;
    }
  }
  return safeWord;
}

type updateFieldName = "$pull" | "$push" | "$unshift" | "$incr" | "$decr"; //| string;

type updateExpr = {
  $set?: any;
  $add?: any;

  /**
   * @type {string}
   */
  $delete?: any;
  $remove?: any;

  $pull?: any;
  /**
   * Push an item or an array of items into an array
   * @example
   * ```js
   * {
   *  games: {
   *    victories: { $push: 1 }
   *  },
   *  hobbies: { $push: ["Tennis", "Golf"] }
   * }
   * ```
   */
  $push?: any | any[];
  $unshift?: any;

  $incr?: any;
  $decr?: any;
  [key: string]: any | updateExpr;
};

interface selectAndExclude {
  select: string | selectAlias;
  exclude: string | selectAlias;
}
