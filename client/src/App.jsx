// client/src/App.jsx
import { useEffect, useState, useRef, useCallback } from 'react';
import './App.css';
import { socket } from './services/socketService';
import { createWebRTCManager } from './services/WebrtcService'; // resetWebRTCManager больше не нужен

// UI компоненты
import Button from './components/ui/Button';
import Input from './components/ui/Input';
import AppLayout from './components/layout/AppLayout';
import CallModal from './components/call/CallModal';

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

const getAvatarColor = (username) => '#cccccc';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [callRooms, setCallRooms] = useState({}); // Только метаданные комнат
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicrophoneMuted, setIsMicrophoneMuted] = useState(false);
  const [audioInputs, setAudioInputs] = useState([]);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  // === СОСТОЯНИЯ ДЛЯ КОНТАКТОВ ===
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // === СОСТОЯНИЯ АВТОРИЗАЦИИ ===
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  // 🔥 useRef для активного WebRTC-менеджера (вместо хранения в состоянии)
  const activeWebrtcManager = useRef(null);

  // Получение устройств
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputs(audioInputs);
      return audioInputs;
    } catch (error) {
      console.error('Ошибка получения устройств:', error);
      return [];
    }
  }, []);

  // Восстановление сессии
  const restoreSession = () => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (typeof user.id === 'string') {
          user.id = parseInt(user.id, 10);
        }
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
  const safeEmit = useCallback((event, data) => {
    if (!socket.connected) {
      console.warn('⚠️ Сокет не подключен, пытаемся переподключиться...');
      socket.connect();
      setTimeout(() => {
        if (socket.connected) {
          socket.emit(event, data);
        }
      }, 1000);
    } else {
      socket.emit(event, data);
    }
  }, []);

  // Загрузка контактов
  const loadContacts = useCallback(async () => {
    if (!currentUser) return;
    const data = await fetchContacts(currentUser.id);
    if (data.success) {
      setContacts(data.contacts || []);
    }
  }, [currentUser]);

  // Поиск пользователей
  const handleSearchAllUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchNotFound(false);
      return;
    }

    try {
      const response = await fetch('/api/users', { credentials: 'include' });
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
      console.error('Ошибка поиска:', error);
      setSearchResults([]);
      setSearchNotFound(true);
    }
  }, [currentUser]);

  // Добавление контакта
  const handleAddContact = useCallback(async (contactId, contactUsername) => {
    if (!currentUser) return;
    const result = await addContact(currentUser.id, contactId);
    if (result.success) {
      loadContacts();
      setSearchResults(prev => prev.filter(c => c.id !== contactId));
    } else {
      alert('Ошибка добавления: ' + result.message);
    }
  }, [currentUser, loadContacts]);

  // === ОСНОВНАЯ ЛОГИКА КОМНАТ ===

  // Создание комнаты и уведомление собеседника
  const createCallRoom = useCallback((targetId, targetName) => {
    if (!currentUser) {
      alert('Сначала войдите в систему');
      return;
    }

    const roomId = `room_${currentUser.id}_${targetId}`;
    const room = {
      roomId,
      targetId,
      targetName,
      status: 'waiting',
      isInitiator: true
    };

    setCallRooms(prev => ({ ...prev, [roomId]: room }));
    safeEmit('room:create', { roomId, targetId, initiatorId: currentUser.id, initiatorName: currentUser.username });
  }, [currentUser, safeEmit]);

  // Подключение к комнате (WebRTC)
  const connectToRoom = useCallback(async (roomId) => {
    if (!currentUser) {
      console.error('Невозможно подключиться: пользователь не авторизован');
      return;
    }

    const room = callRooms[roomId];
    if (!room || room.status !== 'waiting') return;

    setCallRooms(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], status: 'connecting' }
    }));

    try {
      // Создаём НОВЫЙ WebRTCManager (временный)
      const webrtcManager = createWebRTCManager(socket, currentUser.id);
      activeWebrtcManager.current = webrtcManager; // Сохраняем в useRef

      webrtcManager.onRemoteStream = (stream) => {
        setRemoteStream(stream);
      };

      const stream = await webrtcManager.init();
      const audioTrack = stream.getAudioTracks()[0];
      
      if (audioTrack) {
        audioTrack.enabled = true; // 🔥 КРИТИЧЕСКИ ВАЖНО: включаем микрофон
        setLocalStream(stream);
        setIsMicrophoneMuted(false);
      } else {
        throw new Error('Микрофон недоступен');
      }

      await getDevices();

      if (room.isInitiator) {
        const offer = await webrtcManager.createOffer(room.targetId);
        safeEmit('webrtc:offer', { roomId, offer, to: room.targetId });
      }

      // Обновляем статус комнаты (БЕЗ сохранения webrtcManager!)
      setCallRooms(prev => ({
        ...prev,
        [roomId]: { ...prev[roomId], status: 'connected' }
      }));
    } catch (error) {
      console.error('Ошибка подключения к комнате:', error);
      setCallRooms(prev => ({
        ...prev,
        [roomId]: { ...prev[roomId], status: 'waiting' }
      }));
      alert('Не удалось подключиться: ' + error.message);
    }
  }, [callRooms, currentUser, getDevices, safeEmit]);

  // Отключение от комнаты (оставляет комнату открытой)
  const disconnectFromRoom = useCallback((roomId) => {
    const room = callRooms[roomId];
    if (!room) return;

    // Закрываем текущий WebRTCManager
    if (activeWebrtcManager.current) {
      activeWebrtcManager.current.close();
      activeWebrtcManager.current = null;
    }

    // Очищаем медиапотоки
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (remoteStream) {
      setRemoteStream(null);
    }
    setIsMicrophoneMuted(false);

    // Возвращаем комнату в статус ожидания (окно остаётся!)
    setCallRooms(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], status: 'waiting' }
    }));

    safeEmit('room:disconnect', { roomId, userId: currentUser.id });
  }, [callRooms, currentUser, localStream, remoteStream, safeEmit]);

  // Полное закрытие комнаты (удаляет её)
  const closeRoom = useCallback((roomId) => {
    // Сначала отключаемся
    disconnectFromRoom(roomId);

    // Затем удаляем комнату
    setCallRooms(prev => {
      const newRooms = { ...prev };
      delete newRooms[roomId];
      return newRooms;
    });

    safeEmit('room:close', { roomId, userId: currentUser.id });
  }, [disconnectFromRoom, currentUser, safeEmit]);

  // === ОБРАБОТКА СОКЕТОВ ===

  useEffect(() => {
    const initializeApp = async () => {
      const user = restoreSession();
      setupSocketHandlers();
      if (user && !socket.connected) {
        socket.connect();
      }
    };

    initializeApp();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('auth:success');
      socket.off('auth:failed');
      socket.off('room:create');
      socket.off('room:close');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('user_status_change');
    };
  }, []);

  const setupSocketHandlers = useCallback(() => {
    socket.on('connect', () => {
      setSocketStatus('connected');
      const user = JSON.parse(localStorage.getItem('currentUser'));
      if (user?.id) {
        socket.emit('user_online', user.id);
        socket.emit('get_online_users');
      }
    });

    socket.on('online_users_list', (onlineUserIds) => {
  // Обновляем статусы ВСЕХ контактов
  setContacts(prev => 
    prev.map(contact => ({
      ...contact,
      isOnline: onlineUserIds.includes(contact.id)
    }))
  );
  setSearchResults(prev => 
    prev.map(user => ({
      ...user,
      isOnline: onlineUserIds.includes(user.id)
    }))
  );
});

    socket.on('disconnect', () => setSocketStatus('disconnected'));
    socket.on('connect_error', () => setSocketStatus('error'));

    socket.on('auth:success', (data) => {
      setCurrentUser(data.user);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
    });

    socket.on('auth:failed', (data) => {
      alert('❌ Ошибка авторизации: ' + data.message);
      setIsLoading(false);
    });

    // Когда собеседник отключается от комнаты
    socket.on('room:disconnect', (data) => {
      const { roomId } = data;
      setCallRooms(prev => {
        if (prev[roomId]) {
          return {
            ...prev,
            [roomId]: { ...prev[roomId], status: 'waiting' }
          };
        }
        return prev;
      });
    });

    // Кто-то создал комнату для нас
    socket.on('room:create', (data) => {
      const { roomId, initiatorId, initiatorName } = data;
      if (initiatorId === currentUser?.id) return;

      const room = {
        roomId,
        targetId: initiatorId,
        targetName: initiatorName,
        status: 'waiting',
        isInitiator: false
      };

      setCallRooms(prev => ({ ...prev, [roomId]: room }));
    });

    // Кто-то закрыл комнату
    socket.on('room:close', (data) => {
      const { roomId } = data;
      setCallRooms(prev => {
        const newRooms = { ...prev };
        delete newRooms[roomId];
        return newRooms;
      });
    });

    // WebRTC сигналы
    socket.on('webrtc:offer', async (data) => {
      const { roomId, offer } = data;
      const room = callRooms[roomId];
      if (!room || !room.isInitiator) {
        const webrtcManager = createWebRTCManager(socket, currentUser?.id);
        activeWebrtcManager.current = webrtcManager; // Сохраняем для закрытия
        await webrtcManager.handleOffer(offer, data.from);
        const answer = await webrtcManager.createAnswer();
        safeEmit('webrtc:answer', { roomId, answer, to: data.from });
      }
    });

    socket.on('webrtc:answer', async (data) => {
      const { roomId, answer } = data;
      if (activeWebrtcManager.current) {
        await activeWebrtcManager.current.handleAnswer(answer);
      }
    });

    socket.on('webrtc:ice-candidate', async (data) => {
      if (activeWebrtcManager.current) {
        await activeWebrtcManager.current.addIceCandidate(data.candidate);
      }
    });

    // Обновление статусов контактов
    socket.on('user_status_change', (data) => {
      const { userId, isOnline } = data;
      setContacts(prev => prev.map(c => c.id === userId ? { ...c, isOnline } : c));
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, isOnline } : u));
    });
  }, [currentUser, callRooms, safeEmit]);

  // Загрузка контактов ТОЛЬКО после подключения сокета
  useEffect(() => {
    if (currentUser && socketStatus === 'connected') {
      loadContacts();
    }
  }, [currentUser, socketStatus, loadContacts]);

  // === ОСТАЛЬНЫЕ ФУНКЦИИ ===

  const handleLogin = () => {
    if (!loginId.trim() || !loginPassword) {
      setLoginError('Введите имя и пароль');
      return;
    }

    setIsLoading(true);
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginId, password: loginPassword })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setCurrentUser(data.user);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        if (!socket.connected) socket.connect();
      } else {
        setLoginError(data.message);
      }
    })
    .catch(() => setLoginError('Ошибка сети'))
    .finally(() => setIsLoading(false));
  };

  const handleRegister = async () => {
    if (!registerUsername || !registerPassword || registerUsername.length < 3 || registerPassword.length < 6) {
      setLoginError('Имя от 3 символов, пароль от 6');
      return;
    }

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
    } catch {
      setLoginError('Ошибка сети');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMicrophone = () => {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMicrophoneMuted(!track.enabled);
    }
  };

  const handleCallUser = (targetName) => {
    if (!currentUser) {
      alert('Сначала войдите в систему');
      return;
    }

    const contact = [...contacts, ...searchResults].find(c => c.username === targetName);
    if (!contact) {
      alert('Пользователь не найден');
      return;
    }

    if (!contact.isOnline) {
      alert('Пользователь не в сети');
      return;
    }

    createCallRoom(contact.id, targetName);
  };

  const handleLogout = () => {
    if (currentUser) {
      // Закрываем все комнаты
      Object.keys(callRooms).forEach(roomId => {
        closeRoom(roomId);
      });
      
      socket.emit('user_offline', currentUser.id);
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
      socket.disconnect();
    }
  };

  // === РЕНДЕР ===

  if (!currentUser) {
    return (
      <div className="App" style={{ padding: '20px'}}>
        <h1>Besedka</h1>
        <div style={{ marginBottom: '20px', display: 'flex' }}>
          <Button
            variant={!isRegistering ? 'primary' : 'secondary'}
            onClick={() => setIsRegistering(false)}
            style={{ borderRadius: '8px 8px 0 0', flex: 1 }}
          >
            Вход
          </Button>
          <Button
            variant={isRegistering ? 'primary' : 'secondary'}
            onClick={() => setIsRegistering(true)}
            style={{ borderRadius: '88px 8px 0 0', flex: 1 }}
          >
            Регистрация
          </Button>
        </div>

        {isRegistering ? (
          <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
            <Input
              placeholder="Ваше имя (уникальное)"
              value={registerUsername}
              onChange={(e) => setRegisterUsername(e.target.value.trim())}
              onKeyPress={(e) => { if (e.key === 'Enter') handleRegister(); }}
              style={{ marginBottom: '12px' }}
            />
            <Input
              type="password"
              placeholder="Пароль (мин. 6 символов)"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleRegister(); }}
              style={{ marginBottom: '12px' }}
            />
            <Button 
              type="submit"
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </Button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
            <Input
              placeholder="Имя пользователя"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.trim())}
              onKeyPress={(e) => { if (e.key === 'Enter') handleLogin(); }}
              disabled={isLoading}
              style={{ marginBottom: '12px' }}
            />
            <Input
              type="password"
              placeholder="Пароль"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') handleLogin(); }}
              disabled={isLoading}
              style={{ marginBottom: '12px' }}
            />
            <Button 
              type="submit"
              disabled={isLoading} 
              style={{ width: '100%' }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        )}
        
        {loginError && <div style={{ color: 'red', marginTop: '10px' }}>{loginError}</div>}
      </div>
    );
  }

  // Основной интерфейс
  return (
    <AppLayout
      currentUser={currentUser}
      searchQuery={searchQuery}
      searchResults={searchResults}
      searchNotFound={searchNotFound}
      contacts={contacts}
      socketStatus={socketStatus}
      activeTab={activeTab}
      onSearchChange={setSearchQuery}
      onSearchSubmit={() => handleSearchAllUsers(searchQuery)}
      onAddContact={handleAddContact}
      onCallUser={handleCallUser}
      onLogout={handleLogout}
      onReconnect={() => socket.connect()}
    >
      {/* Рендер всех открытых комнат */}
      {Object.values(callRooms).map(room => (
        <CallModal
          key={room.roomId}
          room={room}
          localStream={localStream}
          remoteStream={remoteStream}
          isMicrophoneMuted={isMicrophoneMuted}
          audioInputs={audioInputs}
          onConnect={() => connectToRoom(room.roomId)}
          onToggleMicrophone={toggleMicrophone}
          onDisconnect={() => disconnectFromRoom(room.roomId)}
          onClose={() => closeRoom(room.roomId)}
          onMicrophoneChange={async (deviceId) => {
            if (!localStream) return;
            const newStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: deviceId } },
              video: false
            });
            const oldTrack = localStream.getAudioTracks()[0];
            localStream.removeTrack(oldTrack);
            oldTrack.stop();
            const newTrack = newStream.getAudioTracks()[0];
            localStream.addTrack(newTrack);
            if (activeWebrtcManager.current?.peerConnection) {
              activeWebrtcManager.current.peerConnection.removeTrack(oldTrack);
              activeWebrtcManager.current.peerConnection.addTrack(newTrack, localStream);
            }
          }}
        />
      ))}
    </AppLayout>
  );
}

export default App;