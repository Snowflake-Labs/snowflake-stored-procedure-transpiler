/**
 * @fileoverview Unit tests for avg.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import {assert} from 'chai'
import {avg} from '../example/avg'

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
