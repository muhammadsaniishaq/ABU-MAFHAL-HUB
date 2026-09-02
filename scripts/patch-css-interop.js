const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join(__dirname, '..', 'node_modules', 'react-native-css-interop', 'dist', 'css-to-rn', 'parseDeclaration.js'),
  path.join(__dirname, '..', 'node_modules', 'react-native-css-interop', 'src', 'css-to-rn', 'parseDeclaration.ts')
];

for (const filePath of filesToPatch) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('if (aspectRatio.ratio[0] === aspectRatio.ratio[1])')) {
      content = content.replace(
        /if\s*\(aspectRatio\.auto\)\s*\{\s*return\s*"auto";\s*\}\s*else\s*\{\s*if\s*\(aspectRatio\.ratio\[0\]\s*===\s*aspectRatio\.ratio\[1\]\)/g,
        'if (!aspectRatio) return undefined; if (aspectRatio.auto) { return "auto"; } else if (aspectRatio.ratio && Array.isArray(aspectRatio.ratio)) { if (aspectRatio.ratio[0] === aspectRatio.ratio[1])'
      );
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch] Successfully patched ${filePath}`);
    }
  }
}
