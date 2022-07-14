import {
  ExpressionAttributes,
  ConditionExpression,
  ConditionExpressionSubject,
  serializeConditionExpression,
  lessThan,
  lessThanOrEqualTo,
  greaterThan,
  greaterThanOrEqualTo,
  notEquals,
  equals,
  between,
  inList,
  attributeExists,
  attributeNotExists,
  attributeType,
  beginsWith,
  contains,
  AndExpression,
  OrExpression,
  AttributePath,
} from "@aws/dynamodb-expressions";

function andCondition(subject: string, values: any[]): ConditionExpression {
  return {
    type: "And",
    conditions: values.map((val) => getConditionExpressions(val, subject)),
  };
}
function orCondition(subject: string, values: any[]): ConditionExpression {
  return {
    type: "Or",
    conditions: values.map((val) => getConditionExpressions(val, subject)),
  };
}
function notCondition(subject: string, value: any): ConditionExpression {
  return {
    type: "Not",
    condition: getConditionExpressions(value, subject),
  };
}
function eqCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...equals(value),
  };
}
function neqCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...notEquals(value),
  };
}

function gtCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...greaterThan(value),
  };
}
function gteCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...greaterThanOrEqualTo(value),
  };
}
function ltCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...lessThan(value),
  };
}
function lteCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...lessThanOrEqualTo(value),
  };
}
function inCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...inList(value),
  };
}

function betweenCondition(subject: string | AttributePath, values: any[]): ConditionExpression {
  return {
    subject,
    ...between(values[0], values[1]),
  };
}

// function sizeCondition(subject: string | AttributePath, value: any): ConditionExpression {
//   const size = () => {
//     return { type: "Function", name: "size", expected: "" };
//   };

//   return {
//     subject,
//     ...size(),
//   };
// }
function containsCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...contains(value),
  };
}
function existsCondition(subject: string | AttributePath, value: boolean): ConditionExpression {
  if (value === true) {
    return {
      subject,
      ...attributeExists(),
    };
  } else {
    return {
      subject,
      ...attributeNotExists(),
    };
  }
}

function typeCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...attributeType(value),
  };
}
function beginsWithCondition(subject: string | AttributePath, value: any): ConditionExpression {
  return {
    subject,
    ...beginsWith(value),
  };
}

type cond = { [key: string]: (subject: any, value: any) => ConditionExpression };

const conditions: cond = {
  $and: andCondition,
  $or: orCondition,
  $not: notCondition,
  $eq: eqCondition,
  $neq: neqCondition,
  $gt: gtCondition,
  $gte: gteCondition,
  $lt: ltCondition,
  $lte: lteCondition,
  $in: inCondition,
  $between: betweenCondition,
  // $size: sizeCondition,
  $contains: containsCondition,
  $includes: containsCondition,
  $exists: existsCondition,
  $type: typeCondition,
  $beginsWith: beginsWithCondition,
  $startsWith: beginsWithCondition,
};

export function getConditionExpressions($if: any, _rawPath?: string): ConditionExpression | any {
  const keys = Object.keys($if);

  const rawPath = _rawPath;
  if (keys.length > 1) {
    const customCondition = {
      $and: keys.map((field) => {
        return {
          [field]: $if[field],
        };
      }),
    };
    return getConditionExpressions(customCondition, rawPath);
  } else if (keys.length == 1) {
    const conditionName = keys[0];
    const condValue = $if[conditionName];
    const valueType = typeof condValue;

    if (!conditionName.startsWith("$")) {
      let currentPath = conditionName;
      if (rawPath) {
        if (conditionName.startsWith("[")) {
          currentPath = `${rawPath}${conditionName}`;
        } else {
          currentPath = `${rawPath}.${conditionName}`;
        }
      }

      if (isJsObject(condValue)) {
        // continue deep parsing

        console.log("Depp parsing ?????", currentPath);
        return getConditionExpressions(condValue, currentPath);
      } else {
        // equality check

        return conditions.$eq(currentPath, condValue);
      }
    } else {
      if (typeof conditions[conditionName] == "function") {
        const resolveCondition = conditions[conditionName] as Function;

        let currentPath = rawPath;

        if (!currentPath && !conditionName.startsWith("$")) {
          currentPath = conditionName;
        }
        const result = resolveCondition(currentPath, condValue);
        return result;
      } else {
        throw Error(`Unknown operator '${conditionName}'\nAllowed operators: ${Object.keys(conditions).join(", ")}`);
      }
    }
  }
}

const isJsObject = (value: any) => {
  return value !== null && typeof value == "object" && !Array.isArray(value) && !(value instanceof Date);
};
