// client/src/services/webrtcService.js
import { WebRTCManager } from '../webrtc';

export const createWebRTCManager = (socket, userId) => {
  return new WebRTCManager(socket, userId);
};