// client/src/components/auth/AuthForm.jsx
import React from 'react';

export default function AuthForm({
  isRegistering,
  setIsRegistering,
  loginId,
  setLoginId,
  loginPassword,
  setLoginPassword,
  registerUsername,
  setRegisterUsername,
  registerPassword,
  setRegisterPassword,
  handleLogin,
  handleRegister,
  loginError,
  isLoading,
  socketStatus
}) {
  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Helvetica' }}>
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
        <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
          <input
            type="text"
            placeholder="Ваше имя (уникальное)"
            value={registerUsername}
            onChange={(e) => setRegisterUsername(e.target.value.trim())}
            onKeyPress={(e) => { if (e.key === 'Enter') handleRegister(); }}
            style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
          />
          <input
            type="password"
            placeholder="Пароль (мин. 6 символов)"
            value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleRegister(); }}
            style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
          />
          <button 
            type="submit"
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
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
          <input
            type="text"
            placeholder="Имя пользователя"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.trim())}
            onKeyPress={(e) => { if (e.key === 'Enter') handleLogin(); }}
            disabled={isLoading}
            style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleLogin(); }}
            disabled={isLoading}
            style={{ display: 'block', margin: '10px 0', padding: '10px', width: '300px' }}
          />
          <button 
            type="submit"
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
        </form>
      )}
      
      {loginError && <div style={{ color: 'red', marginTop: '10px' }}>{loginError}</div>}
    </div>
  );
}