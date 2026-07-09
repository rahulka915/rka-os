'use dom';

import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  Clock,
  DirectionalLight,
  LoopOnce,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
} from 'three';
import type { AnimationAction, Mesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { DOMProps } from 'expo/dom';

/**
 * 3D Ronin companion — DOM-component variant ('use dom'): runs web three.js
 * inside Expo's dom-webview, so it needs NO native modules beyond what every
 * SDK 57 dev client already ships. Scene setup (camera, lights, mixer, blink,
 * one-shot settle) is the same validated port as the parked native Ronin3D.
 *
 * This module bundles for the web platform: keep it free of react-native and
 * app-domain imports. The RN side resolves mood → clip names (getMoodClip)
 * and passes primitives only.
 */

export interface Ronin3DDomProps {
  /** Bundled GLB, base64-encoded (427 KB model → ~570 KB string). */
  glbBase64: string;
  /** Clip to play; crossfades on change. */
  animation: string;
  /** Idle to settle into after a one-shot clip finishes. */
  fallbackAnimation: string;
  /** Whether `animation` plays once (resolved_nod) instead of looping. */
  oneShot: boolean;
  /** Procedural blink; disabled while eyes are happily closed (resolved). */
  blinkEnabled: boolean;
  /** Whether the render loop keeps scheduling frames. Defaults to true. */
  active?: boolean;
  /** DOM-component function props bridge asynchronously — must return Promises. */
  onSceneReady?: () => Promise<void>;
  onSceneError?: (message: string) => Promise<void>;
  dom?: DOMProps;
}

const BLINK_DURATION = 0.26;
const CROSSFADE_S = 0.35;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface ClipTarget {
  animation: string;
  fallbackAnimation: string;
  oneShot: boolean;
  blinkEnabled: boolean;
}

export default function Ronin3DDom({
  glbBase64,
  animation,
  fallbackAnimation,
  oneShot,
  blinkEnabled,
  active = true,
  onSceneReady,
  onSceneError,
}: Ronin3DDomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // The render loop reads the latest target each frame — no effect-ordering
  // races between async scene setup and prop changes.
  const targetRef = useRef<ClipTarget>({ animation, fallbackAnimation, oneShot, blinkEnabled });
  const activeRef = useRef(active);
  activeRef.current = active;
  targetRef.current = { animation, fallbackAnimation, oneShot, blinkEnabled };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    let frame = 0;
    let renderer: WebGLRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      try {
        const gltf = await new GLTFLoader().parseAsync(base64ToArrayBuffer(glbBase64), '');
        if (disposed) return;

        const scene = new Scene();
        scene.add(gltf.scene);

        const camera = new PerspectiveCamera(35, 1, 0.1, 10);
        camera.position.set(0, 0.62, 2.05);
        camera.lookAt(0.05, 0.5, 0);

        // The character's albedo is near-black (black garb by design), so
        // punctual lights alone leave him a flat silhouette in r185's
        // physical light units. A neutral studio environment map does the
        // heavy lifting (matches the lab preview look); the directionals add
        // the warm key and the cool rim that separate him from dark scenes.
        scene.add(new AmbientLight(0xffffff, 0.65));
        const sun = new DirectionalLight(0xfff8ef, 2.4);
        sun.position.set(-2, 3, 4);
        scene.add(sun);
        const rim = new DirectionalLight(0xdfe9ff, 2.2);
        rim.position.set(2.2, 2.4, -2.5);
        scene.add(rim);
        const fill = new PointLight(0xb9c2d8, 30);
        fill.position.set(-2.2, 1.2, -1.5);
        scene.add(fill);

        renderer = new WebGLRenderer({ alpha: true, antialias: true });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.toneMapping = ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const pmrem = new PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        pmrem.dispose();

        const resize = () => {
          if (!renderer) return;
          const width = container.clientWidth || 1;
          const height = container.clientHeight || 1;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);

        const mixer = new AnimationMixer(gltf.scene);
        const actions: Record<string, AnimationAction> = {};
        for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);

        const eyes: { mesh: Mesh; blinkIndex: number }[] = [];
        for (const name of ['Eye_L', 'Eye_R']) {
          const mesh = gltf.scene.getObjectByName(name) as Mesh | null;
          const blinkIndex = mesh?.morphTargetDictionary?.eyeBlink;
          if (mesh && blinkIndex !== undefined) eyes.push({ mesh, blinkIndex });
        }

        let current: AnimationAction | null = null;
        let currentName = '';
        const playClip = (name: string, once: boolean) => {
          const next = actions[name];
          if (!next || next === current) return;
          next.reset();
          if (once) {
            next.setLoop(LoopOnce, 1);
            next.clampWhenFinished = true;
          }
          if (current) next.crossFadeFrom(current, CROSSFADE_S, false);
          next.play();
          current = next;
          currentName = name;
        };

        // one-shot clips settle back into the mood's fallback idle
        mixer.addEventListener('finished', () => {
          const { fallbackAnimation: idleName } = targetRef.current;
          const idle = actions[idleName];
          if (!idle || !current || idle === current) return;
          idle.reset();
          idle.crossFadeFrom(current, 0.5, false);
          idle.play();
          current = idle;
          currentName = idleName;
        });

        const clock = new Clock();
        const blinkState = { nextAt: 2.5 };

        const animate = () => {
          if (disposed || !renderer) return;
          frame = requestAnimationFrame(animate);
          if (!activeRef.current) return;

          const target = targetRef.current;
          const wanted = actions[target.animation] ? target.animation : target.fallbackAnimation;
          if (wanted !== currentName && !(current && target.oneShot && currentName === target.fallbackAnimation)) {
            playClip(wanted, target.oneShot && wanted === target.animation);
          }

          mixer.update(clock.getDelta());

          // blink after mixer.update so it wins over idle clips' eyeBlink track
          if (target.blinkEnabled && eyes.length > 0) {
            const t = clock.elapsedTime;
            if (t >= blinkState.nextAt + BLINK_DURATION) blinkState.nextAt = t + 3 + Math.random() * 4;
            const phase = (t - blinkState.nextAt) / BLINK_DURATION;
            const value = phase >= 0 && phase <= 1 ? 1 - Math.abs(phase * 2 - 1) : 0;
            for (const { mesh, blinkIndex } of eyes) {
              const influences = mesh.morphTargetInfluences;
              if (influences) influences[blinkIndex] = Math.max(influences[blinkIndex], value);
            }
          }

          renderer.render(scene, camera);
        };
        animate();

        console.log('[RONIN3D_DOM] scene ready — clips:', Object.keys(actions).join(', '));
        void onSceneReady?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log('[RONIN3D_DOM] scene error —', message);
        void onSceneError?.(message);
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
    };
    // The GLB and callbacks are stable for the component's lifetime; clip
    // changes flow through targetRef without rebuilding the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbBase64]);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: 'transparent' }} />;
}
