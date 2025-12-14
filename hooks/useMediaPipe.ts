/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import * as THREE from 'three';

// Mapping 2D normalized coordinates to 3D game world.
const mapHandToWorld = (x: number, y: number): THREE.Vector3 => {
  const GAME_X_RANGE = 5; 
  const GAME_Y_RANGE = 3.5;
  const Y_OFFSET = 0.8;

  // MediaPipe often returns mirrored X if facingMode is 'user'.
  const worldX = (0.5 - x) * GAME_X_RANGE; 
  const worldY = (1.0 - y) * GAME_Y_RANGE - (GAME_Y_RANGE / 2) + Y_OFFSET;

  const worldZ = -Math.max(0, worldY * 0.2);

  return new THREE.Vector3(worldX, Math.max(0.1, worldY), worldZ);
};

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const handPositionsRef = useRef<{
    left: THREE.Vector3 | null;
    right: THREE.Vector3 | null;
    lastLeft: THREE.Vector3 | null;
    lastRight: THREE.Vector3 | null;
    leftVelocity: THREE.Vector3;
    rightVelocity: THREE.Vector3;
    lastTimestamp: number;
  }>({
    left: null,
    right: null,
    lastLeft: null,
    lastRight: null,
    leftVelocity: new THREE.Vector3(0,0,0),
    rightVelocity: new THREE.Vector3(0,0,0),
    lastTimestamp: 0
  });

  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const isActiveRef = useRef(true);

  // 1. Initialize Model
  useEffect(() => {
    isActiveRef.current = true;
    const setupModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );
        
        if (!isActiveRef.current) return;

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (!isActiveRef.current) {
             landmarker.close();
             return;
        }

        landmarkerRef.current = landmarker;
        setIsModelLoaded(true);
      } catch (err: any) {
        console.error("Error initializing MediaPipe:", err);
        setError(`Failed to load AI model: ${err.message}`);
      }
    };

    setupModel();

    return () => {
      isActiveRef.current = false;
      if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
      }
      if (landmarkerRef.current) {
          landmarkerRef.current.close();
      }
    };
  }, []);

  // 2. Camera Logic
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    
    // Clear previous errors to allow retry
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      if (videoRef.current && isActiveRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load to set Ready state
        videoRef.current.onloadeddata = () => {
           if (isActiveRef.current) {
               setIsCameraReady(true);
           }
        };
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      // Normalized error message check
      const msg = (err.message || '').toLowerCase();
      
      // Check for various permission/security denial patterns including "not allowed by user agent"
      if (
          err.name === 'NotAllowedError' || 
          err.name === 'PermissionDeniedError' || 
          err.name === 'SecurityError' || 
          msg.includes('not allowed') || 
          msg.includes('denied') || 
          msg.includes('permission') ||
          msg.includes('user agent')
      ) {
          setError("Camera access required. Please click the button below to grant permission.");
      } else {
          setError(err.message || "Could not access camera.");
      }
    }
  }, [videoRef]);

  // 3. Auto-start camera when model is loaded (Attempt ONCE)
  const autoStartAttempted = useRef(false);

  useEffect(() => {
      // We only want to try auto-starting once when the model is ready.
      // If it fails (e.g. needs gesture), we stop and let the user manually trigger it via button.
      if (isModelLoaded && !isCameraReady && !autoStartAttempted.current) {
          autoStartAttempted.current = true;
          startCamera();
      }
  }, [isModelLoaded, isCameraReady, startCamera]);


  // 4. Prediction Loop
  const predictWebcam = useCallback(() => {
      if (!videoRef.current || !landmarkerRef.current || !isActiveRef.current) return;
      
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
           let startTimeMs = performance.now();
           try {
               const results = landmarkerRef.current.detectForVideo(video, startTimeMs);
               lastResultsRef.current = results;
               processResults(results);
           } catch (e) {
               // console.warn(e);
           }
      }
      requestRef.current = requestAnimationFrame(predictWebcam);
  }, []);

  const processResults = (results: HandLandmarkerResult) => {
      const now = performance.now();
      const deltaTime = (now - handPositionsRef.current.lastTimestamp) / 1000;
      handPositionsRef.current.lastTimestamp = now;

      let newLeft: THREE.Vector3 | null = null;
      let newRight: THREE.Vector3 | null = null;

      if (results.landmarks) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const landmarks = results.landmarks[i];
          const classification = results.handedness[i][0];
          const isRight = classification.categoryName === 'Right'; 
          
          const tip = landmarks[8];
          const worldPos = mapHandToWorld(tip.x, tip.y);

          if (isRight) {
               newRight = worldPos; 
          } else {
               newLeft = worldPos;
          }
        }
      }

      const s = handPositionsRef.current;
      const LERP = 0.6; 

      if (newLeft) {
          if (s.left) {
              newLeft.lerpVectors(s.left, newLeft, LERP);
              if (deltaTime > 0.001) { 
                   s.leftVelocity.subVectors(newLeft, s.left).divideScalar(deltaTime);
              }
          }
          s.lastLeft = s.left ? s.left.clone() : newLeft.clone();
          s.left = newLeft;
      } else {
          s.left = null;
      }

      if (newRight) {
           if (s.right) {
               newRight.lerpVectors(s.right, newRight, LERP);
               if (deltaTime > 0.001) {
                    s.rightVelocity.subVectors(newRight, s.right).divideScalar(deltaTime);
               }
           }
           s.lastRight = s.right ? s.right.clone() : newRight.clone();
           s.right = newRight;
      } else {
          s.right = null;
      }
  };

  // Start prediction loop when ready
  useEffect(() => {
      if (isCameraReady && isModelLoaded) {
          predictWebcam();
      }
  }, [isCameraReady, isModelLoaded, predictWebcam]);

  return { isCameraReady, handPositionsRef, lastResultsRef, error, requestCameraPermission: startCamera };
};