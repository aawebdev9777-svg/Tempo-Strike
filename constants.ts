/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { CutDirection, NoteData, ShopItem } from "./types";
import * as THREE from 'three';

// Game World Config
export const TRACK_LENGTH = 50;
export const SPAWN_Z = -30;
export const PLAYER_Z = 0;
export const MISS_Z = 5;
export const NOTE_SPEED = 14; // Increased from 10 to 14 for hardness

export const LANE_WIDTH = 0.8;
export const LAYER_HEIGHT = 0.8;
export const NOTE_SIZE = 0.5;

// Positions for the 4 lanes (centered around 0)
export const LANE_X_POSITIONS = [-1.5 * LANE_WIDTH, -0.5 * LANE_WIDTH, 0.5 * LANE_WIDTH, 1.5 * LANE_WIDTH];
export const LAYER_Y_POSITIONS = [0.8, 1.6, 2.4]; // Low, Mid, High

// Audio
export const SONG_URL = 'https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race2.ogg';
export const SONG_BPM = 140; 
export const BEAT_TIME = 60 / SONG_BPM;

// Shop Catalog
export const SABER_CATALOG: ShopItem[] = [
  { 
    id: 'default', 
    name: 'Standard Issue', 
    price: 0, 
    description: 'Reliable and balanced.',
    perks: { scoreMult: 1.0, coinMult: 1.0, hitWindow: 1.0 }
  },
  { 
    id: 'pixel', 
    name: '8-Bit Blade', 
    price: 250, 
    description: 'Retro style. Slight score boost.',
    perks: { scoreMult: 1.1, coinMult: 1.0, hitWindow: 1.0 }
  },
  { 
    id: 'rapier', 
    name: 'Duelist Foil', 
    price: 800, 
    description: 'Precision weapon. Harder to hit, higher score.',
    perks: { scoreMult: 1.3, coinMult: 1.0, hitWindow: 0.8 }
  },
  { 
    id: 'midas', 
    name: 'Midas Grip', 
    price: 1200, 
    description: 'Generates extra wealth with every swing.',
    perks: { scoreMult: 1.0, coinMult: 1.5, hitWindow: 1.0 }
  },
  { 
    id: 'broadsword', 
    name: 'Heavy Titan', 
    price: 1500, 
    description: 'Huge hit area, but yields less coins.',
    perks: { scoreMult: 1.0, coinMult: 0.8, hitWindow: 1.3 }
  },
  { 
    id: 'plasma', 
    name: 'Plasma Cutter', 
    price: 3000, 
    description: 'High tech. Good balance of stats.',
    perks: { scoreMult: 1.2, coinMult: 1.2, hitWindow: 1.1 }
  },
  { 
    id: 'katana', 
    name: 'Neon Katana', 
    price: 5000, 
    description: 'The sharpest edge. Massive score potential.',
    perks: { scoreMult: 1.5, coinMult: 1.0, hitWindow: 0.9 }
  },
  { 
    id: 'ultimate_eudin', 
    name: 'Ultimate Eudin Saber', 
    price: 99999, 
    description: '1900x Better. You will never miss.',
    perks: { scoreMult: 2.0, coinMult: 2.0, hitWindow: 5.0 }
  }
];

// Generate a HARDER chart
export const generateDemoChart = (): NoteData[] => {
  const notes: NoteData[] = [];
  let idCount = 0;

  // Start after 4 beats
  // Loop through 200 beats
  for (let i = 4; i < 300; i += 1) { 
    const time = i * BEAT_TIME;
    
    // Pattern complexity increases over time
    // 0 = simple alt, 1 = streams, 2 = doubles, 3 = chaos
    const phase = Math.floor(i / 32) % 4; 

    // Skip some beats to create rhythm, but fewer skips than before
    if (i % 8 === 7) continue; 

    if (phase === 0) {
      // Warmup / Simple Alternating (Every 2 beats)
      if (i % 2 === 0) {
         const isLeft = (i % 4 === 0);
         notes.push({
          id: `note-${idCount++}`,
          time: time,
          lineIndex: isLeft ? 1 : 2,
          lineLayer: 0,
          type: isLeft ? 'left' : 'right',
          cutDirection: CutDirection.ANY
        });
      }
    } else if (phase === 1) {
      // Faster Streams (Every beat)
       const isLeft = (i % 2 === 0);
       notes.push({
          id: `note-${idCount++}`,
          time: time,
          lineIndex: isLeft ? 0 : 3, // Use outer lanes
          lineLayer: 0,
          type: isLeft ? 'left' : 'right',
          cutDirection: CutDirection.DOWN
        });
    } else if (phase === 2) {
      // Double Hits (Every 4 beats)
      if (i % 4 === 0) {
         notes.push(
           { id: `note-${idCount++}`, time, lineIndex: 1, lineLayer: 1, type: 'left', cutDirection: CutDirection.ANY },
           { id: `note-${idCount++}`, time, lineIndex: 2, lineLayer: 1, type: 'right', cutDirection: CutDirection.ANY }
         );
      } else if (i % 4 === 2) {
          // Off-beat single
          notes.push({ 
              id: `note-${idCount++}`, 
              time, 
              lineIndex: Math.random() > 0.5 ? 0 : 3, 
              lineLayer: 0, 
              type: Math.random() > 0.5 ? 'left' : 'right', 
              cutDirection: CutDirection.ANY 
          });
      }
    } else {
      // Chaos / Hard Mode
      // High density
      if (i % 2 === 0) {
          // Double outer
          notes.push(
           { id: `note-${idCount++}`, time, lineIndex: 0, lineLayer: 0, type: 'left', cutDirection: CutDirection.LEFT },
           { id: `note-${idCount++}`, time, lineIndex: 3, lineLayer: 0, type: 'right', cutDirection: CutDirection.RIGHT }
         );
      } else {
          // Inner cross
           notes.push(
           { id: `note-${idCount++}`, time, lineIndex: 2, lineLayer: 1, type: 'left', cutDirection: CutDirection.DOWN },
           { id: `note-${idCount++}`, time, lineIndex: 1, lineLayer: 1, type: 'right', cutDirection: CutDirection.DOWN }
         );
      }
    }
  }

  return notes.sort((a, b) => a.time - b.time);
};

export const DEMO_CHART = generateDemoChart();

// Vectors for direction checking
export const DIRECTION_VECTORS: Record<CutDirection, THREE.Vector3> = {
  [CutDirection.UP]: new THREE.Vector3(0, 1, 0),
  [CutDirection.DOWN]: new THREE.Vector3(0, -1, 0),
  [CutDirection.LEFT]: new THREE.Vector3(-1, 0, 0),
  [CutDirection.RIGHT]: new THREE.Vector3(1, 0, 0),
  [CutDirection.ANY]: new THREE.Vector3(0, 0, 0) // Magnitude check only
};