/**
 * Chrome Built-in Language Detector API
 * Ref: https://developer.chrome.com/docs/ai/language-detection
 *
 * Runs on-device with 0 MB download overhead.
 * Chrome 138+ (Intent to Ship).
 */

export interface DetectedLang {
  language: string;
  confidence: number;
}

export class ChromeLanguageDetector {
  private detector: any = null;

  static isSupported(): boolean {
    return typeof self !== "undefined" && "LanguageDetector" in self;
  }

  async init(onDownloadProgress?: (percent: number) => void): Promise<boolean> {
    if (!ChromeLanguageDetector.isSupported()) return false;

    try {
      const LanguageDetectorClass = (self as any).LanguageDetector;
      this.detector = await LanguageDetectorClass.create({
        monitor(m: any) {
          m.addEventListener("downloadprogress", (e: any) => {
            const pct = Math.round((e.loaded / (e.total || 1)) * 100);
            onDownloadProgress?.(pct);
          });
        },
      });
      return true;
    } catch (e) {
      console.warn("LanguageDetector initialization failed:", e);
      return false;
    }
  }

  async detect(text: string): Promise<DetectedLang[]> {
    if (!this.detector) {
      const ok = await this.init();
      if (!ok || !this.detector) return [];
    }

    try {
      const results = await this.detector.detect(text);
      return results.map((r: any) => ({
        language: r.detectedLanguage,
        confidence: r.confidence,
      }));
    } catch (e) {
      console.warn("Language detection error:", e);
      return [];
    }
  }

  destroy() {
    if (this.detector && typeof this.detector.destroy === "function") {
      this.detector.destroy();
      this.detector = null;
    }
  }
}
