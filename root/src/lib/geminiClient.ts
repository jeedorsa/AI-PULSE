/**
 * geminiClient.ts
 * 
 * Helper para llamar al proxy seguro en lugar de Gemini directamente.
 * 
 * USO:
 *   import { generateContent } from '../lib/geminiClient';
 *   const text = await generateContent("Tu prompt aquí");
 */

const API_PROXY_URL = "/api/gemini-proxy";

interface GeminiRequest {
  model?: string;
  contents: Array<{
    role: "user" | "model";
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

/**
 * Llama al proxy de Gemini con un prompt simple (texto → texto).
 */
export async function generateContent(
  prompt: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const body: GeminiRequest = {
    model: "gemini-1.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 1024
    }
  };

  const response = await fetch(API_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gemini proxy error ${response.status}: ${error.error || "Unknown error"}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}

/**
 * Llama al proxy con historial de conversación (multi-turn).
 */
export async function generateChat(
  messages: Array<{ role: "user" | "model"; text: string }>,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const body: GeminiRequest = {
    model: "gemini-1.5-flash",
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 1024
    }
  };

  const response = await fetch(API_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Gemini proxy error ${response.status}: ${error.error || "Unknown error"}`);
  }

  const data: GeminiResponse = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text ?? "";
}
