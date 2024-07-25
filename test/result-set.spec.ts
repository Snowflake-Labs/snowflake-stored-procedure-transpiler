/**
 * @fileoverview Integration tests for functions in result-set.ts.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import {assert} from 'chai'
import {setupSnowflake} from '../lib/setup-snowflake'
import {fetchAll, fetchCell, fetchOne} from '../example/result-set'

describe('fetchAll', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('returns all rows as an array of arrays', () => {
        assert.deepEqual([['xyzzy']], fetchAll(snowflake, "select 'xyzzy'"))
        assert.deepEqual(
            [
                [1, 2],
                [3, 4],
            ],
            fetchAll(snowflake, 'select * from values (1, 2), (3, 4)'),
        )
    })
})

describe('fetchCell', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('returns the first value in the first row', () => {
        assert.equal('xyzzy', fetchCell(snowflake, "select 'xyzzy'"))
        assert.equal(1, fetchCell(snowflake, 'select * from values (1, 2), (3, 4)'))
    })
})

describe('fetchOne', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('returns the first row as an array', () => {
        assert.deepEqual(['xyzzy'], fetchOne(snowflake, "select 'xyzzy'"))
        assert.deepEqual([1, 2], fetchOne(snowflake, 'select * from values (1, 2), (3, 4)'))
    })
})
