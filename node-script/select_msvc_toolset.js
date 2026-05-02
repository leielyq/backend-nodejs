const fs = require('fs');
const path = require('path');

const VCVARS_CALL_PATTERN =
  'set vcvars_call="%VCINSTALLDIR%\\Auxiliary\\Build\\vcvarsall.bat" %vcvarsall_arg%';
const VS_INSTALL_OVERRIDE =
  'if defined PREFERRED_VS_INSTALL_PATH set "VCINSTALLDIR=%PREFERRED_VS_INSTALL_PATH%\\VC\\"';

function patchVcbuildText(text) {
  const replacement = `${VS_INSTALL_OVERRIDE}\r\n${VCVARS_CALL_PATTERN}`;
  if (text.includes(replacement)) {
    return text;
  }

  const patched = text.split(VCVARS_CALL_PATTERN).join(replacement);
  if (patched === text) {
    throw new Error('No vcvarsall calls were patched in vcbuild.bat.');
  }

  return patched;
}

function patchVcbuildFile(vcbuildPath) {
  const resolvedPath = path.resolve(vcbuildPath);
  const original = fs.readFileSync(resolvedPath, 'utf8');
  const patched = patchVcbuildText(original);
  fs.writeFileSync(resolvedPath, patched, 'utf8');
  return resolvedPath;
}

function main(argv) {
  const [, , vcbuildPath = 'vcbuild.bat'] = argv;

  try {
    const patchedPath = patchVcbuildFile(vcbuildPath);
    console.log(`Configured ${patchedPath} to use the latest MSVC toolset.`);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

module.exports = {
  patchVcbuildFile,
  patchVcbuildText,
};

if (require.main === module) {
  main(process.argv);
}
