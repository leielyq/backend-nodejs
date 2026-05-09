const fs = require('fs');
const path = require('path');

function parseV8MajorVersionFromText(text, sourceName) {
  const match = text.match(/^\s*#\s*define\s+V8_MAJOR_VERSION\s+(\d+)/m);
  if (!match) {
    throw new Error(`Unable to find V8_MAJOR_VERSION in ${sourceName}`);
  }
  return Number(match[1]);
}

function parseV8MajorVersion(v8Root) {
  const versionHeaderPath = path.join(v8Root, 'include', 'v8-version.h');
  return parseV8MajorVersionFromText(
    fs.readFileSync(versionHeaderPath, 'utf8'),
    versionHeaderPath
  );
}

function createV8HeaderInsertCode() {
  return `

#define HAS_ARRAYBUFFER_NEW_WITHOUT_STL 1

namespace v8
{
// do not new two ArrayBuffer with the same data and length
V8_EXPORT Local<ArrayBuffer> ArrayBuffer_New_Without_Stl(Isolate* isolate, 
      void* data, size_t byte_length, v8::BackingStore::DeleterCallback deleter,
      void* deleter_data);
V8_EXPORT Local<ArrayBuffer> ArrayBuffer_New_Without_Stl(Isolate* isolate, 
      void* data, size_t byte_length);
V8_EXPORT void* ArrayBuffer_Get_Data(Local<ArrayBuffer> array_buffer, size_t &byte_length);
V8_EXPORT void* ArrayBuffer_Get_Data(Local<ArrayBuffer> array_buffer);
}

`;
}

function createArrayBufferWithoutStlBody(v8MajorVersion) {
  if (v8MajorVersion < 9) {
    return `  CHECK_IMPLIES(byte_length != 0, data != nullptr);
  CHECK_LE(byte_length, i::JSArrayBuffer::kMaxByteLength);
  i::Isolate* i_isolate = reinterpret_cast<i::Isolate*>(isolate);

  std::shared_ptr<i::BackingStore> backing_store = LookupOrCreateBackingStore(
      i_isolate, data, byte_length, i::SharedFlag::kNotShared, ArrayBufferCreationMode::kExternalized);

  i::Handle<i::JSArrayBuffer> obj =
      i_isolate->factory()->NewJSArrayBuffer(std::move(backing_store));
  obj->set_is_external(true);
  return Utils::ToLocal(obj);`;
  }

  return `  auto Backing = ArrayBuffer::NewBackingStore(
          data, byte_length, BackingStore::EmptyDeleter, nullptr);
  return ArrayBuffer::New(isolate, std::move(Backing));`;
}

function createApiCcInsertCode(v8MajorVersion) {
  return `
namespace v8
{
Local<ArrayBuffer> ArrayBuffer_New_Without_Stl(Isolate* isolate,
      void* data, size_t byte_length, BackingStore::DeleterCallback deleter,
      void* deleter_data)
{
    auto Backing = ArrayBuffer::NewBackingStore(
            data, byte_length,deleter,
            deleter_data);
    return ArrayBuffer::New(isolate, std::move(Backing));
}

V8_EXPORT Local<ArrayBuffer> ArrayBuffer_New_Without_Stl(Isolate* isolate,
      void* data, size_t byte_length)
{
${createArrayBufferWithoutStlBody(v8MajorVersion)}
}

void* ArrayBuffer_Get_Data(Local<ArrayBuffer> array_buffer, size_t &byte_length)
{
    byte_length = array_buffer->GetBackingStore()->ByteLength();
    return array_buffer->GetBackingStore()->Data();
}
void* ArrayBuffer_Get_Data(Local<ArrayBuffer> array_buffer)
{
    return array_buffer->GetBackingStore()->Data();
}
}
`
}

function patchV8Root(v8Root) {
  const resolvedV8Root = path.resolve(v8Root);
  const v8MajorVersion = parseV8MajorVersion(resolvedV8Root);

  console.log('=====[ add ArrayBuffer_New_Without_Stl ]=====');
  console.log(`Detected V8 major version ${v8MajorVersion}`);

  const v8HeaderPath = path.join(resolvedV8Root, 'include', 'v8.h');
  const v8HeaderContext = fs.readFileSync(v8HeaderPath, 'utf8');
  const v8HeaderInsertPosition = v8HeaderContext.lastIndexOf('#endif');
  if (v8HeaderInsertPosition < 0) {
    throw new Error(`Unable to find final #endif in ${v8HeaderPath}`);
  }
  fs.writeFileSync(
    v8HeaderPath,
    v8HeaderContext.slice(0, v8HeaderInsertPosition) +
      createV8HeaderInsertCode() +
      v8HeaderContext.slice(v8HeaderInsertPosition)
  );

  const apiCcPath = path.join(resolvedV8Root, 'src', 'api', 'api.cc');
  fs.writeFileSync(
    apiCcPath,
    fs.readFileSync(apiCcPath, 'utf8') + createApiCcInsertCode(v8MajorVersion)
  );

  return {
    apiCcPath,
    v8HeaderPath,
    v8MajorVersion,
  };
}

function main(argv) {
  const [, , v8Root] = argv;
  if (!v8Root) {
    throw new Error('Usage: node add_arraybuffer_new_without_stl.js <path-to-deps-v8>');
  }
  patchV8Root(v8Root);
}

module.exports = {
  createApiCcInsertCode,
  createArrayBufferWithoutStlBody,
  createV8HeaderInsertCode,
  parseV8MajorVersion,
  parseV8MajorVersionFromText,
  patchV8Root,
};

if (require.main === module) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}
