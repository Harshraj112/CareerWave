import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { postProcessParsedResume } from "./validation.js";
import { extractTextFromPDF, extractTextFromDocx } from "./pdf-extractor.js";
import { chat, extractJson, describeProvider } from "./ai-provider.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let PROMPT_TEXT;

// ─────────────────────────────────────────────────────────────────────────────
// AI PROVIDER SWITCH
//
//   AI_PROVIDER=agentrouter  → ACTIVE (model claude-opus-4.8) — see ai-provider.js
//   AI_PROVIDER=openrouter   → original Hecknex provider (openai/gpt-6-luna)
//
// The original OpenRouter request code is preserved verbatim, commented out,
// at the bottom of this file ("ORIGINAL OPENROUTER IMPLEMENTATION"). The live
// OpenRouter path now runs through ai-provider.js with the identical URL,
// model, headers, temperature and response_format, so switching back is a
// one-line .env change.
// ─────────────────────────────────────────────────────────────────────────────
//
// const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// const MODEL = "openai/gpt-6-luna";

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function validateProfileInput(profileJson = {}) {
  const payload = profileJson && typeof profileJson === "object" ? profileJson : {};

  const targetValue =
    payload.targetRole ||
    payload.target ||
    payload.role ||
    payload.jobRole ||
    payload.job_title ||
    payload.target_description ||
    (payload.target && typeof payload.target === "object"
      ? payload.target.target_description
      : null) ||
    null;

  const experienceValue =
    payload.experienceLevel ||
    payload.experience_level ||
    payload.level ||
    payload.experience ||
    payload.starting_point ||
    null;

  const rawSkills = Array.isArray(payload.skills)
    ? payload.skills
    : Array.isArray(payload.knownSkills)
      ? payload.knownSkills
      : Array.isArray(payload.known_skills)
        ? payload.known_skills
        : typeof payload.skills === "string"
          ? payload.skills.split(",")
          : typeof payload.knownSkills === "string"
            ? payload.knownSkills.split(",")
            : typeof payload.known_skills === "string"
              ? payload.known_skills.split(",")
              : Array.isArray(payload.target?.skills)
                ? payload.target.skills
                : [];

  const hasTarget = Boolean(targetValue && String(targetValue).trim());
  const hasExperience = Boolean(experienceValue && String(experienceValue).trim());
  const hasSkills = rawSkills.some((skill) => {
    if (skill == null) return false;
    return String(skill).trim().length > 0;
  });

  if (!hasTarget && !hasExperience && !hasSkills) {
    throw new Error("Profile input must include at least one meaningful profile field such as target role, experience level, or skills.");
  }

  return true;
}

/**
 * The extraction prompt (prompt.txt) followed by the machine-readable output
 * contract (schema.json). Previously schema.json was never sent to the model,
 * so field names drifted between responses; now every response follows it.
 */
function loadPrompt() {
  if (!PROMPT_TEXT) {
    const promptPath = path.join(__dirname, "prompt.txt");
    const schemaPath = path.join(__dirname, "schema.json");
    const prompt = fs.readFileSync(promptPath, "utf-8");
    const schema = JSON.stringify(JSON.parse(fs.readFileSync(schemaPath, "utf-8"))); // minified to save tokens
    PROMPT_TEXT = `${prompt}\n\n═══════════════════════════════════════\nOUTPUT CONTRACT — your JSON must follow this schema exactly (use null / [] for missing values)\n═══════════════════════════════════════\n${schema}`;
  }
  return PROMPT_TEXT;
}

function logRawResponse(responseText) {
  if (process.env.LOG_LLM_RESPONSES === "false") return;
  try {
    const logsDir = path.join(__dirname, "..", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.writeFileSync(path.join(logsDir, `llm_response_${Date.now()}.json`), responseText, "utf-8");
  } catch (e) {
    console.warn("Could not write LLM response log:", e.message);
  }
}

async function runModel(messages, task) {
  const responseText = await chat(messages, { task, temperature: 0, json: true });
  console.log(`✅ API response received (${describeProvider().provider})`);
  logRawResponse(responseText);
  console.log("📝 Parsing JSON response...");
  return extractJson(responseText);
}

/**
 * Parse a resume file (PDF, DOCX, TXT or image) with the active AI provider.
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} mimeType - MIME type of the file
 * @param {string} _apiKey - kept for backwards compatibility; keys are read from env by ai-provider.js
 * @param {string|null} role - target role the user is applying for
 * @param {string|null} extraContext - optional JSON/text with user context
 * @returns {Promise<Object>} Parsed resume data
 */
export async function parseResumeFile(fileBuffer, mimeType, _apiKey = null, role = null, extraContext = null) {
  // Text-based documents: extract locally (all pages) then parse as text.
  if (mimeType === "application/pdf" || mimeType === "text/plain" || mimeType === SUPPORTED_MIME_TYPES[6]) {
    let extractedText;
    try {
      if (mimeType === "application/pdf") extractedText = await extractTextFromPDF(fileBuffer);
      else if (mimeType === "text/plain") extractedText = fileBuffer.toString("utf-8");
      else extractedText = await extractTextFromDocx(fileBuffer);
    } catch (error) {
      console.error("❌ Text extraction error:", error.message);
      throw new Error(`Failed to extract text from document: ${error.message}`);
    }
    if (!extractedText || extractedText.trim().length < 40) {
      const err = new Error(
        "We could not read any text from this file. If it is a scanned PDF, upload it as an image (PNG/JPG) or export a text-based PDF."
      );
      err.status = 422;
      throw err;
    }
    return parseResumeText(extractedText, null, role, extraContext);
  }

  // Images: send as a multimodal message.
  console.log(`📄 File type: ${mimeType}`);
  console.log(`📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

  let text = loadPrompt();
  if (role) text += `\n\nROLE APPLIED FOR: ${role}`;
  if (extraContext) text += `\n\nUSER CONTEXT / ADDITIONAL INFO:\n${extraContext}`;

  try {
    const parsed = await runModel(
      [{ role: "user", content: [{ type: "text", text }, { type: "image", mimeType, base64: fileBuffer.toString("base64") }] }],
      "resume-parse(image)"
    );
    // Post-process and validate (no original text available for image payloads)
    return postProcessParsedResume(parsed, null);
  } catch (error) {
    console.error("❌ Parse error:", error.message);
    throw Object.assign(new Error(`Failed to parse resume: ${error.message}`), { status: error.status || 502 });
  }
}

/**
 * Parse resume text (already extracted)
 * @param {string} resumeText - Plain text or extracted resume content
 * @param {string} _apiKey - kept for backwards compatibility
 * @returns {Promise<Object>} Parsed resume data
 */
export async function parseResumeText(resumeText, _apiKey = null, role = null, extraContext = null) {
  let combinedPrompt = `${loadPrompt()}\n\nRESUME TEXT:\n\n${resumeText}`;
  if (role) {
    combinedPrompt = `${combinedPrompt}\n\nROLE APPLIED FOR: ${role}`;
  }
  if (extraContext) {
    combinedPrompt = `${combinedPrompt}\n\nUSER CONTEXT / ADDITIONAL INFO:\n${extraContext}`;
  }

  try {
    console.log(`📊 Text length: ${resumeText.length} characters`);
    const parsed = await runModel([{ role: "user", content: combinedPrompt }], "resume-parse(text)");
    // Post-process and validate (pass original text so we can extract missing sections)
    return postProcessParsedResume(parsed, resumeText);
  } catch (error) {
    console.error("❌ Parse error:", error.message);
    throw Object.assign(new Error(`Failed to parse resume: ${error.message}`), { status: error.status || 502 });
  }
}

/**
 * Parse a profile JSON (targeted job + optional education/skills) instead of a resume file.
 * @param {Object} profileJson - JSON object with input_mode/target/etc.
 * @param {string} _apiKey - kept for backwards compatibility
 * @returns {Promise<Object>} Parsed analysis / roadmap according to schema
 */
export async function parseProfile(profileJson, _apiKey = null) {
  validateProfileInput(profileJson);

  const inputStr = JSON.stringify(profileJson, null, 2);
  const combinedPrompt = `${loadPrompt()}\n\nINPUT_DATA:\n\n${inputStr}`;

  try {
    return await runModel([{ role: "user", content: combinedPrompt }], "profile-roadmap");
  } catch (err) {
    console.error("❌ Profile parse error:", err.message);
    throw err;
  }
}

/**
 * Get supported MIME types
 */
export function getSupportedMimeTypes() {
  return [...SUPPORTED_MIME_TYPES];
}

// ═════════════════════════════════════════════════════════════════════════════
// ORIGINAL OPENROUTER IMPLEMENTATION — preserved verbatim, disabled.
//
// This is the exact parser.js that shipped with Hecknex (OpenRouter + openai/gpt-6-luna).
// It is commented out because the request logic now lives in ai-provider.js, which
// reproduces it 1:1 when AI_PROVIDER=openrouter. To restore this file wholesale,
// uncomment the block below and remove the provider-switched functions above.
// ═════════════════════════════════════════════════════════════════════════════
// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";
// import { postProcessParsedResume } from "./validation.js";
// import { extractTextFromPDF } from "./pdf-extractor.js";
//
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
//
// let PROMPT_TEXT;
//
// const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// const MODEL = "openai/gpt-6-luna";
//
// export function validateProfileInput(profileJson = {}) {
//   const payload = profileJson && typeof profileJson === "object" ? profileJson : {};
//
//   const targetValue =
//     payload.targetRole ||
//     payload.target ||
//     payload.role ||
//     payload.jobRole ||
//     payload.job_title ||
//     payload.target_description ||
//     (payload.target && typeof payload.target === "object"
//       ? payload.target.target_description
//       : null) ||
//     null;
//
//   const experienceValue =
//     payload.experienceLevel ||
//     payload.experience_level ||
//     payload.level ||
//     payload.experience ||
//     payload.starting_point ||
//     null;
//
//   const rawSkills = Array.isArray(payload.skills)
//     ? payload.skills
//     : Array.isArray(payload.knownSkills)
//       ? payload.knownSkills
//       : Array.isArray(payload.known_skills)
//         ? payload.known_skills
//         : typeof payload.skills === "string"
//           ? payload.skills.split(",")
//           : typeof payload.knownSkills === "string"
//             ? payload.knownSkills.split(",")
//             : typeof payload.known_skills === "string"
//               ? payload.known_skills.split(",")
//               : Array.isArray(payload.target?.skills)
//                 ? payload.target.skills
//                 : [];
//
//   const hasTarget = Boolean(targetValue && String(targetValue).trim());
//   const hasExperience = Boolean(experienceValue && String(experienceValue).trim());
//   const hasSkills = rawSkills.some((skill) => {
//     if (skill == null) return false;
//     return String(skill).trim().length > 0;
//   });
//
//   if (!hasTarget && !hasExperience && !hasSkills) {
//     throw new Error("Profile input must include at least one meaningful profile field such as target role, experience level, or skills.");
//   }
//
//   return true;
// }
//
// function loadPrompt() {
//   if (!PROMPT_TEXT) {
//     const promptPath = path.join(__dirname, "prompt.txt");
//     PROMPT_TEXT = fs.readFileSync(promptPath, "utf-8");
//   }
//   return PROMPT_TEXT;
// }
//
// /**
//  * Parse a resume file using OpenRouter API with GPT Luna
//  * @param {Buffer} fileBuffer - The file buffer (PDF, image, or text)
//  * @param {string} mimeType - MIME type of the file (application/pdf, image/png, etc.)
//  * @param {string} apiKey - OpenRouter API key
//  * @returns {Promise<Object>} Parsed resume data
//  */
// export async function parseResumeFile(fileBuffer, mimeType, apiKey, role = null, extraContext = null) {
//   // For PDFs: extract text locally (all pages) then parse as text
//   if (mimeType === "application/pdf") {
//     try {
//       const extractedText = await extractTextFromPDF(fileBuffer);
//       return await parseResumeText(extractedText, apiKey, role, extraContext);
//     } catch (error) {
//       console.error("❌ PDF extraction error:", error.message);
//       throw new Error(`Failed to extract text from PDF: ${error.message}`);
//     }
//   }
//
//   // For non-PDFs (images), send as image_url with base64 payload
//   const base64Data = fileBuffer.toString("base64");
//   const dataUrl = `data:${mimeType};base64,${base64Data}`;
//   const messageContent = [
//     {
//       type: "text",
//       text: loadPrompt(),
//     },
//     {
//       type: "image_url",
//       image_url: {
//         url: dataUrl,
//       },
//     },
//   ];
//
//   try {
//     console.log("🔄 Sending request to OpenRouter API...");
//     console.log(`📄 File type: ${mimeType}`);
//     console.log(`📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
//
//     const response = await fetch(OPENROUTER_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${apiKey}`,
//         "HTTP-Referer": "https://hecknex-resume-parser.app",
//         "X-Title": "Hecknex Resume Parser",
//       },
//       body: JSON.stringify({
//         model: MODEL,
//         messages: [
//           {
//             role: "user",
//             content: messageContent,
//           },
//         ],
//         temperature: 0,
//         response_format: {
//           type: "json_object",
//         },
//       }),
//     });
//
//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("API Response:", errorText);
//       throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
//     }
//
//     const data = await response.json();
//     console.log("✅ API response received");
//
//     if (!data.choices || !data.choices[0]?.message?.content) {
//       console.error("Invalid response format:", JSON.stringify(data, null, 2));
//       throw new Error("Invalid response format from OpenRouter API");
//     }
//
//     const responseText = data.choices[0].message.content;
//     // Save raw LLM response for debugging
//     try {
//       const logsDir = path.join(__dirname, "..", "logs");
//       fs.mkdirSync(logsDir, { recursive: true });
//       const ts = Date.now();
//       fs.writeFileSync(path.join(logsDir, `llm_response_${ts}.json`), responseText, "utf-8");
//     } catch (e) {
//       console.warn("Could not write LLM response log:", e.message);
//     }
//
//     console.log("📝 Parsing JSON response...");
//     const parsed = JSON.parse(responseText);
//
//     // Post-process and validate (no original text available for image payloads)
//     return postProcessParsedResume(parsed, null);
//   } catch (error) {
//     console.error("❌ Parse error:", error.message);
//     throw new Error(`Failed to parse resume: ${error.message}`);
//   }
// }
//
// /**
//  * Parse resume text (already extracted)
//  * @param {string} resumeText - Plain text or extracted resume content
//  * @param {string} apiKey - OpenRouter API key
//  * @returns {Promise<Object>} Parsed resume data
//  */
// export async function parseResumeText(resumeText, apiKey, role = null, extraContext = null) {
//   let combinedPrompt = `${loadPrompt()}\n\nRESUME TEXT:\n\n${resumeText}`;
//   if (role) {
//     combinedPrompt = `${combinedPrompt}\n\nROLE APPLIED FOR: ${role}`;
//   }
//   if (extraContext) {
//     combinedPrompt = `${combinedPrompt}\n\nUSER CONTEXT / ADDITIONAL INFO:\n${extraContext}`;
//   }
//
//   try {
//     console.log("🔄 Sending text request to OpenRouter API...");
//     console.log(`📊 Text length: ${resumeText.length} characters`);
//     
//     const response = await fetch(OPENROUTER_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${apiKey}`,
//         "HTTP-Referer": "https://hecknex-resume-parser.app",
//         "X-Title": "Hecknex Resume Parser",
//       },
//       body: JSON.stringify({
//         model: MODEL,
//         messages: [
//           {
//             role: "user",
//             content: combinedPrompt,
//           },
//         ],
//         temperature: 0,
//         response_format: {
//           type: "json_object",
//         },
//       }),
//     });
//
//     if (!response.ok) {
//       const errorText = await response.text();
//       console.error("API Error Response:", errorText);
//       throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
//     }
//
//     const data = await response.json();
//     console.log("✅ API response received");
//
//     if (!data.choices || !data.choices[0]?.message?.content) {
//       console.error("Invalid response structure:", JSON.stringify(data, null, 2));
//       throw new Error("Invalid response format from OpenRouter API");
//     }
//
//     const responseText = data.choices[0].message.content;
//
//     // Save raw LLM response for debugging
//     try {
//       const logsDir = path.join(__dirname, "..", "logs");
//       fs.mkdirSync(logsDir, { recursive: true });
//       const ts = Date.now();
//       fs.writeFileSync(path.join(logsDir, `llm_response_${ts}.json`), responseText, "utf-8");
//     } catch (e) {
//       console.warn("Could not write LLM response log:", e.message);
//     }
//
//     console.log("📝 Parsing JSON response...");
//     const parsed = JSON.parse(responseText);
//
//     // Post-process and validate (pass original text so we can extract missing sections)
//     return postProcessParsedResume(parsed, combinedPrompt + "\n\n" + resumeText);
//   } catch (error) {
//     console.error("❌ Parse error:", error.message);
//     throw new Error(`Failed to parse resume: ${error.message}`);
//   }
// }
//
// /**
//  * Parse a profile JSON (targeted job + optional education/skills) instead of a resume file.
//  * @param {Object} profileJson - JSON object with input_mode/target/etc.
//  * @param {string} apiKey - OpenRouter API key
//  * @returns {Promise<Object>} Parsed analysis / roadmap according to schema
//  */
// export async function parseProfile(profileJson, apiKey) {
//   validateProfileInput(profileJson);
//
//   const inputStr = JSON.stringify(profileJson, null, 2);
//   const combinedPrompt = `${loadPrompt()}\n\nINPUT_DATA:\n\n${inputStr}`;
//
//   try {
//     console.log("🔄 Sending profile request to OpenRouter API...");
//     const response = await fetch(OPENROUTER_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${apiKey}`,
//         "HTTP-Referer": "https://hecknex-resume-parser.app",
//         "X-Title": "Hecknex Resume Parser",
//       },
//       body: JSON.stringify({
//         model: MODEL,
//         messages: [
//           {
//             role: "user",
//             content: combinedPrompt,
//           },
//         ],
//         temperature: 0,
//         response_format: { type: "json_object" },
//       }),
//     });
//
//     if (!response.ok) {
//       const errorText = await response.text();
//       throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
//     }
//
//     const data = await response.json();
//     const responseText = data.choices[0].message.content;
//
//     // Save raw LLM response
//     try {
//       const logsDir = path.join(__dirname, "..", "logs");
//       fs.mkdirSync(logsDir, { recursive: true });
//       const ts = Date.now();
//       fs.writeFileSync(path.join(logsDir, `llm_response_${ts}.json`), responseText, "utf-8");
//     } catch (e) {
//       console.warn("Could not write LLM response log:", e.message);
//     }
//
//     const parsed = JSON.parse(responseText);
//     return parsed;
//   } catch (err) {
//     console.error("❌ Profile parse error:", err.message);
//     throw err;
//   }
// }
//
// /**
//  * Get supported MIME types
//  */
// export function getSupportedMimeTypes() {
//   return [
//     "application/pdf",
//     "image/png",
//     "image/jpeg",
//     "image/webp",
//     "image/gif",
//   ];
// }
