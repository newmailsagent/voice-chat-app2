import { useEffect, useState, useRef } from 'react';
import './App.css';
import { io } from 'socket.io-client';
import { WebRTCManager } from './webrtc.js';

const socket = io('https://pobesedka.ru', {
  transports: ['websocket'],
  secure: true
});

function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'calling' | 'in_call'
  const [loginId, setLoginId] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false); // ✅ исправлено имя
  const webrtcManager = useRef(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);

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
        setTimeout(() => {
          socket.emit('user_online', user.id);
        }, 1000);
      } catch (e) {
        console.error('Ошибка восстановления сессии:', e);
        localStorage.removeItem('currentUser');
      }
    }
  };

  // Загрузка пользователей и сокет-события
  useEffect(() => {
    restoreSession();
    fetch('https://pobesedka.ru/api/users')
      .then(response => response.json())
      .then(data => setUsers(data));

    socket.on('auth:success', (data) => {
      console.log('✅ Авторизация успешна:', data.user);
      setCurrentUser(data.user);
      setLoginError('');
      setIsLoading(false);
    });

    socket.on('auth:failed', (data) => {
      alert('❌ Ошибка авторизации: ' + data.message);
      setIsLoading(false);
    });

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

    socket.on('call:failed', (data) => {
      console.log('❌ Ошибка вызова:', data);
      setCallStatus('idle');
      alert(`Не удалось дозвониться: ${data.reason}`);
    });

    socket.on('call:initiated', (data) => {
      console.log('🔄 Ожидание ответа на вызов...');
    });

    socket.on('webrtc:offer', async (data) => {
      console.log('📥 [RTC] Получен offer от:', data.from);
      if (webrtcManager.current) {
        await webrtcManager.current.handleOffer(data.offer, data.from);
      }
    });

    socket.on('webrtc:answer', async (data) => {
      console.log('📥 [RTC] Получен answer от:', data.from);
      if (webrtcManager.current) {
        await webrtcManager.current.handleAnswer(data.answer);
      }
    });

    socket.on('webrtc:ice-candidate', async (data) => {
      console.log('📥 [RTC] Получен ICE-кандидат от:', data.from);
      if (webrtcManager.current) {
        await webrtcManager.current.addIceCandidate(data.candidate);
      }
    });

    return () => {
      socket.off('auth:success');
      socket.off('auth:failed');
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:failed');
      socket.off('call:initiated');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
    };
  }, []);

  // Вход
  const handleLogin = () => {
    if (!loginId.trim() || !loginPassword) {
      setLoginError('Введите ID и пароль');
      return;
    }

    setLoginError('');
    setIsLoading(true);

    fetch('https://pobesedka.ru/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loginId, password: loginPassword })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        socket.emit('user_online', loginId);
        setCurrentUser(data.user);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
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
  const handleCallUser = async (targetUserId) => {
    if (!currentUser) {
      alert('Сначала войдите в систему');
      return;
    }

    if (!webrtcManager.current) {
      try {
        webrtcManager.current = new WebRTCManager(socket, currentUser.id);
        webrtcManager.current.onRemoteStream = setRemoteStream;
        const stream = await webrtcManager.current.init();
        setLocalStream(stream);
        setIsMicrophoneEnabled(true);
        
        // ✅ Заполняем список микрофонов
        const devices = await getDevices();
        setAudioInputs(devices.audioInputs);
      } catch (error) {
        console.error('❌ Ошибка инициализации WebRTC:', error);
        alert('Не удалось получить доступ к микрофону');
        return;
      }
    }

    setCallStatus('calling');
    try {
      const offer = await webrtcManager.current.createOffer(targetUserId);
      socket.emit('call:start', { targetUserId, offer });
    } catch (error) {
      console.error('❌ Ошибка создания вызова:', error);
      setCallStatus('idle');
      alert('Не удалось начать вызов');
    }
  };

  // Принять вызов
  const handleAcceptCall = async () => {
    if (!incomingCall || !webrtcManager.current) return;

    try {
      if (!webrtcManager.current) {
        webrtcManager.current = new WebRTCManager(socket, currentUser.id);
        webrtcManager.current.onRemoteStream = setRemoteStream;
      }
      
      const stream = await webrtcManager.current.init();
      setLocalStream(stream);
      setIsMicrophoneEnabled(true);
      
      // ✅ Заполняем список микрофонов
      const devices = await getDevices();
      setAudioInputs(devices.audioInputs);

      await webrtcManager.current.handleOffer(incomingCall.offer, incomingCall.from);
      socket.emit('call:accept', { from: incomingCall.from });
      setIncomingCall(null);
      setCallStatus('in_call');
    } catch (error) {
      console.error('❌ Ошибка принятия вызова:', error);
      alert('Не удалось принять вызов: ' + error.message);
    }
  };

  // Отклонить вызов
  const handleRejectCall = () => {
    if (!incomingCall) return;
    socket.emit('call:reject', { from: incomingCall.from });
    setIncomingCall(null);
    setCallStatus('idle');
  };

  // Завершить вызов
  const handleEndCall = () => {
    console.log('📴 Завершаем вызов');
    if (webrtcManager.current) {
      webrtcManager.current.close();
    }
    setCallStatus('idle');
    setRemoteStream(null);
    setLocalStream(null);
    setIsMicrophoneEnabled(false);
    setIsMicrophoneMuted(false);
    socket.emit('call:end');
  };

  // Экран входа
  if (!currentUser) {
    return (
      <div className="App" style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1>📞 Вход в систему</h1>
        <p>Доступные ID: <strong>alex, maria, john</strong></p>
        
        <input
          type="text"
          placeholder="ID пользователя"
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
        
        <button onClick={handleLogin} disabled={isLoading} style={{ padding: '10px 20px', fontSize: '16px' }}>
          {isLoading ? 'Вход...' : 'Войти'}
        </button>
        
        {loginError && <div style={{ color: 'red', marginTop: '10px' }}>{loginError}</div>}
      </div>
    );
  }

  // Основной интерфейс
  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>📞 Видеозвонки</h1>
      <p>Вы вошли как: <strong>{currentUser.username}</strong> (ID: {currentUser.id})</p>

      <div style={{ marginBottom: '20px' }}>
        <strong>Вы вошли как:</strong> {currentUser.username} (ID: {currentUser.id})
        <button
          onClick={() => {
            localStorage.removeItem('currentUser');
            setCurrentUser(null);
          }}
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
        {callStatus === 'idle' && <span>🟢 Готов к звонкам</span>}
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
              if (webrtcManager.current?.peerConnection) {
                webrtcManager.current.peerConnection.removeTrack(oldAudioTrack);
                webrtcManager.current.peerConnection.addTrack(newAudioTrack, localStream);
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

      <h2>👥 Доступные пользователи:</h2>
      <ul style={{ listStyle: 'none', padding: '0' }}>
        {users.map(user => (
          <li key={user.id} style={{ margin: '10px 0', display: 'flex', alignItems: 'center' }}>
            <strong>{user.username}</strong> (ID: {user.id})
            {user.id !== currentUser.id && (
              <button
                onClick={() => handleCallUser(user.id)}
                disabled={callStatus !== 'idle'}
                style={{
                  marginLeft: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (callStatus !== 'idle') ? 'not-allowed' : 'pointer'
                }}
              >
                Позвонить
              </button>
            )}
          </li>
        ))}
      </ul>

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