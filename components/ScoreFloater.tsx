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
  const LIFETIME = 800; // ms

  useFrame(() => {
    if (!groupRef.current) return;

    const elapsed = Date.now() - startTime;
    const progress = elapsed / LIFETIME;

    if (progress >= 1) {
      onComplete();
      return;
    }

    // Animate up
    groupRef.current.position.y = position.y + progress * 1.5;
    // Animate scale (pop in then fade)
    const scale = progress < 0.2 ? progress * 5 : 1.0;
    groupRef.current.scale.setScalar(scale);
    
    // Opacity handled via color prop usually, but Text opacity is tricky. 
    // We'll just move it out of view or scale to 0 at end.
    if (progress > 0.8) {
        groupRef.current.scale.setScalar(1.0 - (progress - 0.8) * 5);
    }
    
    // Face camera
    groupRef.current.lookAt(0, 1.8, 4);
  });

  return (
    <group ref={groupRef} position={position}>
      <Text
        color={color}
        fontSize={0.5}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {text}
      </Text>
    </group>
  );
};

export default ScoreFloater;