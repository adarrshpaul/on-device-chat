/**
 * Canvas & WebGL Game Inspector Engine
 *
 * Provides deep perception into <canvas> elements and WebGL/HTML5 game engines
 * (Phaser 3, Phaser CE, PixiJS, Three.js, Canvas2D).
 *
 * Solves the "Canvas Blindness" gap in Web Agents:
 * 1. Probes runtime game engines and active game scenes.
 * 2. Extracts interactive game controls (buttons, menus, restart chips) and projects
 *    their internal game coordinates to viewport pixel rectangles.
 * 3. Injects virtual accessible nodes into A11yTreeEngine so compact LLMs and the
 *    Vega decision engine can "see" and interact with canvas games.
 */

import { IA11yNode } from "./a11yTree";

export interface ICanvasEntity {
  id: string;
  name: string;
  role: "button" | "game_target" | "game_player" | "status" | "menu";
  screenBounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  gameCoords?: {
    x: number;
    y: number;
  };
  sceneKey?: string;
  metadata?: Record<string, unknown>;
}

export interface ICanvasGameState {
  hasCanvas: boolean;
  engine: "phaser" | "pixi" | "three" | "generic_canvas" | "none";
  activeSceneKey?: string;
  score?: number;
  timerProgress?: number;
  entities: ICanvasEntity[];
  canvasBounds?: DOMRect;
  rawGameInstance?: unknown;
}

export class CanvasInspector {
  private static bridgeInitialized = false;

  /**
   * Initialize lightweight non-intrusive runtime engine bridge.
   * Catches Phaser.Game instantiations without modifying game logic.
   */
  public static initBridge(): void {
    if (typeof window === "undefined" || this.bridgeInitialized) return;
    this.bridgeInitialized = true;

    try {
      const anyWindow = window as any;

      // Hook Phaser if present or when assigned
      if (anyWindow.Phaser && anyWindow.Phaser.Game) {
        const OrigGame = anyWindow.Phaser.Game;
        if (!anyWindow.__phaserHooked) {
          anyWindow.__phaserHooked = true;
          anyWindow.Phaser.Game = function (...args: any[]) {
            const inst = new OrigGame(...args);
            anyWindow.__activeCanvasGame = inst;
            anyWindow.__phaserGame = inst;
            return inst;
          };
          anyWindow.Phaser.Game.prototype = OrigGame.prototype;
        }
      } else {
        // Define setter on window.Phaser to hook as soon as scripts load
        let _phaser = anyWindow.Phaser;
        Object.defineProperty(anyWindow, "Phaser", {
          configurable: true,
          enumerable: true,
          get() {
            return _phaser;
          },
          set(val) {
            _phaser = val;
            if (val && val.Game && !anyWindow.__phaserHooked) {
              anyWindow.__phaserHooked = true;
              const OrigGame = val.Game;
              val.Game = function (...args: any[]) {
                const inst = new OrigGame(...args);
                anyWindow.__activeCanvasGame = inst;
                anyWindow.__phaserGame = inst;
                return inst;
              };
              val.Game.prototype = OrigGame.prototype;
            }
          },
        });
      }
    } catch {
      // Non-fatal if environment restricts window modification
    }
  }

  /**
   * Find the active Phaser game instance from known globals or window hooks
   */
  public static getActivePhaserGame(): any | null {
    if (typeof window === "undefined") return null;
    const anyWindow = window as any;

    if (anyWindow.__phaserGame) return anyWindow.__phaserGame;
    if (anyWindow.__activeCanvasGame) return anyWindow.__activeCanvasGame;
    if (anyWindow.game && anyWindow.game.scene) return anyWindow.game;
    if (anyWindow.Phaser && Array.isArray(anyWindow.Phaser.GAMES) && anyWindow.Phaser.GAMES.length > 0) {
      return anyWindow.Phaser.GAMES[0];
    }
    return null;
  }

  /**
   * Inspect all canvases and game engines on the active page
   */
  public static inspect(): ICanvasGameState {
    if (typeof document === "undefined") {
      return { hasCanvas: false, engine: "none", entities: [] };
    }

    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    if (!canvas) {
      return { hasCanvas: false, engine: "none", entities: [] };
    }

    const canvasBounds = canvas.getBoundingClientRect();
    const phaserGame = this.getActivePhaserGame();

    if (phaserGame && phaserGame.scene) {
      return this.inspectPhaserGame(phaserGame, canvas, canvasBounds);
    }

    // Generic Canvas fallback
    const genericEntities: ICanvasEntity[] = [];

    // Project standard interactive regions on canvas (center, left, right buttons)
    genericEntities.push({
      id: "canvas_center_action",
      name: "Canvas Center Tap / Action",
      role: "button",
      screenBounds: {
        top: canvasBounds.top + canvasBounds.height * 0.4,
        left: canvasBounds.left + canvasBounds.width * 0.25,
        width: canvasBounds.width * 0.5,
        height: canvasBounds.height * 0.2,
      },
      metadata: { engine: "generic_canvas" },
    });

    return {
      hasCanvas: true,
      engine: "generic_canvas",
      entities: genericEntities,
      canvasBounds,
    };
  }

  /**
   * Deep inspect Phaser 3 / CE game hierarchy
   */
  private static inspectPhaserGame(
    game: any,
    canvas: HTMLCanvasElement,
    canvasBounds: DOMRect
  ): ICanvasGameState {
    const entities: ICanvasEntity[] = [];
    let activeSceneKey = "";
    let score = 0;
    let timerProgress = 0;

    const gameWidth = game.config?.width || canvas.width || 540;
    const gameHeight = game.config?.height || canvas.height || 950;
    const scaleX = canvasBounds.width / gameWidth;
    const scaleY = canvasBounds.height / gameHeight;

    const scenes = game.scene?.scenes || [];
    for (const scene of scenes) {
      if (scene.sys?.settings?.active) {
        activeSceneKey = scene.scene?.key || scene.key || "";

        // Extract score
        if (typeof scene.score_value === "number") {
          score = scene.score_value;
        } else if (game.registry && typeof game.registry.get("score") === "number") {
          score = game.registry.get("score");
        }

        // Extract timer
        if (scene.timer && typeof scene.timer.getOverallProgress === "function") {
          timerProgress = scene.timer.getOverallProgress();
        }

        // Inspect scene objects for interactive controls
        if (scene.children && Array.isArray(scene.children.list)) {
          for (const child of scene.children.list) {
            if (!child.visible) continue;

            // Check if interactive
            const isInteractive = !!child.input?.enabled;
            const textContent = child.text || child.texture?.key || "";
            const isButton = isInteractive || typeof textContent === "string";

            if (isButton && textContent) {
              const gameX = child.x || 0;
              const gameY = child.y || 0;
              const gameW = child.width || 120;
              const gameH = child.height || 40;

              const screenLeft = canvasBounds.left + (gameX - gameW * (child.originX ?? 0.5)) * scaleX;
              const screenTop = canvasBounds.top + (gameY - gameH * (child.originY ?? 0.5)) * scaleY;
              const screenW = Math.max(30, gameW * scaleX);
              const screenH = Math.max(20, gameH * scaleY);

              // Clean user-facing label
              let label = String(textContent);
              if (label === "ClassicalModeButton") label = "Classic Mode";
              if (label === "MatchModeButton") label = "Match Mode";
              if (label === "SoundOnButton") label = "Sound Toggle";
              if (label === "ScorePopup") label = "Score Summary";

              entities.push({
                id: `phaser_${child.type || "obj"}_${entities.length + 1}`,
                name: label,
                role: isInteractive ? "button" : "status",
                screenBounds: {
                  left: Math.round(screenLeft),
                  top: Math.round(screenTop),
                  width: Math.round(screenW),
                  height: Math.round(screenH),
                },
                gameCoords: { x: Math.round(gameX), y: Math.round(gameY) },
                sceneKey: activeSceneKey,
                metadata: {
                  texture: child.texture?.key,
                  type: child.type,
                  interactive: isInteractive,
                },
              });
            }
          }
        }

        // Detect game-specific targets (e.g. Hoops)
        if (Array.isArray(scene.BasketBallNetBoardRingCollisionArray)) {
          for (const hoop of scene.BasketBallNetBoardRingCollisionArray) {
            const hx = hoop.Sensor?.position?.x || 100;
            const hy = hoop.Sensor?.position?.y || 400;
            entities.push({
              id: "hoop_left",
              name: "Left Basketball Hoop",
              role: "game_target",
              screenBounds: {
                left: Math.round(canvasBounds.left + (hx - 30) * scaleX),
                top: Math.round(canvasBounds.top + (hy - 20) * scaleY),
                width: Math.round(60 * scaleX),
                height: Math.round(40 * scaleY),
              },
              gameCoords: { x: hx, y: hy },
              sceneKey: activeSceneKey,
            });
          }
        }

        if (Array.isArray(scene.BasketBallNetBoardRingCollisionArrayRight)) {
          for (const hoop of scene.BasketBallNetBoardRingCollisionArrayRight) {
            const hx = hoop.Sensor?.position?.x || 440;
            const hy = hoop.Sensor?.position?.y || 400;
            entities.push({
              id: "hoop_right",
              name: "Right Basketball Hoop",
              role: "game_target",
              screenBounds: {
                left: Math.round(canvasBounds.left + (hx - 30) * scaleX),
                top: Math.round(canvasBounds.top + (hy - 20) * scaleY),
                width: Math.round(60 * scaleX),
                height: Math.round(40 * scaleY),
              },
              gameCoords: { x: hx, y: hy },
              sceneKey: activeSceneKey,
            });
          }
        }
      }
    }

    return {
      hasCanvas: true,
      engine: "phaser",
      activeSceneKey,
      score,
      timerProgress,
      entities,
      canvasBounds,
      rawGameInstance: game,
    };
  }

  /**
   * Convert detected canvas entities into synthetic A11yNodes for A11yTreeEngine
   */
  public static getVirtualA11yNodes(canvasEl: HTMLCanvasElement, startId: number): IA11yNode[] {
    const state = this.inspect();
    if (!state.hasCanvas || state.entities.length === 0) return [];

    const nodes: IA11yNode[] = [];
    let currId = startId;

    for (const ent of state.entities) {
      // Create a virtual element proxy linked to the real canvas element
      const proxyEl = document.createElement("div");
      proxyEl.setAttribute("data-canvas-entity", ent.id);
      proxyEl.setAttribute("data-canvas-engine", state.engine);
      if (ent.gameCoords) {
        proxyEl.setAttribute("data-game-x", String(ent.gameCoords.x));
        proxyEl.setAttribute("data-game-y", String(ent.gameCoords.y));
      }

      nodes.push({
        id: currId++,
        role: ent.role,
        name: `[Canvas] ${ent.name}`,
        tag: "canvas-element",
        selector: `canvas[data-target="${ent.id}"]`,
        element: canvasEl, // Target is the real canvas element
        bounds: {
          top: ent.screenBounds.top,
          left: ent.screenBounds.left,
          width: ent.screenBounds.width,
          height: ent.screenBounds.height,
        },
        states: {
          value: ent.metadata?.interactive ? "interactive" : undefined,
        },
      });
    }

    return nodes;
  }
}
