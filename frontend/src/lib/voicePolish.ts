/**
 * Voice Polish & Disfluency Stripping Engine (TASK-115)
 *
 * Implements local-first text cleanup:
 * 1. Strips verbal fillers and hesitation artifacts ("um", "uh", "er", "ah", "like").
 * 2. Resolves spoken self-corrections ("4, no actually 5pm" -> "5pm", "Bob, wait Alice" -> "Alice").
 * 3. Applies user's offline personal dictionary replacements.
 * 4. Context-aware punctuation and formatting based on target element type.
 */

import { personalDictionary } from "./personalDictionary.ts";

export type TargetTone = "general" | "search" | "code" | "formal";

export interface PolishOptions {
  tone?: TargetTone;
  stripFillers?: boolean;
  resolveCorrections?: boolean;
  applyDictionary?: boolean;
}

export class VoicePolishEngine {
  private static FILLERS = [
    /\b(?:um+h?|uh+h?|er+h?|ah+h?)\b/gi,
    /\b(?:you know|sort of|kind of)\b/gi,
  ];

  /**
   * Deterministically cleans raw speech transcription.
   */
  static polish(rawText: string, options: PolishOptions = {}): string {
    if (!rawText || !rawText.trim()) return "";

    let text = rawText.trim();

    // 1. Resolve spoken self-corrections first before dropping fillers
    if (options.resolveCorrections !== false) {
      text = this.resolveSpokenCorrections(text);
    }

    // 2. Strip filler words
    if (options.stripFillers !== false) {
      text = this.stripFillers(text);
    }

    // 3. Apply personal dictionary jargon replacements
    if (options.applyDictionary !== false) {
      text = personalDictionary.applyReplacements(text);
    }

    // 4. Tone adaptation & terminal punctuation
    const tone = options.tone || "general";
    text = this.formatTone(text, tone);

    return text.trim();
  }

  private static stripFillers(text: string): string {
    let result = text;
    for (const pattern of this.FILLERS) {
      result = result.replace(pattern, " ");
    }
    // Clean up double spaces or floating punctuation
    result = result.replace(/\s+/g, " ");
    result = result.replace(/\s*([,.;!?])\s*/g, "$1 ");
    result = result.replace(/,\s*,/g, ",");
    return result.trim();
  }

  private static resolveSpokenCorrections(text: string): string {
    let result = text;

    // Pattern: "[X], no [Y]" or "[X], wait [Y]"
    // e.g. "Meeting at 4, no 5pm" -> "Meeting at 5pm"
    // e.g. "Send email to Bob, actually Sarah" -> "Send email to Sarah"
    const regex = /\b([\w\s]+?),\s*(?:no\s+actually|no\s+wait|actually|scratch that|i mean|wait)\s+([\w\s]+?)(?=[.,;!?]|$)/i;
    let match = result.match(regex);
    let iterations = 0;

    while (match && iterations < 3) {
      iterations++;
      const [fullMatch, beforePart, afterPart] = match;
      const beforeWords = beforePart.trim().split(/\s+/);
      const afterWords = afterPart.trim().split(/\s+/);

      // If replacement has similar or smaller token length, replace the corrected tail word(s)
      if (beforeWords.length >= afterWords.length) {
        const keptBefore = beforeWords.slice(0, beforeWords.length - afterWords.length).join(" ");
        const replacement = keptBefore ? `${keptBefore} ${afterPart.trim()}` : afterPart.trim();
        result = result.replace(fullMatch, replacement);
      } else {
        result = result.replace(fullMatch, afterPart.trim());
      }
      match = result.match(regex);
    }

    return result;
  }

  private static formatTone(text: string, tone: TargetTone): string {
    if (!text) return "";
    let cleaned = text.trim();

    // If search tone: strip conversational preambles ("search for...", "can you please search for...")
    if (tone === "search") {
      cleaned = cleaned.replace(/^(?:(?:can you|could you|please|i want to|i'd like to)\s+)*(?:search(?:\s+for)?|find(?:\s+me)?|look(?:\s+up)?)\s+/i, "");
      // Remove trailing period for search queries
      cleaned = cleaned.replace(/[.]+$/, "");
    } else if (tone === "code") {
      // Don't append periods to code or command inputs
      cleaned = cleaned.replace(/[.]+$/, "");
    } else {
      // General/Formal: Capitalize first letter and ensure terminal punctuation
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        if (!/[.!?]$/.test(cleaned)) {
          cleaned += ".";
        }
      }
    }

    return cleaned;
  }
}
