import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttributePath, ExpressionAttributes, FunctionExpression, ConditionExpression, UpdateExpression, MathematicalExpression, AttributeValue } from "@aws/dynamodb-expressions";

export function getUpdateExpressions(doc: any, _update?: UpdateExpression, _rawPath?: string): UpdateExpression {
  let update = _update ?? new UpdateExpression();

  for (const fieldName of Object.keys(doc)) {
    const field = doc[fieldName];
    let rawPath = !_rawPath ? fieldName : `${_rawPath}.${fieldName}`;

    if (fieldName.startsWith("$")) {
      rawPath = rawPath.replace(`.${fieldName}`, "");
    }
    const attrPath = new AttributePath(rawPath);

    if (typeof field == "object" && !Array.isArray(field)) {
      if (fieldName == "$set") {
        if (rawPath == fieldName) {
          Object.keys(field).forEach((k) => {
            const childAttrPath = new AttributePath(k);
            const childValue = field[k];
            update.set(childAttrPath, childValue);
          });
        } else {
          update.set(attrPath, field);
        }
      } else {
        getUpdateExpressions(field, update, rawPath);
      }
    } else {
      if (!fieldName.startsWith("$")) {
        update.set(attrPath, field);
      } else {
        if (fieldName == "$push") {
          let pushingValue = Array.isArray(field) ? field : [field];
          const expr = new FunctionExpression("list_append", new AttributePath(rawPath), pushingValue);

          update.set(rawPath, expr);
        } else if (fieldName == "$unshift") {
          let pushingValue = Array.isArray(field) ? field : [field];
          const expr = new FunctionExpression("list_append", pushingValue, new AttributePath(rawPath));

          update.set(rawPath, expr);
        } else if (fieldName == "$incr") {
          const expr = new MathematicalExpression(rawPath, "+", field);

          update.set(rawPath, expr);
        } else if (fieldName == "$decr") {
          const expr = new MathematicalExpression(rawPath, "-", field);

          update.set(rawPath, expr);
        } else if (fieldName == "$pull" || fieldName == "$remove") {
          let pullingItems = Array.isArray(field) ? field : [field];
          let currentPath = rawPath.startsWith("$") ? "" : rawPath + ".";
          pullingItems.forEach((item) => {
            const nestedPath = currentPath + isNaN(item) ? `${item}` : `${rawPath}[${item}]`;
            update.remove(nestedPath);
          });
        } else if (fieldName == "$delete") {
          update.delete(rawPath, field);
        }
      }
    }
  }

  return update;
}
