export type TTSState = 'idle' | 'playing' | 'paused' | 'complete';

export interface TTSConfig {
  onStateChange: (state: TTSState, progress: number) => void;
  onToast: (msg: string, check: boolean) => void;
  getText: () => string;
}

export class TTSController {
  private state: TTSState = 'idle';
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  private text: string = '';
  private totalChars: number = 0;
  private spokenChars: number = 0;
  private chunkIndex: number = 0;
  private chunks: string[] = [];
  
  constructor(private config: TTSConfig) {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
    }
  }

  public get progress(): number {
    if (this.totalChars === 0) return 0;
    return Math.min(1, this.spokenChars / this.totalChars);
  }

  public getState(): TTSState {
    return this.state;
  }

  public togglePlay(): void {
    if (!this.synthesis) {
      this.config.onToast('Браузер не поддерживает озвучку', false);
      return;
    }

    if (this.state === 'idle' || this.state === 'complete') {
      this.start();
    } else if (this.state === 'playing') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
  }

  public stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
    this.state = 'idle';
    this.spokenChars = 0;
    this.chunkIndex = 0;
    this.config.onStateChange(this.state, 0);
  }

  private start(): void {
    this.text = this.config.getText();
    if (!this.text) {
      this.config.onToast('Текст статьи не найден', false);
      return;
    }
    
    this.chunks = this.chunkText(this.text);
    this.totalChars = this.text.length;
    this.spokenChars = 0;
    this.chunkIndex = 0;
    
    this.state = 'playing';
    this.config.onStateChange(this.state, this.progress);
    this.speakNextChunk();
  }

  private pause(): void {
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.pause();
      this.state = 'paused';
      this.config.onStateChange(this.state, this.progress);
    }
  }

  private resume(): void {
    if (this.synthesis && this.synthesis.paused) {
      this.synthesis.resume();
      this.state = 'playing';
      this.config.onStateChange(this.state, this.progress);
    } else {
      // Sometimes browsers clear the paused state on mobile if backgrounded
      this.speakNextChunk();
    }
  }

  private speakNextChunk(): void {
    if (!this.synthesis) return;
    
    if (this.chunkIndex >= this.chunks.length) {
      this.state = 'complete';
      this.config.onStateChange(this.state, 1);
      return;
    }

    this.state = 'playing';
    const text = this.chunks[this.chunkIndex];
    this.currentUtterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance.rate = this.getRate();
    this.currentUtterance.lang = 'ru-RU';
    
    this.currentUtterance.onboundary = (e) => {
      // Very rough approximation without heavy string matching
      this.spokenChars += e.charLength || 5; 
      this.config.onStateChange(this.state, this.progress);
    };

    this.currentUtterance.onend = () => {
      this.chunkIndex++;
      this.speakNextChunk();
    };
    
    this.currentUtterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        this.stop();
      }
    };

    this.synthesis.speak(this.currentUtterance);
  }

  private getRate(): number {
    try {
      const r = parseFloat(localStorage.getItem('gb:audio:rate') || localStorage.getItem('gbx-tts-rate') || '1');
      if (isNaN(r) || r < 0.5 || r > 3) return 1;
      return r;
    } catch {
      return 1;
    }
  }

  private chunkText(text: string): string[] {
    // Simple sentence-based chunker for robust mobile TTS
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  }
}
