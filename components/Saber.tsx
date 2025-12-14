/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trail, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { HandType, COLORS } from '../types';

interface SaberProps {
  type: HandType;
  positionRef: React.MutableRefObject<THREE.Vector3 | null>;
  velocityRef: React.MutableRefObject<THREE.Vector3 | null>;
  model: string;
  combo: number;
  intensityRef: React.MutableRefObject<number>;
}

// --- SHARED MATERIALS ---
const MATERIAL_LIBRARY = {
    metalDark: new THREE.MeshStandardMaterial({ color: '#1a1a1a', metalness: 0.9, roughness: 0.2 }),
    metalSilver: new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 1.0, roughness: 0.1 }),
    gold: new THREE.MeshStandardMaterial({ color: '#FFD700', metalness: 1.0, roughness: 0.1, emissive: '#F4B400', emissiveIntensity: 0.2 }),
    blackMatte: new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.9 }),
    glowingWhite: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    glass: new THREE.MeshPhysicalMaterial({ transmission: 0.6, opacity: 0.5, metalness: 0, roughness: 0, thickness: 0.5 })
};

// --- SABER MODEL COMPONENTS ---

const DefaultSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, -0.15, 0]} material={MATERIAL_LIBRARY.metalDark}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 16]} />
        </mesh>
        <mesh position={[0, -0.28, 0]} material={MATERIAL_LIBRARY.metalSilver}>
            <cylinderGeometry args={[0.04, 0.04, 0.05, 16]} />
        </mesh>
        <mesh position={[0, 0, 0]} material={MATERIAL_LIBRARY.metalSilver}>
            <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
        </mesh>
        {/* Blade */}
        <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.6, 0]} scale={[1.5, 1.02, 1.5]}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.4} toneMapped={false} />
        </mesh>
    </group>
);

const PixelSaber: React.FC<{ color: string }> = ({ color }) => {
    // Generate voxel grid
    const voxels = useMemo(() => {
        const v = [];
        for(let y = 0; y < 12; y++) {
            v.push(y);
        }
        return v;
    }, []);

    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
            {/* Handle */}
            <mesh position={[0, -0.2, 0]}>
                 <boxGeometry args={[0.08, 0.4, 0.08]} />
                 <meshStandardMaterial color="#333" roughness={0.8} />
            </mesh>
            {/* Guard */}
            <mesh position={[0, 0.1, 0]}>
                 <boxGeometry args={[0.3, 0.1, 0.1]} />
                 <meshStandardMaterial color="#555" />
            </mesh>
            {/* Blade Voxels */}
            {voxels.map((y, i) => (
                <group key={i} position={[0, 0.2 + y * 0.1, 0]}>
                     <mesh position={[0,0,0]}>
                         <boxGeometry args={[0.08, 0.08, 0.08]} />
                         <meshBasicMaterial color={i % 2 === 0 ? color : 'white'} toneMapped={false} />
                     </mesh>
                     {/* Random floating bits */}
                     {(i === 8 || i === 11) && (
                         <Float speed={5} rotationIntensity={2} floatIntensity={1}>
                             <mesh position={[0.15, 0, 0.1]}>
                                 <boxGeometry args={[0.04, 0.04, 0.04]} />
                                 <meshBasicMaterial color={color} toneMapped={false} />
                             </mesh>
                         </Float>
                     )}
                </group>
            ))}
        </group>
    );
};

const RapierSaber: React.FC<{ color: string }> = ({ color }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Handle */}
        <mesh position={[0, -0.25, 0]} material={MATERIAL_LIBRARY.gold}>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        </mesh>
        {/* Basket Guard */}
        <group position={[0, -0.1, 0]}>
            <mesh rotation={[Math.PI, 0, 0]}>
                <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI/2]} />
                <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} side={THREE.DoubleSide} />
            </mesh>
        </group>
        {/* Thin Blade */}
        <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.005, 0.015, 1.4, 8]} />
            <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 1.4, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} toneMapped={false} />
        </mesh>
        <Sparkles count={5} scale={1} size={2} speed={0.2} opacity={0.5} color={color} position={[0, 0.5, 0]} />
    </group>
);

const MidasSaber: React.FC<{ color: string }> = ({ color }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
         {/* Solid Gold Handle */}
         <mesh position={[0, -0.2, 0]} material={MATERIAL_LIBRARY.gold}>
             <cylinderGeometry args={[0.03, 0.03, 0.4, 6]} />
         </mesh>
         <mesh position={[0, 0.05, 0]}>
             <torusGeometry args={[0.05, 0.01, 8, 16]} />
             <meshBasicMaterial color="white" toneMapped={false} />
         </mesh>
         {/* Blade */}
         <mesh position={[0, 0.6, 0]}>
             <boxGeometry args={[0.04, 1.2, 0.01]} />
             <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} metalness={1} roughness={0} />
         </mesh>
         {/* Coin particles */}
         <Sparkles count={15} scale={[0.5, 1.5, 0.5]} size={4} speed={1} opacity={1} color="#FFD700" position={[0, 0.5, 0]} />
    </group>
);

const BroadswordSaber: React.FC<{ color: string }> = ({ color }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
        {/* Big Handle */}
        <mesh position={[0, -0.3, 0]} material={MATERIAL_LIBRARY.metalDark}>
             <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        </mesh>
        {/* Crossguard */}
        <mesh position={[0, 0, 0]} material={MATERIAL_LIBRARY.metalDark}>
             <boxGeometry args={[0.4, 0.05, 0.1]} />
        </mesh>
        {/* Massive Blade */}
        <mesh position={[0, 0.7, 0]}>
             <boxGeometry args={[0.15, 1.4, 0.02]} />
             <meshStandardMaterial color="#333" metalness={0.8} roughness={0.5} />
        </mesh>
        {/* Energy Edge */}
        <mesh position={[0.08, 0.7, 0]}>
             <boxGeometry args={[0.01, 1.4, 0.025]} />
             <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh position={[-0.08, 0.7, 0]}>
             <boxGeometry args={[0.01, 1.4, 0.025]} />
             <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
    </group>
);

const ViperSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if(groupRef.current) {
            groupRef.current.scale.setScalar(1 + intensityRef.current * 0.05);
        }
    });

    return (
        <group ref={groupRef} rotation={[Math.PI / 2, 0, 0]}>
             {/* Curved Handle */}
             <mesh position={[0, -0.2, 0.1]} rotation={[0.2, 0, 0]} material={MATERIAL_LIBRARY.blackMatte}>
                 <cylinderGeometry args={[0.03, 0.02, 0.4, 8]} />
             </mesh>
             {/* Fang Blade */}
             <group position={[0, 0.1, 0]}>
                 <mesh position={[0, 0.5, 0.1]} rotation={[-0.1, 0, 0]}>
                     <coneGeometry args={[0.06, 1.2, 4]} />
                     <meshBasicMaterial color={color} toneMapped={false} />
                 </mesh>
                 <mesh position={[0, 0.5, 0.1]} rotation={[-0.1, 0, 0]} scale={[1.2, 1, 1.2]}>
                      <coneGeometry args={[0.06, 1.2, 4]} />
                      <meshBasicMaterial color="black" wireframe transparent opacity={0.2} />
                 </mesh>
             </group>
             <Sparkles count={10} scale={[0.2, 1, 0.2]} size={3} speed={0.5} opacity={0.8} color="green" position={[0, 0.5, 0.1]} />
        </group>
    );
};

const PlasmaSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => {
    const arcRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (arcRef.current) {
            arcRef.current.scale.x = 0.5 + Math.random(); // Flicker
            arcRef.current.visible = Math.random() > 0.1;
        }
    });

    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
             {/* Industrial Handle */}
             <mesh position={[0, -0.2, 0]} material={MATERIAL_LIBRARY.metalSilver}>
                 <boxGeometry args={[0.08, 0.4, 0.04]} />
             </mesh>
             {/* Prongs */}
             <mesh position={[-0.06, 0.6, 0]} material={MATERIAL_LIBRARY.metalDark}>
                 <boxGeometry args={[0.02, 1.2, 0.02]} />
             </mesh>
             <mesh position={[0.06, 0.6, 0]} material={MATERIAL_LIBRARY.metalDark}>
                 <boxGeometry args={[0.02, 1.2, 0.02]} />
             </mesh>
             {/* Arc */}
             <mesh ref={arcRef} position={[0, 0.6, 0]}>
                 <planeGeometry args={[0.1, 1.1]} />
                 <meshBasicMaterial color={color} side={THREE.DoubleSide} toneMapped={false} opacity={0.8} transparent />
             </mesh>
             <Sparkles count={20} scale={[0.15, 1.2, 0.1]} size={5} speed={2} opacity={1} color={color} position={[0, 0.6, 0]} />
        </group>
    );
};

const BassSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => {
    const visualizerRef = useRef<THREE.Group>(null);
    
    useFrame(() => {
        if (visualizerRef.current) {
            const intensity = intensityRef.current;
            visualizerRef.current.children.forEach((child, i) => {
                 const scaleY = 1 + (intensity * (i + 1) * 0.5);
                 child.scale.y = THREE.MathUtils.lerp(child.scale.y, scaleY, 0.2);
            });
        }
    });

    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
             {/* Speaker Handle */}
             <mesh position={[0, -0.25, 0]} material={MATERIAL_LIBRARY.metalDark}>
                 <cylinderGeometry args={[0.05, 0.04, 0.4, 16]} />
             </mesh>
             {/* Subwoofer Cone */}
             <mesh position={[0, 0, 0]} rotation={[Math.PI, 0, 0]}>
                 <coneGeometry args={[0.1, 0.1, 16, 1, true]} />
                 <meshStandardMaterial color="#222" side={THREE.DoubleSide} />
             </mesh>
             
             {/* EQ Visualizer Blade */}
             <group ref={visualizerRef} position={[0, 0.1, 0]}>
                 {[0,1,2,3,4].map(i => (
                     <mesh key={i} position={[0, i * 0.25, 0]}>
                         <boxGeometry args={[0.1 - (i * 0.015), 0.2, 0.02]} />
                         <meshBasicMaterial color={color} toneMapped={false} />
                     </mesh>
                 ))}
             </group>
             {/* Soundwaves */}
             <mesh position={[0, 0.6, 0]}>
                 <cylinderGeometry args={[0.15, 0.15, 1.2, 8, 1, true]} />
                 <meshBasicMaterial color={color} wireframe transparent opacity={0.2} />
             </mesh>
        </group>
    );
};

const ScytheSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
         {/* Long Handle */}
         <mesh position={[0, -0.4, 0]} material={MATERIAL_LIBRARY.blackMatte}>
             <cylinderGeometry args={[0.02, 0.02, 0.8, 8]} />
         </mesh>
         
         {/* The Blade - Curved */}
         <group position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 4]}>
             <mesh position={[0.4, 0.4, 0]} rotation={[0, 0, -0.5]}>
                 <torusGeometry args={[0.6, 0.04, 8, 32, 2]} />
                 <meshBasicMaterial color={color} toneMapped={false} />
             </mesh>
             {/* Glow */}
             <mesh position={[0.4, 0.4, 0]} rotation={[0, 0, -0.5]} scale={[1.1,1.1,1.1]}>
                 <torusGeometry args={[0.6, 0.04, 8, 32, 2]} />
                 <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.4} />
             </mesh>
         </group>
    </group>
);

const KatanaSaber: React.FC<{ color: string }> = ({ color }) => (
    <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, -0.2, 0]} material={MATERIAL_LIBRARY.metalDark}>
            <cylinderGeometry args={[0.025, 0.02, 0.4, 8]} />
        </mesh>
        <mesh position={[0, 0.05, 0]} material={MATERIAL_LIBRARY.metalDark}>
             <boxGeometry args={[0.08, 0.02, 0.06]} />
        </mesh>
        <group position={[0, 0.65, 0]}>
             <mesh position={[0, 0, 0.015]}>
                  <boxGeometry args={[0.01, 1.2, 0.005]} />
                  <meshBasicMaterial color="white" toneMapped={false} />
             </mesh>
             <mesh position={[0, 0, 0]}>
                 <capsuleGeometry args={[0.03, 1.2, 4, 16]} />
                 <meshBasicMaterial color={color} transparent opacity={0.6} toneMapped={false} />
             </mesh>
        </group>
    </group>
);

const UltimateSaber: React.FC<{ color: string, intensityRef: React.MutableRefObject<number> }> = ({ color, intensityRef }) => {
    const coreRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Group>(null);
    
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if(coreRef.current) {
            coreRef.current.scale.setScalar(1 + Math.sin(t * 5) * 0.1);
        }
        if(ringRef.current) {
            ringRef.current.rotation.x = t;
            ringRef.current.rotation.y = t * 0.5;
            ringRef.current.rotation.z = t * 0.2;
        }
    });

    return (
        <group rotation={[Math.PI / 2, 0, 0]}>
            {/* Dark Matter Handle */}
            <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.02, 0.01, 0.4, 8]} />
                <meshBasicMaterial color="black" />
            </mesh>
            
            {/* Singular Point Core */}
            <mesh ref={coreRef} position={[0, 0.1, 0]}>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial color="black" />
            </mesh>
            
            {/* Reality Rift Blade */}
            <mesh position={[0, 0.8, 0]}>
                <cylinderGeometry args={[0.05, 0.01, 1.5, 32]} />
                <meshBasicMaterial color="white" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.8, 0]} scale={[1.2, 1, 1.2]}>
                <cylinderGeometry args={[0.05, 0.01, 1.5, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
            
            {/* Orbital Rings */}
            <group ref={ringRef} position={[0, 0.1, 0]}>
                 <mesh rotation={[Math.PI/2, 0, 0]}>
                     <torusGeometry args={[0.2, 0.005, 8, 32]} />
                     <meshBasicMaterial color={color} toneMapped={false} />
                 </mesh>
                 <mesh rotation={[0, Math.PI/2, 0]}>
                     <torusGeometry args={[0.25, 0.005, 8, 32]} />
                     <meshBasicMaterial color="white" toneMapped={false} />
                 </mesh>
            </group>
            
            <Sparkles count={50} scale={[1, 2, 1]} size={2} speed={1} opacity={1} color="white" />
        </group>
    );
};

// --- MAIN COMPONENT ---

const Saber: React.FC<SaberProps> = ({ type, positionRef, velocityRef, model, combo, intensityRef }) => {
  const meshRef = useRef<THREE.Group>(null);
  const color = type === 'left' ? COLORS.left : COLORS.right;
  const isLeft = type === 'left';
  const targetRotation = useRef(new THREE.Euler());

  // Dynamic Trail Configuration
  const trailConfig = useMemo(() => {
      // Default
      let width = 0.6;
      let length = 4;
      let decay = 1;
      let trailColor = new THREE.Color(color);

      // Enhance with Combo
      if (combo > 20) {
          width = 0.8;
          trailColor.lerp(new THREE.Color('white'), 0.5);
      }

      // Model Specific overrides
      if (model === 'rapier') width = 0.3;
      if (model === 'broadsword') width = 1.2;
      if (model === 'pixel') length = 2; // Short trail for digital feel
      if (model === 'ultimate_eudin') { width = 1.0; length = 8; }

      return { width, length, decay, trailColor };
  }, [combo, model, color]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const targetPos = positionRef.current;
    const velocity = velocityRef.current;

    if (targetPos) {
      meshRef.current.visible = true;
      meshRef.current.position.lerp(targetPos, 0.4); 
      
      const restingX = -Math.PI / 3.5; 
      const restingY = 0;
      const restingZ = isLeft ? 0.2 : -0.2; 
      let swayX = 0; let swayY = 0; let swayZ = 0;

      if (velocity) {
          swayX = velocity.y * 0.1; 
          swayZ = -velocity.x * 0.1;
          swayX += velocity.z * 0.05;
      }

      targetRotation.current.set(restingX + swayX, restingY + swayY, restingZ + swayZ);

      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotation.current.x, 0.2);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotation.current.y, 0.2);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, targetRotation.current.z, 0.2);

    } else {
      meshRef.current.visible = false;
    }
  });

  const renderSaberModel = () => {
      switch(model) {
          case 'pixel': return <PixelSaber color={color} />;
          case 'rapier': return <RapierSaber color={color} />;
          case 'midas': return <MidasSaber color={color} />;
          case 'broadsword': return <BroadswordSaber color={color} />;
          case 'viper': return <ViperSaber color={color} intensityRef={intensityRef} />;
          case 'plasma': return <PlasmaSaber color={color} intensityRef={intensityRef} />;
          case 'bass': return <BassSaber color={color} intensityRef={intensityRef} />;
          case 'katana': return <KatanaSaber color={color} />;
          case 'scythe': return <ScytheSaber color={color} intensityRef={intensityRef} />;
          case 'ultimate_eudin': return <UltimateSaber color={color} intensityRef={intensityRef} />;
          default: return <DefaultSaber color={color} intensityRef={intensityRef} />;
      }
  };

  return (
    <group ref={meshRef}>
        <Trail 
            width={trailConfig.width}
            length={trailConfig.length}
            color={trailConfig.trailColor}
            attenuation={(t) => t * t}
            order={-1}
        >
            {renderSaberModel()}
        </Trail>
        
        <pointLight color={color} intensity={2} distance={3} decay={2} position={[0, 0.5, 0]} />
    </group>
  );
};

export default React.memo(Saber);