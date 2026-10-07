export const SOUND_IDS = ["shot", "reload", "empty", "hit", "bonus", "music", "end"] as const;
export type SoundId = (typeof SOUND_IDS)[number];

/** File extension of the shipped audio files. */
export const AUDIO_EXTENSION = "mp3";
const MP3_PADDING = 0.03;

export interface AudioOptions {
  muted: boolean;
  musicVolume: number;
  sfxVolume: number;
}

type AudioContextCtor = typeof AudioContext;

// Shared across game instances so several games on a page (or StrictMode
// remounts) download each file once.
const downloads = new Map<string, Promise<ArrayBuffer | null>>();

function download(url: string): Promise<ArrayBuffer | null> {
  let promise = downloads.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .catch(() => null);
    downloads.set(url, promise);
  }
  return promise;
}

/**
 * WebAudio playback. Files are downloaded right away, but the AudioContext is
 * only created on the first user gesture (browser autoplay policy), then the
 * downloads are decoded. Missing files are skipped silently.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private wantMusic = false;
  private readonly downloads = new Map<SoundId, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private muted: boolean;
  private disposed = false;

  constructor(
    baseUrl: string,
    private readonly options: AudioOptions,
  ) {
    this.muted = options.muted;
    if (typeof fetch === "undefined") return;
    for (const id of SOUND_IDS) this.downloads.set(id, download(`${baseUrl}audio/${id}.${AUDIO_EXTENSION}`));
  }

  /** Call from a user gesture (click / key press). */
  unlock(): void {
    if (this.disposed) return;
    if (!this.ctx) {
      const Ctor: AudioContextCtor | undefined =
        globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.options.sfxVolume;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.options.musicVolume;
      this.music.connect(this.master);
      void this.decodeAll();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private async decodeAll(): Promise<void> {
    await Promise.all(
      [...this.downloads].map(async ([id, download]) => {
        const data = await download;
        if (!data || !this.ctx || this.disposed) return;
        try {
          // decodeAudioData detaches the buffer, so decode a copy (StrictMode safety).
          this.buffers.set(id, await this.ctx.decodeAudioData(data.slice(0)));
          if (id === "music" && this.wantMusic) this.startMusic();
        } catch {
          // Unsupported or corrupt file: play without this sound.
        }
      }),
    );
  }

  play(id: Exclude<SoundId, "music">, volume = 1, rate = 1): void {
    const buffer = this.buffers.get(id);
    if (!this.ctx || !this.sfx || !buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.sfx);
    source.start();
  }

  startMusic(): void {
    this.wantMusic = true;
    const buffer = this.buffers.get("music");
    if (!this.ctx || !this.music || !buffer || this.musicSource) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Skip the MP3 encoder padding at both ends so the loop has no audible gap.
    if (buffer.duration > 1) {
      source.loopStart = MP3_PADDING;
      source.loopEnd = buffer.duration - MP3_PADDING;
    }
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setValueAtTime(0, this.ctx.currentTime);
    this.music.gain.linearRampToValueAtTime(this.options.musicVolume, this.ctx.currentTime + 1.2);
    source.connect(this.music);
    source.start();
    this.musicSource = source;
  }

  stopMusic(fade = 0.6): void {
    this.wantMusic = false;
    const source = this.musicSource;
    if (!source || !this.ctx || !this.music) return;
    this.musicSource = null;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(this.music.gain.value, t);
    this.music.gain.linearRampToValueAtTime(0, t + fade);
    source.stop(t + fade + 0.05);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  suspend(): void {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  dispose(): void {
    this.disposed = true;
    this.musicSource?.stop();
    this.musicSource = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
