/**
 * Voice Transcription & Audio Engine (TASK-115 & TASK-117)
 *
 * Implements speech-to-text input with two distinct tiers:
 * 1. Tier 1 (Browser Built-In): Web Speech API (webkitSpeechRecognition)
 *    - Instant zero-download start.
 *    - PRIVACY NOTICE (§7): In Google Chrome and Chromium browsers, the Web Speech API
 *      transmits speech audio to Google cloud servers for transcription. It is NOT fully
 *      on-device private.
 * 2. Tier 2 (100% Offline On-Device): Whisper WebGPU (transformers.js / onnx-community/whisper-tiny)
 *    - Runs fully client-side inside the browser tab via WebGPU / WASM.
 *    - Zero external network requests; speech audio NEVER leaves the local machine.
 *    - Captures PCM audio via Web Audio ScriptProcessor/Analyser and resamples to 16kHz Float32Array.
 * 3. Automatic Disfluency Polish via VoicePolishEngine.
 * 4. Dual dispatch: Agent prompt command or direct DOM text injection via TextInjector.
 */

import { VoicePolishEngine } from "./voicePolish.ts";
import type { TargetTone } from "./voicePolish.ts";
import { TextInjector } from "./textInjector.ts";
import { loadTransformers } from "./modelLoader.ts";

export type VoiceEngineState = "idle" | "listening" | "transcribing" | "polishing" | "error";

export type VoiceOutputMode = "agent_command" | "dictate";

export interface VoiceEngineConfig {
  outputMode?: VoiceOutputMode;
  useWhisperWebGPU?: boolean;
  whisperModelId?: string;
  tone?: TargetTone;
  onStateChange?: (state: VoiceEngineState, details?: string) => void;
  onAudioLevel?: (level: number) => void;
  onInterimTranscript?: (text: string) => void;
  onFinalTranscript?: (rawText: string, polishedText: string) => void;
}

function resampleTo16kHz(audio: Float32Array, srcRate: number): Float32Array {
  if (srcRate === 16000) return audio;
  const ratio = srcRate / 16000;
  const newLength = Math.round(audio.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIdx = i * ratio;
    const idxFloor = Math.floor(origIdx);
    const idxCeil = Math.min(audio.length - 1, idxFloor + 1);
    const fraction = origIdx - idxFloor;
    result[i] = audio[idxFloor] * (1 - fraction) + audio[idxCeil] * fraction;
  }
  return result;
}

export class VoiceEngine {
  private state: VoiceEngineState = "idle";
  private config: VoiceEngineConfig;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private animFrameId: number | null = null;

  // Web Speech API
  private recognition: any = null;
  private currentWebSpeechTranscript = "";

  // Whisper WebGPU pipeline instance
  private whisperPipeline: any = null;
  private audioChunks: Float32Array[] = [];

  constructor(config: VoiceEngineConfig = {}) {
    this.config = config;
  }

  getState(): VoiceEngineState {
    return this.state;
  }

  private setState(state: VoiceEngineState, details?: string) {
    this.state = state;
    if (this.config.onStateChange) {
      this.config.onStateChange(state, details);
    }
  }

  /**
   * Check if on-device voice recording is supported in this browser.
   */
  static isSupported(): { supported: boolean; hasWebSpeech: boolean; hasGetUserMedia: boolean } {
    if (typeof window === "undefined") {
      return { supported: false, hasWebSpeech: false, hasGetUserMedia: false };
    }
    const hasGetUserMedia = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasWebSpeech = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    return {
      supported: hasGetUserMedia || hasWebSpeech,
      hasWebSpeech,
      hasGetUserMedia,
    };
  }

  /**
   * Start push-to-talk voice recording.
   */
  async startRecording(): Promise<boolean> {
    if (this.state === "listening" || this.state === "transcribing") {
      return false;
    }

    // 1. Microphone Access
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.setupAudioAnalysis(this.audioStream);
      }
    } catch (err: any) {
      const msg = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "Microphone permission was denied by the user. Please allow microphone access in browser settings."
        : `Microphone error: ${err.message || "Failed to access input device"}`;
      this.setState("error", msg);
      return false;
    }

    this.setState("listening");

    // 2. Start STT Provider
    if (this.config.useWhisperWebGPU) {
      return this.startWhisperRecording();
    } else {
      return this.startWebSpeechRecording();
    }
  }

  /**
   * Stop recording, transcribe speech, polish disfluencies, and dispatch.
   */
  async stopRecording(): Promise<string> {
    if (this.state !== "listening") {
      return "";
    }

    let transcript = "";
    if (this.config.useWhisperWebGPU) {
      transcript = await this.finishWhisperRecording();
    } else {
      transcript = await this.finishWebSpeechRecording();
    }

    this.cleanupAudio();
    return transcript;
  }

  /**
   * Cancel ongoing recording and discard audio.
   */
  cancelRecording() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.cleanupAudio();
    this.audioChunks = [];
    this.currentWebSpeechTranscript = "";
    this.setState("idle");
  }

  // ---------------------------------------------------------------------------
  // Web Speech API Pipeline (Zero-Download Instant ASR)
  // ---------------------------------------------------------------------------
  private startWebSpeechRecording(): boolean {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.setState("error", "Web Speech API is not supported in this browser. Consider enabling Whisper WebGPU.");
      this.cleanupAudio();
      return false;
    }

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";
      this.currentWebSpeechTranscript = "";

      let finalSoFar = "";

      this.recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalSoFar += " " + item[0].transcript;
          } else {
            interim += " " + item[0].transcript;
          }
        }
        const current = (finalSoFar + " " + interim).trim();
        this.currentWebSpeechTranscript = current;
        if (this.config.onInterimTranscript) {
          this.config.onInterimTranscript(current);
        }
      };

      this.recognition.onerror = (err: any) => {
        console.warn("[VoiceEngine] WebSpeech error:", err.error);
        if (err.error === "not-allowed") {
          this.setState("error", "Microphone access blocked.");
        }
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      this.setState("error", `Speech recognition start failed: ${err.message}`);
      this.cleanupAudio();
      return false;
    }
  }

  private finishWebSpeechRecording(): Promise<string> {
    return new Promise((resolve) => {
      this.setState("polishing");
      if (!this.recognition) {
        this.setState("idle");
        resolve("");
        return;
      }

      this.recognition.onend = () => {
        const raw = this.currentWebSpeechTranscript.trim();
        const polished = VoicePolishEngine.polish(raw, { tone: this.config.tone });

        if (this.config.onFinalTranscript) {
          this.config.onFinalTranscript(raw, polished);
        }

        this.dispatchOutput(polished);
        this.setState("idle");
        resolve(polished);
      };

      try {
        this.recognition.stop();
      } catch {
        const raw = this.currentWebSpeechTranscript.trim();
        const polished = VoicePolishEngine.polish(raw, { tone: this.config.tone });
        this.setState("idle");
        resolve(polished);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Whisper WebGPU Pipeline (Offline Neural Model)
  // ---------------------------------------------------------------------------
  private async startWhisperRecording(): Promise<boolean> {
    this.audioChunks = [];

    if (this.audioContext && this.audioSourceNode) {
      try {
        this.scriptProcessorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.scriptProcessorNode.onaudioprocess = (e) => {
          if (this.state !== "listening") return;
          const channelData = e.inputBuffer.getChannelData(0);
          this.audioChunks.push(new Float32Array(channelData));
        };
        this.audioSourceNode.connect(this.scriptProcessorNode);
        this.scriptProcessorNode.connect(this.audioContext.destination);
      } catch (err: any) {
        console.warn("[VoiceEngine] ScriptProcessor error for Whisper:", err);
      }
    }

    return true;
  }

  private async finishWhisperRecording(): Promise<string> {
    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch {}
      this.scriptProcessorNode = null;
    }

    this.setState("transcribing", "Transcribing with on-device Whisper WebGPU...");
    try {
      const transformers = await loadTransformers();
      if (!this.whisperPipeline) {
        const modelId = this.config.whisperModelId || "onnx-community/whisper-tiny";
        this.whisperPipeline = await transformers.pipeline(
          "automatic-speech-recognition",
          modelId,
          { device: "webgpu" }
        );
      }

      // Concatenate captured audio samples
      const length = this.audioChunks.reduce((acc, c) => acc + c.length, 0);
      const mergedAudio = new Float32Array(length);
      let offset = 0;
      for (const chunk of this.audioChunks) {
        mergedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Resample to 16kHz for Whisper
      const sampleRate = this.audioContext?.sampleRate || 44100;
      const resampledAudio = resampleTo16kHz(mergedAudio, sampleRate);

      const output = await this.whisperPipeline(resampledAudio);
      const rawText = (output && output.text ? output.text : "").trim();

      this.setState("polishing");
      const polished = VoicePolishEngine.polish(rawText, { tone: this.config.tone });

      if (this.config.onFinalTranscript) {
        this.config.onFinalTranscript(rawText, polished);
      }

      this.dispatchOutput(polished);
      this.setState("idle");
      return polished;
    } catch (err: any) {
      this.setState("error", `Whisper WebGPU transcription error: ${err.message}`);
      return "";
    }
  }

  // ---------------------------------------------------------------------------
  // Audio Waveform & Energy Level Analysis
  // ---------------------------------------------------------------------------
  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.audioSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.audioSourceNode.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkLevel = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(1.0, avg / 128.0);

        if (this.config.onAudioLevel) {
          this.config.onAudioLevel(normalized);
        }

        if (this.state === "listening") {
          this.animFrameId = requestAnimationFrame(checkLevel);
        }
      };

      this.animFrameId = requestAnimationFrame(checkLevel);
    } catch (err: any) {
      console.warn("[VoiceEngine] Audio analysis setup skipped:", err.message);
    }
  }

  private dispatchOutput(text: string) {
    if (!text) return;
    if (this.config.outputMode === "dictate") {
      TextInjector.injectText(text);
    }
  }

  private cleanupAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch {}
      this.scriptProcessorNode = null;
    }
    if (this.audioSourceNode) {
      try {
        this.audioSourceNode.disconnect();
      } catch {}
      this.audioSourceNode = null;
    }
    if (this.audioStream) {
      for (const track of this.audioStream.getTracks()) {
        track.stop();
      }
      this.audioStream = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
