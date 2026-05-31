import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const roots = ['resources/js', 'resources/css', 'config', 'routes', 'app'];
const optionalRoots = ['public/build'];
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.php', '.json', '.env', '.txt', '.md']);
const findings = [];

const patterns = [
    { name: 'private key block', regex: /-----BEGIN (RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/i },
    { name: 'PayMongo secret key', regex: /sk_(test|live)_[A-Za-z0-9]{12,}/i },
    { name: 'generic secret assignment', regex: /\b(secret|private[_-]?key|api[_-]?key|password)\b\s*[:=]\s*['"][^'"\n]{12,}['"]/i },
    { name: 'authorization bearer token', regex: /Authorization\s*[:=]\s*['"]Bearer\s+[A-Za-z0-9._~+/=-]{12,}['"]/i },
];

const walk = (dir) => {
    if (!existsSync(dir)) {
        return [];
    }

    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        const stat = statSync(full);

        if (stat.isDirectory()) {
            if (['node_modules', 'vendor', '.git', 'storage'].includes(entry)) {
                return [];
            }
            return walk(full);
        }

        return allowedExtensions.has(extname(full)) ? [full] : [];
    });
};

const files = [...roots, ...optionalRoots].flatMap(walk);

for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of patterns) {
        if (pattern.regex.test(text)) {
            findings.push({ file, type: pattern.name });
        }
    }
}

if (findings.length > 0) {
    console.error('Potential client/source secrets found:');
    for (const finding of findings) {
        console.error(`- ${finding.file}: ${finding.type}`);
    }
    process.exit(1);
}

console.log(`Secret scan passed across ${files.length} files.`);
