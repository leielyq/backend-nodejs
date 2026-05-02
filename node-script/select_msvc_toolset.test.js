const assert = require('assert');

const { patchVcbuildText } = require('./select_msvc_toolset');

const sample = [
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
  'echo calling: %vcvars_call%',
  'call %vcvars_call%',
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%',
].join('\r\n');

const patched = patchVcbuildText(sample);
assert.strictEqual(
  (patched.match(/-vcvars_ver=/g) || []).length,
  0,
  'must not force a fixed MSVC toolset by default'
);
assert.strictEqual(
  (patched.match(/if defined PREFERRED_VS_INSTALL_PATH/g) || []).length,
  2,
  'must force vcbuild.bat to use the selected Visual Studio installation'
);

assert.strictEqual(
  patchVcbuildText(patched),
  patched,
  'patching must be idempotent'
);

assert.throws(
  () => patchVcbuildText('echo no vcvars here'),
  /No vcvarsall calls were patched/
);

console.log('select_msvc_toolset tests passed');
