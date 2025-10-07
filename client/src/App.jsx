// client/src/App.jsx
import { useEffect, useState, useRef } from 'react';
import './App.css';
import { socket } from './services/socketService';
import { getWebRTCManager, resetWebRTCManager } from './services/WebrtcService';

// === ИМПОРТ КОМПОНЕНТОВ ===
import AuthForm from './components/auth/AuthForm';
import ContactItem from './components/contacts/ContactItem';
import SearchResultItem from './components/contacts/SearchResultItem';
import CallModal from './components/call/CallModal';
import IncomingCallBanner from './components/call/IncomingCallBanner';
import ConnectionStatus from './components/ui/ConnectionStatus';

// Сервисы для контактов
const addContact = async (userId, contactId) => {
  const response = await fetch('/api/contacts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, contactId })
  });
  return response.json();
};

const fetchContacts = async (userId) => {
  const response = await fetch(`/api/contacts/${userId}`, {
    credentials: 'include'
  });
  return response.json();
};

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
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [searchNotFound, setSearchNotFound] = useState(false);

  // === СОСТОЯНИЯ ДЛЯ КОНТАКТОВ ===
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [callWindow, setCallWindow] = useState(null);
  const callWindowRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

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

  // Загрузка контактов
  const loadContacts = async () => {
    if (!currentUser) return;
    const data = await fetchContacts(currentUser.id);
    if (data.success) {
      setContacts(data.contacts || []);
    }
  };

  // Поиск по ВСЕМ пользователям
  const handleSearchAllUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchNotFound(false);
      return;
    }

    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        const filtered = data.users
          .filter(u => u.id !== currentUser.id)
          .filter(u => u.username.toLowerCase().includes(query.toLowerCase()));
        
        setSearchResults(filtered);
        setSearchNotFound(filtered.length === 0);
      } else {
        setSearchResults([]);
        setSearchNotFound(true);
      }
    } catch (error) {
      console.error('Ошибка поиска всех пользователей:', error);
      setSearchResults([]);
      setSearchNotFound(true);
    }
  };

  // Добавление в контакты
  const handleAddContact = async (contactId, contactUsername) => {
    if (!currentUser) return;
    const result = await addContact(currentUser.id, contactId);
    if (result.success) {
      loadContacts();
      setSearchResults(prev => prev.filter(c => c.id !== contactId));
    } else {
      alert('Ошибка добавления: ' + result.message);
    }
  };

  // Инициализация приложения
  useEffect(() => {
    const initializeApp = async () => {
      console.log('🚀 Инициализация приложения...');
      const user = restoreSession();
      setupSocketHandlers();
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

  // Загружаем контакты при входе
  useEffect(() => {
    if (currentUser) {
      loadContacts();
    }
  }, [currentUser]);

  // Настройка обработчиков сокета
  const setupSocketHandlers = () => {
    socket.on('connect', () => {
      console.log('✅ WebSocket подключён ID:', socket.id);
      setSocketStatus('connected');
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      if (currentUser?.id) {
        socket.emit('user_online', currentUser.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket отключён:', reason);
      setSocketStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Ошибка WebSocket подключения:', err);
      setSocketStatus('error');
    });

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
      setCallWindow(null);
    });

    socket.on('call:failed', (data) => {
      console.log('❌ Ошибка вызова:', data);
      setCallStatus('idle');
      setCallWindow(prev => prev ? { ...prev, status: 'missed' } : null);
      alert(`Не удалось дозвониться: ${data.reason}`);
    });

    socket.on('call:initiated', (data) => {
      console.log('🔄 Ожидание ответа на вызов...');
    });

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

    // Обновление статуса контактов в реалтайме
    socket.on('user_status_change', (data) => {
      const { userId, isOnline } = data;
      setContacts(prev => 
        prev.map(contact => 
          contact.id === userId ? { ...contact, isOnline } : contact
        )
      );
      setSearchResults(prev => 
        prev.map(user => 
          user.id === userId ? { ...user, isOnline } : user
        )
      );
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

    fetch('/api/auth/login', {
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
        if (!socket.connected) {
          console.log('🔌 Подключаем сокет после логина...');
          socket.connect();
        }
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
      const response = await fetch('/api/auth/register', {
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

    if (!socket.connected) {
      alert('Нет подключения к серверу. Пожалуйста, подождите...');
      socket.connect();
      return;
    }

    try {
      const response = await fetch(`/api/auth/user/online?query=${encodeURIComponent(targetQuery)}`);
      const data = await response.json();
      
      if (!data.isOnline) {
        setCallWindow({
          targetId: data.userId,
          targetName: targetQuery,
          status: 'offline'
        });
        return;
      }

      const targetUserId = data.userId;
      setLastCalledUserId(targetUserId);

      setCallWindow({
        targetId: targetUserId,
        targetName: targetQuery,
        status: 'calling'
      });

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
      setCallWindow({
        targetId: targetQuery,
        targetName: targetQuery,
        status: 'missed'
      });
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
      setIncomingCall(null);
    } else if (lastCalledUserId) {
      safeEmit('call:end', { target: lastCalledUserId });
    }

    if (callWindow) {
      setCallWindow(prev => prev ? { ...prev, status: 'missed' } : null);
    }

    if (window.AudioContext) {
      const ctx = new AudioContext();
      ctx.close().then(() => {
        console.log('🔊 Аудиоконтекст сброшен');
      });
    }

    // Для iOS: попробуем "отпустить" микрофон
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      setLocalStream(null);
    }
  };

  // Повторный вызов из окна
  const handleRetryCall = () => {
    if (callWindow?.targetId) {
      handleCallUser(callWindow.targetId);
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

  // === ФУНКЦИИ ДЛЯ ПЕРЕМЕЩЕНИЯ ОКНА ===
  const startDrag = (e) => {
    if (e.target.classList.contains('call-window-header')) {
      const rect = callWindowRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', stopDrag);
    }
  };

  const onDrag = (e) => {
    if (callWindowRef.current) {
      callWindowRef.current.style.left = `${e.clientX - dragOffset.current.x}px`;
      callWindowRef.current.style.top = `${e.clientY - dragOffset.current.y}px`;
    }
  };

  const stopDrag = () => {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
  };

  // === ЭКРАН ВХОДА / РЕГИСТРАЦИИ ===
  if (!currentUser) {
    return (
      <AuthForm
        isRegistering={isRegistering}
        setIsRegistering={setIsRegistering}
        loginId={loginId}
        setLoginId={setLoginId}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        registerUsername={registerUsername}
        setRegisterUsername={setRegisterUsername}
        registerPassword={registerPassword}
        setRegisterPassword={setRegisterPassword}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        loginError={loginError}
        isLoading={isLoading}
        socketStatus={socketStatus}
      />
    );
  }

  // === ОСНОВНОЙ ИНТЕРФЕЙС (ПОСЛЕ ВХОДА) ===
  return (
    <div className="App" style={{ fontFamily: 'Helvetica', display: 'flex', height: '100vh' }}>
      {/* Левая панель: профиль + контакты */}
      <div style={{ 
        width: '300px', 
        display: 'flex', 
        flexDirection: 'column', 
        borderRight: '1px solid #eee',
        padding: '15px'
      }}>
        {/* Профиль */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0 0 15px 0',
          borderBottom: '1px solid #eee'
        }}>
          <div>
            <div><strong>{currentUser.username}</strong></div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>ID: {currentUser.id}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '4px 8px',
              backgroundColor: '#121212',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Выйти
          </button>
        </div>

        {/* Поиск пользователей */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input
              type="text"
              placeholder="Поиск пользователя..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchAllUsers(searchQuery);
                }
              }}
              style={{ 
                flex: 1,
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            <button
              onClick={() => handleSearchAllUsers(searchQuery)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#121212',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔍
            </button>
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '8px' }}>
            {searchResults.map(user => (
              <SearchResultItem 
                key={user.id} 
                user={user} 
                onAdd={handleAddContact} 
              />
            ))}
            {searchNotFound && searchQuery.trim() && (
              <div style={{ 
                color: '#6c757d', 
                fontStyle: 'italic', 
                marginTop: '8px',
                fontSize: '14px'
              }}>
                Пользователь не найден
              </div>
            )}
          </div>
        </div>

        {/* Контакты */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Контакты</h3>
          {contacts.length === 0 ? (
            <div style={{ color: '#6c757d', fontStyle: 'italic' }}>Нет контактов</div>
          ) : (
            contacts.map(contact => (
              <ContactItem 
                key={contact.id} 
                contact={contact} 
                onCall={handleCallUser} 
              />
            ))
          )}
        </div>
      </div>

      {/* Правая панель: статус и аудио */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <h1>📞 Besedka</h1>

        {/* Статус подключения */}
        <ConnectionStatus 
          socketStatus={socketStatus} 
          onReconnect={() => socket.connect()} 
        />

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

        {/* Входящий вызов */}
        {incomingCall && (
          <IncomingCallBanner
            incomingCall={incomingCall}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
          />
        )}
      </div>

      {/* === МОДАЛЬНОЕ ОКНО ВЫЗОВА === */}
      {callWindow && (
        <CallModal
          callWindow={callWindow}
          onEndCall={handleEndCall}
          onRetryCall={handleRetryCall}
          onDragStart={startDrag}
        />
      )}
    </div>
  );
}

export default App;