/**
 * @fileoverview This file is an spt example containing a stored procedure
 * that returns the input string passed to it.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara <nate.mcnamara@snowflake.com>
 * @author Manvi Thakore <manvi.thakore@snowflake.com>
 * @author Noble Mushtak <noble.mushtak@snowflake.com>
 */
import {Snowflake} from 'lib/javascript-api-types'

/**
 * Return the input message.
 * @sf_stored_procedure
 * @param The message to return.
 * @returns The input message.
 */
export function output_message(snowflake: Snowflake, message: string): string {
    return message
}
