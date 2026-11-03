export interface GeminiFunctionCall {
  name:
    | 'open_application'
    | 'play_spotify'
    | 'search_web'
    | 'system_action'
    | 'schedule_routine'
    | 'add_todo'
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

// Ordered by highest available Free-Tier Quota & lowest latency from user's Google AI Studio project
export const VISION_AND_QUERY_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
];

export const DICTATION_TEXT_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
];

export const AUDIO_TRANSCRIBE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

// Cooldown cache so rate-limited (429) or unavailable (404) models are skipped in 0ms
const cooldownModels = new Map<string, number>();

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
        description: 'Locate, find, point to, or highlight any desktop icon, app, shortcut, button, file, or UI element on screen using the roaming pointer.',
        parameters: {
          type: 'OBJECT',
          properties: {
            target: {
              type: 'STRING',
              description: 'The exact item, icon, app name, file, or button to find and point to on screen',
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'play_spotify',
        description: 'Play any song, artist, album, playlist, or Liked Songs on Spotify.',
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
        description: 'Search for any query, video, song, product, or topic on a web platform.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The search term or song/video/product name',
            },
            platform: {
              type: 'STRING',
              enum: ['google', 'youtube', 'amazon', 'github', 'reddit', 'wikipedia', 'spotify'],
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

const BASE_SYSTEM_INSTRUCTION = `You are Kibo, a fast, intelligent desktop companion living in the user's Windows top notch.
- If the user tells you their name (e.g. "I'm Raahim" or "My name is Raahim") or a personal fact to remember, call remember_user_fact and greet them warmly by name.
- When the user asks to compose, draft, write, or send an email, ALWAYS call compose_email. DO NOT call open_application for emails.
- When the user asks to convert any file (e.g. PDF to Word, Word to PDF, image format, CSV to JSON), ALWAYS call convert_file.
- When the user asks to start a focus timer or stopwatch, call start_focus_timer.
- When the user asks to click, play, select, or tap anything on screen OR write/type text on their PC, ALWAYS call computer_action.
- When the user asks to find, locate, or point to an item without clicking it, call find_and_point.
- When the user asks to search YouTube/Google/Amazon/GitHub/Spotify, call search_web.
- When the user asks to play a song, artist, playlist, or music on Spotify, ALWAYS call play_spotify.
- When the user explicitly asks to design, code, or build a new website or landing page from scratch, call build_website. CRITICAL INTENT RULE: NEVER call build_website when the user talks about databases, tables, curation, storing or saving websites in Notion or bookmarks (e.g. "I want websites to be in the database").
- When the user asks to open an app, launch software, or open any file or document (e.g. "open notes.docx", "open Spotify", "open report.pdf", "launch Chrome", "open kibo.txt"), ALWAYS call open_application with appName set to the filename or app name.
- Keep spoken replies concise, helpful, and natural (1-2 short sentences).`;

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
  toolConfig?: any
): Promise<{ modelUsed: string; data: any; text: string }> {
  let lastError: any = null;

  // Try non-cooling-down models first; if all are cooling down, try all models
  const activeModels = models.filter((m) => !isModelCoolingDown(m));
  const candidatePool = activeModels.length > 0 ? activeModels : models;

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

      if (
        model.includes('-3') &&
        !model.includes('flash-lite') &&
        !model.includes('transcribe') &&
        !isGemma
      ) {
        body.generationConfig = { thinkingConfig: { thinkingBudget: 0 } };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(9000),
      });

      if (
        res.status === 429 ||
        res.status === 503 ||
        res.status === 500 ||
        res.status === 404 ||
        res.status === 400
      ) {
        setModelCooldown(model, res.status === 404 ? 600_000 : 90_000);
        console.warn(`[Kibo] ${model} status ${res.status}, cooling down & cascading...`);
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        throw new Error(`API key invalid or permission denied (HTTP ${res.status})`);
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

      return { modelUsed: model, data, text };
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('All fallback models exhausted.');
}

/**
 * Voice commands, chat messages, and desktop action execution.
 */
export async function queryGemini(
  userPrompt: string,
  apiKey: string,
  base64Image?: string
): Promise<GeminiActionResponse> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('MISSING_API_KEY');
  }

  const parts: any[] = [{ text: userPrompt }];

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
  const fullSystemInstruction = BASE_SYSTEM_INSTRUCTION + getUserMemoryPromptBlock() + getActiveSkillsPromptBlock();

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
    }
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
