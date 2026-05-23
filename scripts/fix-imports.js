const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiDir = path.join(rootDir, 'api');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

// Replacement rules based on the subfolder containing the file
const replacementsByFolder = {
    'handlers': [
        { regex: /from\s+["']\.\/_auth\.js["']/g, replacement: 'from "../services/auth.js"' },
        { regex: /from\s+["']\.\/_db\.js["']/g, replacement: 'from "../services/db.js"' },
        { regex: /from\s+["']\.\/_logger\.js["']/g, replacement: 'from "../services/logger.js"' },
        { regex: /from\s+["']\.\/_default-categories\.js["']/g, replacement: 'from "../utils/default-categories.js"' },
        { regex: /from\s+["']\.\/_rate-limiter\.js["']/g, replacement: 'from "../middleware/rate-limiter.js"' },
        { regex: /from\s+["']\.\/_session-store\.js["']/g, replacement: 'from "../services/session-store.js"' },
        { regex: /from\s+["']\.\/_types\.js["']/g, replacement: 'from "../utils/types.js"' },
        { regex: /from\s+["']\.\/_crypto\.js["']/g, replacement: 'from "../utils/crypto.js"' },
        { regex: /from\s+["']\.\/_query-builder\.js["']/g, replacement: 'from "../services/query-builder.js"' },
    ],
    'handlers/ai': [
        { regex: /from\s+["']\.\.\/_auth\.js["']/g, replacement: 'from "../../services/auth.js"' },
        { regex: /from\s+["']\.\.\/_db\.js["']/g, replacement: 'from "../../services/db.js"' },
        { regex: /from\s+["']\.\.\/_logger\.js["']/g, replacement: 'from "../../services/logger.js"' },
        { regex: /from\s+["']\.\.\/_ai-provider\.js["']/g, replacement: 'from "../../services/ai-provider.js"' },
        { regex: /from\s+["']\.\.\/_types\.js["']/g, replacement: 'from "../../utils/types.js"' },
    ],
    'middleware': [
        { regex: /from\s+["']\.\/_logger\.js["']/g, replacement: 'from "../services/logger.js"' },
        { regex: /from\s+["']\.\/_types\.js["']/g, replacement: 'from "../utils/types.js"' },
    ],
    'services': [
        { regex: /from\s+["']\.\/_auth\.js["']/g, replacement: 'from "./auth.js"' },
        { regex: /from\s+["']\.\/_db\.js["']/g, replacement: 'from "./db.js"' },
        { regex: /from\s+["']\.\/_db-mock\.js["']/g, replacement: 'from "./db-mock.js"' },
        { regex: /from\s+["']\.\/_gemini\.js["']/g, replacement: 'from "./gemini.js"' },
        { regex: /from\s+["']\.\/_logger\.js["']/g, replacement: 'from "./logger.js"' },
        { regex: /from\s+["']\.\/_provider-openrouter\.js["']/g, replacement: 'from "./openrouter.js"' },
        { regex: /from\s+["']\.\/_query-builder\.js["']/g, replacement: 'from "./query-builder.js"' },
        { regex: /from\s+["']\.\/_session-store\.js["']/g, replacement: 'from "./session-store.js"' },
        { regex: /from\s+["']\.\/_ai-provider\.js["']/g, replacement: 'from "./ai-provider.js"' },
        { regex: /from\s+["']\.\/_crypto\.js["']/g, replacement: 'from "../utils/crypto.js"' },
        { regex: /from\s+["']\.\/_dns-bypass\.js["']/g, replacement: 'from "../utils/dns-bypass.js"' },
        { regex: /from\s+["']\.\/_types\.js["']/g, replacement: 'from "../utils/types.js"' },
    ],
    'utils': [
        { regex: /from\s+["']\.\/_types\.js["']/g, replacement: 'from "./types.js"' },
        { regex: /from\s+["']\.\/_db\.js["']/g, replacement: 'from "../services/db.js"' },
        { regex: /from\s+["']\.\/_logger\.js["']/g, replacement: 'from "../services/logger.js"' },
    ]
};

console.log("Fixing relative imports...");

walkDir(apiDir, (filePath) => {
    // Only process .ts or .js files
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.js')) return;
    
    // Ignore server and handler files in api root for now (we will edit them manually or via script)
    const relativePath = path.relative(apiDir, filePath);
    const dirName = path.dirname(relativePath).replace(/\\/g, '/');
    
    if (dirName === '.' || dirName === '') return; // skip files directly under api/
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    const rules = replacementsByFolder[dirName];
    if (rules) {
        rules.forEach(rule => {
            content = content.replace(rule.regex, rule.replacement);
        });
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated imports in: ${relativePath}`);
    }
});

console.log("Imports updated successfully!");
