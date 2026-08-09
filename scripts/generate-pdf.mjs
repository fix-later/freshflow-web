import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_BIN,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const chromePath = chromePaths.find(p => existsSync(p));
if (!chromePath) {
    console.error('No Chrome/Edge browser found');
    process.exit(1);
}

const htmlFile = path.resolve('public/files/privacy.html');
const pdfFile = path.resolve('public/files/FreshFlow_Chinh_sach_bao_mat.pdf');

console.log(`Using browser at: ${chromePath}`);
execSync(`"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfFile}" "file:///${htmlFile.replace(/\\\\/g, '/')}"`);
console.log('Successfully generated:', pdfFile);
