export interface LyricLine {
  id?: string;
  text: string;
  translation?: string;
  script?: string;
  startTime: number;
  endTime: number;
  kind?: "lyric" | "instrumental";
  label?: string;
  style?: "default" | "energetic" | "calm" | "intro" | "outro";
  highlight?: boolean;
  highlightStyle?: "glow" | "sparkle" | "heart";
  note?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  coverArtUri?: string;
  palette: [string, string, string];
  source: string;
  lyrics: LyricLine[];
}

export interface DraftLine {
  id: string;
  script: string;
  text: string;
  translation: string;
  startTime: number | null;
  kind?: 'lyric' | 'instrumental';
  label?: string;
}
