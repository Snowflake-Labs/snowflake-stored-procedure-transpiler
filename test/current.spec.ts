/**
 * @fileoverview Integration tests for spt stored procedures in current.ts.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import {assert} from 'chai'
import {setupSnowflake} from '../lib/setup-snowflake'
import {current_t, current_v} from '../example/current'

describe('current_t', function () {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('is not in the past', () => {
        const res = current_t(snowflake)
        assert.isTrue(res.getFullYear() >= 2024)
    })
})

describe('current_v', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('has the form major.minor.patch', () => {
        const res = current_v(snowflake)
        for (const portion of res.split(' ')[0].split('.')) {
            assert.isTrue(/^\d+$/.test(portion))
        }
    })
})
