const fs = require('fs');
const path = require('path');

function searchEnv(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === '.expo') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchEnv(fullPath);
    } else if (file.includes('.env')) {
      console.log("Found env file:", fullPath);
    }
  }
}

searchEnv('c:/ABU-MAFHAL-HUB');
