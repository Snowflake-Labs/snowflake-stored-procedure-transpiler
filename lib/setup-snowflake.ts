/**
 * @fileoverview Defines the types and functions needed to write integration
 * tests for spt stored procedures.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import * as fs from 'fs'
import * as deasync from 'deasync'
import * as snowflake from 'snowflake-sdk'
import {ExecuteInput, ResultSet, Statement, Snowflake} from './javascript-api-types'

snowflake.configure({
    logLevel: snowflake.LogLevel.WARN,
})

interface Credentials {
    password: string
    host: string
    port: number
    role: string
    database: string
    account: string
    warehouse: string
    schema: string
    protocol: string
    insecure_mode: boolean
    username: string
    accessUrl: string
    region: string | null
}

function getRowAtIndexAsync(
    stmt: snowflake.RowStatement,
    idx: number,
    callback: (err: any, res: any[]) => void,
) {
    stmt.streamRows({
        start: idx,
        end: idx,
    })
        .on('error', function (err: any) {
            callback(err, null)
        })
        .on('data', function (row: any[]) {
            callback(null, row)
        })
}
const getRowAtIndex = deasync(getRowAtIndexAsync)

class ResultSetAdapter implements ResultSet {
    private stmt: snowflake.RowStatement
    private row: any[] | undefined
    private rowsRead: number

    constructor(stmt: snowflake.RowStatement) {
        this.stmt = stmt
        this.rowsRead = 0
    }

    // Internally used only! Not part of ResultSet interface
    getSnowflakeStmt(): snowflake.RowStatement {
        return this.stmt
    }
    static transformCol(col: string | number) {
        if (typeof col === 'string') {
            return col
        }
        // JavaScript stored procedure API uses 1-based indexing,
        // while Node.JS driver uses 0-based indexing
        return col - 1
    }
    getColumn(col: string | number): snowflake.Column {
        return this.stmt.getColumn(ResultSetAdapter.transformCol(col))
    }

    getColumnCount(): number {
        return this.stmt.getColumns().length
    }
    getColumnSqlType(col: string | number): string {
        return this.getColumn(col).getType()
    }
    getColumnValue(col: string | number) {
        if (this.row === undefined) {
            throw new Error('ResultSet is empty or not prepared (call next() first).')
        }
        col = ResultSetAdapter.transformCol(col)
        if (typeof col === 'string') {
            return this.row[col]
        } else {
            let key = this.stmt.getColumn(col).getName()
            return this.row[key]
        }
    }
    getColumnValueAsString(col: string | number): string {
        return JSON.stringify(this.getColumnValue(col))
    }
    getNumRowsAffected(): number {
        throw new Error('Node.JS driver does not expose the number of affected rows')
    }
    getQueryId(): string {
        // getQueryId method exists, but is not exposed to TypeScript
        return (this.stmt as unknown as {getQueryId(): string}).getQueryId()
    }
    getRowCount(): number {
        return this.stmt.getNumRows()
    }
    next(): boolean {
        if (this.rowsRead >= this.getRowCount()) {
            return false
        }
        // TODO: This is not safe!
        // deasynced functions should only be called from the top-level, not from callbacks
        // https://github.com/Kaciras/deasync
        this.row = getRowAtIndex(this.stmt, this.rowsRead)
        this.rowsRead += 1
        return true
    }
}

class SnowflakeErrorWithStatement implements snowflake.SnowflakeError {
    externalize?: () => snowflake.SnowflakeErrorExternal
    code?: snowflake.ErrorCode
    sqlState?: string
    data?: Record<string, any>
    response?: Record<string, any>
    responseBody?: string
    cause?: Error
    isFatal?: boolean
    name: string
    message: string
    stack?: string
    stmt: snowflake.RowStatement

    constructor(err: snowflake.SnowflakeError, stmt: snowflake.RowStatement) {
        this.externalize = err.externalize
        this.code = err.code
        this.sqlState = err.sqlState
        this.data = err.data
        this.response = err.response
        this.responseBody = err.responseBody
        this.cause = err.cause
        this.name = err.name
        this.message = err.message
        this.stack = err.stack
        this.stmt = stmt
    }
}

function executeAsync(
    conn: snowflake.Connection,
    input: ExecuteInput,
    callback: (error: SnowflakeErrorWithStatement, res: ResultSetAdapter) => void,
): void {
    let executeInput: ExecuteInput & {
        streamRows: boolean
        complete: (err: snowflake.SnowflakeError, stmt: snowflake.RowStatement, rows: any[]) => void
    } = {
        sqlText: input.sqlText,
        streamRows: true,
        complete: function (err, stmt, rows) {
            if (err) {
                callback(new SnowflakeErrorWithStatement(err, stmt), null)
            } else {
                callback(null, new ResultSetAdapter(stmt))
            }
        },
    }
    if (input.binds !== undefined) executeInput.binds = input.binds
    conn.execute(executeInput)
}

const execute = deasync(executeAsync)

class StatementAdapter implements Statement {
    private conn: snowflake.Connection
    private execInput: ExecuteInput
    private resultSet: ResultSetAdapter | undefined
    private stmt: snowflake.RowStatement | undefined

    constructor(conn: snowflake.Connection, execInput: ExecuteInput) {
        this.conn = conn
        this.execInput = execInput
    }
    static sqlToJsType(sqlType: string): string {
        switch (sqlType) {
            case 'FIXED':
            case 'REAL':
                return 'number'
            case 'TEXT':
                return 'string'
            case 'BINARY':
                return 'buffer'
            case 'BOOLEAN':
                return 'boolean'
            case 'DATE':
            case 'TIMESTAMP_LTZ':
            case 'TIMESTAMP_NTZ':
            case 'TIMESTAMP_TZ':
                return 'date'
            case 'VARIANT':
            case 'OBJECT':
            case 'ARRAY':
            case 'MAP':
                return 'json'
            default:
                return 'invalid'
        }
    }

    configure(conf: any): void {
        snowflake.configure(conf)
    }

    execute(): ResultSet {
        try {
            // TODO: This is not safe!
            // deasynced functions should only be called from the top-level, not from callbacks
            this.resultSet = execute(this.conn, this.execInput)
            this.stmt = this.resultSet.getSnowflakeStmt()
            return this.resultSet
        } catch (err) {
            if (err instanceof SnowflakeErrorWithStatement) {
                this.stmt = err.stmt
            }
            throw err
        }
    }

    private getSnowflakeStmtSafe(): snowflake.RowStatement {
        if (this.stmt === undefined) {
            throw new Error('Statement is not executed yet.')
        }
        return this.stmt
    }
    private throwIfNoResult(col: string | number) {
        if (this.stmt !== undefined && this.resultSet === undefined) {
            throw new Error(`Given column name/index does not exist: ${col}`)
        }
    }
    private getResultSetSafe(): ResultSetAdapter {
        if (this.resultSet === undefined) {
            throw new Error('Statement is not executed yet.')
        }
        return this.resultSet
    }

    getColumnCount(): number {
        return this.getSnowflakeStmtSafe().getColumns().length
    }
    getColumnName(col: number): string {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).getName()
    }
    getColumnScale(col: string | number): number {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).getScale()
    }
    getColumnSqlType(col: string | number): string {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumnSqlType(col)
    }
    getColumnType(col: string | number): string {
        this.throwIfNoResult(col)
        return StatementAdapter.sqlToJsType(this.getColumnSqlType(col))
    }
    getNumDuplicateRowsUpdated(): number {
        throw new Error('Node.JS driver does not expose the number of duplicate rows updated')
    }
    getNumRowsAffected(): number {
        return this.getResultSetSafe().getNumRowsAffected()
    }
    getNumRowsDeleted(): number {
        throw new Error('Node.JS driver does not expose the number of deleted rows')
    }
    getNumRowsInserted(): number {
        throw new Error('Node.JS driver does not expose the number of inserted rows')
    }
    getNumRowsUpdated(): number {
        return this.getSnowflakeStmtSafe().getNumUpdatedRows()
    }
    getRowCount(): number {
        return this.getSnowflakeStmtSafe().getNumRows()
    }
    getQueryId(): string {
        // getQueryId method exists, but is not exposed to TypeScript
        return (this.getSnowflakeStmtSafe() as unknown as {getQueryId(): string}).getQueryId()
    }
    getSqlText(): string {
        return this.execInput.sqlText
    }
    isColumnNullable(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isNullable()
    }
    isColumnText(col: string | number): boolean {
        return this.getColumnSqlType(col) === 'TEXT'
    }
    isColumnArray(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isArray()
    }
    isColumnBinary(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isBinary()
    }
    isColumnBoolean(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isBoolean()
    }
    isColumnDate(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isDate()
    }
    isColumnNumber(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isNumber()
    }
    isColumnObject(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isObject()
    }
    isColumnTime(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isTime()
    }
    isColumnTimestamp(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isTimestamp()
    }
    isColumnVariant(col: string | number): boolean {
        this.throwIfNoResult(col)
        return this.getResultSetSafe().getColumn(col).isVariant()
    }
}

function connectToSnowflakeAsync(
    conn: snowflake.Connection,
    callback: (err: snowflake.SnowflakeError, res: boolean) => void,
) {
    conn.connect((err, conn) => {
        if (err !== null) {
            callback(err, null)
        } else {
            callback(null, true)
        }
    })
}
const connectToSnowflake = deasync(connectToSnowflakeAsync)

function setupSnowflake(credentialFile: string): [Credentials, Snowflake] {
    const credentials: Credentials = JSON.parse(fs.readFileSync(credentialFile, 'utf-8'))

    const conn = snowflake.createConnection({
        account: credentials.account,
        username: credentials.username,
        password: credentials.password,
        authenticator: 'SNOWFLAKE',
    })

    connectToSnowflake(conn)

    const sf: Snowflake = {
        createStatement: input => new StatementAdapter(conn, input),
        // TODO: This is not safe!
        // deasynced functions should only be called from the top-level, not from callbacks
        execute: input => execute(conn, input),
    }
    sf.execute({sqlText: `use role ${credentials.role}`})
    sf.execute({sqlText: `use warehouse ${credentials.warehouse}`})
    sf.execute({sqlText: `use database ${credentials.database}`})
    sf.execute({sqlText: `use schema ${credentials.schema}`})
    return [credentials, sf]
}

export {Credentials, setupSnowflake}
