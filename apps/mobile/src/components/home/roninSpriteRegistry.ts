import { WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';

export type RoninSpriteClipName =
  | 'walking'
  | 'calm'
  | 'legacyAlert'
  | 'lookAround'
  | 'blinkDip'
  | 'yawn'
  | 'adjustWrap'
  | 'shoulderStretch'
  | 'bow'
  | 'jump';

export interface RoninSpriteClip {
  frames: number[];
  frameDurationMs: number;
  loops: boolean;
  reduceMotionClip: RoninSpriteClipName;
}

const WALK_CYCLE_FRAMES: number[] = [
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-01.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-02.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-03.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-04.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-05.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-06.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-07.png'),
  require('../../../assets/ronin/journey/walk-cycle/ronin-walk-08.png'),
];

const IDLE_CALM_FRAMES: number[] = [
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-01.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-02.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-03.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-04.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-05.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-06.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-07.png'),
  require('../../../assets/ronin/journey-v2/idle-calm/ronin-idle-calm-08.png'),
];

const IDLE_ALERT_FRAMES: number[] = [
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-01.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-02.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-03.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-04.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-05.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-06.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-07.png'),
  require('../../../assets/ronin/journey/idle-alert/ronin-idle-alert-08.png'),
];

const BOW_FRAMES: number[] = [
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-01.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-02.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-03.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-04.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-05.png'),
  require('../../../assets/ronin/journey/tap-reaction/ronin-tap-06.png'),
];

const JUMP_FRAMES: number[] = [
  require('../../../assets/ronin/journey/jump/ronin-jump-01.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-02.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-03.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-04.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-05.png'),
  require('../../../assets/ronin/journey/jump/ronin-jump-06.png'),
];

export const RONIN_SPRITE_CLIPS: Record<RoninSpriteClipName, RoninSpriteClip> = {
  walking: { frames: WALK_CYCLE_FRAMES, frameDurationMs: WALK_CYCLE_FRAME_INTERVAL_MS, loops: true, reduceMotionClip: 'walking' },
  calm: { frames: IDLE_CALM_FRAMES, frameDurationMs: 420, loops: true, reduceMotionClip: 'calm' },
  legacyAlert: { frames: IDLE_ALERT_FRAMES, frameDurationMs: 420, loops: true, reduceMotionClip: 'calm' },
  lookAround: { frames: [], frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  blinkDip: { frames: [], frameDurationMs: 160, loops: false, reduceMotionClip: 'blinkDip' },
  yawn: { frames: [], frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  adjustWrap: { frames: [], frameDurationMs: 150, loops: false, reduceMotionClip: 'calm' },
  shoulderStretch: { frames: [], frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  bow: { frames: BOW_FRAMES, frameDurationMs: 90, loops: false, reduceMotionClip: 'bow' },
  jump: { frames: JUMP_FRAMES, frameDurationMs: 90, loops: false, reduceMotionClip: 'jump' },
};
