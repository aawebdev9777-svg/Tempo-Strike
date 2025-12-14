/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface ScoreFloaterProps {
  position: THREE.Vector3;
  text: string;
  color: string;
  onComplete: () => void;
}

const ScoreFloater: React.FC<ScoreFloaterProps> = ({ position, text, color, onComplete }) => {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useMemo(() => Date.now(), []);
  
  // Faster lifetime for clearer view (600ms vs 800ms)
  const LIFETIME = 600; 

  // Random drift
  const driftX = useMemo(() => (Math.random() - 0.5) * 1.5, []);
  
  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = Date.now() - startTime;
    const progress = elapsed / LIFETIME;

    if (progress >= 1) {
      onComplete();
      return;
    }

    // Animate up and drift slightly left/right
    groupRef.current.position.y = position.y + (progress * 2.0); // Faster up speed
    groupRef.current.position.x = position.x + (driftX * progress); 

    // Scale animation (Quick pop, then shrink)
    let scale = 1.0;
    if (progress < 0.2) {
        // Pop in
        scale = progress * 5.0; 
    } else {
        // Slow shrink
        scale = 1.0 - ((progress - 0.2) * 0.5);
    }
    
    // Scale text based on importance (Perfect is bigger)
    if (text === "PERFECT") scale *= 1.2;
    else if (text === "GREAT") scale *= 1.0;
    else scale *= 0.8;

    groupRef.current.scale.setScalar(scale);

    // Fade out earlier
    if (progress > 0.6) {
         // Since we can't easily change alpha on Text without remounting material, 
         // we shrink it rapidly to 0 to simulate fade out
         const fadeProgress = (progress - 0.6) / 0.4;
         groupRef.current.scale.multiplyScalar(1 - fadeProgress);
    }
    
    // Face camera
    groupRef.current.lookAt(0, 1.8, 4);
  });

  return (
    <group ref={groupRef} position={position}>
      <Text
        color={color}
        fontSize={0.4} // Slightly smaller base font
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
        fillOpacity={1}
      >
        {text}
      </Text>
    </group>
  );
};

export default ScoreFloater;