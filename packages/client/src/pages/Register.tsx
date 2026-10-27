import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, fetchTenantBranding, getBaseUrl, setBaseUrl } from '../api';
import { useAuthStore, useBrandStore } from '../store';
import TitleBar, { MacInsetChromeTools } from '../components/TitleBar';
import { AuthCard } from '../components/AuthCard';
import UITextInput from '../components/ui/UITextInput';
import { APP_MAX_WIDTH } from '../layout/constants';
import { applyWindowPinClass, isMacElectron } from '../utils/electronChrome';
import { passwordErrorMessage } from './main/components/PasswordChangeModal';

const REGISTER_WINDOW_HEIGHT = 900;

// 회원가입은 LDAP 연동 중엔 막혀 있으므로(REGISTER_DISABLED) 여기서 나올 수 있는
// 비밀번호 정책 오류는 항상 로컬 정책(4자 이상) 기준이다.
const LOCAL_PASSWORD_POLICY = {
  ldapEnabled: false,
  minLength: 4,
  requireUpper: false,
  requireLower: false,
  requireDigit: false,
  requireSpecial: false,
  hint: '4자 이상',
};

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => getBaseUrl());
  const [pinned, setPinned] = useState(false);
  const { name: brandName, logoUrl: brandLogoUrl, setBrand } = useBrandStore();
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const brandRequestSeq = useRef(0);

  const refreshBranding = (urlOverride: string) => {
    const seq = ++brandRequestSeq.current;
    void fetchTenantBranding(urlOverride || undefined).then((b) => {
      if (seq !== brandRequestSeq.current) return;
      setBrand(b?.name || '', b?.logoUrl || '');
    });
  };

  useEffect(() => {
    void window.electronAPI?.setWindowUiMode?.('login', APP_MAX_WIDTH, REGISTER_WINDOW_HEIGHT);
    void window.electronAPI?.getAlwaysOnTop?.().then((r) => {
      const on = !!r?.alwaysOnTop;
      setPinned(on);
      applyWindowPinClass(on);
    });
    refreshBranding(serverUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (serverUrl.trim()) setBaseUrl(serverUrl.trim());
    else if (!window.electronAPI) {
      try { localStorage.removeItem('emax_api_url'); } catch { /* ignore */ }
    }
    setLoading(true);
    try {
      const { user, token } = await authApi.register(email, password, name);
      setAuth(user, token);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '회원가입 실패';
      setError(
        msg === 'REGISTER_DISABLED'
          ? 'LDAP 연동 중에는 회원가입을 사용할 수 없습니다. 관리자에게 계정을 요청해 주세요.'
          : passwordErrorMessage(err, LOCAL_PASSWORD_POLICY)
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePin = async () => {
    const next = !pinned;
    const r = await window.electronAPI?.setAlwaysOnTop?.(next);
    const on = !!(r?.alwaysOnTop ?? next);
    setPinned(on);
    applyWindowPinClass(on);
  };

  const isElectron = !!window.electronAPI;
  const isMac = isMacElectron();
  const chromeTools = {
    showPin: true,
    pinned,
    onTogglePin: () => { void handleTogglePin(); },
  };

  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-white">
      {isElectron && isMac && <MacInsetChromeTools {...chromeTools} />}
      {isElectron && !isMac && (
        <TitleBar
          title="CSIN-Tech"
          showLogo
          showMaximize={false}
          {...chromeTools}
        />
      )}
      <div className="flex-1 flex items-stretch justify-center overflow-y-auto">
        <AuthCard
          title="계정 만들기"
          variant="flush"
          logoUrl={brandLogoUrl}
          brandName={brandName}
          subtext={
            <>
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-brand font-semibold no-underline hover:underline">
                로그인
              </Link>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#334155]">회사 서버 주소</label>
              <UITextInput
                type="url"
                placeholder="예: https://example.com"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                onBlur={() => {
                  if (serverUrl.trim()) setBaseUrl(serverUrl.trim());
                  else if (!window.electronAPI) {
                    try { localStorage.removeItem('emax_api_url'); } catch { /* ignore */ }
                  }
                  refreshBranding(serverUrl.trim());
                }}
                className="!px-4 !py-3 !rounded-xl !border !border-[#e2e8f0] !bg-[#f8fafc] !text-black placeholder:!text-[#94a3b8]"
              />
            </div>
            <UITextInput
              type="text"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="!px-4 !py-3 !rounded-xl !border !border-[#e2e8f0] !bg-[#f8fafc] !text-black placeholder:!text-[#94a3b8]"
            />
            <UITextInput
              type="email"
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="!px-4 !py-3 !rounded-xl !border !border-[#e2e8f0] !bg-[#f8fafc] !text-black placeholder:!text-[#94a3b8]"
            />
            <div className="relative">
              <UITextInput
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="!px-4 !py-3 !pr-12 !rounded-xl !border !border-[#e2e8f0] !bg-[#f8fafc] !text-black placeholder:!text-[#94a3b8]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#334155] p-1"
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            <p className="text-[13px] text-[#64748b]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" required className="rounded border-[#e2e8f0]" />
                <span>
                  <a href="#" className="text-brand hover:underline">이용약관</a> 및{' '}
                  <Link to="/privacy" className="text-brand hover:underline">개인정보처리방침</Link>에 동의합니다
                </span>
              </label>
            </p>
            {error && (
              <p className="px-3 py-2 rounded-xl text-[13px] text-red-600 bg-red-50/80">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-full bg-black text-white font-semibold text-[15px] disabled:opacity-60 transition-opacity"
            >
              {loading ? '가입 중...' : '계정 만들기'}
            </button>
          </form>
        </AuthCard>
      </div>
    </div>
  );
}
