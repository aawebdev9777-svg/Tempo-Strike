/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Grid, PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { GameStatus, NoteData, HandPositions, COLORS, CutDirection, ShopItem } from '../types';
import { PLAYER_Z, SPAWN_Z, MISS_Z, NOTE_SPEED, DIRECTION_VECTORS, LANE_X_POSITIONS, LAYER_Y_POSITIONS, SONG_BPM } from '../constants';
import Note from './Note';
import Saber from './Saber';
import ScoreFloater from './ScoreFloater';

interface GameSceneProps {
  gameStatus: GameStatus;
  audioRef: React.RefObject<HTMLAudioElement>;
  handPositionsRef: React.MutableRefObject<any>;
  chart: NoteData[];
  onNoteHit: (note: NoteData, goodCut: boolean) => void;
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

// --- CYBER TUNNEL COMPONENT ---
const CyberTunnel: React.FC<{ speed: number, color: THREE.Color }> = ({ speed, color }) => {
    const count = 15;
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useFrame((state) => {
        if (!meshRef.current) return;
        
        const t = state.clock.elapsedTime * speed;

        for (let i = 0; i < count; i++) {
            // Distribute rings along Z
            const zOffset = (i * 10) % 150; 
            // Move them towards player (positive Z direction usually, but here we move world past player)
            let z = (t * 20 + zOffset) % 150; 
            z = z - 120; // Shift range to be in front and behind

            dummy.position.set(0, 0, z);
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, 0, i * 0.5 + t * 0.2); // Rotate rings
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
            
            // Fade out as they get close/behind
            const dist = Math.abs(z - PLAYER_Z);
            const scale = Math.max(0, Math.min(1, (dist - 5) / 50)); 
            // We can't easily change opacity per instance without custom shader, 
            // so we scale them down to 0 when they get too close/far
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        (meshRef.current.material as THREE.MeshStandardMaterial).color = color;
        (meshRef.current.material as THREE.MeshStandardMaterial).emissive = color;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <torusGeometry args={[8, 0.2, 8, 32]} />
            <meshStandardMaterial transparent opacity={0.3} toneMapped={false} emissiveIntensity={2} />
        </instancedMesh>
    );
};

const GameScene: React.FC<GameSceneProps> = ({ 
    gameStatus, 
    audioRef, 
    handPositionsRef, 
    chart,
    onNoteHit,
    onNoteMiss,
    onSongEnd,
    equippedSaber,
    combo
}) => {
  const [notesState, setNotesState] = useState<NoteData[]>(chart);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Floating Text System
  const [popups, setPopups] = useState<PopupData[]>([]);
  const popupIdCounter = useRef(0);

  const activeNotesRef = useRef<NoteData[]>([]);
  const nextNoteIndexRef = useRef(0);
  const shakeIntensity = useRef(0);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  
  // Environment Refs
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const tunnelColor = useRef(new THREE.Color("#3b82f6"));

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

  const handleHit = (note: NoteData, goodCut: boolean) => {
      shakeIntensity.current = goodCut ? 0.3 : 0.15;
      onNoteHit(note, goodCut);
      
      // Calculate world position for popup
      const x = LANE_X_POSITIONS[note.lineIndex];
      const y = LAYER_Y_POSITIONS[note.lineLayer];
      // Note is hit roughly at PLAYER_Z (0), maybe slightly offset
      
      const scoreText = goodCut ? "PERFECT" : "BAD CUT";
      const color = goodCut ? "#ffffff" : "#ff4444";
      
      addPopup(new THREE.Vector3(x, y + 0.5, -2), scoreText, color);
  };

  const handleMiss = (note: NoteData) => {
      onNoteMiss(note);
      const x = LANE_X_POSITIONS[note.lineIndex];
      const y = LAYER_Y_POSITIONS[note.lineLayer];
      addPopup(new THREE.Vector3(x, y, -1), "MISS", "#ff0000");
  };

  useFrame((state, delta) => {
    // --- Dynamic Audio Visuals & Environment ---
    if (audioRef.current && gameStatus === GameStatus.PLAYING) {
        const time = audioRef.current.currentTime;
        const beatPhase = (time % BEAT_TIME) / BEAT_TIME;
        const pulse = Math.pow(1 - beatPhase, 4); 
        
        if (ambientLightRef.current) ambientLightRef.current.intensity = 0.1 + (pulse * 0.3);
        if (spotLightRef.current) spotLightRef.current.intensity = 0.5 + (pulse * 1.5);

        // Combo Color Shift
        let targetColor = new THREE.Color("#3b82f6"); 
        if (combo > 50) targetColor.set("#FFD700"); 
        else if (combo > 30) targetColor.set("#ec4899"); 
        else if (combo > 10) targetColor.set("#8b5cf6"); 

        tunnelColor.current.lerp(targetColor, delta);
        if (spotLightRef.current) spotLightRef.current.color.copy(tunnelColor.current);
        if (fogRef.current) fogRef.current.color.lerp(targetColor, delta * 0.5);
    }

    // --- Camera Shake ---
    if (shakeIntensity.current > 0 && cameraRef.current) {
        const shake = shakeIntensity.current;
        cameraRef.current.position.set(
            (Math.random() - 0.5) * shake,
            1.8 + (Math.random() - 0.5) * shake,
            4 + (Math.random() - 0.5) * shake
        );
        shakeIntensity.current = THREE.MathUtils.lerp(shakeIntensity.current, 0, 10 * delta);
        if (shakeIntensity.current < 0.01) {
             shakeIntensity.current = 0;
             cameraRef.current.position.set(0, 1.8, 4);
        }
    }

    if (gameStatus !== GameStatus.PLAYING || !audioRef.current) return;

    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    if (audioRef.current.ended) {
        onSongEnd();
        return;
    }

    // --- Note Spawning ---
    const spawnAheadTime = Math.abs(SPAWN_Z - PLAYER_Z) / NOTE_SPEED;
    while (nextNoteIndexRef.current < notesState.length) {
      const nextNote = notesState[nextNoteIndexRef.current];
      if (nextNote.time - spawnAheadTime <= time) {
        activeNotesRef.current.push(nextNote);
        nextNoteIndexRef.current++;
      } else {
        break;
      }
    }

    // --- Collision Logic ---
    const hands = handPositionsRef.current as HandPositions;

    for (let i = activeNotesRef.current.length - 1; i >= 0; i--) {
        const note = activeNotesRef.current[i];
        if (note.hit || note.missed) continue;

        const timeDiff = note.time - time; 
        const currentZ = PLAYER_Z - (timeDiff * NOTE_SPEED);

        if (currentZ > MISS_Z) {
            note.missed = true;
            handleMiss(note);
            activeNotesRef.current.splice(i, 1);
            continue;
        }

        if (currentZ > PLAYER_Z - 2.5 && currentZ < PLAYER_Z + 1.5) {
            const handPos = note.type === 'left' ? hands.left : hands.right;
            const handVel = note.type === 'left' ? hands.leftVelocity : hands.rightVelocity;

            if (handPos) {
                 const notePos = vecA.set(
                     LANE_X_POSITIONS[note.lineIndex],
                     LAYER_Y_POSITIONS[note.lineLayer],
                     currentZ
                 );

                 const distXY = Math.sqrt(Math.pow(handPos.x - notePos.x, 2) + Math.pow(handPos.y - notePos.y, 2));

                 const baseRadius = 1.2;
                 const hitRadius = baseRadius * equippedSaber.perks.hitWindow;

                 if (distXY < hitRadius) {
                     let goodCut = true;
                     const speed = handVel.length();

                     if (!isUltimate) {
                         if (note.cutDirection !== CutDirection.ANY) {
                             const requiredDir = DIRECTION_VECTORS[note.cutDirection];
                             vecB.copy(handVel).normalize();
                             const dot = vecB.dot(requiredDir);
                             if (dot < 0.3 || speed < 1.5) goodCut = false;
                         } else {
                             if (speed < 1.5) goodCut = false; 
                         }
                     }

                     note.hit = true;
                     note.hitTime = time;
                     handleHit(note, goodCut);
                     activeNotesRef.current.splice(i, 1);
                 }
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
  }, [notesState, currentTime]);

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
      <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 1.8, 4]} fov={60} />
      <color attach="background" args={['#050505']} />
      <fog ref={fogRef} attach="fog" args={['#050505', 10, 50]} />
      
      <ambientLight ref={ambientLightRef} intensity={0.2} />
      <spotLight ref={spotLightRef} position={[0, 10, 5]} angle={0.5} penumbra={1} intensity={1} castShadow />
      
      <Environment preset="night" />
      
      {/* World Visuals */}
      <CyberTunnel speed={1.0} color={tunnelColor.current} />
      
      <Grid position={[0, 0, 0]} args={[6, 100]} cellThickness={0.1} cellColor="#333" sectionSize={5} sectionThickness={1.5} sectionColor={COLORS.right} fadeDistance={60} infiniteGrid />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[4, 100]} />
          <meshStandardMaterial color="#111" roughness={0.8} metalness={0.5} />
      </mesh>
      
      <Stars radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

      <Saber type="left" positionRef={leftHandPosRef} velocityRef={leftHandVelRef} model={equippedSaber.id} />
      <Saber type="right" positionRef={rightHandPosRef} velocityRef={rightHandVelRef} model={equippedSaber.id} />

      {visibleNotes.map(note => (
          <Note key={note.id} data={note} zPos={PLAYER_Z - ((note.time - currentTime) * NOTE_SPEED)} currentTime={currentTime} />
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