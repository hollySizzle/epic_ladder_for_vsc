#!/usr/bin/env node
/**
 * SCSS to TypeScript compiler
 *
 * Compiles styles.scss and generates styles.ts with the CSS as a string export.
 * This allows VS Code webview to use the styles inline (required due to CSP).
 */

const sass = require('sass');
const fs = require('fs');
const path = require('path');

const SCSS_PATH = path.join(__dirname, '../src/webview/styles.scss');
const TS_OUTPUT_PATH = path.join(__dirname, '../src/webview/styles.ts');

function compileScss() {
  try {
    console.log('Compiling SCSS...');

    // Compile SCSS to CSS
    const result = sass.compile(SCSS_PATH, {
      style: 'compressed', // Use compressed for production
      sourceMap: false,
    });

    const css = result.css;

    // Generate TypeScript file
    const tsContent = `/**
 * CSS styles for the Epic Ladder webview
 *
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * Edit styles.scss instead and run 'npm run compile:scss' to regenerate.
 */
export function getStyles(): string {
    return \`${css.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
}
`;

    // Write TypeScript file
    fs.writeFileSync(TS_OUTPUT_PATH, tsContent, 'utf8');

    console.log(`Successfully compiled SCSS to ${TS_OUTPUT_PATH}`);
    console.log(`CSS size: ${(css.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('Error compiling SCSS:', error.message);
    process.exit(1);
  }
}

compileScss();
