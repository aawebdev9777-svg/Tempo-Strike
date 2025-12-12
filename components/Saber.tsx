/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail } from '@react-three/drei';
import * as THREE from 'three';
import { HandType, COLORS } from '../types';
import { BEAT_TIME } from '../constants';

interface SaberProps {
  type: HandType;
  positionRef: React.MutableRefObject<THREE.Vector3 | null>;
  velocityRef: React.MutableRefObject<THREE.Vector3 | null>;
  model: string;
}

const Saber: React.FC<SaberProps> = ({ type, positionRef, velocityRef, model }) => {
  const meshRef = useRef<THREE.Group>(null);
  const color = type === 'left' ? COLORS.left : COLORS.right;
  const isLeft = type === 'left';

  // Ultimate Saber specific refs
  const helixRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  const targetRotation = useRef(new THREE.Euler());
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const targetPos = positionRef.current;
    const velocity = velocityRef.current;

    if (targetPos) {
      meshRef.current.visible = true;
      meshRef.current.position.lerp(targetPos, 0.5); 
      
      // Dynamic Rotation with more sway for feel
      const restingX = -Math.PI / 3.5; 
      const restingY = 0;
      const restingZ = isLeft ? 0.2 : -0.2; 

      let swayX = 0;
      let swayY = 0;
      let swayZ = 0;

      if (velocity) {
          swayX = velocity.y * 0.08; 
          swayZ = -velocity.x * 0.08;
          swayX += velocity.z * 0.04;
      }

      targetRotation.current.set(restingX + swayX, restingY + swayY, restingZ + swayZ);

      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotation.current.x, 0.2);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation.current.y, 0.2);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotation.current.z, 0.2);

      // --- Custom Model Animations ---

      // 1. Ultimate Eudin Pulse (Synced to Beat)
      if (model === 'ultimate_eudin') {
          if (helixRef.current) helixRef.current.rotation.y += delta * 5;
          if (coreRef.current) {
               const beatPhase = (state.clock.elapsedTime % BEAT_TIME) / BEAT_TIME;
               const pulse = Math.pow(1 - beatPhase, 8); 
               
               const baseScale = 1;
               const scale = baseScale + pulse * 0.3;
               coreRef.current.scale.set(scale, 1, scale);
               
               const intensity = 3 + (pulse * 10);
               (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
          }
      }

    } else {
      meshRef.current.visible = false;
    }
  });

  const renderModel = () => {
      switch (model) {
          case 'ultimate_eudin':
              return (
                  <group>
                      <mesh ref={coreRef} position={[0, 0.6, 0]}>
                          <cylinderGeometry args={[0.025, 0.025, 1.4, 16]} />
                          <meshStandardMaterial color="white" emissive={color} emissiveIntensity={5} toneMapped={false} />
                      </mesh>
                      <group ref={helixRef} position={[0, 0.6, 0]}>
                           {[0, 1, 2].map((i) => (
                               <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
                                   <mesh position={[0.08, 0, 0]}>
                                       <boxGeometry args={[0.015, 1.2, 0.015]} />
                                       <meshStandardMaterial color={color} emissive="white" emissiveIntensity={2} wireframe />
                                   </mesh>
                               </group>
                           ))}
                      </group>
                      <mesh position={[0, -0.1, 0]}>
                          <cylinderGeometry args={[0.04, 0.03, 0.25, 8]} />
                          <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} />
                      </mesh>
                      <pointLight color={color} intensity={3} distance={4} decay={2} position={[0, 0.5, 0]} />
                  </group>
              );

          case 'midas':
              return (
                  <group>
                      <mesh position={[0, 0.5, 0]}>
                          <boxGeometry args={[0.08, 1.0, 0.02]} />
                          <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} emissive="#FDB931" emissiveIntensity={0.5} />
                      </mesh>
                      {[0.2, 0.4, 0.6, 0.8].map((y, i) => (
                          <mesh key={i} position={[0, y, 0.015]}>
                               <octahedronGeometry args={[0.03]} />
                               <meshStandardMaterial color={isLeft ? "red" : "blue"} emissive={isLeft ? "red" : "blue"} emissiveIntensity={2} />
                          </mesh>
                      ))}
                      <mesh position={[0, -0.1, 0]}>
                           <cylinderGeometry args={[0.03, 0.03, 0.2, 6]} />
                           <meshStandardMaterial color="#333" />
                      </mesh>
                  </group>
              );

          case 'katana':
              return (
                  <group rotation={[0, Math.PI/2, 0]}>
                       <mesh position={[0, 0.6, 0]}>
                           <boxGeometry args={[0.01, 1.2, 0.06]} />
                           <meshStandardMaterial color="black" metalness={0.9} roughness={0.1} />
                       </mesh>
                       <mesh position={[0.006, 0.6, 0.03]}>
                           <boxGeometry args={[0.002, 1.2, 0.005]} />
                           <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
                       </mesh>
                       <mesh position={[0, 0, 0]}>
                           <cylinderGeometry args={[0.08, 0.08, 0.01, 32]} />
                           <meshStandardMaterial color="#111" />
                       </mesh>
                       <mesh position={[0, -0.15, 0]}>
                           <cylinderGeometry args={[0.02, 0.025, 0.3, 8]} />
                           <meshStandardMaterial color="#222" />
                       </mesh>
                  </group>
              );

          case 'pixel':
              return (
                  <group>
                     {Array.from({ length: 10 }).map((_, i) => (
                         <mesh key={i} position={[0, i * 0.1 + 0.1, 0]}>
                             <boxGeometry args={[0.08, 0.08, 0.08]} />
                             <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
                         </mesh>
                     ))}
                     <mesh position={[0, -0.05, 0]}>
                         <boxGeometry args={[0.06, 0.15, 0.06]} />
                         <meshStandardMaterial color="#333" />
                     </mesh>
                  </group>
              );
          
          default:
               return (
                  <group>
                    <mesh position={[0, -0.06, 0]}>
                        <cylinderGeometry args={[0.02, 0.02, 0.12, 16]} />
                        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.8} />
                    </mesh>
                    <mesh position={[0, -0.13, 0]}>
                        <cylinderGeometry args={[0.025, 0.025, 0.02, 16]} />
                        <meshStandardMaterial color="#888" roughness={0.3} metalness={1} />
                    </mesh>
                    <mesh position={[0, 0.01, 0]}>
                        <cylinderGeometry args={[0.035, 0.025, 0.05, 16]} />
                        <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={1} />
                    </mesh>
                    <mesh position={[0, 0.05 + 1.0 / 2, 0]}>
                        <cylinderGeometry args={[0.008, 0.008, 1.0, 12]} />
                        <meshBasicMaterial color="white" toneMapped={false} />
                    </mesh>
                    <mesh position={[0, 0.05 + 1.0 / 2, 0]}>
                        <capsuleGeometry args={[0.02, 1.0, 16, 32]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} transparent opacity={0.6} roughness={0.1} metalness={0} />
                    </mesh>
                    <pointLight color={color} intensity={2} distance={3} decay={2} position={[0, 0.5, 0]} />
                  </group>
               );
      }
  };

  return (
    <group ref={meshRef}>
        <Trail width={0.4} length={6} color={color} attenuation={(t) => t * t}>
            {renderModel()}
        </Trail>
    </group>
  );
};

export default Saber;