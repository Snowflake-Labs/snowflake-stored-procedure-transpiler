/**
 * @fileoverview Integration tests for spt stored procedures in output_message.ts.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import {assert} from 'chai'
import {setupSnowflake} from '../lib/setup-snowflake'
import {output_message} from '../example/output_message'

describe('output_message', () => {
    let credentials = null
    let snowflake = null

    beforeEach('setup snowflake', () => {
        ;[credentials, snowflake] = setupSnowflake('credentials.json')
    })

    it('returns what is passed', () => {
        for (const s of ['spt', 'is', 'awesome', '!']) {
            assert.equal(s, output_message(snowflake, s))
        }
    })
})
