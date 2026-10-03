/**
 * Multilingual Translator Service
 * Built following Google's official case study:
 * Policybazaar (Finova AI) & JioHotstar (SubTitleTranslator) architecture.
 *
 * Flow:
 * 1. User writes in any language (e.g. Hindi, Spanish, French, Japanese).
 * 2. LanguageDetector detects language on-device (0 MB).
 * 3. Translator translates to English for tool routing & execution.
 * 4. Assistant response is translated back into the user's native language!
 *
 * Ref: https://developer.chrome.com/docs/ai/translator-api & https://developer.chrome.com/blog/pb-jiohotstar-translation-ai
 */

export class MultilingualService {
  private languageDetector: any = null;
  private translatorMap: Map<string, any> = new Map();

  static isSupported(): boolean {
    return typeof window !== "undefined" && ("Translator" in window || "translation" in window);
  }

  async init(): Promise<void> {
    if (typeof window === "undefined") return;

    if ("LanguageDetector" in window) {
      try {
        this.languageDetector = await (window as any).LanguageDetector.create();
      } catch (err) {
        console.warn("LanguageDetector init error:", err);
      }
    }
  }

  /**
   * Detect language (Policybazaar pattern: confidence threshold > 0.5)
   */
  async detectLanguage(text: string): Promise<string> {
    if (!this.languageDetector) {
      await this.init();
      if (!this.languageDetector) return "en";
    }

    try {
      const results = await this.languageDetector.detect(text);
      if (results && results.length > 0) {
        const top = results[0];
        if (top.confidence > 0.45 && top.detectedLanguage !== "en") {
          return top.detectedLanguage;
        }
      }
    } catch (err) {
      console.warn("Language detection failed:", err);
    }

    return "en";
  }

  /**
   * Get or create a cached translator instance (JioHotstar SubTitleTranslator pattern)
   */
  async getTranslator(sourceLanguage: string, targetLanguage: string): Promise<any | null> {
    if (sourceLanguage === targetLanguage) return null;
    const key = `${sourceLanguage}-${targetLanguage}`;

    if (this.translatorMap.has(key)) {
      return this.translatorMap.get(key);
    }

    const TranslatorClass = (window as any).Translator || (window as any).translation?.createTranslator;
    if (!TranslatorClass) return null;

    try {
      // Check availability first
      if (typeof TranslatorClass.availability === "function") {
        const avail = await TranslatorClass.availability({ sourceLanguage, targetLanguage });
        if (avail !== "available" && avail !== "readily" && avail !== "downloadable") {
          return null;
        }
      }

      const translator = await TranslatorClass.create({
        sourceLanguage,
        targetLanguage,
      });

      this.translatorMap.set(key, translator);
      return translator;
    } catch (err) {
      console.warn(`Translator create error (${key}):`, err);
      return null;
    }
  }

  /**
   * Translate text from source to target language
   */
  async translate(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    if (!text || sourceLanguage === targetLanguage) return text;

    try {
      const translator = await this.getTranslator(sourceLanguage, targetLanguage);
      if (!translator) return text;
      return await translator.translate(text);
    } catch (err) {
      console.warn("Translation failed, returning original text:", err);
      return text;
    }
  }
}

export const multilingualService = new MultilingualService();
