/**
 * @fileoverview Entry point for spt, the Snowflake Stored Procedure Transpiler.
 * Transpiles vanilla TypeScript into Snowflake-conformant stored procedures,
 * enabling the use of the TypeScript and JavaScript ecosystem.
 * The TypeScript compiler API documentation is at
 * https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API#type-checker-apis
 * @copyright 2024 Snowflake, Inc. All Rights Reserved.
 * @license Apache-2.0
 * @author Nate McNamara
 * @author Manvi Thakore
 * @author Noble Mushtak
 */
import * as fs from 'fs'
import * as path from 'path'
import * as rollup from 'rollup'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import * as ts from 'typescript'

////////////////////////////////////////////////////////////////////////////////////////////////////
// Type predicates for builtins
// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
////////////////////////////////////////////////////////////////////////////////////////////////////

function isString(x: string | any): x is string {
    return typeof x === 'string'
}

function isStringArray(x: string[] | any): x is string[] {
    return Array.isArray(x) && (x as Array<unknown>).every(isString)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Diagnostics
////////////////////////////////////////////////////////////////////////////////////////////////////

type Diagnostics = {messages: string[]}

function diagnostics(tsDiagnostics: readonly ts.Diagnostic[]): Diagnostics {
    function fromFile(d: ts.Diagnostic): string {
        const {line, character} = ts.getLineAndCharacterOfPosition(d.file, d.start!)
        return `${d.file.fileName} (${line + 1},${character + 1}): ${message(d)}`
    }

    function message(d: ts.Diagnostic): string {
        return ts.flattenDiagnosticMessageText(d.messageText, '\n')
    }

    return {
        messages: tsDiagnostics.map(d => (d.file ? fromFile(d) : message(d))),
    } as Diagnostics
}

function isDiagnostics(x: Diagnostics | any): x is Diagnostics {
    return typeof x === 'object' && isStringArray((x as Diagnostics).messages)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Signature (for TypeScript, not SQL)
////////////////////////////////////////////////////////////////////////////////////////////////////

type Sym = {name: string; doc: string; type: string}
type Sig = {params: Sym[]; returnType: string; doc: string}

function serializeSignature(checker: ts.TypeChecker, signature: ts.Signature): Sig {
    function serializeSymbol(checker: ts.TypeChecker, symbol: ts.Symbol): Sym {
        return {
            name: symbol.getName(),
            doc: ts.displayPartsToString(symbol.getDocumentationComment(checker)),
            type: checker.typeToString(
                checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!),
            ),
        }
    }

    return {
        params: signature.parameters.map(p => serializeSymbol(checker, p)),
        returnType: checker.typeToString(signature.getReturnType()),
        doc: ts.displayPartsToString(signature.getDocumentationComment(checker)),
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Stored Procedure
////////////////////////////////////////////////////////////////////////////////////////////////////

type Param = {name: string; type: string}
enum Rights { // no const so we can use reverse mapping
    NOT_SPECIFIED,
    CALLER,
    OWNER,
}
type StoredProcedure = {
    name: string
    params: Param[]
    returnType: string
    rights: Rights
}

const STORED_PROCEDURE_TAG: string = 'sf_stored_procedure'

function jsTags(node: ts.FunctionDeclaration): ts.JSDocTag[] {
    return ts
        .getJSDocCommentsAndTags(node)
        .filter(ts.isJSDoc)
        .flatMap(jsdoc => jsdoc.tags)
}

function mapToSQL(dataType: string): string {
    const map = {
        string: 'STRING',
        number: 'NUMBER',
        Date: 'TIMESTAMP_LTZ',
        boolean: 'BOOLEAN',
        object: 'VARIANT',
        array: 'ARRAY',
        json: 'VARIANT',
    }
    return map[dataType] || map['object']
}

function runAs(tag: ts.JSDocTag): Rights {
    const map = {
        caller: Rights.CALLER,
        owner: Rights.OWNER,
    }
    const comment = isString(tag.comment) ? (tag.comment as string) : ''
    return map[comment] || Rights.NOT_SPECIFIED
}

function storedProcedure(checker: ts.TypeChecker, decl: ts.FunctionDeclaration): StoredProcedure {
    const signatures = checker.getTypeAtLocation(decl).getCallSignatures()
    if (signatures.length !== 1) {
        throw new Error(`Function ${decl.name.text} has ${signatures.length} signatures ?!`)
    }
    const sig = serializeSignature(checker, signatures[0])
    const ps = sig.params.slice(1)
    const params = ps.map(p => ({
        name: p.name.toUpperCase(),
        type: mapToSQL(p.type),
    }))
    const returnType = sig.returnType !== 'void' ? mapToSQL(sig.returnType) : 'VARIANT NULL'
    return {
        name: decl.name.text,
        params,
        returnType,
        rights: runAs(storedProcedureTag(decl)),
    }
}

function storedProcedureTag(decl: ts.FunctionDeclaration): ts.JSDocTag | undefined {
    return jsTags(decl).find(tag => tag.tagName.escapedText === STORED_PROCEDURE_TAG)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Compile
////////////////////////////////////////////////////////////////////////////////////////////////////

type Bundler = (
    tmpDir: string,
    fileName: string,
    sp: StoredProcedure,
) => Promise<string | Diagnostics>

/**
 * Given a TypeScript file, outputs SQL code for defining a JavaScript stored procedure
 * for the first function in that file whose documentation comment starts with the string
 * in STORED_PROCEDURE_DOC.
 *
 * @param bundler  Function to bundle a stored procedure.
 * @param paths    Module-lookup paths, e.g., {'lib/*': ['path/to/spt/lib/*']}.
 * @param fileName Name of file possibly containing stored procedure.
 *                 fileName must end with ".ts" or ".js" and be a relative path.
 * @returns either undefined, an empty string, or a nonempty string
 *   Diagnostics -> Errors occured during compilation
 *   list of strings -> list of strings representing SQL for each stored procedure in this file
 */
async function compile(
    bundler: Bundler,
    paths: {[key: string]: string[]},
    fileName: string,
): Promise<string[] | Diagnostics> {
    const compilerOptions: ts.CompilerOptions = {
        allowJs: true,
        module: ts.ModuleKind.ES2015,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmitOnError: true,
        paths: paths,
        strict: true,
        target: ts.ScriptTarget.ES2021,
    }

    // Compile to AST to identify the stored procedures
    const program = ts.createProgram([fileName], compilerOptions)
    const checker = program.getTypeChecker()
    const sourceFileNode = program.getSourceFile(fileName)
    if (!sourceFileNode) {
        return diagnostics(ts.getPreEmitDiagnostics(program))
    }
    const sprocs: StoredProcedure[] = storedProcedures(checker, sourceFileNode)
    if (sprocs.length === 0) {
        // If we try to pack a file without any sprocs, rollup emits a misleading error message.
        return []
    }

    // Output js files to bundle
    let emitResult = program.emit()
    if (emitResult.emitSkipped) {
        return diagnostics(ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics))
    }
    const result = await pack(bundler, fileName, sprocs)

    // Clean up the js files
    if (fileName.endsWith('.ts')) {
        await fs.promises.rm(fileName.substring(0, fileName.length - 3) + '.js')
    }

    return result
}

async function pack(
    bundler: Bundler,
    fileName: string,
    sprocs: StoredProcedure[],
): Promise<string[] | Diagnostics> {
    function sqlRights(rights: Rights): string {
        return rights === Rights.NOT_SPECIFIED ? '' : ` execute as ${Rights[rights]}`
    }

    function sqlSignature(sp: StoredProcedure): string {
        const params = sp.params.map(p => `${p.name} ${p.type}`)
        return `${sp.name}${'(' + params.join(', ') + ')'} returns ${sp.returnType}`
    }

    let sqlCodes = []
    for (const sp of sprocs) {
        const tmpDir = await fs.promises.mkdtemp('temp-')
        const bundle = await bundler(tmpDir, fileName, sp)
        if (isDiagnostics(bundle)) {
            return bundle as Diagnostics
        }

        const spCode = `create or replace procedure ${sqlSignature(
            sp,
        )} language javascript${sqlRights(sp.rights)} as \$\$
    let __result = null;

    ${bundle.split(/\r?\n/).join('\n    ')}
    return __result;
\$\$;`

        await fs.promises.rm(tmpDir, {recursive: true})
        sqlCodes.push(spCode)
    }
    return sqlCodes
}

function storedProcedures(checker: ts.TypeChecker, node: ts.Node): StoredProcedure[] {
    function isStoredProcedure(node: ts.Node): node is ts.FunctionDeclaration {
        return (
            ts.isFunctionDeclaration(node) &&
            jsTags(node).some(tag => tag.tagName.escapedText === STORED_PROCEDURE_TAG)
        )
    }

    // getChildren doesn't return the nodes we want
    // forEachChild stops if the callback returns truthy, hence the void
    const children: ts.Node[] = []
    ts.forEachChild(node, n => void children.push(n))
    return children.filter(isStoredProcedure).map(n => storedProcedure(checker, n))
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// Main
////////////////////////////////////////////////////////////////////////////////////////////////////

async function call_rollup(
    tmpDir: string,
    fileName: string,
    sp: StoredProcedure,
): Promise<string | Diagnostics> {
    function isChunk(x: rollup.OutputAsset | rollup.OutputChunk): x is rollup.OutputChunk {
        return x.type === 'chunk'
    }

    const moduleName = `${fileName.substring(0, fileName.length - 3)}.js`
    const args = `snowflake${sp.params.map(p => ', ' + p.name).join('')}`
    await fs.promises.writeFile(
        `${tmpDir}/use.js`,
        `import {${sp.name}} from '../${moduleName}'\n__result = ${sp.name}(${args})`,
    )

    const inputOptions: rollup.InputOptions = {
        input: path.resolve(`${tmpDir}/use.js`),
        plugins: [commonjs(), nodeResolve()],
    }
    const outputOptions: rollup.OutputOptions = {
        format: 'commonjs',
        generatedCode: {constBindings: true},
        strict: false, // don't emit "use strict" as it cannot appear in the middle of a function
    }
    const bundle: rollup.RollupBuild = await rollup.rollup(inputOptions)
    try {
        const output: rollup.RollupOutput = await bundle.generate(outputOptions)
        const chunks: rollup.OutputChunk[] = output.output.filter(isChunk)
        return chunks.map(chunk => chunk.code).join('')
    } catch (e) {
        return {messages: [`${e}`]}
    } finally {
        await bundle.close()
    }
}

async function main(argv: string[]): Promise<number> {
    // argv is [ts-node, main.ts, file...]
    // TODO allow the user to specify module paths
    const libDir = path.resolve(`${argv[1]}/../../lib`)
    const paths = {'lib/*': [`${libDir}/*`]}
    const fileNames = argv.slice(2)
    const compilationResults = await Promise.all(fileNames.map(f => compile(call_rollup, paths, f)))
    const errors: Diagnostics[] = compilationResults.filter(isDiagnostics)
    if (0 < errors.length) {
        errors.forEach(d => d.messages.forEach(m => process.stderr.write(`${m}\n`)))
        return 1
    }
    const texts: string[] = compilationResults.flatMap(x => (isDiagnostics(x) ? [] : x))
    console.log(texts.filter(s => 0 < s.length).join('\n\n\n'))
    return 0
}

main(process.argv).then(process.exit)
