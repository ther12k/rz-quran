// Singleton Audio Controller (T028)
// Handles audio playback, generation tokens for cancellation, error handling,
// and ensures only one audio stream plays at any moment across routes.

class AudioController {
  private currentAudio: HTMLAudioElement | null = null;
  private currentGeneration = 0;

  play(url: string, onEnded?: () => void, onError?: (err: unknown) => void): number {
    this.stop();
    const generation = ++this.currentGeneration;

    try {
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        if (this.currentGeneration === generation) {
          this.currentAudio = null;
          onEnded?.();
        }
      };

      audio.onerror = (err) => {
        if (this.currentGeneration === generation) {
          this.currentAudio = null;
          onError?.(err);
        }
      };

      audio.play().catch((err) => {
        if (this.currentGeneration === generation) {
          this.currentAudio = null;
          onError?.(err);
        }
      });
    } catch (err) {
      onError?.(err);
    }

    return generation;
  }

  stop(generation?: number): void {
    if (generation === undefined || generation === this.currentGeneration) {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio = null;
      }
      this.currentGeneration++;
    }
  }

  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }
}

export const audioController = new AudioController();
