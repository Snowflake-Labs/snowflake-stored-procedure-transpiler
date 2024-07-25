/**
 * @fileoverview This file is an spt example containing a stored procedure that
 * generates an ASCII art plot of a 2D dataset.
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara <nate.mcnamara@snowflake.com>
 * @author Manvi Thakore <manvi.thakore@snowflake.com>
 * @author Noble Mushtak <noble.mushtak@snowflake.com>
 */
import plot from 'simple-ascii-chart'
import {Snowflake} from 'lib/javascript-api-types'
import {fetchAll} from './result-set'

/**
 * Given a table and the names of two numeric columns, outputs a string
 * representing an ASCII art plot of the result data, with the first and second
 * columns corresponding to the horizontal and vertical axes, respectively.
 *
 * @sf_stored_procedure
 * @param table_name Table containing the data to plot
 * @param x_column Name of the column to use for the x-axis
 * @param y_column Name of the column to use for the y-axis
 * @param settings Object representing settings for the ASCII chart
 *   Possible keys for the object: title, xlabel, ylabel, width, height
 * @returns ASCII art representing 2D plot
 */
export function ascii_2d_plot(
    snowflake: Snowflake,
    table_name: string,
    x_column: string,
    y_column: string,
    settings: {
        title?: string
        xlabel?: string
        ylabel?: string
        width?: number
        height?: number
    },
): string {
    const query = 'select identifier(?), identifier(?) from identifier(?)'
    const binds = [x_column, y_column, table_name]
    return plot(fetchAll(snowflake, query, binds), {
        title: settings.title ?? '2D Plot',
        xLabel: settings.xlabel ?? 'X',
        yLabel: settings.ylabel ?? 'Y',
        width: settings.width ?? 480,
        height: settings.height ?? 270,
    })
}
