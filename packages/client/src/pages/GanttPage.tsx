import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore, useThemeStore } from '../store';
import { roomsApi } from '../api';
import { getActiveToken } from '../utils/authSession';
import GanttChart from '../components/GanttChart';

function PageLoading({ isDark }: { isDark: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '100vh', background: isDark ? '#0f172a' : '#f1f5f9', color: isDark ? '#94a3b8' : '#64748b' }}>
      로딩 중...
    </div>
  );
}

export default function GanttPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const storeToken = useAuthStore((s) => s.token);
  const token = storeToken ?? getActiveToken();
  const isDark = useThemeStore((s) => s.isDark);

  useEffect(() => {
    if (!roomId) navigate('/', { replace: true });
  }, [roomId, navigate]);

  const { data: room, isLoading } = useQuery({
    queryKey: ['rooms', roomId],
    queryFn: () => (roomId ? roomsApi.get(roomId) : Promise.reject(new Error('no roomId'))),
    enabled: !!roomId && !!token,
  });

  if (!roomId) return <PageLoading isDark={isDark} />;

  if (isLoading) return <PageLoading isDark={isDark} />;

  const handleClose = () => {
    if (window.electronAPI?.windowClose) {
      window.electronAPI.windowClose();
    } else {
      window.close();
    }
  };

  return (
    <GanttChart
      roomId={roomId}
      members={room?.members || []}
      onClose={handleClose}
    />
  );
}
