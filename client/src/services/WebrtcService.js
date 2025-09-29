// client/src/services/webrtcService.js
import { WebRTCManager } from './webrtc';

let webrtcManager = null;

export const getWebRTCManager = (socket, userId) => {
  if (!webrtcManager) {
    webrtcManager = new WebRTCManager(socket, userId);
  }
  return webrtcManager;
};

export const resetWebRTCManager = () => {
  if (webrtcManager) {
    webrtcManager.close();
    webrtcManager = null;
  }
};