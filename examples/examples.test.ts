import Ajv from 'ajv';
import draft6Schema from 'ajv/lib/refs/json-schema-draft-06.json';
import fs from 'fs';
import path from 'path';
import {Spec as VgSpec} from 'vega';
import vgSchema from 'vega/build/vega-schema.json';
import vlSchema from '../build/vega-lite-schema.json';
import {compile} from '../src/compile/compile';
import * as log from '../src/log';
import {TopLevelSpec} from '../src/spec';
import {duplicate} from '../src/util';

// import {inspect} from 'util';

const ajv = new Ajv({
  validateSchema: true,
  allErrors: true,
  format: 'full',
  extendRefs: 'fail',
  schemaId: 'auto' // for draft 04 and 06 schemas
});

ajv.addMetaSchema(draft6Schema);
ajv.addFormat('color-hex', () => true);

const validateVl = ajv.compile(vlSchema);
const validateVg = ajv.compile(vgSchema);

function validateVL(spec: TopLevelSpec) {
  const valid = validateVl(spec);
  const errors = validateVl.errors;
  if (!valid) {
    // uncoment to show schema validation error details
    // console.log(inspect(errors, {depth: 10, colors: true}));
  }

  expect(errors?.map((err: Ajv.ErrorObject) => err.message).join(', ')).toBeUndefined();
  expect(valid).toBe(true);

  expect(spec.$schema.substr(0, 42)).toBe('https://vega.github.io/schema/vega-lite/v4');
}

function validateVega(vegaSpec: VgSpec) {
  const valid = validateVg(vegaSpec);
  const errors = validateVg.errors;
  if (!valid) {
    // uncoment to show schema validation  error details
    // console.log(inspect(errors, {depth: 10, colors: true}));
  }

  expect(errors?.map((err: Ajv.ErrorObject) => err.message).join(', ')).toBeUndefined();
  expect(valid).toBe(true);
}

const BROKEN_SUFFIX = '_broken.vl.json';
const FUTURE_SUFFIX = '_future.vl.json';

const examples = fs.readdirSync('examples/specs').map(file => 'examples/specs/' + file);
const normalizedExamples = fs.readdirSync('examples/specs/normalized').map(file => 'examples/specs/normalized/' + file);

expect(examples).toContain('examples/specs/scatter_image.vl.json');

for (const example of [...examples, ...normalizedExamples]) {
  if (path.extname(example) !== '.json') {
    continue;
  }
  const jsonSpec = JSON.parse(fs.readFileSync(example).toString());
  const originalSpec = duplicate(jsonSpec);

  describe(
    example,
    log.wrap(localLogger => {
      const vegaSpec: VgSpec = compile(jsonSpec).spec;

      it('should not cause any side effects', () => {
        expect(jsonSpec).toEqual(originalSpec);
      });

      it('should be valid Vega-Lite with proper $schema', () => {
        if (example.endsWith(FUTURE_SUFFIX)) {
          return;
        }
        validateVL(jsonSpec);
      });

      it('should not produce any warning', () => {
        if (example.endsWith(BROKEN_SUFFIX)) {
          return;
        }

        expect(localLogger.warns).toEqual([]);
      });

      it('should produce valid Vega', () => {
        if (example.endsWith(BROKEN_SUFFIX)) {
          return;
        }

        validateVega(vegaSpec);
      });
    })
  );
}
