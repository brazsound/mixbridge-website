const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const protoDir = path.join(__dirname, '..', 'ptsl-proto');
const outDir = path.join(__dirname, '..', 'dist-main', 'ptsl');
const protoFile = path.join(protoDir, 'ptsl_minimal.proto');

if (!fs.existsSync(protoFile)) {
  console.warn('ptsl_minimal.proto not found, skipping proto compile');
  process.exit(0);
}

try {
  fs.mkdirSync(outDir, { recursive: true });
  // Use grpc_tools_node_protoc if available (from grpc-tools), else skip
  const protoc = path.join(__dirname, '..', 'node_modules', '.bin', 'grpc_tools_node_protoc');
  if (fs.existsSync(protoc)) {
    execSync(
      `"${protoc}" --js_out=import_style=commonjs,binary:${outDir} --grpc_out=grpc_js:${outDir} -I "${protoDir}" "${protoFile}"`,
      { stdio: 'inherit' }
    );
  }
} catch (e) {
  console.warn('Proto compile skipped (grpc-tools may not be installed):', e.message);
}
