const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach(line => {
        const parts = line.split('=');
        if (parts[0]) {
            console.log(parts[0].trim(), '=', parts[1] ? parts[1].trim().slice(0, 10) + '...' : 'undefined');
        }
    });
} else {
    console.log('No .env found');
}
