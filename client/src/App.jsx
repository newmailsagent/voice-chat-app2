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
  //const [isWebRTCReady, setIsWebRTCReady] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [IsMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const webrtcManager = useRef(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);

  // Загрузка пользователей и настройка сокет-событий
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
      setIncomingCall(data); // data.offer теперь есть!
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

    // WebRTC события (на случай, если понадобятся отдельные)
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

//Функция включения отключения микрофона
  const toggleMicrophone = () => {
  if (!localStream) return;

  const audioTracks = localStream.getAudioTracks();
  if (audioTracks.length > 0) {
    const track = audioTracks[0];
    track.enabled = !track.enabled; // включить/выключить
    setIsMicrophoneMuted(!track.enabled);
  }
};

//Выбор устройства микрофон
const getDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');
    const videoInputs = devices.filter(device => device.kind === 'videoinput');
    return { audioInputs, videoInputs };
  } catch (error) {
    console.error('Ошибка получения устройств:', error);
    return { audioInputs: [], videoInputs: [] };
  }
};


    //Добавляем длительную сессию
const restoreSession = () => {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      // Даем сокету время подключиться
      setTimeout(() => {
        socket.emit('user_online', user.id);
      }, 1000);
    } catch (e) {
      console.error('Ошибка восстановления сессии:', e);
      localStorage.removeItem('currentUser');
    }
  }
};


  
  // Инициализация WebRTC
  useEffect(() => {
    if (!currentUser) return;

    try {
      webrtcManager.current = new WebRTCManager(socket, currentUser.id);
      webrtcManager.current.onRemoteStream = setRemoteStream;

      webrtcManager.current.init()
        .then((stream) => {
          setLocalStream(stream);
          setIsMicrophoneEnabled(true);
          console.log('✅ WebRTC инициализирован');
        })
        .catch(error => {
          console.error('❌ Ошибка инициализации WebRTC:', error);
          alert('Ошибка инициализации: ' + error.message);
          setIsMicrophoneEnabled(false);
        });
    } catch (error) {
      console.error('❌ Ошибка создания WebRTCManager:', error);
      alert('Не удалось создать WebRTC менеджер');
    }

    return () => {
      if (webrtcManager.current) {
        webrtcManager.current.close();
        webrtcManager.current = null;
      }
      setLocalStream(null);
      setRemoteStream(null);
      setIsMicrophoneEnabled(false);
    };
  }, [currentUser]);

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

// Включить микрофон (для Linux и безопасности)
const handleEnableMicrophone = async () => {
  if (!currentUser) {
    alert('Сначала войдите в систему');
    return;
  }

  try {
    if (!webrtcManager.current) {
      webrtcManager.current = new WebRTCManager(socket, currentUser.id);
      webrtcManager.current.onRemoteStream = setRemoteStream;
    }

    const stream = await webrtcManager.current.init();
    setLocalStream(stream);
    setIsMicrophoneEnabled(true);
    console.log('✅ Микрофон включён');
  } catch (error) {
    console.error('❌ Ошибка доступа к микрофону:', error);
    alert('Не удалось получить доступ к микрофону: ' + (error.message || 'разрешите в настройках браузера'));
  }
};

  // Исходящий вызов — ★★★ ИСПРАВЛЕНО: передаём offer в call:start ★★★
  const handleCallUser = async (targetUserId) => {
  if (!currentUser) {
    alert('Сначала войдите в систему');
    return;
  }

  // ✅ Инициализируем WebRTC при звонке
  if (!webrtcManager.current) {
    try {
      webrtcManager.current = new WebRTCManager(socket, currentUser.id);
      webrtcManager.current.onRemoteStream = setRemoteStream;
      const stream = await webrtcManager.current.init();
      setLocalStream(stream);
      setIsMicrophoneEnabled(true); // микрофон включён
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
      console.log('✅ Принимаем вызов от:', incomingCall.from);
      console.log('📥 Offer:', incomingCall.offer); // Должен быть {type, sdp}

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

    console.log('❌ Отклоняем вызов от:', incomingCall.from);
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
      <h1>📞 Видеозвонки (тестовый режим)</h1>
      <p>Вы вошли как: <strong>{currentUser.username}</strong> (ID: {currentUser.id})</p>

      <div style={{ marginBottom: '10px', color: IsMicrophoneEnabled ? 'green' : 'orange' }}>
        WebRTC: {IsMicrophoneEnabled ? '✅ Готов' : '⏳ Инициализация...'}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Статус звонка: </strong>
        {callStatus === 'idle' && <span>🟢 Готов к звонкам</span>}
        {callStatus === 'calling' && <span>🟡 Звонок...</span>}
        {callStatus === 'in_call' && <span>🔴 В звонке</span>}
      </div>

      <div style={{ marginBottom: '20px' }}>
  <strong>Вы вошли как:</strong> {currentUser.username} (ID: {currentUser.id})
  <button
    onClick={() => {
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
      socket.emit('user_offline'); // опционально
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


{/* Выбор устройства */}
{callStatus === 'in_call' && localStream && (
  <div style={{ marginBottom: '20px' }}>
    <label>
      Микрофон:
      <select onChange={async (e) => {
        const deviceId = e.target.value;
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
          video: false
        });
        // Замени трек в localStream и WebRTC
        const oldAudioTrack = localStream.getAudioTracks()[0];
        localStream.removeTrack(oldAudioTrack);
        oldAudioTrack.stop();
        const newAudioTrack = newStream.getAudioTracks()[0];
        localStream.addTrack(newAudioTrack);
        if (webrtcManager.current?.peerConnection) {
          webrtcManager.current.peerConnection.removeTrack(oldAudioTrack);
          webrtcManager.current.peerConnection.addTrack(newAudioTrack, localStream);
        }
      }}>
        {audioInputs.map(device => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Микрофон ${device.deviceId.slice(0, 5)}`}
          </option>
        ))}
      </select>
    </label>
  </div>
)}


{/* Кнопка в интерфейсе */}
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

      {/* Заглушки видео */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <div>
          <h4>📹 Ваше видео (заглушка)</h4>
          <div style={{ width: '320px', height: '240px', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid green', borderRadius: '8px' }}>
            {IsMicrophoneEnabled ? 'WebRTC активен' : 'Ожидание...'}
          </div>
        </div>

        {remoteStream && (
  <div>
    <h4>🔊 Аудио собеседника</h4>
    <audio
      ref={audio => { if (audio) audio.srcObject = remoteStream; }}
      autoPlay
      controls
      style={{ width: '100%', height: '50px', border: '2px solid blue', borderRadius: '8px' }}
    />
  </div>
)}
      </div>

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
                disabled={callStatus !== 'idle' || !IsMicrophoneEnabled}
                style={{
                  marginLeft: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (callStatus !== 'idle' || !IsMicrophoneEnabled) ? 'not-allowed' : 'pointer'
                }}
              >
                {IsMicrophoneEnabled ? 'Позвонить' : 'Ожидание...'}
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