// Simple PWA icon generator using Canvas API
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create simple colored rectangles as placeholder PWA icons
function createPlaceholderIcon(size, filename) {
  // Create a simple SVG as placeholder
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size/4}" fill="#10b981"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="white" fill-opacity="0.2"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="white"/>
  <path d="M${size/2 - size/8} ${size/2 - size/12}L${size/2 - size/8} ${size/2 + size/12}L${size/2 + size/8} ${size/2}Z" fill="#10b981"/>
</svg>`;

  fs.writeFileSync(path.join(__dirname, '..', 'public', filename), svg.trim());
  console.log(`Created ${filename}`);
}

// Generate both icon sizes
createPlaceholderIcon(192, 'pwa-192x192.png');
createPlaceholderIcon(512, 'pwa-512x512.png');

console.log('PWA icons generated successfully!');
