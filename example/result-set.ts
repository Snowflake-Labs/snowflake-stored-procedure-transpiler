/**
 * @fileoverview This file contains functions for transforming a
 * Snowflake ResultSet into an object, array, or array of arrays.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara <nate.mcnamara@snowflake.com>
 * @author Manvi Thakore <manvi.thakore@snowflake.com>
 * @author Noble Mushtak <noble.mushtak@snowflake.com>
 */
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
    const result_set: ResultSet = snowflake.execute({sqlText, binds})
    return result_set.next() ? rowToArray(result_set) : null
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
