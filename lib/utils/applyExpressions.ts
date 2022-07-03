import { AttributePath, ExpressionAttributes, FunctionExpression } from "@aws/dynamodb-expressions";

const expr = new FunctionExpression("list_append", new AttributePath("path.to.list"), "foo");
const attributes = new ExpressionAttributes();
// serializes as 'list_append(#attr0.#attr1.#attr2, :val3)'
const serialized = expr.serialize(attributes);
console.log(attributes.names); // {'#attr0': 'path', '#attr1': 'to', '#attr2': 'list'}
console.log(attributes.values); // {':val3': {S: 'foo'}}
