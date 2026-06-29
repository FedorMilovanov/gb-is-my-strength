import { TTSController, type TTSConfig } from './TTSController';
import { ThemeController } from './ThemeController';

export class PremiumControlsEngine {
  public tts: TTSController;
  public theme: ThemeController;

  constructor(ttsConfig: TTSConfig) {
    this.tts = new TTSController(ttsConfig);
    this.theme = new ThemeController();
  }

  public init() {
    this.theme.initListeners();
    this.theme.syncButtons();
    // Additional initialization can be wired here in the future
    // avoiding the massive 1200-line IIFE.
  }
}
