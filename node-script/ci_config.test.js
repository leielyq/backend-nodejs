const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');

const expectedNodeBuilds = {
  18: {
    file: 'build_18.yml',
    version: '18.20.8',
    output: 'nodejs_18',
    linuxLib: 'libnode.so.108',
  },
  20: {
    file: 'build_20.yml',
    version: '20.20.2',
    output: 'nodejs_20',
    linuxLib: 'libnode.so.115',
  },
  22: {
    file: 'build_22.yml',
    version: '22.22.2',
    output: 'nodejs_22',
    linuxLib: 'libnode.so.127',
  },
};

const desktopBuildWorkflows = [
  'build_14.yml',
  'build_16.yml',
  'build_16_withssl.yml',
  ...Object.values(expectedNodeBuilds).map((config) => config.file),
];

const publicNodeHeaders = [
  'js_native_api.h',
  'js_native_api_types.h',
  'node.h',
  'node_api.h',
  'node_api_types.h',
  'node_buffer.h',
  'node_object_wrap.h',
  'node_version.h',
];
const commonWinRuntimeLibraries = [
  'concrt140.dll',
  'msvcp140.dll',
  'msvcp140_1.dll',
  'msvcp140_2.dll',
  'msvcp140_atomic_wait.dll',
  'msvcp140_codecvt_ids.dll',
  'vccorlib140.dll',
  'vcruntime140.dll',
];
const win64OnlyRuntimeLibraries = [
  'vcruntime140_1.dll',
];

const removedPlatformFiles = [
  'android-configure',
  'android-configure-static',
  'android-static.sh',
  'android.sh',
  'ios.sh',
  'macos.sh',
  'macos_arm64.sh',
  path.join('patchs', 'android_disable_alink_thin_v14.16.1.patch'),
  path.join('patchs', 'android_disable_alink_thin_v14.18.3.patch'),
  path.join('patchs', 'android_disable_alink_thin_v16.16.0.patch'),
  path.join('patchs', 'fix_no_handler_inside_posix_v14.16.1.patch'),
  path.join('patchs', 'fix_no_handler_inside_posix_v14.18.3.patch'),
  path.join('patchs', 'fix_no_handler_inside_posix_v16.16.0.patch'),
  path.join('patchs', 'ios_ninja_compile_for_v14.16.1.patch'),
  path.join('patchs', 'ios_ninja_compile_for_v14.18.3.patch'),
  path.join('patchs', 'ios_ninja_compile_for_v16.16.0.patch'),
];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertNotContains(text, forbidden, context) {
  for (const token of forbidden) {
    assert(
      !new RegExp(token, 'i').test(text),
      `${context} must not contain removed platform token: ${token}`
    );
  }
}

for (const [major, config] of Object.entries(expectedNodeBuilds)) {
  const workflowPath = path.join(workflowsDir, config.file);
  const winBuildPatch = readText(path.join('patchs', `win_build_v${config.version}.patch`));
  assert(fs.existsSync(workflowPath), `missing workflow for Node ${major}: ${config.file}`);

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert(
    workflow.includes(`VERSION: ${config.version}`),
    `${config.file} must build Node ${config.version}`
  );
  assert(workflow.includes(`OUTPUT_DIR: ${config.output}`), `${config.file} must publish ${config.output}`);
  assert(workflow.includes('runs-on: windows-latest'), `${config.file} must build on Windows`);
  assert(workflow.includes('runs-on: ubuntu-latest'), `${config.file} must build on Linux`);
  assert(workflow.includes('mv ~/puerts-node/nodejs ~/puerts-node/${{ env.OUTPUT_DIR }}'), `${config.file} must rename Linux output`);
  assert(workflow.includes('mv puerts-node/nodejs puerts-node/${{ env.OUTPUT_DIR }}'), `${config.file} must rename Windows output`);
  assert(workflow.includes('nodejs_bin_${{ env.VERSION }}.tgz'), `${config.file} must publish a versioned archive`);
  assertNotContains(workflow, ['macos', 'ios', 'android', 'xcode', 'ndk'], config.file);

  assert(
    fs.existsSync(path.join(repoRoot, 'patchs', `win_build_v${config.version}.patch`)),
    `missing Windows patch for Node ${config.version}`
  );
  if (major === '18') {
    assert(
      winBuildPatch.includes('BUILDING_V8_SHARED'),
      'Node 18 Windows patch must export V8 private template symbols for shared builds'
    );
  }
  assert(
    fs.existsSync(path.join(repoRoot, 'patchs', `lib_uv_add_on_watcher_queue_updated_v${config.version}.patch`)),
    `missing libuv patch for Node ${config.version}`
  );
}

for (const workflowFile of desktopBuildWorkflows) {
  const workflow = readText(path.join('.github', 'workflows', workflowFile));
  assert(
    workflow.includes('Install Linux build dependencies'),
    `${workflowFile} must install Linux dependencies before running linux.sh`
  );
  assert(
    workflow.includes('libc++-dev') && workflow.includes('libc++abi-dev'),
    `${workflowFile} must install libc++ headers because linux.sh builds with -stdlib=libc++`
  );
  assert(
    !workflow.includes('MSVC_TOOLSET_VERSION:'),
    `${workflowFile} must not pin Windows builds to a fixed MSVC toolset`
  );
  assert(
    workflow.includes('Select latest MSVC toolset'),
    `${workflowFile} must select the latest MSVC toolset before Windows builds`
  );
  assert(
    workflow.includes('.\\node-script\\ensure_msvc_toolset.ps1'),
    `${workflowFile} must use ensure_msvc_toolset.ps1 for Windows toolset/runtime discovery`
  );
  assert(
    !workflow.includes('-ToolsetVersion'),
    `${workflowFile} must not pass a fixed MSVC toolset version`
  );
  assert(
    workflow.includes('Remove Existing Release'),
    `${workflowFile} must clean up an existing release before publishing`
  );
  assert(
    workflow.includes('GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}'),
    `${workflowFile} must authenticate GitHub CLI release cleanup with GITHUB_TOKEN`
  );
  assert(
    workflow.includes('gh release delete "${RELEASE_TAG}" --yes --cleanup-tag'),
    `${workflowFile} must delete an existing release and tag before recreating it`
  );
  assert(
    workflow.includes('gh api --method DELETE "repos/${GITHUB_REPOSITORY}/git/refs/tags/${RELEASE_TAG}"'),
    `${workflowFile} must delete a leftover git tag before recreating the release`
  );
  const expectedReleaseTag = workflowFile === 'build_16_withssl.yml'
    ? 'RELEASE_TAG: NodeJS_${{ env.VERSION }}_ssl_${{ github.event.inputs.tag_date }}'
    : 'RELEASE_TAG: NodeJS_${{ env.VERSION }}_${{ github.event.inputs.tag_date }}';
  assert(
    workflow.includes(expectedReleaseTag),
    `${workflowFile} must clean up the same release tag that it publishes`
  );
}

const windowsTrybuild = readText('windows_trybuild.cmd');
assert(
  !windowsTrybuild.includes('PREFERRED_MSVC_TOOLSET_VERSION=14.29'),
  'windows_trybuild.cmd must not default to a fixed MSVC toolset'
);
assert(
  windowsTrybuild.includes('select_msvc_toolset.js') && !windowsTrybuild.includes('%PREFERRED_MSVC_TOOLSET_VERSION%'),
  'windows_trybuild.cmd must patch Node vcbuild.bat without forcing a fixed MSVC toolset'
);
assert(
  fs.existsSync(path.join(repoRoot, 'node-script', 'ensure_msvc_toolset.ps1')),
  'missing MSVC setup script'
);
const ensureMsvcToolset = readText(path.join('node-script', 'ensure_msvc_toolset.ps1'));
assert(
  !ensureMsvcToolset.includes('Microsoft.VisualStudio.Component.VC.14.29.16.11.x86.x64'),
  'ensure_msvc_toolset.ps1 must not install a fixed MSVC 14.29 component'
);
assert(
  ensureMsvcToolset.includes('-latest -products'),
  'ensure_msvc_toolset.ps1 must select the latest Visual Studio installation'
);
assert(
  !ensureMsvcToolset.includes('--wait'),
  'ensure_msvc_toolset.ps1 must not pass unsupported --wait to Visual Studio Installer setup.exe'
);
assert(
  ensureMsvcToolset.includes('PREFERRED_VS_INSTALL_PATH=$installPath'),
  'ensure_msvc_toolset.ps1 must export the selected Visual Studio install path'
);
assert(
  ensureMsvcToolset.includes('PREFERRED_VC_REDIST_ROOT='),
  'ensure_msvc_toolset.ps1 must export the selected VC runtime redistributable root'
);
assert(
  fs.existsSync(path.join(repoRoot, 'node-script', 'select_msvc_toolset.js')),
  'missing Node vcbuild MSVC selector script'
);
const selectMsvcToolset = readText(path.join('node-script', 'select_msvc_toolset.js'));
assert(
  !selectMsvcToolset.includes('PREFERRED_MSVC_TOOLSET_VERSION') && !selectMsvcToolset.includes('-vcvars_ver'),
  'select_msvc_toolset.js must not force a fixed MSVC toolset'
);

const linuxBuildScript = readText('linux.sh');
for (const header of publicNodeHeaders) {
  assert(
    linuxBuildScript.includes(`cp src/${header} ../puerts-node/nodejs/include`),
    `linux.sh must export public Node header ${header}`
  );
}

for (const windowsUploadScript of ['windows_32.cmd', 'windows_64.cmd']) {
  const script = readText(windowsUploadScript);
  for (const header of publicNodeHeaders) {
    assert(
      script.includes(`node\\src\\${header}`),
      `${windowsUploadScript} must export public Node header ${header}`
    );
  }
  assert(
    script.includes('node\\deps\\uv\\include'),
    `${windowsUploadScript} must export libuv headers`
  );
  assert(
    script.includes('node\\deps\\v8\\include'),
    `${windowsUploadScript} must export V8 headers`
  );
  assert(
    script.includes('puerts-node\\nodejs\\lib\\'),
    `${windowsUploadScript} must export Windows binaries under lowercase lib`
  );
  assert(
    !script.includes('puerts-node\\nodejs\\Lib\\'),
    `${windowsUploadScript} must not use uppercase Lib in export paths`
  );
  assert(
    script.includes('PREFERRED_VC_REDIST_ROOT'),
    `${windowsUploadScript} must locate the selected VC runtime redistributable root`
  );
  assert(
    script.includes('-latest -products'),
    `${windowsUploadScript} must use the latest Visual Studio installation when falling back to vswhere`
  );
  assert(
    script.includes('Microsoft.VC*.CRT'),
    `${windowsUploadScript} must find the selected VC runtime CRT directory`
  );
  assert(
    script.includes('concrt140.dll') &&
      script.includes('msvcp140*.dll') &&
      script.includes('vcruntime140*.dll'),
    `${windowsUploadScript} must export matching Visual C++ runtime DLLs`
  );
}

for (const entry of fs.readdirSync(workflowsDir)) {
  if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) continue;
  assertNotContains(readText(path.join('.github', 'workflows', entry)), ['macos-latest', 'build_ios', 'build_android', 'macos_arm64'], entry);
}

for (const removedPath of removedPlatformFiles) {
  assert(
    !fs.existsSync(path.join(repoRoot, removedPath)),
    `removed platform file still exists: ${removedPath}`
  );
}

const puerBuild = JSON.parse(readText('puer-build.json'));
assert.deepStrictEqual(Object.keys(puerBuild.skip), ['win']);
assert(!('android' in puerBuild['link-libraries']), 'puer-build.json must not expose Android link libraries');
assert(!('osx' in puerBuild['link-libraries']), 'puer-build.json must not expose macOS link libraries');
assert(!('ios' in puerBuild['copy-libraries']), 'puer-build.json must not expose iOS copy libraries');
assert.strictEqual(puerBuild['link-libraries'].win.ia32[0], '/lib/Win32/libnode.lib');
assert.strictEqual(puerBuild['link-libraries'].win.x64[0], '/lib/Win64/libnode.lib');
assert.strictEqual(puerBuild['link-libraries'].linux.x64[0], '/lib/Linux/libnode.so.${NODE_MODULE_VERSION}');
assert.strictEqual(puerBuild['copy-libraries'].linux.x64[0], '/lib/Linux/libnode.so.${NODE_MODULE_VERSION}');

for (const runtime of commonWinRuntimeLibraries) {
  assert(
    puerBuild['copy-libraries'].win.x64.includes(`/lib/Win64/${runtime}`),
    `puer-build.json must copy Win64 VC runtime ${runtime}`
  );
  assert(
    puerBuild['copy-libraries'].win.ia32.includes(`/lib/Win32/${runtime}`),
    `puer-build.json must copy Win32 VC runtime ${runtime}`
  );
}

for (const runtime of win64OnlyRuntimeLibraries) {
  assert(
    puerBuild['copy-libraries'].win.x64.includes(`/lib/Win64/${runtime}`),
    `puer-build.json must copy Win64 VC runtime ${runtime}`
  );
}

console.log('CI config tests passed');
