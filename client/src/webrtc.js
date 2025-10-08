// client/src/webrtc.js — улучшенная версия с высоким качеством звука

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
    this.isClosed = false;
    this.pendingCandidates = [];
  }

  /**
   * Инициализирует WebRTC соединение
   * @param {boolean} withMicrophone - Запрашивать ли микрофон сразу
   */
  async init(withMicrophone = true) {
    if (this.peerConnection || this.isClosed) {
      throw new Error('WebRTCManager уже инициализирован или закрыт. Создайте новый инстанс.');
    }

    console.log('WebRTCManager.init вызван', { withMicrophone });

    try {
      if (withMicrophone) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            autoGainControl: false,
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 48000,
            sampleSize: 16,
            channelCount: 1,
            latency: 0,
            volume: 1.0
          }
        });
      }

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

      const transceiver = this.peerConnection.addTransceiver('audio', {
        direction: 'sendrecv'
      });
      
      if (transceiver.setCodecPreferences) {
        const codecs = RTCRtpSender.getCapabilities('audio').codecs;
        const opusCodec = codecs.find(c => c.mimeType === 'audio/opus');
        if (opusCodec) {
          opusCodec.parameters = {
            ...opusCodec.parameters,
            usedtx: false,
            useinbandfec: true,
            maxaveragebitrate: 128000
          };
          transceiver.setCodecPreferences([opusCodec]);
        }
      }

      if (this.localStream) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
          this.peerConnection.addTrack(audioTrack, this.localStream);
        }
      }

      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && !this.isClosed) {
          console.log('📤 Отправляем ICE-кандидат:', event.candidate);
          this.socket.emit('webrtc:ice-candidate', {
            candidate: event.candidate,
            to: this.targetUserId
          });
        }
      };

      this.peerConnection.ontrack = (event) => {
        if (this.isClosed) return;
        
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

      console.log('✅ RTCPeerConnection инициализирован');
      return this.localStream;
    } catch (error) {
      console.error('❌ Ошибка инициализации WebRTC:', error);
      this.close();
      throw error;
    }
  }

  async addMicrophone() {
    if (this.isClosed) {
      throw new Error('WebRTCManager закрыт.');
    }
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 1,
          latency: 0,
          volume: 1.0
        }
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        if (this.localStream) {
          const oldTrack = this.localStream.getAudioTracks()[0];
          if (oldTrack) {
            try {
              this.peerConnection.removeTrack(oldTrack);
              oldTrack.stop();
            } catch (e) {
              console.warn('Не удалось удалить старый трек:', e);
            }
          }
        }

        this.peerConnection.addTrack(audioTrack, stream);
        this.localStream = stream;
        console.log('✅ Микрофон добавлен к существующему соединению');
        return stream;
      }
    } catch (error) {
      console.error('❌ Ошибка добавления микрофона:', error);
      throw error;
    }
  }

  async createOffer(targetUserId) {
    if (this.isClosed) {
      throw new Error('WebRTCManager закрыт.');
    }
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('createOffer вызван для:', targetUserId);
    this.targetUserId = targetUserId;

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Локальное описание (offer) установлено');
      return offer;
    } catch (error) {
      console.error('❌ Ошибка создания offer:', error);
      this.close();
      throw error;
    }
  }

  async handleOffer(offer, fromUserId) {
    if (this.isClosed) {
      throw new Error('WebRTCManager закрыт.');
    }
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    console.log('📥 Получен offer от:', fromUserId);
    this.targetUserId = fromUserId;

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log('✅ Отправлен answer');
      return answer;
    } catch (error) {
      console.error('❌ Ошибка обработки offer:', error);
      this.close();
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (this.isClosed) {
      throw new Error('WebRTCManager закрыт.');
    }
    if (!this.peerConnection) {
      throw new Error('RTCPeerConnection не инициализирован.');
    }

    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Удалённое описание (answer) установлено');
      
      // 🔥 Применяем отложенные кандидаты ПОСЛЕ установки remoteDescription
      if (this.pendingCandidates.length > 0) {
        console.log(`Применяем ${this.pendingCandidates.length} отложенных ICE-кандидатов`);
        for (const candidate of this.pendingCandidates) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('Ошибка применения отложенного кандидата:', err);
          }
        }
        this.pendingCandidates = [];
      }
    } catch (error) {
      console.error('❌ Ошибка обработки answer:', error);
      this.close();
      throw error;
    }
  }

  async addIceCandidate(candidate) {
    if (this.isClosed) return;
    
    if (!this.peerConnection) {
      console.warn('RTCPeerConnection не готов. Буферизуем ICE-кандидат.');
      this.pendingCandidates.push(candidate);
      return;
    }

    // 🔥 Проверяем, что remoteDescription установлен
    if (!this.peerConnection.remoteDescription || this.peerConnection.remoteDescription.type === '') {
      console.warn('Remote description не установлен. Буферизуем ICE-кандидат.');
      this.pendingCandidates.push(candidate);
      return;
    }

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
    if (this.isClosed) return;
    this.isClosed = true;
    console.log('Закрытие WebRTC соединения');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Не удалось остановить трек:', e);
        }
      });
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Не удалось остановить удаленный трек:', e);
        }
      });
      this.remoteStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('Не удалось закрыть peerConnection:', e);
      }
      this.peerConnection = null;
    }
    
    this.targetUserId = null;
    this.pendingCandidates = [];
    
    if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ctx.close().catch(console.error);
    }
  }
}