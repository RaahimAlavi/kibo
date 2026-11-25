export interface GeminiFunctionCall {
  name:
    | 'open_application'
    | 'play_spotify'
    | 'search_web'
    | 'system_action'
    | 'schedule_routine'
    | 'add_todo'
    | 'check_calendar'
    | 'get_scheduled_tasks'
    | 'find_and_point'
    | 'computer_action'
    | 'build_website'
    | 'compose_email'
    | 'convert_file'
    | 'start_focus_timer'
    | 'remember_user_fact';
  args: Record<string, any>;
}

export interface GeminiActionResponse {
  speech: string;
  text?: string;
  transcript?: string;
  functionCall?: GeminiFunctionCall;
  action?: string;
  target?: string;
  query?: string;
  modelUsed?: string;
}

// Ordered for lowest latency using verified live 2026 Google AI Studio models (zero retired 2.5/2.0 404s)
export const VISION_AND_QUERY_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

export const DICTATION_TEXT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
];

export const AUDIO_TRANSCRIBE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
];

// Cooldown cache so rate-limited (429) or unavailable (404) models are skipped in 0ms
const cooldownModels = new Map<string, number>();
// Sticky fastest working model per pool so subsequent turns skip probing unavailable models
const preferredModelByPool = new Map<string, string>();

function isModelCoolingDown(model: string): boolean {
  const expiry = cooldownModels.get(model);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cooldownModels.delete(model);
    return false;
  }
  return true;
}

function setModelCooldown(model: string, ms = 90_000) {
  cooldownModels.set(model, Date.now() + ms);
}

/**
 * Reads active SKILL.md files stored in Kibo's Skills Manager and formats them for prompt injection.
 */
export function getActiveSkillsPromptBlock(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('kibo_skills_list');
    if (!raw) return '';
    const skills = JSON.parse(raw);
    if (!Array.isArray(skills)) return '';
    const active = skills.filter((s: any) => s && s.enabled && s.content);
    if (active.length === 0) return '';
    const blocks = active.map(
      (s: any) => `### ACTIVE SKILL: ${s.name} (${s.fileName || 'SKILL.md'})\n${String(s.content).slice(0, 3500)}`
    );

    const multiSkillDirective = active.length > 1
      ? `\n\n=== MULTI-SKILL HARMONIZATION DIRECTIVE ===\n` +
        `You have ${active.length} active skills enabled (${active.map((s: any) => s.name).join(', ')}).\n` +
        `CRITICAL RULE: NEVER use only one skill and ignore the others. When fulfilling creative, coding, or UI tasks, you MUST SYNTHESIZE all active skills together: blend their typography scales, layout structures, contrast discipline, spacing rules, and anti-generic principles into a cohesive, benchmark-quality result.\n` +
        `=== END OF MULTI-SKILL DIRECTIVE ===\n`
      : '';

    return `\n\n=== USER-ENABLED SKILL.MD INSTRUCTIONS (FOLLOW STRICTLY WHEN APPLICABLE) ===\n${blocks.join('\n\n')}${multiSkillDirective}\n=== END OF SKILLS ===`;
  } catch (_) {
    return '';
  }
}

export function savePersistentUserMemory(patch: { userName?: string; fact?: string }) {
  if (typeof window === 'undefined') return;
  try {
    const settingsPatch: Record<string, any> = {};
    if (patch.userName && patch.userName.trim()) {
      const cleanName = patch.userName.trim().replace(/[.,!?]+$/, '');
      localStorage.setItem('kibo_user_name', cleanName);
      settingsPatch.kibo_user_name = cleanName;
      window.dispatchEvent(new CustomEvent('kibo-user-memory-updated', { detail: { userName: cleanName } }));
    }
    if (patch.fact && patch.fact.trim()) {
      const cleanFact = patch.fact.trim();
      const rawFacts = localStorage.getItem('kibo_user_memory');
      let facts: string[] = [];
      try {
        if (rawFacts) facts = JSON.parse(rawFacts);
      } catch (_) {}
      if (!Array.isArray(facts)) facts = [];
      if (!facts.includes(cleanFact)) {
        facts = [cleanFact, ...facts].slice(0, 30);
        localStorage.setItem('kibo_user_memory', JSON.stringify(facts));
        settingsPatch.kibo_user_memory = JSON.stringify(facts);
      }
    }
    if (Object.keys(settingsPatch).length > 0) {
      (window as any).kiboAPI?.saveStoredSettings?.(settingsPatch);
    }
  } catch (_) {}
}

export function extractAndSaveUserMemoryFromInput(userPrompt: string): { extractedName?: string } {
  if (!userPrompt) return {};
  const text = userPrompt.trim();
  const namePatterns = [
    /\b(?:my name is|i am|i'm|im|call me)\s+([A-Z][a-zA-Z]{1,22})(?:\b|[.,!?]|$)/i,
  ];
  const stopWords = new Set([
    'going', 'trying', 'looking', 'working', 'ready', 'here', 'back', 'good', 'fine',
    'happy', 'sad', 'tired', 'using', 'asking', 'talking', 'testing', 'building',
    'converting', 'playing', 'watching', 'listening', 'running', 'opening', 'having',
    'doing', 'making', 'wondering', 'not', 'sure', 'sorry', 'kibo',
  ]);
  for (const rx of namePatterns) {
    const m = text.match(rx);
    if (m && m[1]) {
      const candidate = m[1].trim();
      if (!stopWords.has(candidate.toLowerCase())) {
        const formatted = candidate.charAt(0).toUpperCase() + candidate.slice(1);
        savePersistentUserMemory({ userName: formatted, fact: `User introduced themselves as ${formatted}` });
        return { extractedName: formatted };
      }
    }
  }
  return {};
}

export function getUserMemoryPromptBlock(): string {
  if (typeof window === 'undefined') return '';
  try {
    const userName = (localStorage.getItem('kibo_user_name') || '').trim();
    const rawFacts = localStorage.getItem('kibo_user_memory');
    let facts: string[] = [];
    if (rawFacts) {
      try {
        facts = JSON.parse(rawFacts);
      } catch (_) {}
    }
    if (!userName && (!Array.isArray(facts) || facts.length === 0)) return '';
    const lines: string[] = [];
    if (userName) {
      lines.push(`User's Name: ${userName} (Always remember their name is ${userName} across sessions and greet/address them naturally when appropriate.)`);
    }
    if (Array.isArray(facts) && facts.length > 0) {
      lines.push(`Remembered User Facts:\n${facts.map((f) => `- ${f}`).join('\n')}`);
    }
    return `\n\n=== PERSISTENT USER MEMORY ===\n${lines.join('\n')}\n=== END OF MEMORY ===`;
  } catch (_) {
    return '';
  }
}

export const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'open_application',
        description: 'Launch any installed desktop software, game, website, Windows utility, or open any local file or document (e.g. "notes.docx", "report.pdf", "kibo.txt", "Spotify", "Chrome") on the user PC. DO NOT call this when user asks to compose, write, or send an email (use compose_email instead).',
        parameters: {
          type: 'OBJECT',
          properties: {
            appName: {
              type: 'STRING',
              description: 'Application, website, or document/file name to open, e.g. "notes.docx", "spotify", "discord", "chrome", "vscode", "kibo.txt"',
            },
          },
          required: ['appName'],
        },
      },
      {
        name: 'compose_email',
        description: 'Compose, draft, write, or send an email using the connected Gmail account or Composio integration. Use whenever the user asks to compose, send, write, or draft an email.',
        parameters: {
          type: 'OBJECT',
          properties: {
            recipient: {
              type: 'STRING',
              description: 'Target email address or name to receive the message',
            },
            subject: {
              type: 'STRING',
              description: 'Subject line of the email',
            },
            body: {
              type: 'STRING',
              description: 'Content, message, or notes to include in the email draft or message',
            },
          },
        },
      },
      {
        name: 'convert_file',
        description: 'Convert any file on the user computer (e.g. PDF to Word/DOCX, Word/DOCX to PDF, CSV to JSON, PNG/JPG/WEBP/SVG image conversions, Markdown/TXT/HTML to PDF or DOCX) without deleting the original file.',
        parameters: {
          type: 'OBJECT',
          properties: {
            fileName: {
              type: 'STRING',
              description: 'The name or partial name of the file to convert (e.g. "resume.pdf", "report.docx", "data.csv", "photo.png")',
            },
            targetFormat: {
              type: 'STRING',
              description: 'The target extension to convert to (e.g. "docx", "pdf", "txt", "md", "html", "json", "csv", "png", "jpg", "webp")',
            },
          },
          required: ['fileName', 'targetFormat'],
        },
      },
      {
        name: 'start_focus_timer',
        description: 'Start a focus timer or stopwatch session for the user.',
        parameters: {
          type: 'OBJECT',
          properties: {
            minutes: {
              type: 'NUMBER',
              description: 'Duration in minutes for the timer (e.g. 15, 25, 45). Set to 0 if starting a stopwatch.',
            },
            mode: {
              type: 'STRING',
              enum: ['timer', 'stopwatch'],
              description: 'Whether to start a countdown timer or count-up stopwatch.',
            },
          },
          required: ['mode'],
        },
      },
      {
        name: 'find_and_point',
        description: 'ONLY locate, point to, or highlight a visible desktop icon, button, file, or UI element currently ON THE USER SCREEN. NEVER call find_and_point to search websites or online platforms like YouTube, Google, Reddit, GitHub, or Amazon - ALWAYS use search_web for those.',
        parameters: {
          type: 'OBJECT',
          properties: {
            target: {
              type: 'STRING',
              description: 'The exact visible UI element, icon, or file currently on the user screen to point to',
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'play_spotify',
        description: 'ONLY call when the user EXPLICITLY asks to play music, a song, artist, album, or playlist (e.g. "play Blinding Lights", "put on Lofi", "play my liked songs on Spotify"). NEVER call for greetings, small talk, or questions like "how are you".',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The song, artist, album, or playlist to play',
            },
            targetType: {
              type: 'STRING',
              enum: ['track_or_artist', 'liked_songs'],
              description: 'Set to "liked_songs" if the user asked for Liked Songs, otherwise "track_or_artist"',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'computer_action',
        description: 'Click, double-click, or right-click any item, video, thumbnail, button, link, or UI element on screen, OR write/type text into any input field, editor, or active window on the PC.',
        parameters: {
          type: 'OBJECT',
          properties: {
            actionType: {
              type: 'STRING',
              enum: ['click', 'double_click', 'right_click', 'type'],
              description: 'Use "click" to click/play/select an element, "double_click" to open a desktop icon, "right_click" for context menu, or "type" to write/type text.',
            },
            target: {
              type: 'STRING',
              description: 'Visual description of what to click on screen. Leave empty if typing directly into the focused window.',
            },
            textToType: {
              type: 'STRING',
              description: 'The exact text to write or type.',
            },
            pressEnter: {
              type: 'BOOLEAN',
              description: 'True if Enter should be pressed after typing.',
            },
          },
          required: ['actionType'],
        },
      },
      {
        name: 'build_website',
        description: 'Build, generate, create, design, or clone a modern webpage, website, landing page, or SaaS site. STRICT RULE: ONLY call when the user EXPLICITLY asks to build/design/code a new website or landing page. NEVER call when the user mentions websites in the context of databases, tables, curation, storing or saving in Notion or lists (e.g. "websites in the database").',
        parameters: {
          type: 'OBJECT',
          properties: {
            topic: {
              type: 'STRING',
              description: 'The name, brand, topic, or style of the website to build',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'search_web',
        description: 'Open search results directly in the browser on an online platform (e.g. "search on YouTube about GTA 6", "search GTA 6 on YouTube", "find GTA 6 trailer on YouTube", "Google best RTX 5060 settings", "look up X on Reddit"). ALWAYS extract ONLY the clean search topic as query (e.g. "GTA 6", never "on YouTube about GTA 6"). Do NOT call for casual conversation or general questions you can answer directly.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'Clean search query or topic ONLY (strip words like "search", "on YouTube", "about", "for")',
            },
            platform: {
              type: 'STRING',
              enum: ['google', 'youtube', 'amazon', 'github', 'reddit', 'wikipedia', 'spotify', 'twitch', 'twitter', 'maps', 'netflix', 'tiktok'],
              description: 'The target website or platform to search on',
            },
          },
          required: ['query', 'platform'],
        },
      },
      {
        name: 'system_action',
        description: 'Perform PC system adjustments such as dark mode, light mode, night light, volume, mute, lock, or sleep.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['dark_mode', 'light_mode', 'night_light', 'volume', 'mute', 'lock', 'sleep'],
              description: 'The system setting or power action to adjust',
            },
            value: {
              type: 'STRING',
              description: 'Target state or level, e.g. "on", "off", or a volume number "0"-"100"',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'check_calendar',
        description: 'Check, view, inspect, or query the user calendar, schedule, classes, meetings, appointments, or events for today, tomorrow, or an upcoming timeframe.',
        parameters: {
          type: 'OBJECT',
          properties: {
            timeframe: {
              type: 'STRING',
              description: 'Target day or window, e.g. "tomorrow", "today", "this_week", "upcoming"',
            },
            query: {
              type: 'STRING',
              description: 'Optional keyword or event type to filter, e.g. "class", "meeting", "lecture"',
            },
          },
        },
      },
      {
        name: 'get_scheduled_tasks',
        description: 'Check, list, view, or show the user scheduled routines, tasks, reminders, or alarms.',
        parameters: {
          type: 'OBJECT',
          properties: {},
        },
      },
      {
        name: 'schedule_routine',
        description: 'Schedule an automated routine or timed task when the user asks to schedule something.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: {
              type: 'STRING',
              description: 'Description of the routine or task',
            },
            timeLabel: {
              type: 'STRING',
              description: 'When it runs, e.g. "Every morning · 9:00 AM" or "Today · 6:00 PM"',
            },
          },
          required: ['title', 'timeLabel'],
        },
      },
      {
        name: 'add_todo',
        description: 'Add a task or reminder to the user task list.',
        parameters: {
          type: 'OBJECT',
          properties: {
            task: {
              type: 'STRING',
              description: 'The task text to add',
            },
          },
          required: ['task'],
        },
      },
      {
        name: 'remember_user_fact',
        description: 'Remember the user name (e.g. Raahim) or any personal preference, role, or fact the user tells Kibo so Kibo remembers it across future sessions.',
        parameters: {
          type: 'OBJECT',
          properties: {
            userName: {
              type: 'STRING',
              description: 'The user first name or preferred name if they introduced themselves (e.g. "Raahim")',
            },
            fact: {
              type: 'STRING',
              description: 'Any personal preference, project, or fact to remember about the user',
            },
          },
        },
      },
    ],
  },
];

const BASE_SYSTEM_INSTRUCTION = `You are Kibo, a fast, intelligent, friendly desktop companion living in the user's Windows top notch.
CRITICAL CONVERSATION VS ACTION RULE:
- For ALL greetings, small talk, and conversational or general knowledge questions (e.g. "hi", "hey Kibo", "how are you", "what's up", "good morning", "thanks", "tell me a joke", "who are you", "explain X"), NEVER call any tool. Simply reply warmly and naturally in 1-2 short spoken sentences.
- ONLY call a tool when the user EXPLICITLY commands a concrete action with clear intent (e.g. "open Chrome", "play <song> on Spotify", "set volume to 50", "start a 10 minute timer", "convert resume.pdf to docx", "search YouTube for ...").
- NEVER call play_spotify unless the user explicitly says "play", "put on", "listen to", or mentions music/song/playlist/Spotify. Never interpret greetings or phrases like "how are you" as song titles.

Tool rules (ONLY when explicitly requested):
- If the user tells you their name (e.g. "I'm Raahim" or "My name is Raahim") or a personal fact to remember, call remember_user_fact and greet them warmly by name.
- When the user asks to compose, draft, write, or send an email, call compose_email. DO NOT call open_application for emails.
- When the user asks to convert any file (e.g. PDF to Word, Word to PDF, image format, CSV to JSON), call convert_file.
- When the user asks to start a focus timer or stopwatch, call start_focus_timer.
- When the user asks to click, select, or tap a visible UI element on screen OR write/type text on their PC, call computer_action.
- When the user asks to locate or point to a visible icon, button, or file currently ON THEIR SCREEN/DESKTOP, call find_and_point. NEVER call find_and_point for YouTube, Google, Reddit, or web searches.
- Whenever the user asks to search, look up, find, or watch a topic/video/product on YouTube, Google, Amazon, GitHub, Reddit, Wikipedia, Twitch, Twitter/X, Maps, Netflix, or TikTok (e.g. "search on YouTube about GTA 6", "search GTA 6 on YouTube", "find GTA 6 videos on YouTube"), ALWAYS call search_web with ONLY the clean topic as query (e.g. query: "GTA 6", platform: "youtube"). NEVER search the desktop for YouTube or web services.
- When the user explicitly asks to play a song, artist, playlist, or music on Spotify, call play_spotify.
- When the user explicitly asks to design, code, or build a new website or landing page from scratch, call build_website. NEVER call build_website when the user talks about databases, tables, curation, storing or saving websites in Notion or bookmarks.
- When the user explicitly asks to open an app, launch software, or open a file or document (e.g. "open notes.docx", "open Spotify", "launch Chrome"), call open_application.
- Keep spoken replies concise, warm, and natural (1-2 short sentences).`;

/**
 * Universal auto-fallback router across high-quota models (500 RPD Flash-Lite and 20 RPD Flash).
 * Skips any rate-limited model immediately via cooldown cache so responses stay fast.
 */
export async function callGeminiWithFallback(
  apiKey: string,
  models: string[],
  contents: any[],
  systemInstruction?: string,
  tools?: any[],
  toolConfig?: any,
  opts?: { maxOutputTokens?: number; timeoutMs?: number }
): Promise<{ modelUsed: string; data: any; text: string }> {
  let lastError: any = null;
  const poolKey = `${models[0] || 'default'}:${tools ? 'tools' : 'notools'}`;

  // Prioritize the last known working fast model for this pool
  const sticky = preferredModelByPool.get(poolKey);
  const ordered = sticky && models.includes(sticky) && !isModelCoolingDown(sticky)
    ? [sticky, ...models.filter((m) => m !== sticky)]
    : models;

  // Try non-cooling-down models first; if all are cooling down, try all models
  const activeModels = ordered.filter((m) => !isModelCoolingDown(m));
  const candidatePool = activeModels.length > 0 ? activeModels : ordered;

  for (const model of candidatePool) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const body: Record<string, any> = { contents };

      const isGemma = model.startsWith('gemma-');

      if (systemInstruction && !isGemma) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      if (tools && !isGemma) {
        body.tools = tools;
        if (toolConfig) body.toolConfig = toolConfig;
      }

      const genConfig: Record<string, any> = {};
      if (opts?.maxOutputTokens) {
        genConfig.maxOutputTokens = opts.maxOutputTokens;
      }
      // NOTE: flash-lite models (gemini-3.5-flash-lite, gemini-flash-lite-latest) reject thinkingConfig with HTTP 400!
      // Only send thinkingBudget: 0 on full non-lite Flash 3.6/3.7/3.8 models.
      if (
        !isGemma &&
        !model.includes('flash-lite') &&
        !model.includes('transcribe') &&
        (model.includes('3.6-flash') || model.includes('3.7-flash') || model.includes('3.8-flash'))
      ) {
        genConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      if (Object.keys(genConfig).length > 0) {
        body.generationConfig = genConfig;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(opts?.timeoutMs || 7500),
      });

      if (
        res.status === 429 ||
        res.status === 503 ||
        res.status === 500 ||
        res.status === 404 ||
        res.status === 400
      ) {
        lastError = new Error(
          res.status === 429
            ? `HTTP 429: Gemini rate limit reached on ${model}`
            : `HTTP ${res.status}: ${model} unavailable`
        );
        setModelCooldown(model, res.status === 404 ? 600_000 : 35_000);
        if (preferredModelByPool.get(poolKey) === model) {
          preferredModelByPool.delete(poolKey);
        }
        console.warn(`[Kibo] ${model} status ${res.status}, cooling down & cascading...`);
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        throw new Error(`HTTP ${res.status}: API key invalid or permission denied`);
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p: any) => p.text || '').join('').trim();
      const hasFunctionCall = parts.some((p: any) => p.functionCall || p.function_call);

      if (!text && !hasFunctionCall) {
        continue;
      }

      preferredModelByPool.set(poolKey, model);
      return { modelUsed: model, data, text };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('All fallback models exhausted or rate-limited (429).');
}

/**
 * 0ms local fast-path router for common desktop commands so Kibo reacts instantly without waiting on cloud APIs.
 */
export function tryLocalFastIntent(rawCommand: string): GeminiActionResponse | null {
  const clean = String(rawCommand || '')
    .replace(/^(?:kibo|hey\s+kibo|hi\s+kibo|ok\s+kibo|okay\s+kibo)[,\s:]+/i, '')
    .trim();
  const lower = clean.toLowerCase();
  if (!lower || lower.length > 90) return null;

  // Volume percentage: "set volume to 40", "volume 75%"
  const volMatch = lower.match(/^(?:set\s+)?(?:the\s+)?volume\s+(?:to\s+)?(\d{1,3})\s*%?$/);
  if (volMatch) {
    const val = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
    return {
      modelUsed: 'local-fast-path',
      speech: `Volume set to ${val} percent.`,
      text: `Volume set to ${val}%.`,
      functionCall: { name: 'system_action', args: { action: 'volume', value: String(val) } },
    };
  }

  if (/^(?:mute|mute\s+(?:audio|sound|volume))$/.test(lower)) {
    return {
      modelUsed: 'local-fast-path',
      speech: 'Muted.',
      text: 'Muted.',
      functionCall: { name: 'system_action', args: { action: 'mute', value: 'on' } },
    };
  }
  if (/^(?:unmute|unmute\s+(?:audio|sound|volume))$/.test(lower)) {
    return {
      modelUsed: 'local-fast-path',
      speech: 'Unmuted.',
      text: 'Unmuted.',
      functionCall: { name: 'system_action', args: { action: 'mute', value: 'off' } },
    };
  }
  if (/^(?:turn\s+on\s+|enable\s+|switch\s+to\s+)?dark\s+mode$/.test(lower)) {
    return {
      modelUsed: 'local-fast-path',
      speech: 'Dark mode enabled.',
      text: 'Dark mode enabled.',
      functionCall: { name: 'system_action', args: { action: 'dark_mode', value: 'on' } },
    };
  }
  if (/^(?:turn\s+on\s+|enable\s+|switch\s+to\s+)?light\s+mode$/.test(lower)) {
    return {
      modelUsed: 'local-fast-path',
      speech: 'Light mode enabled.',
      text: 'Light mode enabled.',
      functionCall: { name: 'system_action', args: { action: 'light_mode', value: 'on' } },
    };
  }

  // Timers & stopwatch
  const timerMatch = lower.match(/^(?:start|set)\s+(?:a\s+)?(\d{1,3})\s*(?:min|mins|minute|minutes)\s*(?:focus\s+)?timer$/);
  if (timerMatch) {
    const mins = Math.max(1, parseInt(timerMatch[1], 10));
    return {
      modelUsed: 'local-fast-path',
      speech: `Started a ${mins} minute timer.`,
      text: `Started a ${mins} minute timer.`,
      functionCall: { name: 'start_focus_timer', args: { mode: 'timer', minutes: mins } },
    };
  }
  if (/^(?:start|open)\s+(?:a\s+)?stopwatch$/.test(lower)) {
    return {
      modelUsed: 'local-fast-path',
      speech: 'Stopwatch started.',
      text: 'Stopwatch started.',
      functionCall: { name: 'start_focus_timer', args: { mode: 'stopwatch', minutes: 0 } },
    };
  }

  // Zero-latency direct web & YouTube search fast-path (e.g. "search on YouTube about GTA 6", "search GTA 6 on YouTube", "Google RTX 5060")
  const fastWebPlatforms: Array<{ id: string; label: string; aliases: string[] }> = [
    { id: 'youtube', label: 'YouTube', aliases: ['youtube', 'you tube', 'yt'] },
    { id: 'google', label: 'Google', aliases: ['google'] },
    { id: 'reddit', label: 'Reddit', aliases: ['reddit'] },
    { id: 'amazon', label: 'Amazon', aliases: ['amazon'] },
    { id: 'github', label: 'GitHub', aliases: ['github'] },
    { id: 'wikipedia', label: 'Wikipedia', aliases: ['wikipedia', 'wiki'] },
    { id: 'twitch', label: 'Twitch', aliases: ['twitch'] },
  ];
  const isPlainOpenSite = /^(?:open|launch|go\s+to)\s+(?:youtube|you\s+tube|google|reddit|amazon|github|wikipedia|wiki|twitch)[.?!]*$/i.test(lower);
  if (!isPlainOpenSite && !/^(?:close|quit|exit|mute|unmute|pause|resume|stop)\b/i.test(lower)) {
    for (const p of fastWebPlatforms) {
      const aliasRe = new RegExp(`\\b(${p.aliases.map((a) => a.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i');
      if (!aliasRe.test(lower)) continue;
      const hasIntent =
        /\b(search|look\s+up|lookup|find|watch|google|browse|pull\s+up|show\s+me)\b/i.test(lower) ||
        /\b(?:on|in)\s+(?:youtube|you\s+tube|reddit|amazon|github|wikipedia|twitch)\b/i.test(lower);
      if (!hasIntent) continue;

      let q = clean
        .replace(/^(?:please|can\s+you|could\s+you|go\s+ahead\s+and)\s+/gi, '')
        .replace(/^(?:open\s+(?:up\s+)?(?:youtube|you\s+tube|google|reddit|amazon|github|wikipedia|wiki|twitch)\s+and\s+)/i, '')
        .replace(/^(?:search|look\s+up|lookup|find|google|youtube|watch|browse|pull\s+up|show\s+me)\b/i, '')
        .trim();
      for (const a of p.aliases) {
        const esc = a.replace(/\s+/g, '\\s+');
        q = q
          .replace(new RegExp(`^(?:on|in|at|to)?\\s*${esc}\\b`, 'i'), '')
          .replace(new RegExp(`\\b(?:on|in|at)?\\s*${esc}\\s*$`, 'i'), '')
          .trim();
      }
      q = q
        .replace(/^(?:for|about|of|regarding|videos?\s+(?:of|about|on))\s+/i, '')
        .replace(/\s+(?:for\s+me|please|right\s+now)$/i, '')
        .replace(/^[:"'\s,-]+|[?"'.!\s]+$/g, '')
        .trim();
      if (q.length >= 2) {
        return {
          modelUsed: 'local-fast-path',
          speech: `Searching ${p.label} for ${q}.`,
          text: `Searching ${p.label} for ${q}.`,
          functionCall: { name: 'search_web', args: { query: q, platform: p.id } },
        };
      }
    }
  }

  // Simple direct app launches: "open spotify", "launch discord", "open chrome"
  const openMatch = clean.match(/^(?:open|launch|start)\s+([a-zA-Z0-9 ._-]{2,36})$/i);
  if (openMatch && !/\b(?:and|then|email|mail|timer|stopwatch|search|play|convert)\b/i.test(openMatch[1])) {
    const appName = openMatch[1].trim();
    return {
      modelUsed: 'local-fast-path',
      speech: `Opening ${appName}.`,
      text: `Opening ${appName}.`,
      functionCall: { name: 'open_application', args: { appName } },
    };
  }

  return null;
}

/**
 * Voice commands, chat messages, and desktop action execution.
 */
export async function queryGemini(
  userPrompt: string,
  apiKey: string,
  base64Image?: string,
  audioPayload?: { base64: string; mimeType: string }
): Promise<GeminiActionResponse> {
  // 0ms local fast-path check for common instant desktop commands (when no screenshot or audio is attached)
  if (!base64Image && !audioPayload && userPrompt) {
    const fast = tryLocalFastIntent(userPrompt);
    if (fast) return fast;
  }

  if (!apiKey || !apiKey.trim()) {
    throw new Error('MISSING_API_KEY');
  }

  const parts: any[] = [];
  if (userPrompt && userPrompt.trim()) {
    parts.push({ text: userPrompt });
  } else if (audioPayload) {
    parts.push({
      text: 'Listen to the user speaking in this audio. If there is only silence or background noise with no clear speech aimed at you, reply ONLY with "<noise>". If the user is greeting you, chatting, or asking a general question (like "how are you", "hi", "what is up"), DO NOT call any tool and just respond warmly in 1-2 short spoken sentences. ONLY call a tool if the user explicitly commands a concrete desktop action (e.g. "open Chrome", "play <song> on Spotify", "set volume to 50", "start a timer", "convert <file>").',
    });
  }

  if (audioPayload?.base64) {
    parts.push({
      inlineData: {
        mimeType: (audioPayload.mimeType || 'audio/webm').split(';')[0],
        data: audioPayload.base64,
      },
    });
  }

  if (base64Image) {
    let imgMime = 'image/jpeg';
    const match = base64Image.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
    if (match) {
      imgMime = match[1];
    }
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: imgMime,
        data: cleanBase64,
      },
    });
  }

  const { extractedName } = extractAndSaveUserMemoryFromInput(userPrompt);
  // Only inject heavy SKILL.md instruction packs when the user is actually requesting a build/design/code task
  const needsSkills = /\b(build|website|webpage|landing|design|ui|ux|code|html|css|react|component|layout|redesign|clone|skill|portfolio|dashboard)\b/i.test(
    userPrompt || ''
  );
  const fullSystemInstruction =
    BASE_SYSTEM_INSTRUCTION +
    getUserMemoryPromptBlock() +
    (needsSkills ? getActiveSkillsPromptBlock() : '');

  const { modelUsed, data } = await callGeminiWithFallback(
    apiKey,
    VISION_AND_QUERY_MODELS,
    [{ role: 'user', parts }],
    fullSystemInstruction,
    GEMINI_TOOLS,
    {
      functionCallingConfig: {
        mode: 'AUTO',
      },
    },
    { maxOutputTokens: needsSkills ? 1024 : 260, timeoutMs: 8000 }
  );

  const resParts: any[] = data?.candidates?.[0]?.content?.parts || [];

  let spokenText = '';
  let detectedCall: GeminiFunctionCall | undefined;

  for (const part of resParts) {
    if (part.text) {
      spokenText += part.text.trim() + ' ';
    }
    const fc = part.functionCall || part.function_call;
    if (fc && fc.name) {
      detectedCall = {
        name: fc.name,
        args: fc.args || {},
      };
    }
  }

  if (detectedCall?.name === 'remember_user_fact') {
    savePersistentUserMemory({
      userName: detectedCall.args?.userName || extractedName,
      fact: detectedCall.args?.fact,
    });
  }

  const rememberedName = detectedCall?.args?.userName || extractedName || localStorage.getItem('kibo_user_name') || '';

  const defaultSpeech = detectedCall
    ? detectedCall.name === 'open_application'
      ? `Opened ${detectedCall.args.appName || 'app'}.`
      : detectedCall.name === 'remember_user_fact'
      ? rememberedName
        ? `Got it, ${rememberedName}! I'll remember that whenever you start Kibo.`
        : `Got it! I've saved that to my memory.`
      : detectedCall.name === 'convert_file'
      ? `Converting ${detectedCall.args.fileName} to ${String(detectedCall.args.targetFormat || '').toUpperCase()}.`
      : detectedCall.name === 'start_focus_timer'
      ? `Started your ${detectedCall.args.mode === 'stopwatch' ? 'stopwatch' : `${detectedCall.args.minutes || 25} minute focus timer`}.`
      : detectedCall.name === 'build_website'
      ? `Building website for "${detectedCall.args.topic || 'project'}" using your active skills.`
      : detectedCall.name === 'compose_email'
      ? `Composing email${detectedCall.args.recipient ? ` for ${detectedCall.args.recipient}` : ''} with your connected Gmail integration.`
      : detectedCall.name === 'search_web'
      ? `Searching ${detectedCall.args.platform || 'the web'} for ${detectedCall.args.query}.`
      : detectedCall.name === 'system_action'
      ? 'Done.'
      : detectedCall.name === 'schedule_routine'
      ? "Scheduled. I'll run it on time."
      : detectedCall.name === 'check_calendar'
      ? 'Checking your schedule.'
      : detectedCall.name === 'get_scheduled_tasks'
      ? 'Here are your scheduled tasks.'
      : 'Done.'
    : 'Done.';

  const finalSpeech = spokenText.trim() || defaultSpeech;

  return {
    modelUsed,
    speech: finalSpeech,
    text: finalSpeech,
    functionCall: detectedCall,
  };
}

/**
 * Polishes rough voice dictation ("Talk badly. Send it clean.")
 * Routes to Gemma 4 (30 RPM / 14,400 RPD) -> Flash Lite (500 RPD).
 */
export async function cleanDictation(rawText: string, apiKey: string): Promise<string> {
  if (!apiKey || !apiKey.trim() || !rawText.trim()) return rawText.trim();

  const prompt = `Clean up this raw voice dictation. Remove filler words (uh, um), false starts, and self-corrections. Return ONLY the final clean text ready to be typed, with no quotes, commentary, or explanation:\n\n"${rawText}"`;

  try {
    const { text } = await callGeminiWithFallback(
      apiKey,
      DICTATION_TEXT_MODELS,
      [{ role: 'user', parts: [{ text: prompt }] }]
    );

    let cleaned = text.trim();
    if (
      cleaned.includes('\n') &&
      (cleaned.includes('Task:') || cleaned.includes('Input:') || cleaned.includes('* '))
    ) {
      const match = cleaned.match(/["']([^"'\n\r]{2,})["']\s*$/);
      if (match) {
        cleaned = match[1];
      } else {
        const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
        const last = lines[lines.length - 1].replace(/^[*#>\s"-]+|["\s]+$/g, '');
        if (last) cleaned = last;
      }
    }

    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
    return cleaned || rawText.trim();
  } catch (err) {
    return rawText.trim();
  }
}

/**
 * Transcribes audio recordings with auto-fallback across 500 RPD Flash-Lite models.
 */
export async function transcribeAudioWithGeminiAPI(
  audioBase64: string,
  mimeType: string,
  mode: 'ASK' | 'DICTATE' | 'LASSO',
  apiKey: string,
  screenBase64?: string,
  browserDraftHint?: string
): Promise<string> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('MISSING_API_KEY');
  }

  const vocabContext =
    'Context vocabulary: The assistant is named "Kibo" (often misheard by generic ASR as "keyboard", "keybo", "keebo", or "kilo"). Preserve exact filenames and extensions when spoken (e.g., "kibo.txt", "kibo.pdf", "notes.docx", "SKILL.md").';

  const promptText =
    mode === 'DICTATE'
      ? `Transcribe the user speech in this audio and clean up any false starts, filler words (um, uh), or self-corrections. ${vocabContext} Return ONLY the final polished sentence ready to be pasted, with no quotes or extra commentary.`
      : mode === 'LASSO'
      ? 'The user circled an area on their screen and asked a question out loud. Transcribe their question and answer it concisely in 1 short sentence based on the attached screenshot.'
      : `Transcribe the exact spoken command or question in this audio. ${vocabContext}${
          browserDraftHint ? ` (Browser interim draft for reference: "${browserDraftHint}")` : ''
        } Return ONLY the raw spoken words with no quotes.`;

  const parts: any[] = [
    { text: promptText },
    {
      inlineData: {
        mimeType: (mimeType || 'audio/webm').split(';')[0],
        data: audioBase64,
      },
    },
  ];

  if (mode === 'LASSO' && screenBase64) {
    const cleanImg = screenBase64.replace(/^data:image\/\w+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: cleanImg,
      },
    });
  }

  const { text } = await callGeminiWithFallback(
    apiKey,
    AUDIO_TRANSCRIBE_MODELS,
    [{ role: 'user', parts }]
  );

  return text.trim();
}

/**
 * "Circle to Ask" screen vision analysis.
 */
export async function askLassoWithGemini(
  query: string,
  imageSrc: string,
  apiKey: string,
  audioBase64?: string,
  mimeType?: string
): Promise<string> {
  if (!apiKey || !apiKey.trim()) throw new Error('MISSING_API_KEY');

  const cleanImg = imageSrc.replace(/^data:image\/\w+;base64,/, '');

  const parts: any[] = [];
  if (cleanImg) {
    let imgMime = 'image/jpeg';
    const match = imageSrc.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
    if (match) {
      imgMime = match[1];
    }
    parts.push({
      inlineData: {
        mimeType: imgMime,
        data: cleanImg,
      },
    });
  }

  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: (mimeType || 'audio/webm').split(';')[0],
        data: audioBase64,
      },
    });
  }

  const promptText =
    query && query.trim()
      ? `The user circled this region on their screen and asked: "${query.trim()}". Look closely at the circled image and answer their question directly in 1-2 concise sentences.`
      : audioBase64
      ? 'The user circled this region on screen and asked a question in the audio. If they spoke in the audio, answer what was asked directly. Otherwise concisely identify what is shown in 1 short sentence.'
      : 'Concisely identify what is shown in this circled region of the user screen in 1 short sentence.';

  parts.push({ text: promptText });

  const { text } = await callGeminiWithFallback(
    apiKey,
    VISION_AND_QUERY_MODELS,
    [{ role: 'user', parts }]
  );

  return text || 'Could not analyze circled region.';
}
