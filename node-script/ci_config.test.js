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
  assert(
    fs.existsSync(path.join(repoRoot, 'patchs', `lib_uv_add_on_watcher_queue_updated_v${config.version}.patch`)),
    `missing libuv patch for Node ${config.version}`
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
assert.strictEqual(puerBuild['link-libraries'].linux.x64[0], '/lib/Linux/libnode.so.${NODE_MODULE_VERSION}');
assert.strictEqual(puerBuild['copy-libraries'].linux.x64[0], '/lib/Linux/libnode.so.${NODE_MODULE_VERSION}');

console.log('CI config tests passed');
