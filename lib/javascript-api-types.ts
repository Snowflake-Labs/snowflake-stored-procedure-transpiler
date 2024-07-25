/**
 * @fileoverview Defines the types needed to write spt stored procedures.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/snowflake-sdk/index.d.ts
import * as snowflake from 'snowflake-sdk'

type Bind = snowflake.Bind | null

type ExecuteInput = {
    sqlText: string
    // Unlike Snowflake's NodeJs driver, the JavaScript stored procedure API does
    // not support InsertBinds, so we use Bind[] as the type here instead of Binds
    binds?: Bind[]
}

interface Row {
    getColumnCount(): number
    getColumnSqlType(col: string | number): string
    getColumnValue(col: string | number): any
    getColumnValueAsString(col: string | number): string
}

interface ResultSet extends Row {
    getNumRowsAffected(): number
    getQueryId(): string
    getRowCount(): number
    next(): boolean
}

interface Statement {
    execute(): ResultSet
    getColumnCount(): number
    getColumnName(col: number): string
    getColumnScale(col: string | number): number
    getColumnSqlType(col: string | number): string
    getColumnType(col: string | number): string
    getNumDuplicateRowsUpdated(): number
    getNumRowsAffected(): number
    getNumRowsDeleted(): number
    getNumRowsInserted(): number
    getNumRowsUpdated(): number
    getRowCount(): number
    getQueryId(): string
    getSqlText(): string
    isColumnNullable(col: string | number): boolean
    isColumnText(col: string | number): boolean
    isColumnArray(col: string | number): boolean
    isColumnBinary(col: string | number): boolean
    isColumnBoolean(col: string | number): boolean
    isColumnDate(col: string | number): boolean
    isColumnNumber(col: string | number): boolean
    isColumnObject(col: string | number): boolean
    isColumnTime(col: string | number): boolean
    isColumnTimestamp(col: string | number): boolean
    isColumnVariant(col: string | number): boolean
}

interface Snowflake {
    createStatement(input: ExecuteInput): Statement
    execute(input: ExecuteInput): ResultSet
}

export {Bind, ExecuteInput, ResultSet, Row, Snowflake, Statement}
