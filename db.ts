import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
const client = new DynamoDBClient({ region: "eu-west-3", endpoint: "http://localhost:8000" });

export { client };
