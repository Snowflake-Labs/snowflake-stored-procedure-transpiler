# Stored Procedure Transpiler

Stored Procedure Transpiler (`spt`) is Snowflake's Stored Procedure Transpiler. It enables developers to
write Snowflake stored procedures in pure TypeScript. In addition to providing
type annotation checks, the entire TypeScript and JavaScript ecosystems are
available, providing numerous benefits:

* You can modularize and share code easily across multiple stored procedures.
* You can write unit and integration tests for your stored procedures and functions they call.
* You can step through the code in a debugger.
* Your IDE can understand the code, which means you get better &mdash;
  * code navigation
  * syntax highlighting
  * error highlighting
  * error messages

In addition, since TypeScript is a superset of JavaScript, it is easy to migrate any existing
JavaScript stored procedure to `spt`, and you can do so at whatever pace works for you.

# Getting Started

* Install `npm` using [these instructions](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).
* Install [ts-node](https://www.npmjs.com/package/ts-node) to enable running TypeScript from the command line:

```bash
% npm install -g ts-node
```

* Clone this repo; below, we assume that your local clone is in a directory called `spt`.
* In the top-level directory of your clone, install the required packages:

```bash
spt % npm install
```

Next, let's run `spt` to make sure it's working.

```bash
spt % bin/spt example/*.ts
..
$$;
```

You may wish to add your clone's `bin` directory to your `PATH`. The examples
below assume you have done so.

# Examples

Consider the following stored procedure:

```sql
create or replace procedure
output_message(MESSAGE STRING) returns STRING
language javascript as
$$
    return MESSAGE
$$;
```

To turn this into an `spt` stored procedure, create a new directory outside of
your `spt` clone (in this file we'll named that directory follow-allong)
and place the following code into a file called `output_message.ts`:

```typescript
import {Snowflake} from 'lib/javascript-api-types'

/**
 * @sf_stored_procedure
 */
export function output_message(snowflake: Snowflake, message: string): string {
    return message
}
```

Notes:

* All `spt` stored procedures are marked with the `@sf_stored_procedure` annotation in
their jsdoc comment.

* All `spt` stored procedures take the `snowflake` object as their first parameter.
The type of the `snowflake` parameter is `Snowflake`, which is defined in
`lib/javascript-api-types.ts`. The `snowflake` parameter facilitates testing and
enables the TypeScript compiler and any IDE to understand the code.

* All `spt` stored procedures must be exported. The converse is not true; since
`spt` code is ordinary TypeScript, you can export functions that are not stored
procedures for use in other modules.

To transpile `output_message` to a Snowflake stored procedure, run `spt` on the file:

```bash
follow-along % spt output_message.ts
create or replace procedure output_message(MESSAGE STRING) returns STRING language javascript as $$
    let __result = null;

    /**
     * @sf_stored_procedure
     */
    function output_message(snowflake, message) {
        return message;
    }
    
    __result = output_message(snowflake, MESSAGE);
    
    return __result;
$$;
```

To create the stored procedure in Snowflake, the output of `spt` can be pasted directly into Snowsight and executed.

Let's look at another example. Paste the following code into a file called `current.ts`:

```typescript
import {ResultSet, Snowflake} from 'lib/javascript-api-types'

/**
 * The current timestamp.
 * @sf_stored_procedure
 * @param snowflake The Snowflake connection.
 * @returns The current timestamp.
 */
export function current_t(snowflake: Snowflake): Date {
    const results: ResultSet = snowflake.execute({sqlText: 'select current_timestamp()'})
    results.next()
    return results.getColumnValue(1) as Date
}
```

Retrieving a single value from a query is a common operation. Let's make a function for it.

```typescript
import {Bind, ResultSet, Snowflake} from 'lib/javascript-api-types'

/**
 * Execute a SQL query and returns the value of the first column in the first row.
 * @param snowflake The Snowflake connection.
 * @param sqlText The SQL query to execute.
 * @param binds The bind variables to use in the query.
 * @returns The value of the first column in the first row.
 */
function fetchCell(snowflake: Snowflake, sqlText: string, binds?: Bind[]): any {
    const results: ResultSet = snowflake.execute({sqlText, binds})
    return results.next() ? results.getColumnValue(1) : null
}

/**
 * The current timestamp.
 * @sf_stored_procedure
 * @param snowflake The Snowflake connection.
 * @returns The current timestamp.
 */
export function current_t(snowflake: Snowflake): Date {
    return fetchCell(snowflake, 'select current_timestamp()') as Date
}
```

We can add additional stored procedures in the same module and reuse our new function:

```typescript
import {Bind, ResultSet, Snowflake} from 'lib/javascript-api-types'

/**
 * Execute a SQL query and returns the value of the first column in the first row.
 * @param snowflake The Snowflake connection.
 * @param sqlText The SQL query to execute.
 * @param binds The bind variables to use in the query.
 * @returns The value of the first column in the first row.
 */
function fetchCell(snowflake: Snowflake, sqlText: string, binds?: Bind[]): any {
    const results: ResultSet = snowflake.execute({sqlText, binds})
    return results.next()? results.getColumnValue(1) : null
}

/**
 * The current timestamp.
 * @sf_stored_procedure
 * @param snowflake The Snowflake connection.
 * @returns The current timestamp.
 */
export function current_t(snowflake: Snowflake): Date {
    return fetchCell(snowflake, 'select current_timestamp()') as Date
}

/**
 * The current Snowflake version.
 * @sf_stored_procedure
 * @param snowflake The Snowflake connection.
 * @returns The current Snowflake version.
 */
export function current_v(snowflake: Snowflake): string {
    return fetchCell(snowflake, 'select current_version()') as string
}
```

`spt` will bundle a helper function into each generated Snowflake stored procedure that uses it.

```bash
follow-along % spt current.ts
create or replace procedure current_t() returns TIMESTAMP_LTZ language javascript as $$
    let __result = null;

    /**
     * Execute a SQL query and return the value of the first column in the first row.
     * @param snowflake The Snowflake connection.
     * @param sqlText The SQL query to execute.
     * @param binds The bind variables to use in the query.
     * @returns The value of the first column in the first row.
     */
    function fetchCell(snowflake, sqlText, binds) {
        const results = snowflake.execute({ sqlText, binds });
        return results.next() ? results.getColumnValue(1) : null;
    }
    /**
     * The current timestamp.
     * @sf_stored_procedure
     * @param snowflake The Snowflake connection.
     * @returns The current timestamp.
     */
    function current_t(snowflake) {
        return fetchCell(snowflake, 'select current_timestamp()');
    }

    __result = current_t(snowflake);

    return __result;
$$;


create or replace procedure current_v() returns STRING language javascript as $$
    let __result = null;

    /**
     * Execute a SQL query and return the value of the first column in the first row.
     * @param snowflake The Snowflake connection.
     * @param sqlText The SQL query to execute.
     * @param binds The bind variables to use in the query.
     * @returns The value of the first column in the first row.
     */
    function fetchCell(snowflake, sqlText, binds) {
        const results = snowflake.execute({ sqlText, binds });
        return results.next() ? results.getColumnValue(1) : null;
    }
    /**
     * The current Snowflake version.
     * @sf_stored_procedure
     * @param snowflake The Snowflake connection.
     * @returns The current Snowflake version.
     */
    function current_v(snowflake) {
        return fetchCell(snowflake, 'select current_version()');
    }

    __result = current_v(snowflake);

    return __result;
$$;
```

It is also possible to move `fetchCell` to a separate module, so it can be
shared by stored procedures in separate modules via ordinary `import` statements.
Let's create a file called `result-set.ts` with a few similar functions:

```typesript
import {Bind, ResultSet, Row, Snowflake} from 'lib/javascript-api-types'

/**
 * Execute a SQL query and returns all rows as an array of arrays.
 * @param snowflake The Snowflake connection.
 * @param sqlText The SQL query to execute.
 * @param binds The bind variables to use in the query.
 * @returns All rows as an array of arrays.
 */
export function fetchAll(snowflake: Snowflake, sqlText: string, binds?: Bind[]): any[][] {
    return resultsToGrid(snowflake.execute({sqlText, binds}))
}

/**
 * Execute a SQL query and returns the value of the first column in the first row.
 * @param snowflake The Snowflake connection.
 * @param sqlText The SQL query to execute.
 * @param binds The bind variables to use in the query.
 * @returns The value of the first column in the first row.
 */
export function fetchCell(snowflake: Snowflake, sqlText: string, binds?: Bind[]): any {
    const results: ResultSet = snowflake.execute({sqlText, binds})
    return results.next() ? results.getColumnValue(1) : null
}

/**
 * Execute a SQL query and return the first row as an array.
 * @param snowflake The Snowflake connection.
 * @param sqlText The SQL query to execute.
 * @param binds The bind variables to use in the query.
 * @returns The first row as an array.
 */
export function fetchOne(snowflake: Snowflake, sqlText: string, binds?: Bind[]): any[] | null {
    const rs: ResultSet = snowflake.execute({sqlText, binds})
    return rs.next() ? rowToArray(rs) : null
}

/**
 * Create an iterable that yields each row in a result set.
 * @param result_set A result set returned by Snowflake.execute.
 * @returns An iterable that yields each row in the result set.
 */
function resultSetIter(result_set: ResultSet): Iterable<Row> {
    return {
        [Symbol.iterator]() {
            return {
                next() {
                    return {value: result_set, done: !result_set.next()}
                },
            }
        },
    }
}

/**
 * Transform a result set into an array of arrays.
 * @param result_set A result set returned by Snowflake.execute.
 * @returns An array of arrays representing the result set.
 */
function resultsToGrid(result_set: ResultSet): any[][] {
    return Array.from(resultSetIter(result_set), rowToArray)
}

/**
 * Transform a row into an array of its values.
 * @param row A single row of a result set.
 * @returns An array of the values in the row.
 */
function rowToArray(row: Row): any[] {
    return [...Array(row.getColumnCount()).keys()].map(x => row.getColumnValue(x + 1))
}
```

# Using External Libraries

 `spt` makes it convenient to use npm hosted libraries. Just as an example,
 we'll create a stored procedure using
 [simple-ascii-chart](https://www.npmjs.com/package/simple-ascii-chart) to
 create ASCII charts from a pair of numeric columns in a table. As with any
 node project, there are three steps:

1. add the dependency to a file called `package.json`.
2. run npm install.
3. use the newly install library.

In your project directory, create a `package.json` file with the following
content:

```json
{
  "dependencies": {
    "simple-ascii-chart": "^4.0.6"
  }
}
```

And then install the external dependency via `npm`:

```bash
follow-along % npm install
```

Next, add the following code to a file called `ascii-plot.ts`; note
that, in case you jumped straight to this section, this example uses
the function `fetchAll` defined above.

```typescript
import plot from 'simple-ascii-chart'
import {Snowflake} from 'lib/javascript-api-types'
import {fetchAll} from './result-set'

/**
 * Given a table and the names of two numeric columns, outputs a string
 * representing an ASCII art plot of the result data, with the first and second
 * columns corresponding to the horizontal and vertical axes, respectively.
 *
 * @sf_stored_procedure
 * @param table_name Table containing the data to plot
 * @param x_column Name of the column to use for the x-axis
 * @param y_column Name of the column to use for the y-axis
 * @param settings Object representing settings for the ASCII chart
 *   Possible keys for the object: title, xlabel, ylabel, width, height
 * @returns ASCII art representing 2D plot
 */
export function ascii_2d_plot(
    snowflake: Snowflake,
    table_name: string,
    x_column: string,
    y_column: string,
    settings: {
        title?: string
        xlabel?: string
        ylabel?: string
        width?: number
        height?: number
    },
): string {
    const query = 'select identifier(?), identifier(?) from identifier(?)'
    const binds = [x_column, y_column, table_name]
    return plot(fetchAll(snowflake, query, binds), {
        title: settings.title ?? '2D Plot',
        xLabel: settings.xlabel ?? 'X',
        yLabel: settings.ylabel ?? 'Y',
        width: settings.width ?? 480,
        height: settings.height ?? 270,
    })
}
```

We're done! Now we can run `spt` to produce the Snowflake stored procedure.

# Additional Features

## Caller Rights vs Owner Rights

Snowflake supports running stored procedures with two kinds of
[rights](https://docs.snowflake.com/en/developer-guide/stored-procedure/stored-procedures-rights):
caller and owner. The default is owner's rights.

You can specify the rights for an `spt` stored procedure by adding the word
`caller` or `owner` after the `@sf_stored_procedure` annotation:

```typesript
import {Snowflake} from 'lib/javascript-api-types'

/**
 * @sf_stored_procedure caller
 */
export function caller_fun(snowflake: Snowflake): string {
    // code that needs to run with caller's rights
}
```

# Testing

`spt` code can be tested in the usual way using your preferred test framework.
In these examples, we will use [mocha](https://mochajs.org/) and [chai](https://www.chaijs.com/).

## Setup

Update the `package.json` file to match the following:

```json
{
  "dependencies": {
    "simple-ascii-chart": "^4.0.6"
  },
  "devDependencies": {
    "@types/chai": "^4.3.16",
    "@types/mocha": "^10.0.6",
    "@types/snowflake-sdk": "^1.6.20",
    "chai": "^4.4.1",
    "deasync": "^0.1.29",
    "mocha": "^10.2.0",
    "snowflake-sdk": "^1.9.2",
    "typescript": "^5.4.5"
  },
  "scripts": {
    "build": "tsc",
    "test": "mocha"
  },
  "license": "Apache-2.0"
}
```

And a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "paths": {
        "lib/*": ["./lib/*"]
    },
    "target": "es2021"
  }
}
```

For the `tsconfig.json` above to work, we need to link the `lib` directory from the `spt` clone:

```bash
follow-along % ln -s <path-to-spt>/lib lib
```

Next, install the new packages:

```bash
follow-along % npm install
```

Finally, create `src` and `test` directories and move the existing source files into `src`.

```bash
follow-along % mkdir src && mv *.ts src
follow-along % mkdir test
```

## Unit tests

Just to make sure everything is still working, let's write a trivial function and a
unit test for it. Add the following code to the file `src/avg.ts`:

```typescript
/**
 * The mean of the given numbers.
 * @param xs The numbers whose mean to compute.
 * @returns The mean of the given numbers, or NaN if xs is empty.
 */
export function avg(xs: number[]): number {
    return xs.reduce((x, y) => x + y, 0) / xs.length
}
```

And the following code to `test/avg.spec.ts`:

```typescript
import {assert} from 'chai'
import {avg} from '../src/avg'

/**
 * Generates an array of numbers from 0 to n-1. Aka iota, range.
 * @param n The number of elements to generate.
 * @returns An array of numbers from 0 to n-1.
 */
function til(n: number): number[] {
    return [...Array(n).keys()]
}

describe('avg', () => {
    it('is NaN for an empty list', () => {
        assert.isTrue(Number.isNaN(avg([])))
    })
    it('is the element for a single-element list', () => {
        assert.isTrue(til(5).every(x => avg([x]) === x))
    })
    it('is the middle for a pair', () => {
        const pairs = til(5).flatMap(x => til(5).map(y => [x, y]))
        assert.isTrue(pairs.every(p => avg(p) === (p[0] + p[1]) / 2))
    })
})
```

We can now run the test:

```bash
follow-along % npm run build && npm test
```

## Integration tests

Testing functions that depend on the the `snowflake` object requires additional configuration.
In your project directory, create a `credentials.json` file with the following format:

```json
{
  "account": <account>,
  "username": <username>,
  "password": <password>,
  "role": <role>,
  "warehouse": <warehouse>,
  "database": <database>,
  "schema": <schema>
}
```

Next, let's write a test in `test/output_message.spec.ts`:

```typescript
import {assert} from 'chai'
import {setupSnowflake} from '../lib/setup-snowflake'
import {output_message} from '../src/output_message'

describe('output_message', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        [credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('returns what is passed', () => {
        for (const s of ['spt', 'is', 'awesome', '!']) {
            assert.equal(s, output_message(snowflake, s))
        }
    })
})
```

Now we can run this test with the same command as before:

```bash
follow-along % npm run build && npm test
```

If you get a timeout error, it is probably because it can take several seconds
to connect to Snowflake the first time. If, after trying again, and the new
test still does not pass, check your connectivity (e.g., vpn).

# Debugging in VS Code

The `.vscode/launch.json` included in the `spt` repository defines the "Mocha All"
configuration. This file was modified from [this blog
post](https://benlesh.medium.com/debugging-typescript-mocha-tests-with-vscode-89310051531).
With this in place, open VS Code, go to the "Run and Debug" tab and select the
"Mocha All" configuration. From there you set breakpoints and/or step through
the tests and the functions they exercise.

# How it works

`spt` is a thin wrapper around the [TypeScript compiler
API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
and the [rollup API](https://rollupjs.org/javascript-api/). `rollup` is
a popular JavaScript bundler. `spt` uses the TypeScript compiler API to
identify the stored procedures (i.e., functions annotated with
@sf_stored_procedure) and convert them to JavaScript. Then, `spt`
invokes `rollup` to package all of the code each stored procedure
depends on within that stored procedure.
