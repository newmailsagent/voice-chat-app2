// webrtc.js — улучшенная версия с высоким качеством звука

export class WebRTCManager {
  constructor(socket, localUserId) {
    console.log('WebRTCManager создан для пользователя:', localUserId);
    this.socket = socket;
    this.localUserId = localUserId;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.targetUserId = null;
    this.onRemoteStream = null;
  }

  async init() {
    console.log('WebRTCManager.init вызван');

    try {
      // 🔊 Запрашиваем высококачественный аудиопоток
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          // Отключаем обработку, чтобы не было "телефонного" эффекта
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          
          // Максимальное качество
          sampleRate: 48000,      // 48 кГц
          sampleSize: 16,         // 16 бит
          channelCount: 1,        // моно (достаточно для голоса)
          latency: 0,
          volume: 1.0
        }
      });

      // Настройка PeerConnection с STUN/TURN
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        sdpSemantics: 'unified-plan'
      });

      // 🔑 Настройка кодека OPUS для высокого битрейта
      const transceiver = this.peerConnection.addTransceiver('audio', {
        direction: 'sendrecv'
      });
      
      // Принудительная настройка кодека (работает в Chrome/Firefox)
      if (transceiver.setCodecPreferences) {
        const codecs = RTCRtpSender.getCapabilities('audio').codecs;
        const opusCodec = codecs.find(c => c.mimeType === 'audio/opus');
        if (opusCodec) {
          opusCodec.parameters = {
            ...opusCodec.parameters,
            usedtx: false,         // отключить дискретную передачу тишины
            useinbandfec: true,    // включить коррекцию ошибок
            maxaveragebitrate: 128000 // 128 kbps — максимум для OPUS
          };
          transceiver.setCodecPreferences([opusCodec]);
        }
      }

      // Добавляем аудиотрек
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.peerConnection.addTrack(audioTrack, this.localStream);
      }

      // ICE кандидаты
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('📤 Отправляем ICE-кандидат:', event.candidate);
          this.socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            to: this.targetUserId
          });
        }
      };

      // Удалённые треки
      this.peerConnection.ontrack = (event) => {
        console.log('📥 Получен удаленный трек');
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
          if (this.onRemoteStream) {
            this.onRemoteStream(this.remoteStream);
          }
        }
        event.streams[0].getTracks().forEach(track => {
          this.remoteStream.addTrack(track);
        });
        console.log('✅ Удаленный поток собран');
      };

      console.log('✅ RTCPeerConnection инициализирован с высоким качеством звука');
      return this.localStream;
    } catch (error) {
      console.error('❌ Ошибка инициализации WebRTC:', error);
      throw error;
    }
  }

  async createOffer(targetUserId) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('createOffer вызван для:', targetUserId);
    this.targetUserId = targetUserId;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Локальное описание (offer) установлено. Состояние:', this.peerConnection.signalingState);
      console.log('📤 Отправляем offer:', offer);
      return offer;
    } catch (error) {
      console.error('❌ Ошибка создания offer:', error);
      throw error;
    }
  }

  async handleOffer(offer, fromUserId) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('📥 Получен offer от:', fromUserId);
    this.targetUserId = fromUserId;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Удалённое описание (offer) установлено. Состояние:', this.peerConnection.signalingState);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Локальное описание (answer) установлено. Состояние:', this.peerConnection.signalingState);

      console.log('📤 Отправляем answer:', answer);
      this.socket.emit('webrtc:answer', {
        answer,
        to: fromUserId,
        from: this.localUserId
      });

      return answer;
    } catch (error) {
      console.error('❌ Ошибка обработки offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('📥 Получен answer');
    console.log('Текущее состояние:', this.peerConnection.signalingState);

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Удалённое описание (answer) установлено. Состояние:', this.peerConnection.signalingState);
    } catch (error) {
      console.error('❌ Ошибка обработки answer:', error);
      throw error;
    }
  }

  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('📥 Получен ICE-кандидат');
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('❌ Ошибка добавления ICE-кандидата:', error);
    }
  }

  getLocalStream() {
    return this.localStream;
  }

  getRemoteStream() {
    return this.remoteStream;
  }

  close() {
    console.log('Закрытие WebRTC соединения');
    
    // 🔑 КРИТИЧЕСКИ ВАЖНО: останавливаем треки, чтобы освободить микрофон
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        track.stop();
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.targetUserId = null;
    
    // Дополнительно: сброс аудиоконтекста (для iOS/Android)
    if (window.AudioContext || window.webkitAudioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ctx.close().catch(console.error);
    }
  }
}