// client/src/components/CallManager.jsx
import { useState, useEffect } from 'react';
import { socket } from '../services/socketService';
import { getWebRTCManager, resetWebRTCManager } from '../services/webrtcService';

export const CallManager = ({ currentUser, onRemoteStream }) => {
  const [callStatus, setCallStatus] = useState('idle');
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Обработка сокет-событий
  useEffect(() => {
    const handleIncomingCall = (data) => {
      setIncomingCall(data);
      setCallStatus('incoming');
    };

    const handleCallAccepted = () => {
      setCallStatus('in_call');
    };

    const handleCallEnded = () => {
      resetWebRTCManager();
      setCallStatus('idle');
      setRemoteStream(null);
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:end', handleCallEnded);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:end', handleCallEnded);
    };
  }, []);

  // Передача remoteStream в родителя
  useEffect(() => {
    if (remoteStream && onRemoteStream) {
      onRemoteStream(remoteStream);
    }
  }, [remoteStream, onRemoteStream]);

  // ... логика звонков (handleCallUser, handleAcceptCall, и т.д.)
};