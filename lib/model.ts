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
import { ISchema, selectAlias, createOptions, DBNumber, DBString } from "./types/schema";
import { EventEmitter } from "events";
import { reservedWords } from "./reservedWords";
import { applyStringTransformers } from "./utils/applyStringTransformers";
import { applyCustomSetters } from "./utils/applyCustomSetters";
import { verifyNumberMinMax } from "./utils/verifyNumberMinMax";
import { verifyStringMinMax } from "./utils/verifyStringMinMax";
import { verifyEnums } from "./utils/verifyEnums";
import { setDefaultFields } from "./utils/setDefaultFields";
import { verifyRequiredFields } from "./utils/verifyRequiredFields";

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

  async #verifyFields(item: any) {
    await verifyRequiredFields(this.schema.fields, item, this.name);

    //  TODO: verifyTypes
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
      // apply virtual Setters,
      console.log(Object.keys(this.schema.virtualsSetter));
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

  async getByPk(partitionKey: string | number, select?: string | selectAlias): Promise<any> {
    // check params !!

    const getCmdParams = this.#getCmdInputParams(partitionKey, select);

    let foundItem = (await this.docClient.send(new GetCommand(getCmdParams))).Item;

    if (foundItem) {
      foundItem = await this.#applyVirtualGetters(foundItem, select);

      if (typeof select == "object" && !Array.isArray(select)) {
        foundItem = this.#applyAlias(foundItem, select);
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

  update(partitionKey: string | number, value: string | number) {
    const key = this.schema.partitionKey;
    const updatingDoc = {
      firstname: "Blabla",
      lastname: "Yooo",
      data: {
        // "last[0]": 888,
        // "last[1]": 777,
        last: {
          // $push: [89],
          $unshift: [1656545, 853445],
          //  $pull: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        },
        nested: {
          $set: {
            game: "over",
          },
        },
        $delete: "rank",
        // rank: { $incr: 1 }, // before 3
      },
      last: { $decr: 2 }, // before 15
    };

    const cleanedExpressions = getUpdateExpress(this.schema.fields, updatingDoc);

    let queryString = "";
    if (cleanedExpressions.setFields.length) {
      queryString = `SET ${cleanedExpressions.setFields}`.slice(0, -2);
    }
    if (cleanedExpressions.pullFields.length) {
      queryString += ` REMOVE ${cleanedExpressions.pullFields}`.slice(0, -2);
    }
    console.log(queryString);
    const updateCmd: UpdateCommandInput = {
      TableName: this.name,
      Key: {
        [key]: partitionKey,
      },
      UpdateExpression: queryString,
      ExpressionAttributeValues: cleanedExpressions.ExpressionAttributeValues,
      ExpressionAttributeNames: cleanedExpressions.ExpressionAttributeNames,
      ConditionExpression: "size(firstname) < size(lastname)",
      ReturnValues: "ALL_NEW",
    };

    return this.docClient.send(new UpdateCommand(updateCmd));
  }
}

function getUpdateExpress(fields: ISchema, expr: any, currentConstructor?: {}, nestedPath?: string): any {
  let expressionConstructor: any = currentConstructor ?? {
    valCounter: 1,
    ExpressionAttributeValues: {},
    ExpressionAttributeNames: {},
    ConditionExpression: "",
    setFields: "",
    pullFields: "",
  };

  for (const field of Object.keys(expr)) {
    const fieldObjext = expr[field];
    const safeWord = applyDynamoSelectExpressions(expressionConstructor.ExpressionAttributeNames, field);
    const currentNestedPath = nestedPath ? `${nestedPath}.${safeWord}` : safeWord;
    const fieldValue = `:val${field.replace(/\$|\[|\]/g, "_")}${expressionConstructor.valCounter}`;
    if (typeof fieldObjext == "object" && !Array.isArray(fieldObjext)) {
      if (field == "$set") {
        expressionConstructor.setFields += `${nestedPath} = ${fieldValue}, `;
        expressionConstructor.valCounter++;
        expressionConstructor.ExpressionAttributeValues[fieldValue] = fieldObjext;
      } else {
        expressionConstructor = getUpdateExpress(fields, fieldObjext, expressionConstructor, currentNestedPath);
      }
    } else {
      if (!field.startsWith("$")) {
        expressionConstructor.setFields += `${currentNestedPath} = ${fieldValue}, `;
        expressionConstructor.valCounter++;
        expressionConstructor.ExpressionAttributeValues[fieldValue] = fieldObjext;
      } else {
        if (field == "$push" || field == "$unshift") {
          let pushingValue = Array.isArray(fieldObjext) ? fieldObjext : [fieldObjext];
          const withCorrectOrder = field == "$push" ? `${nestedPath}, ${fieldValue}` : `${fieldValue}, ${nestedPath}`;
          expressionConstructor.setFields += `${nestedPath} = list_append(${withCorrectOrder}), `;
          expressionConstructor.valCounter++;
          expressionConstructor.ExpressionAttributeValues[fieldValue] = pushingValue;
        } else if (field == "$incr" || field == "$decr") {
          let pushingValue = Number(fieldObjext);
          const withCorrectOrder = field == "$incr" ? `+ ${fieldValue}` : `- ${fieldValue}`;
          expressionConstructor.setFields += `${nestedPath} = ${nestedPath} ${withCorrectOrder}, `;
          expressionConstructor.valCounter++;
          expressionConstructor.ExpressionAttributeValues[fieldValue] = pushingValue;
        } else if (field == "$pull") {
          const pullingElements = Array.isArray(fieldObjext) ? fieldObjext : [fieldObjext];

          if (pullingElements.every((i) => !isNaN(i))) {
            pullingElements.forEach((i) => {
              expressionConstructor.pullFields += `${nestedPath}[${i}], `;
            });
          }
        } else if (field == "$delete") {
          const pullingElements = Array.isArray(fieldObjext) ? fieldObjext : [fieldObjext];
          pullingElements.forEach((i) => {
            const safeWord = applyDynamoSelectExpressions(expressionConstructor.ExpressionAttributeNames, i);

            expressionConstructor.pullFields += `${currentNestedPath.replace("$delete", safeWord)}, `;
          });
        }
      }
    }
  }

  return expressionConstructor;
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

// $eq =
// $neq <>
// $gt >
// $gte >=
// $lt <
// $lte <=
// $and AND
// $not NOT
// $or OR
// $in IN
// $between BETWEEN
// $size size(path)
// $contains contains(a, b)
// $exists attribute_exists(path)
// $nexists attribute_not_exists(path)
// $type attribute_type(path, type)
// $beginsWith begins_with(path, str)
// $startsWith begins_with(path, str)

//  ConditionExpression
const conditions = {
  firstname: {
    $eq: "",
  },
};

function conditionExpressBuilder(conditions: any, currentConstructor: any) {
  const keys = Object.keys(conditions);

  if (keys.length < 2) {
    // parse conditions
  } else {
    // consider top level as AND conditions
  }
}

function parseConditions(fields: any, currentConstructor: any) {}

function parseANDConditions(fields: any, currentConstructor: any) {}
