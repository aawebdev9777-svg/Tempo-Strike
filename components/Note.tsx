/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { NoteData, COLORS, CutDirection } from '../types';
import { LANE_X_POSITIONS, LAYER_Y_POSITIONS, NOTE_SIZE, DIRECTION_VECTORS } from '../constants';

interface NoteProps {
  data: NoteData;
  zPos: number;
  currentTime: number;
  saberModel: string;
}

// Pre-allocate geometry/material to prevent GC stutter
const particleGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
const shockwaveGeo = new THREE.RingGeometry(0.5, 0.6, 32);

// --- VISUAL COMPONENTS FOR SLASH ---

const GhostSaberCut: React.FC<{ model: string, color: string, time: number, direction: CutDirection }> = ({ model, color, time, direction }) => {
    const groupRef = useRef<THREE.Group>(null);
    const bladeRef = useRef<THREE.Mesh>(null);
    const trailRef = useRef<THREE.Mesh>(null);
    
    // Animation Duration (Swift cut)
    const DURATION = 0.25; 
    
    // Determine motion vectors based on direction
    const { start, end, rotationZ } = useMemo(() => {
        const cutVec = new THREE.Vector3();
        
        switch(direction) {
            case CutDirection.UP: cutVec.set(0, 1, 0); break;
            case CutDirection.DOWN: cutVec.set(0, -1, 0); break;
            case CutDirection.LEFT: cutVec.set(-1, 0, 0); break;
            case CutDirection.RIGHT: cutVec.set(1, 0, 0); break;
            case CutDirection.ANY: 
            default:
                 // Random diagonal for dot notes
                 const angle = Math.random() * Math.PI * 2;
                 cutVec.set(Math.cos(angle), Math.sin(angle), 0);
                 break;
        }

        // Saber moves across the note
        const OFFSET = 2.0;
        const start = cutVec.clone().multiplyScalar(-OFFSET);
        const end = cutVec.clone().multiplyScalar(OFFSET);

        // Blade should be perpendicular to movement
        const angle = Math.atan2(cutVec.y, cutVec.x);
        const rotationZ = angle + Math.PI / 2;

        return { start, end, rotationZ };
    }, [direction]);

    useFrame(() => {
        if (!groupRef.current) return;
        
        if (time > DURATION) {
            groupRef.current.visible = false;
            return;
        }

        const t = time / DURATION;
        // Ease out cubic
        const ease = 1 - Math.pow(1 - t, 3);
        
        // Move the saber group through the cut
        groupRef.current.position.lerpVectors(start, end, ease);
        
        // Scale trail
        if (trailRef.current) {
             trailRef.current.scale.y = 1 + ease * 2;
             (trailRef.current.material as THREE.MeshBasicMaterial).opacity = (1 - ease) * 0.5;
        }

        // Fade out blade at the very end
        if (bladeRef.current) {
             (bladeRef.current.material as THREE.MeshBasicMaterial).opacity = t > 0.8 ? 0 : 1;
        }
    });

    if (time > DURATION) return null;

    // Different geometry based on sword model
    const bladeWidth = model === 'broadsword' ? 0.25 : 0.08;
    const bladeLength = 1.6;

    return (
        <group ref={groupRef} rotation={[0, 0, rotationZ]}>
             {/* The Ghost Blade */}
             <group>
                 {/* Core */}
                 <mesh ref={bladeRef} rotation={[Math.PI/2, 0, 0]}>
                     <boxGeometry args={[bladeWidth, bladeLength, 0.02]} />
                     <meshBasicMaterial color="white" toneMapped={false} transparent />
                 </mesh>
                 {/* Glow Aura */}
                 <mesh rotation={[Math.PI/2, 0, 0]} scale={[1.5, 1.05, 2]}>
                     <boxGeometry args={[bladeWidth, bladeLength, 0.02]} />
                     <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.5} />
                 </mesh>
             </group>
             
             {/* Motion Trail (Behind the blade) */}
             <mesh ref={trailRef} position={[0, -0.5, 0]} rotation={[0, 0, 0]}>
                  <planeGeometry args={[bladeWidth * 2, bladeLength * 0.8]} />
                  <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
             </mesh>
        </group>
    );
};


const ExplosionEffect: React.FC<{ timeSinceHit: number, color: string, saberModel: string, direction: CutDirection }> = ({ timeSinceHit, color, saberModel, direction }) => {
    const groupRef = useRef<THREE.Group>(null);
    const shockwaveRef = useRef<THREE.Mesh>(null);
    const flashRef = useRef<THREE.Mesh>(null);

    // Generate random velocities ONCE per explosion
    const particles = useMemo(() => {
        const count = saberModel === 'pixel' ? 20 : 12;
        return new Array(count).fill(0).map(() => ({
            dir: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
            speed: 5 + Math.random() * 8,
            rotation: new THREE.Vector3(Math.random(), Math.random(), Math.random())
        }));
    }, [saberModel]);

    useFrame(() => {
        if (groupRef.current) {
             // Particles fly out
             groupRef.current.children.forEach((child, i) => {
                 if (i < particles.length) {
                     const p = particles[i];
                     child.position.addScaledVector(p.dir, p.speed * 0.016);
                     child.rotation.x += p.rotation.x * 0.2;
                     child.rotation.y += p.rotation.y * 0.2;
                     child.scale.setScalar(Math.max(0, 1 - timeSinceHit * 2)); // Shrink
                 }
             });
        }

        // Shockwave expansion
        if (shockwaveRef.current) {
            const scale = 1 + timeSinceHit * 15;
            shockwaveRef.current.scale.setScalar(scale);
            shockwaveRef.current.lookAt(0, 1.8, 5); // Face camera
            (shockwaveRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - timeSinceHit * 3);
        }

        // Hit Flash
        if (flashRef.current) {
             if (timeSinceHit < 0.1) {
                 flashRef.current.visible = true;
                 flashRef.current.scale.setScalar(1 + timeSinceHit * 10);
                 (flashRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - (timeSinceHit * 10);
             } else {
                 flashRef.current.visible = false;
             }
        }
    });

    return (
        <group>
            {/* 1. Dynamic Saber Slash Animation */}
            <GhostSaberCut model={saberModel} color={color} time={timeSinceHit} direction={direction} />

            {/* 2. Flash Core */}
            <mesh ref={flashRef}>
                <sphereGeometry args={[0.8, 16, 16]} />
                <meshBasicMaterial color="white" transparent toneMapped={false} />
            </mesh>
            
            {/* 3. Shockwave Ring (Not for pixel) */}
            {saberModel !== 'pixel' && (
                <mesh ref={shockwaveRef} geometry={shockwaveGeo}>
                    <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} toneMapped={false} />
                </mesh>
            )}

            {/* 4. Debris Particles */}
            <group ref={groupRef}>
                {particles.map((_, i) => (
                    <mesh key={i} geometry={particleGeo}>
                        <meshBasicMaterial color={saberModel === 'pixel' ? (i % 2 === 0 ? color : 'white') : color} toneMapped={false} />
                    </mesh>
                ))}
            </group>
        </group>
    );
};

const Note: React.FC<NoteProps> = ({ data, zPos, currentTime, saberModel }) => {
  const color = data.isGoldStar ? '#FFD700' : (data.type === 'left' ? COLORS.left : COLORS.right);
  const meshRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  
  const position: [number, number, number] = useMemo(() => {
     return [
         LANE_X_POSITIONS[data.lineIndex],
         LAYER_Y_POSITIONS[data.lineLayer],
         zPos
     ];
  }, [data.lineIndex, data.lineLayer, zPos]);

  useFrame((state) => {
      if (meshRef.current) {
          // Bobbing effect
          meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 4 + data.lineIndex) * 0.05;
          
          if (data.isGoldStar) {
              // Gold Star Spin
              meshRef.current.rotation.y += 0.05;
              meshRef.current.rotation.z -= 0.02;
          } else {
              // Outer Cage Rotation
              if (outerRef.current) {
                  outerRef.current.rotation.x += 0.02;
                  outerRef.current.rotation.y += 0.03;
              }
              
              // Inner Core Pulse & Counter-Rotation
              if (coreRef.current) {
                  coreRef.current.rotation.x -= 0.04;
                  coreRef.current.rotation.z -= 0.04;
                  
                  // Pulse to beat
                  const proximity = Math.max(0, 1 - Math.abs(zPos) / 20);
                  const scale = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.1 * proximity;
                  coreRef.current.scale.setScalar(scale);
              }
          }
      }
  });

  if (data.missed) return null;

  if (data.hit && data.hitTime) {
      return (
          <group position={position}>
              <ExplosionEffect 
                  timeSinceHit={currentTime - data.hitTime} 
                  color={color} 
                  saberModel={saberModel}
                  direction={data.cutDirection}
              />
          </group>
      );
  }

  // --- RENDER GOLD STAR ---
  if (data.isGoldStar) {
      return (
          <group position={[position[0], position[1], zPos]}>
              <group ref={meshRef}>
                   <Float speed={5} rotationIntensity={2} floatIntensity={1}>
                       {/* The Gold Star Mesh (using octahedron for gem look) */}
                       <mesh>
                           <octahedronGeometry args={[0.5, 0]} />
                           <meshStandardMaterial 
                               color="#FFD700" 
                               emissive="#F4B400"
                               emissiveIntensity={0.8}
                               metalness={1}
                               roughness={0}
                           />
                       </mesh>
                       {/* Glow Halo */}
                       <mesh scale={[1.2, 1.2, 1.2]}>
                           <octahedronGeometry args={[0.5, 0]} />
                           <meshBasicMaterial color="#FFD700" transparent opacity={0.3} wireframe />
                       </mesh>
                   </Float>
                   <Sparkles count={20} scale={1.5} size={6} speed={2} opacity={1} color="#FFFF00" />
              </group>
          </group>
      );
  }

  // --- RENDER NORMAL NOTE ---
  return (
    <group position={[position[0], position[1], zPos]}>
      <group ref={meshRef}>
          {/* 1. Inner Quantum Core (Glowing Cube) */}
          <mesh ref={coreRef}>
              <boxGeometry args={[NOTE_SIZE * 0.7, NOTE_SIZE * 0.7, NOTE_SIZE * 0.7]} />
              <meshBasicMaterial color="white" toneMapped={false} />
              <mesh scale={[1.1, 1.1, 1.1]}>
                  <boxGeometry args={[NOTE_SIZE * 0.7, NOTE_SIZE * 0.7, NOTE_SIZE * 0.7]} />
                  <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} />
              </mesh>
          </mesh>
          
          {/* 2. Glassy Shell */}
          <mesh>
              <boxGeometry args={[NOTE_SIZE, NOTE_SIZE, NOTE_SIZE]} />
              <meshPhysicalMaterial 
                  color={color}
                  transmission={0.2}
                  opacity={0.8}
                  metalness={0.5}
                  roughness={0}
                  clearcoat={1}
                  thickness={0.5}
                  emissive={color}
                  emissiveIntensity={0.2}
              />
          </mesh>

          {/* 3. Outer Wireframe Cage */}
          <mesh ref={outerRef}>
               <boxGeometry args={[NOTE_SIZE * 1.3, NOTE_SIZE * 1.3, NOTE_SIZE * 1.3]} />
               <meshBasicMaterial color={color} wireframe toneMapped={false} transparent opacity={0.3} />
          </mesh>
          
          {/* 4. Directional Indicator (Arrow) */}
          {data.cutDirection !== 4 && (
             <group rotation={[0, 0, 
                 data.cutDirection === 0 ? 0 : 
                 data.cutDirection === 1 ? Math.PI : 
                 data.cutDirection === 2 ? Math.PI/2 : -Math.PI/2
             ]}>
                 <mesh position={[0, 0, NOTE_SIZE/2 + 0.01]}>
                     <coneGeometry args={[0.15, 0.3, 3]} />
                     <meshBasicMaterial color="white" toneMapped={false} />
                 </mesh>
             </group>
          )}
      </group>
    </group>
  );
};

// Strict equality check for performance
export default React.memo(Note, (prev, next) => {
    // Only re-render if hit status changes or position changes significantly
    if (prev.data.hit !== next.data.hit) return false;
    if (prev.data.missed !== next.data.missed) return false;
    return prev.zPos === next.zPos; 
});