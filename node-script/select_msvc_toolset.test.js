const assert = require('assert');

const { patchVcbuildText } = require('./select_msvc_toolset');

const sample = [
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
  'echo calling: %vcvars_call%',
  'call %vcvars_call%',
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
].join('\r\n');

const patched = patchVcbuildText(sample, '14.34');
assert.strictEqual(
  (patched.match(/-vcvars_ver=14\.34/g) || []).length,
  2,
  'must add -vcvars_ver=14.34 to every vcvarsall call'
);

assert.strictEqual(
  patchVcbuildText(patched, '14.34'),
  patched,
  'patching must be idempotent'
);

assert.throws(
  () => patchVcbuildText('echo no vcvars here', '14.34'),
  /No vcvarsall calls were patched/
);

console.log('select_msvc_toolset tests passed');
