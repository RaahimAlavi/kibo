// rebrand-to-kibo.mjs
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const TARGET_FILES = [
  'index.html',
  'package.json',
  'electron/main.cjs',
  'electron/preload.cjs',
  'electron/systemController.cjs',
  'src/main.tsx',
  'src/App.tsx',
  'src/desktop/HitodamaApp.tsx',
  'src/desktop/desktop-companion.css',
  'src/lib/gemini.ts',
  'src/lib/voiceEngine.ts',
  'src/lib/soundFX.ts',
  'src/lib/soulMath.ts',
  'src/lib/multitaskAgent.ts',
  'src/lib/screenPointerFinder.ts',
  'src/lib/fastComputerUse.ts',
  'src/lib/tavily.ts',
  'src/components/SoulCanvas.tsx',
  'src/components/AgentTopRightDock.tsx',
  'src/components/AgentsNotchView.tsx',
  'src/components/ProactiveContextNotch.tsx',
  'src/components/RoamingSoulPointer.tsx',
  'src/components/HitodamaOnboardingExperience.tsx',
];

const REPLACEMENTS = [
  // 1. Purge old website domain & hardcoded default todo/copy
  [/https:\/\/hitodama\.in\/images\/wallpapers\/wallpaper0\.jpg/g, 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=85'],
  [/https:\/\/hitodama\.in\/images\/wallpapers\/wallpaper1\.jpg/g, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=85'],
  [/https:\/\/hitodama\.in\/images\/wallpapers\/wallpaper2\.jpg/g, 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1920&q=85'],
  [/https:\/\/hitodama\.in\/images\/wallpapers\/wallpaper3\.jpg/g, 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=85'],
  [/https:\/\/hitodama\.in\/images\/wallpapers\/wallpaper4\.jpg/g, 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1920&q=85'],
  [/Hitodama · Give your computer a soul/g, 'Kibo · Tactile Desktop Cyber-Droid'],
  [/Give your computer a soul\./g, 'Kibo voice module online. Systems calibrated.'],
  [/Give your computer a soul/g, 'Your tactile desktop cyber-droid'],
  [/Buy Hitodama!/g, 'Calibrate Kibo core'],
  [/True Chad/g, 'Prime Operator'],
  [/Soul Loadout/g, 'Chassis Bay'],

  // 2. Replace LocalStorage keys & temp file prefixes
  [/hitodama_gemini_key/g, 'kibo_gemini_key'],
  [/hitodama_tavily_key/g, 'kibo_tavily_key'],
  [/hitodama_notion_key/g, 'kibo_notion_key'],
  [/hitodama_notion_db/g, 'kibo_notion_db'],
  [/hitodama_onboarded_v2/g, 'kibo_onboarded_v1'],
  [/hitodama_onboarded_v3/g, 'kibo_onboarded_v1'],
  [/hitodama_embers/g, 'kibo_watts'],
  [/hitodama_daily_ember_date/g, 'kibo_daily_watt_date'],
  [/hitodama_ember_date/g, 'kibo_watt_date'],
  [/hitodama_last_ember_earned_day/g, 'kibo_last_watt_earned_day'],
  [/hitodama_rewarded_tasks/g, 'kibo_rewarded_tasks'],
  [/hitodama_unlocked_cards/g, 'kibo_unlocked_cards'],
  [/hitodama_equipped_cards/g, 'kibo_equipped_cards'],
  [/hitodama_ability_trigger/g, 'kibo_ability_trigger'],
  [/hitodama_skin/g, 'kibo_chassis'],
  [/hitodama_todos/g, 'kibo_todos'],
  [/hitodama_routines/g, 'kibo_routines'],
  [/hitodama_clip_history/g, 'kibo_clip_history'],
  [/hitodama_custom_shortcuts/g, 'kibo_custom_shortcuts'],
  [/hitodama_starred_apps/g, 'kibo_starred_apps'],
  [/hitodama_connected_apps/g, 'kibo_connected_apps'],
  [/hitodama_agent_tasks/g, 'kibo_agent_tasks'],
  [/hitodama_inspirations/g, 'kibo_inspirations'],
  [/hitodama_sfx_enabled/g, 'kibo_sfx_enabled'],
  [/hitodama_autotuck/g, 'kibo_autotuck'],
  [/hitodama_voice_tts/g, 'kibo_voice_tts'],
  [/hitodama_startup/g, 'kibo_startup'],
  [/hitodama_clipboard_history/g, 'kibo_clipboard_history'],
  [/hitodama_shot_/g, 'kibo_shot_'],
  [/hitodama_page_/g, 'kibo_page_'],
  [/hitodama_fitted_desktop_/g, 'kibo_fitted_desktop_'],

  // 3. Replace UI Labels, Prompts & Logs
  [/\[Hitodama\]/g, '[Kibo]'],
  [/HITODAMA/g, 'KIBO'],
  [/Hitodama/g, 'Kibo'],
];

for (const relPath of TARGET_FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  for (const [pattern, replacement] of REPLACEMENTS) {
    content = content.replace(pattern, replacement);
  }
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Updated: ${relPath}`);
}

// 4. Delete old copied public assets if they exist
const OLD_PUBLIC_ASSETS = [
  'public/hitodama-logo.png',
  'public/hitodama-tray.png',
  'public/og-image.png',
  'public/hitodama-core.css',
  'public/images/lasso',
  'public/images/wallpapers',
];

for (const assetRel of OLD_PUBLIC_ASSETS) {
  const assetPath = path.join(ROOT, assetRel);
  if (fs.existsSync(assetPath)) {
    fs.rmSync(assetPath, { recursive: true, force: true });
    console.log(`Deleted old asset: ${assetRel}`);
  }
}

console.log('Kibo rebrand complete!');
