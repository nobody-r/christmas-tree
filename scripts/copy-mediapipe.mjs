/**
 * 将 MediaPipe 运行文件从 node_modules 复制到 public/mediapipe/，
 * 使手势引擎完全本地加载，不依赖外部 CDN。
 * 在 npm install 之后运行：npm run setup:mediapipe
 */
import { mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PACKAGES = [
  { pkg: '@mediapipe/hands', out: 'hands', files: null }, // 复制整个包目录
  { pkg: '@mediapipe/camera_utils', out: 'camera_utils', files: ['camera_utils.js'] },
  { pkg: '@mediapipe/drawing_utils', out: 'drawing_utils', files: ['drawing_utils.js'] },
  { pkg: '@mediapipe/control_utils', out: 'control_utils', files: ['control_utils.js'] },
];

for (const { pkg, out, files } of PACKAGES) {
  const srcDir = join(root, 'node_modules', pkg);
  const outDir = join(root, 'public', 'mediapipe', out);
  mkdirSync(outDir, { recursive: true });
  const toCopy = files ?? readdirSync(srcDir).filter(f =>
    /\.(js|wasm|data|binarypb|tflite)$/.test(f)
  );
  for (const f of toCopy) {
    copyFileSync(join(srcDir, f), join(outDir, f));
  }
  console.log(`copied ${toCopy.length} files -> public/mediapipe/${out}`);
}
