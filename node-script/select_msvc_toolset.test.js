const assert = require('assert');

const {
  createArrayBufferWithoutStlBody,
  parseV8MajorVersionFromText,
} = require('./add_arraybuffer_new_without_stl');
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

assert.strictEqual(
  parseV8MajorVersionFromText('#define V8_MAJOR_VERSION 12\n', 'sample'),
  12
);
assert(
  createArrayBufferWithoutStlBody(8).includes('LookupOrCreateBackingStore'),
  'old V8 builds must keep the legacy backing-store path'
);
assert(
  !createArrayBufferWithoutStlBody(12).includes('LookupOrCreateBackingStore'),
  'new V8 builds must not compile the removed LookupOrCreateBackingStore symbol'
);
assert(
  createArrayBufferWithoutStlBody(12).includes('ArrayBuffer::NewBackingStore'),
  'new V8 builds must use the public NewBackingStore API'
);

console.log('select_msvc_toolset tests passed');
