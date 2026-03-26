import { GoogleGenAI } from "@google/genai";

export function createGeminiClient() {
  return new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "regal-hybrid-472613-u2",
    location: "global",
  });
}
