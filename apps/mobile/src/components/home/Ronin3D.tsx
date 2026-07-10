import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { AnimationMixer, LoopOnce } from 'three';
import type { AnimationAction, Mesh } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { RoninMood } from '../../domain/ronin/types';
import { RONIN_MODEL, getMoodClip, isOneShotClip } from '../../domain/ronin/roninModel';

/**
 * 3D Ronin companion — the ONLY module that imports three/R3F/expo-gl.
 * RoninCharacter require()s this lazily behind RONIN_3D_ENABLED so a dev
 * client without the expo-gl native module falls back to static art instead
 * of crashing at bundle evaluation.
 *
 * Scene setup (camera, lights, mixer/blink logic) is a direct port of the
 * validated web implementation from the avatar lab handoff.
 */

export interface Ronin3DProps {
  mood: RoninMood;
  style?: ViewStyle;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

const BLINK_DURATION = 0.26;
const CROSSFADE_S = 0.35;

// GLB → three.js scene. Native has no reliable fetch(file://), so read the
// bundled asset's bytes via expo-file-system and parse in-memory. The GLB is
// self-contained (no external textures), so parseAsync needs no resource path.
async function loadRoninGltf(): Promise<GLTF> {
  const asset = Asset.fromModule(RONIN_MODEL);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const bytes = await new File(uri).bytes();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new GLTFLoader().parseAsync(buffer as ArrayBuffer, '');
}

interface RoninModelProps {
  gltf: GLTF;
  mood: RoninMood;
  onReady?: () => void;
}

function RoninModel({ gltf, mood, onReady }: RoninModelProps) {
  const mixer = useMemo(() => new AnimationMixer(gltf.scene), [gltf]);
  const actions = useMemo(() => {
    const map: Record<string, AnimationAction> = {};
    for (const clip of gltf.animations) map[clip.name] = mixer.clipAction(clip);
    return map;
  }, [gltf, mixer]);
  const eyes = useMemo(() => {
    // Traversal, not name lookup: v1 multi-primitive eyes load as Groups
    // whose child meshes hold the morphs (see Ronin3DDom for details).
    const found: { mesh: Mesh; blinkIndex: number }[] = [];
    gltf.scene.traverse((node) => {
      const mesh = node as Mesh;
      const blinkIndex = mesh.morphTargetDictionary?.eyeBlink;
      if (blinkIndex !== undefined && mesh.morphTargetInfluences) {
        found.push({ mesh, blinkIndex });
      }
    });
    return found;
  }, [gltf]);

  const current = useRef<AnimationAction | null>(null);
  const blink = useRef({ nextAt: 2.5 });

  useEffect(() => {
    onReady?.();
    // fire once on mount — parity with the web implementation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { animation, fallbackAnimation } = getMoodClip(mood);
    const clipName = actions[animation] ? animation : fallbackAnimation;
    const next = actions[clipName];
    if (!next || next === current.current) return;
    next.reset();
    if (isOneShotClip(clipName)) {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    if (current.current) next.crossFadeFrom(current.current, CROSSFADE_S, false);
    next.play();
    current.current = next;
  }, [mood, actions]);

  // one-shot clips (resolved_nod) settle back into the state's fallback idle
  useEffect(() => {
    const onFinished = () => {
      const { fallbackAnimation } = getMoodClip(mood);
      const idle = actions[fallbackAnimation];
      if (!idle || !current.current || idle === current.current) return;
      idle.reset();
      idle.crossFadeFrom(current.current, 0.5, false);
      idle.play();
      current.current = idle;
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, actions, mood]);

  useFrame((state, delta) => {
    mixer.update(delta);
    // blink written after mixer.update so it wins over idle_breathing's
    // constant eyeBlink track; skipped while eyes are happily closed
    if (mood === 'resolved' || eyes.length === 0) return;
    const t = state.clock.elapsedTime;
    const b = blink.current;
    if (t >= b.nextAt + BLINK_DURATION) b.nextAt = t + 3 + Math.random() * 4;
    const phase = (t - b.nextAt) / BLINK_DURATION;
    const value = phase >= 0 && phase <= 1 ? 1 - Math.abs(phase * 2 - 1) : 0;
    for (const { mesh, blinkIndex } of eyes) {
      const influences = mesh.morphTargetInfluences;
      if (influences) influences[blinkIndex] = Math.max(influences[blinkIndex], value);
    }
  });

  return <primitive object={gltf.scene} />;
}

// R3F render errors surface through React error boundaries; this keeps a GL
// failure contained so RoninCharacter's static art stays on screen.
class SceneErrorBoundary extends Component<
  { onError?: (error: unknown) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function Ronin3D({ mood, style, onReady, onError }: Ronin3DProps) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let alive = true;
    loadRoninGltf()
      .then((loaded) => {
        if (alive) setGltf(loaded);
      })
      .catch((error) => {
        if (alive) onErrorRef.current?.(error);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!gltf) return null;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <SceneErrorBoundary onError={onError}>
        <Canvas
          style={styles.canvas}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 35, position: [0, 0.62, 2.05], near: 0.1, far: 10 }}
          onCreated={({ camera, gl }) => {
            camera.lookAt(0.05, 0.5, 0);
            // transparent clear so the scene art behind the hero shows through
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight position={[-2, 3, 4]} intensity={1.7} color="#fff8ef" />
          <pointLight position={[2.2, 1.4, -2]} intensity={9} color="#aebfff" />
          <pointLight position={[-2.2, 1.2, -1.5]} intensity={5} color="#b9c2d8" />
          <RoninModel gltf={gltf} mood={mood} onReady={onReady} />
        </Canvas>
      </SceneErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  canvas: {
    flex: 1,
  },
});
