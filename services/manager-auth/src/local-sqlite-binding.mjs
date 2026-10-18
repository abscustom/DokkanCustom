function byteLength(value) {
  const encoded = JSON.stringify(value);
  return Buffer.byteLength(encoded === undefined ? String(value) : encoded);
}

function addMetric(metrics, field, amount) {
  if (metrics) metrics[field] = Number(metrics[field] || 0) + amount;
}

function maxFunctionArguments(query, functionName) {
  const calls = new RegExp(`\\b${functionName}\\s*\\(`, 'ig');
  let max = 0, match;
  while ((match = calls.exec(query))) {
    const open = query.indexOf('(', match.index + match[0].length - 1);
    let depth = 1, argumentsCount = 1;
    for (let index = open + 1; index < query.length && depth > 0; index += 1) {
      const char = query[index];
      if (char === "'" || char === '"' || char === '`') {
        const quote = char;
        for (index += 1; index < query.length; index += 1) {
          if (query[index] !== quote) continue;
          if (query[index + 1] === quote) index += 1;
          else break;
        }
      } else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      else if (char === ',' && depth === 1) argumentsCount += 1;
    }
    max = Math.max(max, argumentsCount);
  }
  return max;
}

export function createLocalSqliteBinding(sql, { metrics = null } = {}) {
  return {
    prepare(query) {
      if (metrics) metrics.maxJsonObjectArguments = Math.max(
        Number(metrics.maxJsonObjectArguments || 0), maxFunctionArguments(query, 'json_object')
      );
      const statement = sql.prepare(query);
      let values = [];
      return {
        bind(...args) {
          values = args;
          if (metrics) metrics.maxBoundParameters = Math.max(Number(metrics.maxBoundParameters || 0), args.length);
          return this;
        },
        async first() {
          addMetric(metrics, 'statementsExecuted', 1);
          addMetric(metrics, 'sqlParameterBytes', byteLength(values));
          const result = statement.get(...values) || null;
          if (result) {
            addMetric(metrics, 'returnedRows', 1);
            addMetric(metrics, 'sqlResultBytes', byteLength(result));
          }
          return result;
        },
        async all() {
          addMetric(metrics, 'statementsExecuted', 1);
          addMetric(metrics, 'sqlParameterBytes', byteLength(values));
          const results = statement.all(...values);
          addMetric(metrics, 'returnedRows', results.length);
          addMetric(metrics, 'sqlResultBytes', byteLength(results));
          return { results };
        },
        async run() {
          addMetric(metrics, 'statementsExecuted', 1);
          addMetric(metrics, 'sqlParameterBytes', byteLength(values));
          const result = statement.run(...values);
          const changes = Number(result.changes);
          addMetric(metrics, 'changedRows', changes);
          return { meta: { changes } };
        }
      };
    },
    async batch(statements) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

export function localSqliteStorageBytes(sql) {
  const pageCount = Number(sql.prepare('PRAGMA page_count').get()?.page_count || 0);
  const pageSize = Number(sql.prepare('PRAGMA page_size').get()?.page_size || 0);
  return pageCount * pageSize;
}
