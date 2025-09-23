// webrtc.js — полностью исправленная версия

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
      // ✅ Тестовый поток (без камеры)
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });

      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
        ]
      });

      // Добавляем треки (если бы они были)
       this.localStream.getTracks().forEach(track => {
         this.peerConnection.addTrack(track, this.localStream);
       });

      // ICE
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

      console.log('✅ RTCPeerConnection инициализирован (тестовый режим)');
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
      
      // ★★★ КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем ЛОКАЛЬНОЕ описание ★★★
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
      // Устанавливаем УДАЛЁННОЕ описание
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ Удалённое описание (offer) установлено. Состояние:', this.peerConnection.signalingState);

      const answer = await this.peerConnection.createAnswer();
      
      // Устанавливаем ЛОКАЛЬНОЕ описание (answer)
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
      // Устанавливаем УДАЛЁННОЕ описание (answer)
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
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.targetUserId = null;
  }
}