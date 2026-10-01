import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/tool-sba-nav.js', import.meta.url), 'utf8');
const start = source.indexOf('const applyCalculatorTheme =');
const end = source.indexOf('const setStyle =', start);
assert.ok(start >= 0 && end > start);
const apply = source.slice(start, end);

// Published custom viewers persist "abs-clean"; the calculator's early
// bootstrap already accepts it. Its later navigation bootstrap must agree.
for (const style of ['abs-clean', 'sba', 'abs-style', 'dokkaninfo']) {
    const classes = new Set(['calc-liquid-body', 'theme-sba', 'theme-abs-clean']);
    const document = { body: { classList: {
        contains: value => classes.has(value),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        add: (...values) => values.forEach(value => classes.add(value))
    } } };
    vm.runInNewContext(`${apply}\napplyCalculatorTheme(${JSON.stringify(style)});`, { document });
    const clean = style === 'abs-clean' || style === 'sba';
    assert.equal(classes.has('theme-sba'), clean, `${style}: news must retain its correct renderer`);
    assert.equal(classes.has('theme-abs-clean'), clean, `${style}: background must retain its correct theme`);
    assert.equal(classes.has('theme-abs-style'), style === 'abs-style');
    assert.equal(classes.has('theme-dokkaninfo'), style === 'dokkaninfo');
}
console.log('Calculator navigation theme aliases and legacy theme preservation passed.');
