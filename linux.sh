[ -z "$GITHUB_WORKSPACE" ] && GITHUB_WORKSPACE="$( cd "$( dirname "$0" )"/.. && pwd )"
WORKSPACE=$GITHUB_WORKSPACE
HOMEPATH=~
VERSION=$1

cd $HOMEPATH
git clone https://github.com/nodejs/node.git

cd node
git fetch origin v$VERSION
git checkout v$VERSION

echo "=====[Patching Node.js]====="
node $WORKSPACE/node-script/do-gitpatch.js -p $WORKSPACE/patchs/lib_uv_add_on_watcher_queue_updated_v$VERSION.patch
node $WORKSPACE/node-script/add_arraybuffer_new_without_stl.js deps/v8
node $WORKSPACE/node-script/make_v8_inspector_export.js

echo "=====[Applying security backports]====="
# Security patches backported from newer release lines live in
# patchs/security_v<version>/ and are applied in filename order.
# A failed security patch must abort the build - never skip silently.
SEC_DIR="$WORKSPACE/patchs/security_v$VERSION"
if ls "$SEC_DIR"/*.patch >/dev/null 2>&1; then
  for p in "$SEC_DIR"/*.patch; do
    echo "Applying security patch: $p"
    git apply --reject "$p" || { echo "ERROR: security patch $p failed. Check .rej files"; exit 1; }
  done
else
  echo "No security patch directory for v$VERSION, skipping."
fi

echo "=====[Building Node.js]====="

export CC=clang
export CXX=clang++
export CXXFLAGS="-stdlib=libc++"
export LDFLAGS="-stdlib=libc++"

./configure --shared
make -j8

mkdir -p ../puerts-node/nodejs/include
mkdir -p ../puerts-node/nodejs/deps/uv/include
mkdir -p ../puerts-node/nodejs/deps/v8/include

echo "=====[Copying public Node.js headers]====="
cp src/js_native_api.h ../puerts-node/nodejs/include || exit 1
cp src/js_native_api_types.h ../puerts-node/nodejs/include || exit 1
cp src/node.h ../puerts-node/nodejs/include || exit 1
cp src/node_api.h ../puerts-node/nodejs/include || exit 1
cp src/node_api_types.h ../puerts-node/nodejs/include || exit 1
cp src/node_buffer.h ../puerts-node/nodejs/include || exit 1
cp src/node_object_wrap.h ../puerts-node/nodejs/include || exit 1
cp src/node_version.h ../puerts-node/nodejs/include || exit 1
cp -r deps/uv/include ../puerts-node/nodejs/deps/uv || exit 1
cp -r deps/v8/include ../puerts-node/nodejs/deps/v8 || exit 1

mkdir -p ../puerts-node/nodejs/lib/Linux/
cp out/Release/libnode.so.* ../puerts-node/nodejs/lib/Linux/
cd ../puerts-node/nodejs/lib/Linux/
SOFILE=$(ls libnode.so.* | head -1)
cp $SOFILE libnode.so
cd -
