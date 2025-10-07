// client/src/App.jsx
import { useEffect, useState } from 'react';
import React from 'react';
import './App.css';
import { socket } from './services/socketService';
import { getWebRTCManager, resetWebRTCManager } from './services/WebrtcService';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [loginId, setLoginId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [lastCalledUserId, setLastCalledUserId] = useState(null);
  const [callTargetId, setCallTargetId] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [socketStatus, setSocketStatus] = useState('disconnected');

  // Получение списка устройств
  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      return { audioInputs };
    } catch (error) {
      console.error('Ошибка получения устройств:', error);
      return { audioInputs: [] };
    }
  };

  // Восстановление сессии
  const restoreSession = () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        return user;
      } catch (e) {
        console.error('Ошибка восстановления сессии:', e);
        localStorage.removeItem('currentUser');
        return null;
      }
    }
    return null;
  };

  // Безопасная отправка через сокет
  const safeEmit = (event, data) => {
    if (!socket.connected) {
      console.warn('⚠️ Сокет не подключен, пытаемся переподключиться...');
      socket.connect();
      setTimeout(() => {
        if (socket.connected) {
          socket.emit(event, data);
        } else {
          console.error('❌ Не удалось подключиться для отправки:', event);
        }
      }, 1000);
    } else {
      socket.emit(event, data);
    }
  };

  // Инициализация приложения
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Инициализация приложения...');
      
      // 1. Восстановить сессию
      const user = restoreSession();
      
      // 2. Настроить обработчики сокета
      setupSocketHandlers();
      
      // 3. Если пользователь есть, подключиться и отправить статус
      if (user) {
        if (!socket.connected) {
          console.log('🔌 Подключаем сокет...');
          socket.connect();
        } else {
          console.log('✅ Сокет уже подключен, отправляем статус онлайн');
          safeEmit('user_online', user.id);
        }
      }
    };

    initializeApp();

    // Очистка при размонтировании
    return () => {
      console.log('🧹 Очистка App компонента');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('auth:success');
      socket.off('auth:failed');
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:end');
      socket.off('call:failed');
      socket.off('call:initiated');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
    };
  }, []);

  // Настройка обработчиков сокета
  const setupSocketHandlers = () => {
    // Статус подключения
    socket.on('connect', () => {
      console.log('✅ WebSocket подключён ID:', socket.id);
      setSocketStatus('connected');
      
      // Повторно отправляем статус онлайн при переподключении
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      if (currentUser?.id) {
        console.log('🔄 Отправляем статус онлайн после переподключения');
        socket.emit('user_online', currentUser.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket отключён:', reason);
      setSocketStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Ошибка WebSocket подключения:', {
        message: err.message,
        type: err.type,
        description: err.description
      });
      setSocketStatus('error');
    });

    // Авторизация
    socket.on('auth:success', (data) => {
      console.log('✅ Авторизация успешна:', data.user);
      setCurrentUser(data.user);
      setLoginError('');
      setIsLoading(false);
    });

    socket.on('auth:failed', (data) => {
      console.error('❌ Ошибка авторизации:', data.message);
      alert('❌ Ошибка авторизации: ' + data.message);
      setIsLoading(false);
    });

    // Вызовы
    socket.on('call:incoming', (data) => {
      console.log('📞 Входящий вызов:', data);
      setIncomingCall(data);
    });

    socket.on('call:accepted', (data) => {
      console.log('✅ Вызов принят:', data);
      setCallStatus('in_call');
    });

    socket.on('call:rejected', (data) => {
      console.log('❌ Вызов отклонён');
      setCallStatus('idle');
      alert('Пользователь отклонил вызов');
    });

    socket.on('call:end', () => {
      console.log('📞 Звонок завершён удалённо');
      resetWebRTCManager();
      setCallStatus('idle');
      setRemoteStream(null);
      setLocalStream(null);
      setIsMicrophoneEnabled(false);
      setIsMicrophoneMuted(false);
    });

    socket.on('call:failed', (data) => {
      console.log('❌ Ошибка вызова:', data);
      setCallStatus('idle');
      alert(`Не удалось дозвониться: ${data.reason}`);
    });

    socket.on('call:initiated', (data) => {
      console.log('🔄 Ожидание ответа на вызов...');
    });

    // WebRTC события
    socket.on('webrtc:offer', async (data) => {
      console.log('📥 [RTC] Получен offer от:', data.from);
      const webrtcManager = getWebRTCManager(socket, currentUser?.id);
      if (webrtcManager) {
        await webrtcManager.handleOffer(data.offer, data.from);
      }
    });

    socket.on('webrtc:answer', async (data) => {
      console.log('📥 [RTC] Получен answer от:', data.from);
      const webrtcManager = getWebRTCManager(socket, currentUser?.id);
      if (webrtcManager) {
        await webrtcManager.handleAnswer(data.answer);
      }
    });

    socket.on('webrtc:ice-candidate', async (data) => {
      console.log('📥 [RTC] Получен ICE-кандидат от:', data.from);
      const webrtcManager = getWebRTCManager(socket, currentUser?.id);
      if (webrtcManager) {
        await webrtcManager.addIceCandidate(data.candidate);
      }
    });
  };

  // Вход
  const handleLogin = () => {
    if (!loginId.trim() || !loginPassword) {
      setLoginError('Введите имя и пароль');
      return;
    }

    setLoginError('');
    setIsLoading(true);

    fetch('https://pobesedka.ru/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginId, password: loginPassword })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log('✅ Логин успешен, устанавливаем пользователя');
        setCurrentUser(data.user);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        // Убедимся что сокет подключен перед отправкой статуса
        if (!socket.connected) {
          console.log('🔌 Подключаем сокет после логина...');
          socket.connect();
        }
        
        // Отправляем статус онлайн
        safeEmit('user_online', data.user.id);
        setIsLoading(false);
      } else {
        alert('Ошибка входа: ' + data.message);
        setIsLoading(false);
      }
    })
    .catch(error => {
      console.error('Ошибка входа:', error);
      alert('Ошибка сети');
      setIsLoading(false);
    });
  };

  // Регистрация
  const handleRegister = async () => {
    if (!registerUsername || !registerPassword) {
      setLoginError('Заполните все поля');
      return;
    }
    if (registerUsername.length < 3 || registerPassword.length < 6) {
      setLoginError('Имя от 3 символов, пароль от 6');
      return;
    }

    setLoginError('');
    setIsLoading(true);

    try {
      const response = await fetch('https://pobesedka.ru/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: registerUsername, password: registerPassword })
      });
      const data = await response.json();
      
      if (data.success) {
        alert('Регистрация успешна! Теперь войдите.');
        setIsRegistering(false);
        setLoginId(registerUsername);
        setLoginPassword(registerPassword);
      } else {
        setLoginError(data.message);
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      setLoginError('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  // Переключение микрофона
  const toggleMicrophone = () => {
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      track.enabled = !track.enabled;
      setIsMicrophoneMuted(!track.enabled);
    }
  };

  // Исходящий вызов
  const handleCallUser = async (targetQuery) => {
    if (!currentUser) {
      alert('Сначала войдите в систему');
      return;
    }

    // Проверяем подключение сокета
    if (!socket.connected) {
      alert('Нет подключения к серверу. Пожалуйста, подождите...');
      socket.connect();
      return;
    }

    try {
      const response = await fetch(`https://pobesedka.ru/api/auth/user/online?query=${encodeURIComponent(targetQuery)}`);
      const data = await response.json();
      
      if (!data.isOnline) {
        alert('Пользователь не в сети');
        return;
      }

      const targetUserId = data.userId;
      setLastCalledUserId(targetUserId);

      resetWebRTCManager();
      const webrtcManager = getWebRTCManager(socket, currentUser.id);
      
      const stream = await webrtcManager.init();
      setLocalStream(stream);
      setIsMicrophoneEnabled(true);
      
      const devices = await getDevices();
      setAudioInputs(devices.audioInputs);

      setCallStatus('calling');
      const offer = await webrtcManager.createOffer(targetUserId);
      safeEmit('call:start', { targetUserId, offer });
    } catch (error) {
      console.error('❌ Ошибка звонка:', error);
      alert('Не удалось выполнить звонок: ' + (error.message || 'проверьте данные'));
      handleEndCall();
    }
  };

  // Принять вызов
  const handleAcceptCall = async () => {
    if (!incomingCall) return;

    try {
      resetWebRTCManager();
      const webrtcManager = getWebRTCManager(socket, currentUser.id);
      webrtcManager.onRemoteStream = setRemoteStream;
      
      setLastCalledUserId(incomingCall.from);

      const stream = await webrtcManager.init();
      setLocalStream(stream);
      setIsMicrophoneEnabled(true);
      
      const devices = await getDevices();
      setAudioInputs(devices.audioInputs);

      await webrtcManager.handleOffer(incomingCall.offer, incomingCall.from);
      safeEmit('call:accept', { from: incomingCall.from });
      setIncomingCall(null);
      setCallStatus('in_call');
    } catch (error) {
      console.error('❌ Ошибка принятия вызова:', error);
      alert('Не удалось принять вызов: ' + error.message);
      handleEndCall();
    }
  };

  // Отклонить вызов
  const handleRejectCall = () => {
    if (!incomingCall) return;
    safeEmit('call:reject', { from: incomingCall.from });
    setIncomingCall(null);
    setCallStatus('idle');
  };

  // Завершить вызов
  const handleEndCall = () => {
    console.log('📴 Завершаем вызов');
    resetWebRTCManager();
    
    setCallStatus('idle');
    setRemoteStream(null);
    setLocalStream(null);
    setIsMicrophoneEnabled(false);
    setIsMicrophoneMuted(false);

    if (incomingCall) {
      safeEmit('call:end', { target: incomingCall.from });
    } else if (lastCalledUserId) {
      safeEmit('call:end', { target: lastCalledUserId });
    }
  };

  // Выход
  const handleLogout = () => {
    console.log('🚪 Выход из системы');
    if (currentUser) {
      safeEmit('user_offline', currentUser.id);
    }
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    handleEndCall();
    socket.disconnect();
  };

  // Экран входа/регистрации
  if (!currentUser) {
    return (
      <div className="App" style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1>📞 Besedka</h1>
        
        {/* Статус подключения */}
        <div style={{ 
          marginBottom: '15px', 
          padding: '8px', 
          borderRadius: '4px',
          backgroundColor: socketStatus === 'connected' ? '#d4edda' : 
                         socketStatus === 'error' ? '#f8d7da' : '#fff3cd',
          color: socketStatus === 'connected' ? '#155724' : 
                socketStatus === 'error' ? '#721c24' : '#856404',
          border: `1px solid ${
            socketStatus === 'connected' ? '#c3e6cb' : 
            socketStatus === 'error' ? '#f5c6cb' : '#ffeaa7'
          }`
        }}>
          <strong>Статус подключения:</strong> {
            socketStatus === 'connected' ? '🟢 Подключено' :
            socketStatus === 'connecting' ? '🟡 Подключение...' :
            socketStatus === 'error' ? '🔴 Ошибка' : '⚪ Отключено'
          }
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setIsRegistering(false)}
            style={{
              padding: '8px 16px',
              backgroundColor: !isRegistering ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer'
            }}
          >
            Вход
          </button>
          <button
            onClick={() => setIsRegistering(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: isRegistering ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer'
            }}
          >
            Регистрация
          </button>
        </div>

        {isRegistering ? (
          <div>
            <input
              type="text"
              placeholder="Ваше имя (уникальное)"
              value={registerUsername}
              onChange={(e) => setRegisterUsername(e.target.value.trim())}
              style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
            />
            <input
              type="password"
              placeholder="Пароль (мин. 6 символов)"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
            />
            <button 
              onClick={handleRegister} 
              disabled={isLoading}
              style={{ 
                padding: '10px 20px', 
                fontSize: '16px',
                backgroundColor: isLoading ? '#6c757d' : '#2196F3',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </div>
        ) : (
          <div>
            <input
              type="text"
              placeholder="Имя пользователя"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.trim())}
              disabled={isLoading}
              style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
            />
            <input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={isLoading}
              style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
            />
            <button 
              onClick={handleLogin} 
              disabled={isLoading} 
              style={{ 
                padding: '10px 20px', 
                fontSize: '16px',
                backgroundColor: isLoading ? '#6c757d' : '#2196F3',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        )}
        
        {loginError && <div style={{ color: 'red', marginTop: '10px' }}>{loginError}</div>}
      </div>
    );
  }

  // Основной интерфейс
  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>📞 Besedka</h1>

      {/* Статус подключения */}
      <div style={{ 
        marginBottom: '15px', 
        padding: '8px', 
        borderRadius: '4px',
        backgroundColor: socketStatus === 'connected' ? '#d4edda' : 
                       socketStatus === 'error' ? '#f8d7da' : '#fff3cd',
        color: socketStatus === 'connected' ? '#155724' : 
              socketStatus === 'error' ? '#721c24' : '#856404',
        border: `1px solid ${
          socketStatus === 'connected' ? '#c3e6cb' : 
          socketStatus === 'error' ? '#f5c6cb' : '#ffeaa7'
        }`
      }}>
        <strong>Статус подключения:</strong> {
          socketStatus === 'connected' ? '🟢 Подключено' :
          socketStatus === 'connecting' ? '🟡 Подключение...' :
          socketStatus === 'error' ? '🔴 Ошибка' : '⚪ Отключено'
        }
        {socketStatus !== 'connected' && (
          <button 
            onClick={() => socket.connect()}
            style={{
              marginLeft: '10px',
              padding: '4px 8px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Переподключиться
          </button>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Вы вошли как:</strong> {currentUser.username} (ID: {currentUser.id})
        <button
          onClick={handleLogout}
          style={{
            marginLeft: '15px',
            padding: '6px 12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Выйти
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Статус звонка: </strong>
        {callStatus === 'idle' && <span>🟢 Онлайн</span>}
        {callStatus === 'calling' && <span>🟡 Звонок...</span>}
        {callStatus === 'in_call' && <span>🔴 В звонке</span>}
      </div>

      {/* Кнопка вкл/выкл микрофона */}
      {callStatus === 'in_call' && (
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={toggleMicrophone}
            style={{
              padding: '10px 20px',
              backgroundColor: isMicrophoneMuted ? '#6c757d' : '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isMicrophoneMuted ? '🔇 Микрофон выключен' : '🎤 Микрофон включён'}
          </button>
        </div>
      )}

      {/* Селектор микрофонов */}
      {callStatus === 'in_call' && localStream && audioInputs.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <label>
            Микрофон:
            <select onChange={async (e) => {
              const deviceId = e.target.value;
              const newStream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } },
                video: false
              });
              const oldAudioTrack = localStream.getAudioTracks()[0];
              localStream.removeTrack(oldAudioTrack);
              oldAudioTrack.stop();
              const newAudioTrack = newStream.getAudioTracks()[0];
              localStream.addTrack(newAudioTrack);
              const webrtcManager = getWebRTCManager(socket, currentUser.id);
              if (webrtcManager?.peerConnection) {
                webrtcManager.peerConnection.removeTrack(oldAudioTrack);
                webrtcManager.peerConnection.addTrack(newAudioTrack, localStream);
              }
            }} style={{ marginLeft: '10px', padding: '5px' }}>
              {audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Микрофон ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Аудио собеседника */}
      {remoteStream && (
        <div style={{ marginBottom: '30px' }}>
          <h4>🔊 Аудио собеседника</h4>
          <audio
            ref={audio => { if (audio) audio.srcObject = remoteStream; }}
            autoPlay
            style={{ width: '100%', height: '50px', border: '2px solid blue', borderRadius: '8px' }}
          />
        </div>
      )}

      {callStatus === 'in_call' && (
        <button
          onClick={handleEndCall}
          style={{
            padding: '12px 24px',
            fontSize: '18px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          📵 Завершить звонок
        </button>
      )}

      {/* Поле для ввода ID пользователя */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Введите имя или ID пользователя"
          value={callTargetId}
          onChange={(e) => setCallTargetId(e.target.value.trim())}
          disabled={callStatus !== 'idle' || socketStatus !== 'connected'}
          style={{ 
            padding: '10px', 
            fontSize: '16px', 
            marginRight: '10px', 
            width: '250px',
            border: socketStatus !== 'connected' ? '2px solid #ff6b6b' : '1px solid #ccc'
          }}
        />
        <button
          onClick={() => handleCallUser(callTargetId)}
          disabled={!callTargetId || callStatus !== 'idle' || socketStatus !== 'connected'}
          style={{
            padding: '10px 15px',
            backgroundColor: (!callTargetId || callStatus !== 'idle' || socketStatus !== 'connected') ? '#6c757d' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (!callTargetId || callStatus !== 'idle' || socketStatus !== 'connected') ? 'not-allowed' : 'pointer'
          }}
        >
          Позвонить
        </button>
        {socketStatus !== 'connected' && (
          <div style={{ color: '#dc3545', fontSize: '14px', marginTop: '5px' }}>
            ❌ Нет подключения к серверу
          </div>
        )}
      </div>

      {/* Входящий вызов */}
      {incomingCall && (
        <div style={{
          background: '#fff3cd',
          border: '2px solid #ffeaa7',
          padding: '20px',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3>📞 Входящий вызов!</h3>
          <p><strong>От:</strong> {incomingCall.fromUsername} (ID: {incomingCall.from})</p>
          <div>
            <button
              onClick={handleAcceptCall}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
            >
              ✅ Принять
            </button>
            <button
              onClick={handleRejectCall}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ❌ Отклонить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;