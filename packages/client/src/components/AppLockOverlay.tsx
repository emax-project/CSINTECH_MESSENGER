import { useState } from 'react';
import { authApi } from '../api';
import { useAuthStore } from '../store';
import UITextInput from './ui/UITextInput';

export default function AppLockOverlay({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !password) return;
    setError('');
    setLoading(true);
    try {
      await authApi.login(user.email, password);
      setPassword('');
      onUnlock();
    } catch {
      setError('비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[200000] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
      <form
        onSubmit={(e) => { void handleUnlock(e); }}
        className="w-[min(360px,90%)] rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="m-0 text-[17px] font-bold text-slate-900">화면 잠금</h2>
        <p className="mt-1.5 mb-4 text-[13px] text-slate-500">
          {user?.name ? `${user.name}님, ` : ''}잠금을 해제하려면 비밀번호를 입력하세요.
        </p>
        <UITextInput
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="!px-4 !py-3 !rounded-xl !border !border-[#e2e8f0] !bg-[#f8fafc] !text-black"
        />
        {error && <p className="mt-2 mb-0 text-[13px] text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-4 w-full rounded-full bg-black py-3 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          {loading ? '확인 중...' : '잠금 해제'}
        </button>
      </form>
    </div>
  );
}
