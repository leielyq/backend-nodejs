const assert = require('assert');

const { patchVcbuildText } = require('./select_msvc_toolset');

const sample = [
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
  'echo calling: %vcvars_call%',
  'call %vcvars_call%',
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
].join('\r\n');

const patched = patchVcbuildText(sample, '14.29');
assert.strictEqual(
  (patched.match(/-vcvars_ver=14\.29/g) || []).length,
  2,
  'must add -vcvars_ver=14.29 to every vcvarsall call'
);
assert.strictEqual(
  (patched.match(/if defined PREFERRED_VS_INSTALL_PATH/g) || []).length,
  2,
  'must force vcbuild.bat to use the selected Visual Studio installation'
);

assert.strictEqual(
  patchVcbuildText(patched, '14.29'),
  patched,
  'patching must be idempotent'
);

assert.throws(
  () => patchVcbuildText('echo no vcvars here', '14.29'),
  /No vcvarsall calls were patched/
);

console.log('select_msvc_toolset tests passed');
