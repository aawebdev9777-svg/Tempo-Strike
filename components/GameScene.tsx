/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Grid, PerspectiveCamera, Stars, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { GameStatus, NoteData, HandPositions, COLORS, CutDirection, ShopItem, ScoreTier, HandType } from '../types';
import { PLAYER_Z, SPAWN_Z, MISS_Z, DIRECTION_VECTORS, LANE_X_POSITIONS, LAYER_Y_POSITIONS, SONG_BPM } from '../constants';
import Note from './Note';
import Saber from './Saber';
import ScoreFloater from './ScoreFloater';

interface GameSceneProps {
  gameStatus: GameStatus;
  audioRef: React.RefObject<HTMLAudioElement>;
  handPositionsRef: React.MutableRefObject<any>;
  chart: NoteData[];
  noteSpeed: number;
  onNoteHit: (note: NoteData, tier: ScoreTier) => void;
  onNoteMiss: (note: NoteData) => void;
  onSongEnd: () => void;
  equippedSaber: ShopItem;
  combo: number;
}

const BEAT_TIME = 60 / SONG_BPM;

interface PopupData {
    id: number;
    position: THREE.Vector3;
    text: string;
    color: string;
}

// --- WORLD COMPONENTS ---

const Mountains: React.FC<{ color: THREE.Color }> = ({ color }) => {
    const mountains = useMemo(() => {
        const m = [];
        // Side Mountains (Close)
        for (let i = 0; i < 15; i++) {
             const isLeft = i % 2 === 0;
             const xBase = isLeft ? -50 : 50;
             const zBase = -30 - (i * 5);
             
             m.push({
                 pos: [xBase + (Math.random() - 0.5) * 30, -10, zBase + (Math.random() - 0.5) * 20] as [number, number, number],
                 scale: [15 + Math.random() * 10, 25 + Math.random() * 20, 15 + Math.random() * 10] as [number, number, number],
                 rot: [0, Math.random() * Math.PI, 0] as [number, number, number]
             });
        }
        
        // Distant Horizon Mountains
        for (let i = 0; i < 30; i++) {
            const x = (Math.random() - 0.5) * 300;
            const z = -100 - Math.random() * 60;
            m.push({
                pos: [x, -15, z] as [number, number, number],
                scale: [30 + Math.random() * 30, 40 + Math.random() * 40, 30 + Math.random() * 30] as [number, number, number],
                rot: [0, Math.random() * Math.PI, 0] as [number, number, number]
            });
        }
        return m;
    }, []);

    return (
        <group>
            {mountains.map((m, i) => (
                <mesh key={i} position={m.pos} rotation={m.rot} scale={m.scale}>
                    <coneGeometry args={[1, 1, 4]} />
                    <meshStandardMaterial 
                        color="#050510" 
                        roughness={0.9} 
                        metalness={0.2} 
                        flatShading 
                    />
                </mesh>
            ))}
            {/* Fog to blend mountains into distance */}
            <fog attach="fog" args={['#000000', 30, 150]} />
        </group>
    );
};

const HexTunnel: React.FC<{ speed: number, color: THREE.Color, intensity: number }> = ({ speed, color, intensity }) => {
    const count = 12;
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        const t = state.clock.elapsedTime * (speed * 0.5); // Slower, more majestic rotation

        for (let i = 0; i < count; i++) {
            const zOffset = (i * 12) % 120; 
            let z = (t * 20 + zOffset) % 120; 
            z = z - 100;

            dummy.position.set(0, 0, z);
            // Rotate the hexagons as they move
            dummy.rotation.set(0, 0, i * 0.2 + t * 0.1); 
            
            // Pulse scale to the beat
            const beatScale = 1 + (intensity * 0.05);
            dummy.scale.set(beatScale, beatScale, 1);
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        (meshRef.current.material as THREE.MeshStandardMaterial).color = color;
        (meshRef.current.material as THREE.MeshStandardMaterial).emissive = color;
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + intensity;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <cylinderGeometry args={[12, 12, 1, 6, 1, true]} />
            <meshStandardMaterial 
                transparent 
                opacity={0.1} 
                toneMapped={false} 
                side={THREE.DoubleSide} 
                wireframe 
            />
        </instancedMesh>
    );
};

const MovingFloor: React.FC<{ speed: number }> = ({ speed }) => {
    const gridRef = useRef<THREE.Group>(null);
    
    useFrame((state, delta) => {
        if (gridRef.current) {
            // Move grid towards camera to simulate speed
            gridRef.current.position.z += speed * delta;
            // Reset position to create infinite loop
            if (gridRef.current.position.z > 10) {
                gridRef.current.position.z = 0;
            }
        }
    });

    return (
        <group ref={gridRef} position={[0, -2, -20]}>
             <Grid 
                args={[40, 100]} 
                cellThickness={0.2} 
                cellColor="#222" 
                sectionSize={5} 
                sectionThickness={1} 
                sectionColor="#0044aa" 
                fadeDistance={60} 
            />
        </group>
    );
}

const GameScene: React.FC<GameSceneProps> = ({ 
    gameStatus, 
    audioRef, 
    handPositionsRef, 
    chart,
    noteSpeed,
    onNoteHit,
    onNoteMiss,
    onSongEnd,
    equippedSaber,
    combo
}) => {
  const [notesState, setNotesState] = useState<NoteData[]>(chart);
  const [currentTime, setCurrentTime] = useState(0);
  
  const [popups, setPopups] = useState<PopupData[]>([]);
  const popupIdCounter = useRef(0);

  const activeNotesRef = useRef<NoteData[]>([]);
  const nextNoteIndexRef = useRef(0);
  const shakeIntensity = useRef(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  // Audio Reactive Refs
  const audioPulse = useRef(0);
  // We pass this ref to children so they can react to audio without re-rendering props
  const intensityRef = useRef(0); 
  const worldColor = useRef(new THREE.Color("#001133"));

  const vecA = useMemo(() => new THREE.Vector3(), []);
  const vecB = useMemo(() => new THREE.Vector3(), []);

  const isUltimate = equippedSaber.id === 'ultimate_eudin';

  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING) {
        activeNotesRef.current = [];
        nextNoteIndexRef.current = 0;
        shakeIntensity.current = 0;
        setNotesState([...chart]);
        setPopups([]);
    }
  }, [gameStatus, chart]);

  const addPopup = (position: THREE.Vector3, text: string, color: string) => {
      const id = popupIdCounter.current++;
      setPopups(prev => [...prev, { id, position: position.clone(), text, color }]);
  };

  const removePopup = (id: number) => {
      setPopups(prev => prev.filter(p => p.id !== id));
  };

  const handleHit = (note: NoteData, tier: ScoreTier) => {
      if (tier === ScoreTier.PERFECT) shakeIntensity.current = 0.4;
      else if (tier === ScoreTier.GOLD_STAR) shakeIntensity.current = 0.5;
      else if (tier === ScoreTier.GREAT) shakeIntensity.current = 0.25;
      else if (tier === ScoreTier.WRONG_SABER) shakeIntensity.current = 0.2;
      else shakeIntensity.current = 0.1;

      onNoteHit(note, tier);
      
      const x = LANE_X_POSITIONS[note.lineIndex];
      const y = LAYER_Y_POSITIONS[note.lineLayer];
      
      let text = tier.toString();
      let color = "#ffffff";

      switch (tier) {
          case ScoreTier.PERFECT: text = "PERFECT"; color = "#FDB931"; break;
          case ScoreTier.GREAT: text = "GREAT"; color = "#3b82f6"; break;
          case ScoreTier.GOOD: text = "GOOD"; color = "#22c55e"; break;
          case ScoreTier.OK: text = "OK"; color = "#eab308"; break;
          case ScoreTier.BAD: text = "SLOPPY"; color = "#9ca3af"; break;
          case ScoreTier.WRONG_SABER: text = "WRONG SABER"; color = "#ff4444"; break;
          case ScoreTier.GOLD_STAR: text = "JACKPOT!"; color = "#FFD700"; break;
      }
      
      addPopup(new THREE.Vector3(x, y + 0.5, -2), text, color);
  };

  const handleMiss = (note: NoteData) => {
      onNoteMiss(note);
      const x = LANE_X_POSITIONS[note.lineIndex];
      const y = LAYER_Y_POSITIONS[note.lineLayer];
      addPopup(new THREE.Vector3(x, y, -1), "MISS", "#ff4444");
  };

  useFrame((state, delta) => {
    const time = audioRef.current?.currentTime || 0;
    
    // --- Audio Reactive Visuals ---
    if (audioRef.current && gameStatus === GameStatus.PLAYING && !audioRef.current.paused) {
        const beatPhase = (time % BEAT_TIME) / BEAT_TIME;
        // Sharp pulse at start of beat
        audioPulse.current = Math.pow(1 - beatPhase, 3); 
    } else {
        // Idle breathing
        audioPulse.current = (Math.sin(state.clock.elapsedTime) * 0.5 + 0.5) * 0.2;
    }
    
    // Update shared ref for children
    intensityRef.current = audioPulse.current;

    // Dynamic color shifting based on Combo
    let targetColor = new THREE.Color("#0033cc"); 
    if (combo > 50) targetColor.set("#FF8800"); 
    else if (combo > 30) targetColor.set("#cc00cc"); 
    else if (combo > 10) targetColor.set("#00ccaa"); 
    
    // In IDLE, just blue
    if (gameStatus !== GameStatus.PLAYING) targetColor.set("#001133");

    worldColor.current.lerp(targetColor, delta * 2);

    // Camera Shake Logic
    if (shakeIntensity.current > 0 && cameraRef.current) {
        const shake = shakeIntensity.current;
        cameraRef.current.position.set(
            (Math.random() - 0.5) * shake,
            1.8 + (Math.random() - 0.5) * shake,
            4 + (Math.random() - 0.5) * shake
        );
        shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 10 * delta);
    } else if (cameraRef.current) {
        // Subtle idle sway
        cameraRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.2;
        cameraRef.current.position.y = 1.8 + Math.cos(state.clock.elapsedTime * 0.3) * 0.1;
        cameraRef.current.lookAt(0, 0, -10);
    }

    if (gameStatus !== GameStatus.PLAYING || !audioRef.current) return;
    
    setCurrentTime(time);
    if (audioRef.current.ended) {
        onSongEnd();
        return;
    }

    // --- Note Spawning & Collision (Same Logic) ---
    const spawnAheadTime = Math.abs(SPAWN_Z - PLAYER_Z) / noteSpeed;
    while (nextNoteIndexRef.current < notesState.length) {
      const nextNote = notesState[nextNoteIndexRef.current];
      if (nextNote.time - spawnAheadTime <= time) {
        activeNotesRef.current.push(nextNote);
        nextNoteIndexRef.current++;
      } else {
        break;
      }
    }

    const hands = handPositionsRef.current as HandPositions;
    for (let i = activeNotesRef.current.length - 1; i >= 0; i--) {
        const note = activeNotesRef.current[i];
        if (note.hit || note.missed) continue;

        const timeDiff = note.time - time; 
        const currentZ = PLAYER_Z - (timeDiff * noteSpeed);

        if (currentZ > MISS_Z) {
            note.missed = true;
            handleMiss(note);
            activeNotesRef.current.splice(i, 1);
            continue;
        }

        const zWindow = 2.5 * equippedSaber.perks.hitWindow;
        if (currentZ > PLAYER_Z - zWindow && currentZ < PLAYER_Z + (zWindow * 0.5)) {
            const notePos = vecA.set(LANE_X_POSITIONS[note.lineIndex], LAYER_Y_POSITIONS[note.lineLayer], currentZ);
            const hitRadius = 1.2 * equippedSaber.perks.hitWindow;

            // Check collision with BOTH hands
            const correctHandType = note.type;
            const wrongHandType = correctHandType === 'left' ? 'right' : 'left';

            const correctHandPos = correctHandType === 'left' ? hands.left : hands.right;
            const wrongHandPos = wrongHandType === 'left' ? hands.left : hands.right;

            let hitCorrect = false;
            let hitWrong = false;

            // Check Correct Hand First
            if (correctHandPos) {
                 const distXY = Math.sqrt(Math.pow(correctHandPos.x - notePos.x, 2) + Math.pow(correctHandPos.y - notePos.y, 2));
                 if (distXY < hitRadius) {
                     hitCorrect = true;
                 }
            }

            // Check Wrong Hand (if correct hand didn't hit it yet)
            // If both hit in the same frame, we prioritize the Correct hit to be generous.
            if (wrongHandPos && !hitCorrect) {
                 const distXY = Math.sqrt(Math.pow(wrongHandPos.x - notePos.x, 2) + Math.pow(wrongHandPos.y - notePos.y, 2));
                 if (distXY < hitRadius) {
                     hitWrong = true;
                 }
            }

            // --- GOLD STAR LOGIC (ANY HAND) ---
            if (note.isGoldStar) {
                if (hitCorrect || hitWrong) {
                    note.hit = true;
                    note.hitTime = time;
                    handleHit(note, ScoreTier.GOLD_STAR);
                    activeNotesRef.current.splice(i, 1);
                }
                continue;
            }

            // --- NORMAL LOGIC ---
            if (hitCorrect) {
                 const handVel = correctHandType === 'left' ? hands.leftVelocity : hands.rightVelocity;
                 const distXY = Math.sqrt(Math.pow(correctHandPos!.x - notePos.x, 2) + Math.pow(correctHandPos!.y - notePos.y, 2));
                 
                 const speed = handVel.length();
                 const precision = Math.max(0, 1 - (distXY / hitRadius));
                 let angleScore = 1.0; 
                 if (note.cutDirection !== CutDirection.ANY) {
                     const requiredDir = DIRECTION_VECTORS[note.cutDirection];
                     vecB.copy(handVel).normalize();
                     angleScore = vecB.dot(requiredDir);
                 }

                 let tier = ScoreTier.OK;
                 if (isUltimate) {
                     tier = ScoreTier.PERFECT;
                 } else {
                     const MIN_SPEED = 0.3;
                     if (speed < MIN_SPEED) tier = ScoreTier.BAD;
                     else if (note.cutDirection !== CutDirection.ANY && angleScore < -0.2) tier = ScoreTier.BAD;
                     else {
                         if (precision > 0.7 && speed > 2.0 && angleScore > 0.5) tier = ScoreTier.PERFECT;
                         else if (precision > 0.5 && speed > 1.0) tier = ScoreTier.GREAT;
                         else if (precision > 0.3) tier = ScoreTier.GOOD;
                         else tier = ScoreTier.OK;
                     }
                 }

                 note.hit = true;
                 note.hitTime = time;
                 handleHit(note, tier);
                 activeNotesRef.current.splice(i, 1);
            } else if (hitWrong) {
                 // Trigger Penalty for Wrong Saber
                 note.hit = true;
                 note.hitTime = time;
                 handleHit(note, ScoreTier.WRONG_SABER);
                 activeNotesRef.current.splice(i, 1);
            }
        }
    }
  });

  const visibleNotes = useMemo(() => {
     return notesState.filter(n => 
         !n.missed && 
         (!n.hit || (currentTime - (n.hitTime || 0) < 0.5)) &&
         (n.time - currentTime) < 5 && 
         (n.time - currentTime) > -2 
     );
  }, [notesState, currentTime, noteSpeed]);

  const leftHandPosRef = useRef<THREE.Vector3 | null>(null);
  const rightHandPosRef = useRef<THREE.Vector3 | null>(null);
  const leftHandVelRef = useRef<THREE.Vector3 | null>(null);
  const rightHandVelRef = useRef<THREE.Vector3 | null>(null);

  useFrame(() => {
     leftHandPosRef.current = handPositionsRef.current.left;
     rightHandPosRef.current = handPositionsRef.current.right;
     leftHandVelRef.current = handPositionsRef.current.leftVelocity;
     rightHandVelRef.current = handPositionsRef.current.rightVelocity;
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.8, 4]} fov={70} />
      <color attach="background" args={['#000000']} />
      
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 5, 5]} intensity={1 + audioPulse.current * 2} color={worldColor.current} />
      <spotLight position={[0, 10, -50]} angle={0.5} penumbra={1} intensity={10} color={worldColor.current} />

      {/* World FX */}
      <Mountains color={worldColor.current} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      
      {/* Moving Environment */}
      <HexTunnel speed={noteSpeed} color={worldColor.current} intensity={audioPulse.current} />
      <MovingFloor speed={noteSpeed} />
      
      {/* Atmosphere Particles */}
      <Sparkles count={200} scale={30} size={5} speed={0.4} opacity={0.5} color={worldColor.current} />

      {/* Sabers with Combo & Intensity injection */}
      <Saber 
         type="left" 
         positionRef={leftHandPosRef} 
         velocityRef={leftHandVelRef} 
         model={equippedSaber.id} 
         combo={combo}
         intensityRef={intensityRef}
      />
      <Saber 
         type="right" 
         positionRef={rightHandPosRef} 
         velocityRef={rightHandVelRef} 
         model={equippedSaber.id} 
         combo={combo}
         intensityRef={intensityRef}
      />

      {visibleNotes.map(note => (
          <Note 
             key={note.id} 
             data={note} 
             zPos={PLAYER_Z - ((note.time - currentTime) * noteSpeed)} 
             currentTime={currentTime} 
             saberModel={equippedSaber.id}
          />
      ))}

      {popups.map(p => (
          <ScoreFloater 
            key={p.id} 
            position={p.position} 
            text={p.text} 
            color={p.color} 
            onComplete={() => removePopup(p.id)} 
          />
      ))}
    </>
  );
};

export default GameScene;