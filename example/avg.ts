/**
 * @fileoverview This file contains a function that computes
 * the average (mean) of an array of numbers.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara <nate.mcnamara@snowflake.com>
 * @author Manvi Thakore <manvi.thakore@snowflake.com>
 * @author Noble Mushtak <noble.mushtak@snowflake.com>
 */

/**
 * The mean of the given numbers.
 * @param xs The numbers whose mean to compute.
 * @returns The mean of the given numbers, or NaN if xs is empty.
 */
export function avg(xs: number[]): number {
    return xs.reduce((x, y) => x + y, 0) / xs.length
}
