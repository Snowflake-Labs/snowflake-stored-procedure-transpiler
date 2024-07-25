/**
 * @fileoverview This file is an spt example containing stored procedures
 * returning the current time and the current Snowflake version.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara <nate.mcnamara@snowflake.com>
 * @author Manvi Thakore <manvi.thakore@snowflake.com>
 * @author Noble Mushtak <noble.mushtak@snowflake.com>
 */
import {Bind, ResultSet, Snowflake} from 'lib/javascript-api-types'

/**
 * Execute a SQL query and return the value of the first column in the first row.
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

/**
 * The current Snowflake version.
 * @sf_stored_procedure
 * @param snowflake The Snowflake connection.
 * @returns The current Snowflake version.
 */
export function current_v(snowflake: Snowflake): string {
    return fetchCell(snowflake, 'select current_version()') as string
}
