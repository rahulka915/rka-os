import { WALK_CYCLE_FRAME_INTERVAL_MS } from '../../utils/walkCycle';

export type RoninSpriteClipName =
  | 'walking'
  | 'calm'
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
  require('../../../assets/ronin/idle-v2/calm-01.png'),
  require('../../../assets/ronin/idle-v2/calm-02.png'),
  require('../../../assets/ronin/idle-v2/calm-03.png'),
  require('../../../assets/ronin/idle-v2/calm-04.png'),
  require('../../../assets/ronin/idle-v2/calm-05.png'),
  require('../../../assets/ronin/idle-v2/calm-06.png'),
  require('../../../assets/ronin/idle-v2/calm-07.png'),
  require('../../../assets/ronin/idle-v2/calm-08.png'),
];

const LOOK_AROUND_FRAMES: number[] = [
  require('../../../assets/ronin/idle-v2/look-around-01.png'),
  require('../../../assets/ronin/idle-v2/look-around-02.png'),
  require('../../../assets/ronin/idle-v2/look-around-03.png'),
  require('../../../assets/ronin/idle-v2/look-around-04.png'),
  require('../../../assets/ronin/idle-v2/look-around-05.png'),
  require('../../../assets/ronin/idle-v2/look-around-06.png'),
  require('../../../assets/ronin/idle-v2/look-around-07.png'),
  require('../../../assets/ronin/idle-v2/look-around-08.png'),
];

const BLINK_DIP_FRAMES: number[] = [
  require('../../../assets/ronin/idle-v2/blink-dip-01.png'),
  require('../../../assets/ronin/idle-v2/blink-dip-02.png'),
  require('../../../assets/ronin/idle-v2/blink-dip-03.png'),
  require('../../../assets/ronin/idle-v2/blink-dip-04.png'),
  require('../../../assets/ronin/idle-v2/blink-dip-05.png'),
  require('../../../assets/ronin/idle-v2/blink-dip-06.png'),
];

const YAWN_FRAMES: number[] = [
  require('../../../assets/ronin/idle-v2/yawn-01.png'),
  require('../../../assets/ronin/idle-v2/yawn-02.png'),
  require('../../../assets/ronin/idle-v2/yawn-03.png'),
  require('../../../assets/ronin/idle-v2/yawn-04.png'),
  require('../../../assets/ronin/idle-v2/yawn-05.png'),
  require('../../../assets/ronin/idle-v2/yawn-06.png'),
  require('../../../assets/ronin/idle-v2/yawn-07.png'),
  require('../../../assets/ronin/idle-v2/yawn-08.png'),
  require('../../../assets/ronin/idle-v2/yawn-09.png'),
  require('../../../assets/ronin/idle-v2/yawn-10.png'),
];

const ADJUST_WRAP_FRAMES: number[] = [
  require('../../../assets/ronin/idle-v2/adjust-wrap-01.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-02.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-03.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-04.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-05.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-06.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-07.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-08.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-09.png'),
  require('../../../assets/ronin/idle-v2/adjust-wrap-10.png'),
];

const SHOULDER_STRETCH_FRAMES: number[] = [
  require('../../../assets/ronin/idle-v2/shoulder-stretch-01.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-02.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-03.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-04.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-05.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-06.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-07.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-08.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-09.png'),
  require('../../../assets/ronin/idle-v2/shoulder-stretch-10.png'),
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
  lookAround: { frames: LOOK_AROUND_FRAMES, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  blinkDip: { frames: BLINK_DIP_FRAMES, frameDurationMs: 160, loops: false, reduceMotionClip: 'blinkDip' },
  yawn: { frames: YAWN_FRAMES, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  adjustWrap: { frames: ADJUST_WRAP_FRAMES, frameDurationMs: 150, loops: false, reduceMotionClip: 'calm' },
  shoulderStretch: { frames: SHOULDER_STRETCH_FRAMES, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  bow: { frames: BOW_FRAMES, frameDurationMs: 90, loops: false, reduceMotionClip: 'bow' },
  jump: { frames: JUMP_FRAMES, frameDurationMs: 90, loops: false, reduceMotionClip: 'jump' },
};
