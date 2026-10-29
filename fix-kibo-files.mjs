// fix-kibo-files.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

// 1. Ensure both HitodamaApp.tsx and KiboApp.tsx exist so no import path can fail
const desktopDir = path.join(ROOT, 'src/desktop');
const hitodamaAppPath = path.join(desktopDir, 'HitodamaApp.tsx');
const kiboAppPath = path.join(desktopDir, 'KiboApp.tsx');

const hitoCode = fs.existsSync(hitodamaAppPath) ? fs.readFileSync(hitodamaAppPath, 'utf8') : '';
const kiboCode = fs.existsSync(kiboAppPath) ? fs.readFileSync(kiboAppPath, 'utf8') : '';

// Find which one has the full implementation (never overwrite with stub)
let fullAppCode = kiboCode.length > hitoCode.length ? kiboCode : hitoCode;

if (fullAppCode.includes('export const KiboApp') && !fullAppCode.includes('export { KiboApp as HitodamaApp }')) {
  fullAppCode += '\nexport { KiboApp as HitodamaApp };\n';
} else if (fullAppCode.includes('export const HitodamaApp') && !fullAppCode.includes('export { HitodamaApp as KiboApp }')) {
  fullAppCode += '\nexport { HitodamaApp as KiboApp };\n';
}

fs.writeFileSync(kiboAppPath, fullAppCode, 'utf8');

// For HitodamaApp.tsx, export both so legacy imports work
const hitoShim = `import { KiboApp } from './KiboApp';
export { KiboApp, KiboApp as HitodamaApp } from './KiboApp';
export default KiboApp;
`;
fs.writeFileSync(hitodamaAppPath, hitoShim, 'utf8');
console.log('Synced src/desktop/HitodamaApp.tsx <-> src/desktop/KiboApp.tsx');

// 2. Ensure both HitodamaOnboardingExperience.tsx and KiboOnboardingExperience.tsx exist
const compDir = path.join(ROOT, 'src/components');
const oldOnboard = path.join(compDir, 'HitodamaOnboardingExperience.tsx');
const newOnboard = path.join(compDir, 'KiboOnboardingExperience.tsx');

const oldOnbCode = fs.existsSync(oldOnboard) ? fs.readFileSync(oldOnboard, 'utf8') : '';
const newOnbCode = fs.existsSync(newOnboard) ? fs.readFileSync(newOnboard, 'utf8') : '';

let fullOnbCode = newOnbCode.length > oldOnbCode.length ? newOnbCode : oldOnbCode;
if (!fullOnbCode.includes('HitodamaOnboardingExperience')) {
  fullOnbCode += '\nexport { KiboOnboardingExperience as HitodamaOnboardingExperience };\n';
}
fs.writeFileSync(newOnboard, fullOnbCode, 'utf8');

const onbShim = `import { KiboOnboardingExperience } from './KiboOnboardingExperience';
export type { KiboOnboardingExperienceProps, KiboOnboardingExperienceProps as HitodamaOnboardingExperienceProps } from './KiboOnboardingExperience';
export { KiboOnboardingExperience, KiboOnboardingExperience as HitodamaOnboardingExperience } from './KiboOnboardingExperience';
export default KiboOnboardingExperience;
`;
fs.writeFileSync(oldOnboard, onbShim, 'utf8');
console.log('Synced Onboarding component files.');

// 3. Ensure electron/main.cjs has both createHitodamaTrayIcon and createKiboTrayIcon aliases
const mainPath = path.join(ROOT, 'electron/main.cjs');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');
  if (mainCode.includes('function createHitodamaTrayIcon()') && !mainCode.includes('createKiboTrayIcon')) {
    mainCode = mainCode.replace(
      'function createHitodamaTrayIcon()',
      'function createKiboTrayIcon() { return createHitodamaTrayIcon(); }\nfunction createHitodamaTrayIcon()'
    );
  } else if (mainCode.includes('function createKiboTrayIcon()') && !mainCode.includes('createHitodamaTrayIcon')) {
    mainCode = mainCode.replace(
      'function createKiboTrayIcon()',
      'function createHitodamaTrayIcon() { return createKiboTrayIcon(); }\nfunction createKiboTrayIcon()'
    );
  }
  fs.writeFileSync(mainPath, mainCode, 'utf8');
  console.log('Synced tray icon function names in electron/main.cjs');
}

console.log('All Kibo file imports repaired!');
