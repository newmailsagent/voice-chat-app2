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
  const [isWebRTCReady, setIsWebRTCReady] = useState(false);

  const webrtcManager = useRef(null);

  // Загрузка пользователей и настройка сокет-событий
  useEffect(() => {
    fetch('http://109.73.201.238:8080/api/users')
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

  // Инициализация WebRTC
  useEffect(() => {
    if (!currentUser) return;

    try {
      webrtcManager.current = new WebRTCManager(socket, currentUser.id);
      webrtcManager.current.onRemoteStream = setRemoteStream;

      webrtcManager.current.init()
        .then((stream) => {
          setLocalStream(stream);
          setIsWebRTCReady(true);
          console.log('✅ WebRTC инициализирован');
        })
        .catch(error => {
          console.error('❌ Ошибка инициализации WebRTC:', error);
          alert('Ошибка инициализации: ' + error.message);
          setIsWebRTCReady(false);
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
      setIsWebRTCReady(false);
    };
  }, [currentUser]);

  // Вход
  const handleLogin = () => {
    if (!loginId.trim()) {
      setLoginError('Введите ID');
      return;
    }

    setLoginError('');
    setIsLoading(true);

    fetch('http://109.73.201.238:8080/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loginId })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          socket.emit('user_online', loginId);
        } else {
          alert('Пользователь не найден');
          setIsLoading(false);
        }
      })
      .catch(error => {
        console.error('Ошибка входа:', error);
        alert('Ошибка сети');
        setIsLoading(false);
      });
  };

  // Исходящий вызов — ★★★ ИСПРАВЛЕНО: передаём offer в call:start ★★★
  const handleCallUser = async (targetUserId) => {
    if (!currentUser) {
      alert('Сначала войдите в систему');
      return;
    }

    if (!webrtcManager.current) {
      alert('WebRTC не инициализирован');
      return;
    }

    if (!isWebRTCReady) {
      alert('WebRTC ещё не готов. Подождите...');
      return;
    }

    setCallStatus('calling');
    try {
      console.log('📞 Создаём offer для:', targetUserId);
      const offer = await webrtcManager.current.createOffer(targetUserId);

      console.log('📤 Отправляем вызов с offer');
      socket.emit('call:start', {
        targetUserId,
        offer // ✅ Ключевое исправление!
      });
    } catch (error) {
      console.error('❌ Ошибка создания вызова:', error);
      setCallStatus('idle');
      alert('Не удалось начать вызов: ' + error.message);
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
        <h1>📞 Вход в систему видеозвонков</h1>
        <p>Доступные ID: <strong>alex, maria, john</strong></p>

        <input
          type="text"
          placeholder="Введите ваш ID"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value.trim())}
          disabled={isLoading}
          style={{ padding: '10px', fontSize: '16px', marginRight: '10px' }}
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

      <div style={{ marginBottom: '10px', color: isWebRTCReady ? 'green' : 'orange' }}>
        WebRTC: {isWebRTCReady ? '✅ Готов' : '⏳ Инициализация...'}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Статус звонка: </strong>
        {callStatus === 'idle' && <span>🟢 Готов к звонкам</span>}
        {callStatus === 'calling' && <span>🟡 Звонок...</span>}
        {callStatus === 'in_call' && <span>🔴 В звонке</span>}
      </div>

      {/* Заглушки видео */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
        <div>
          <h4>📹 Ваше видео (заглушка)</h4>
          <div style={{ width: '320px', height: '240px', background: '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid green', borderRadius: '8px' }}>
            {isWebRTCReady ? 'WebRTC активен' : 'Ожидание...'}
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
                disabled={callStatus !== 'idle' || !isWebRTCReady}
                style={{
                  marginLeft: '15px',
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (callStatus !== 'idle' || !isWebRTCReady) ? 'not-allowed' : 'pointer'
                }}
              >
                {isWebRTCReady ? 'Позвонить' : 'Ожидание...'}
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