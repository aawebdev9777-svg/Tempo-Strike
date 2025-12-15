/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { CutDirection, NoteData, ShopItem, Difficulty } from "./types";
import * as THREE from 'three';

// Game World Config
export const TRACK_LENGTH = 50;
export const SPAWN_Z = -30;
export const PLAYER_Z = 0;
export const MISS_Z = 5;

// Removing static NOTE_SPEED, will be dynamic
export const BASE_NOTE_SPEED = 14; 

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

export const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: {
    label: "CHILL",
    speed: 10,
    noteColorScale: 0.8,
    healthDrain: 8,
    healthGain: 6,
    scoreMultiplier: 0.8
  },
  [Difficulty.MEDIUM]: {
    label: "CRUISING",
    speed: 14,
    noteColorScale: 1.0,
    healthDrain: 12,
    healthGain: 4,
    scoreMultiplier: 1.0
  },
  [Difficulty.HARD]: {
    label: "OVERDRIVE",
    speed: 18,
    noteColorScale: 1.2,
    healthDrain: 18,
    healthGain: 3,
    scoreMultiplier: 1.5
  },
  [Difficulty.IMPOSSIBLE]: {
    label: "DEATH WISH",
    speed: 38,       // Extreme speed
    noteColorScale: 1.5,
    healthDrain: 51, // 2 Misses = Game Over (100 -> 49 -> -2)
    healthGain: 0.2, // Healing is negligible
    scoreMultiplier: 8.0
  }
};

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
    perks: { scoreMult: 1.0, coinMult: 0.8, hitWindow: 1.4 } 
  },
  { 
    id: 'viper', 
    name: 'Viper Fang', 
    price: 1800, 
    description: 'Swift strikes. High precision yields higher scores.',
    perks: { scoreMult: 1.35, coinMult: 1.0, hitWindow: 0.85 }
  },
  {
    id: 'skeleton',
    name: 'Bone Harvester',
    price: 2500,
    description: 'Forged from the remains of ancient beasts.',
    perks: { scoreMult: 1.1, coinMult: 1.3, hitWindow: 1.1 }
  },
  { 
    id: 'plasma', 
    name: 'Plasma Cutter', 
    price: 3000, 
    description: 'High tech. Good balance of stats.',
    perks: { scoreMult: 1.25, coinMult: 1.25, hitWindow: 1.1 }
  },
  { 
    id: 'bass', 
    name: 'Bass Edge', 
    price: 3500, 
    description: 'Resonates with the beat. Expansive hit area.',
    perks: { scoreMult: 0.9, coinMult: 1.1, hitWindow: 1.3 }
  },
  {
    id: 'glitch',
    name: 'Data Corruptor',
    price: 4500,
    description: 'Unstable code manifested as a weapon.',
    perks: { scoreMult: 1.4, coinMult: 1.1, hitWindow: 0.9 }
  },
  { 
    id: 'katana', 
    name: 'Neon Katana', 
    price: 5000, 
    description: 'The sharpest edge. Massive score potential.',
    perks: { scoreMult: 1.6, coinMult: 1.1, hitWindow: 0.95 }
  },
  {
    id: 'crystal',
    name: 'Prism Shard',
    price: 6000,
    description: 'Refracts light into pure damage.',
    perks: { scoreMult: 1.3, coinMult: 1.4, hitWindow: 1.0 }
  },
  { 
    id: 'scythe', 
    name: 'Cyber Scythe', 
    price: 6500, 
    description: 'Harvest the rhythm. Superior stats for the elite.',
    perks: { scoreMult: 1.5, coinMult: 1.3, hitWindow: 1.0 }
  },
  {
    id: 'nature',
    name: 'Verdant Keeper',
    price: 8500,
    description: 'Life and death intertwined.',
    perks: { scoreMult: 1.2, coinMult: 1.6, hitWindow: 1.2 }
  },
  {
    id: 'mecha',
    name: 'Mecha Striker',
    price: 10000,
    description: 'Industrial grade cutting tool.',
    perks: { scoreMult: 1.5, coinMult: 1.0, hitWindow: 1.3 }
  },
  {
    id: 'storm',
    name: 'Thunder Caller',
    price: 12000,
    description: 'Harness the power of the storm.',
    perks: { scoreMult: 1.6, coinMult: 1.2, hitWindow: 1.0 }
  },
  {
    id: 'inferno',
    name: 'Hellfire',
    price: 14000,
    description: 'Burns everything it touches.',
    perks: { scoreMult: 1.7, coinMult: 1.0, hitWindow: 1.1 }
  },
  {
    id: 'void',
    name: 'Void Eater',
    price: 16500,
    description: 'Consumes light and sound.',
    perks: { scoreMult: 1.8, coinMult: 1.1, hitWindow: 0.9 }
  },
  {
    id: 'celestial',
    name: 'Star Forged',
    price: 20000,
    description: 'A shard of a dying star.',
    perks: { scoreMult: 2.0, coinMult: 1.5, hitWindow: 1.1 }
  },
  {
    id: 'neon',
    name: 'Synthwave X',
    price: 25000,
    description: 'Maximum aesthetic, maximum power.',
    perks: { scoreMult: 2.2, coinMult: 2.0, hitWindow: 1.2 }
  },
  { 
    id: 'ultimate_eudin', 
    name: 'Ultimate Admin Saber', 
    price: 99999, 
    description: '1900x Better. You will never miss.',
    perks: { scoreMult: 3.0, coinMult: 3.0, hitWindow: 6.0 }
  }
];

export const generateChart = (difficulty: Difficulty): NoteData[] => {
  const notes: NoteData[] = [];
  let idCount = 0;
  let generatedNoteCount = 0;
  
  // Adjust density based on difficulty
  let skipRate = 0;
  let doubleRate = 0;
  
  switch(difficulty) {
    case Difficulty.EASY:
      skipRate = 0.5; // Skip 50% of beats
      doubleRate = 0.05;
      break;
    case Difficulty.MEDIUM:
      skipRate = 0.2;
      doubleRate = 0.15;
      break;
    case Difficulty.HARD:
      skipRate = 0.05;
      doubleRate = 0.3;
      break;
    case Difficulty.IMPOSSIBLE:
      skipRate = 0; // No mercy
      doubleRate = 0.9; // Almost always double or complex
      break;
  }

  // Loop through 300 beats
  for (let i = 4; i < 300; i += 1) { 
    const time = i * BEAT_TIME;
    
    // Random skip for rhythm (unless it's a stream phase in Hard/Impossible)
    if (Math.random() < skipRate) continue;

    // --- IMPOSSIBLE EXCLUSIVE: CHAOS & SPEED ---
    if (difficulty === Difficulty.IMPOSSIBLE) {
         // Sub-beat 1 (8th notes) - High frequency
         if (Math.random() < 0.9) {
             notes.push({
                id: `note-sub-1-${idCount++}`,
                time: time + (BEAT_TIME / 2),
                lineIndex: Math.floor(Math.random() * 4), // Random lane
                lineLayer: Math.floor(Math.random() * 3), // Any height
                type: Math.random() > 0.5 ? 'left' : 'right',
                cutDirection: CutDirection.ANY
             });
         }
         
         // Sub-beat 2 & 3 (16th notes) - Bursts
         if (Math.random() < 0.4) {
             notes.push({
                id: `note-sub-2-${idCount++}`,
                time: time + (BEAT_TIME * 0.25),
                lineIndex: Math.floor(Math.random() * 4),
                lineLayer: Math.floor(Math.random() * 3),
                type: 'left',
                cutDirection: CutDirection.ANY
             });
         }
         if (Math.random() < 0.4) {
             notes.push({
                id: `note-sub-3-${idCount++}`,
                time: time + (BEAT_TIME * 0.75),
                lineIndex: Math.floor(Math.random() * 4),
                lineLayer: Math.floor(Math.random() * 3),
                type: 'right',
                cutDirection: CutDirection.ANY
             });
         }
    }

    // Check for Gold Star (Every 50 notes)
    generatedNoteCount++;
    if (generatedNoteCount % 50 === 0) {
        notes.push({
            id: `gold-${idCount++}`,
            time: time,
            lineIndex: Math.random() > 0.5 ? 1 : 2, // Center lanes
            lineLayer: 1, // Mid height
            type: 'left', // Placeholder, ignored for gold stars
            cutDirection: CutDirection.ANY,
            isGoldStar: true
        });
        continue;
    }

    // Phase determination
    const phase = Math.floor(i / 16) % 4; 

    // EASY MODE SIMPLIFICATION
    if (difficulty === Difficulty.EASY) {
       if (i % 2 !== 0) continue; // Only on downbeats mostly
       const isLeft = i % 4 === 0;
       notes.push({
          id: `note-${idCount++}`,
          time: time,
          lineIndex: isLeft ? 1 : 2,
          lineLayer: 0,
          type: isLeft ? 'left' : 'right',
          cutDirection: CutDirection.ANY
       });
       continue;
    }

    // MEDIUM / HARD / IMPOSSIBLE GENERATION
    if (phase === 0 || phase === 2) {
      // Basic Alternating
      const isLeft = (i % 2 === 0);
      notes.push({
          id: `note-${idCount++}`,
          time: time,
          lineIndex: isLeft ? 1 : 2,
          lineLayer: 0,
          type: isLeft ? 'left' : 'right',
          cutDirection: Math.random() > 0.5 ? CutDirection.DOWN : CutDirection.ANY
      });
    } else if (phase === 1) {
       // Streams or fast succession
       if (difficulty === Difficulty.HARD || difficulty === Difficulty.IMPOSSIBLE || i % 2 === 0) {
          const isLeft = (i % 2 === 0);
          notes.push({
            id: `note-${idCount++}`,
            time: time,
            lineIndex: isLeft ? 0 : 3,
            lineLayer: 0,
            type: isLeft ? 'left' : 'right',
            cutDirection: CutDirection.DOWN
          });
       }
    } else {
       // Complexity
       if (Math.random() < doubleRate) {
           // Double
           notes.push(
             { id: `note-${idCount++}`, time, lineIndex: 1, lineLayer: 1, type: 'left', cutDirection: CutDirection.LEFT },
             { id: `note-${idCount++}`, time, lineIndex: 2, lineLayer: 1, type: 'right', cutDirection: CutDirection.RIGHT }
           );
       } else {
           // Cross or High Note
           const isLeft = Math.random() > 0.5;
           notes.push({
              id: `note-${idCount++}`,
              time, 
              lineIndex: isLeft ? 2 : 1, // Cross lane
              lineLayer: Math.random() > 0.6 ? 1 : 0, 
              type: isLeft ? 'left' : 'right', 
              cutDirection: CutDirection.ANY 
           });
       }
    }
  }

  return notes.sort((a, b) => a.time - b.time);
};

export const DEMO_CHART = generateChart(Difficulty.MEDIUM); // Fallback

// Vectors for direction checking
export const DIRECTION_VECTORS: Record<CutDirection, THREE.Vector3> = {
  [CutDirection.UP]: new THREE.Vector3(0, 1, 0),
  [CutDirection.DOWN]: new THREE.Vector3(0, -1, 0),
  [CutDirection.LEFT]: new THREE.Vector3(-1, 0, 0),
  [CutDirection.RIGHT]: new THREE.Vector3(1, 0, 0),
  [CutDirection.ANY]: new THREE.Vector3(0, 0, 0) // Magnitude check only
};