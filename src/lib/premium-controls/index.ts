import { TTSController, type TTSConfig } from './TTSController';
import { ThemeController } from './ThemeController';
import { SearchController } from './SearchController';
import { FontController } from './FontController';
import { BookmarkController } from './BookmarkController';

export class PremiumControlsEngine {
  public tts: TTSController;
  public theme: ThemeController;
  public search: SearchController;
  public font: FontController;
  public bookmark: BookmarkController;

  constructor(ttsConfig: TTSConfig) {
    this.tts = new TTSController(ttsConfig);
    this.theme = new ThemeController();
    this.search = new SearchController();
    this.font = new FontController();
    this.bookmark = new BookmarkController();
  }

  public init() {
    this.theme.initListeners();
    this.theme.syncButtons();
    this.search.initListeners();
    this.font.init();
    this.bookmark.init();
  }
}

if (typeof window !== 'undefined') {
  (window as any).__PremiumControlsEngine = PremiumControlsEngine;
}
