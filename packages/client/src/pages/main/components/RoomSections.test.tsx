// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Folder, PublicRoom, Room } from '../../../api';
import RoomSections, { type RoomSectionsProps } from './RoomSections';

/**
 * react-virtuoso는 실제 브라우저 레이아웃(ResizeObserver, 스크롤 컨테이너 높이 등)을 측정해서
 * 몇 개를 그릴지 정하는데, jsdom엔 레이아웃 엔진이 없어 항상 0으로 계산돼 아무 것도 안 그려진다.
 * 여기서 검증하려는 건 가상 스크롤 자체(그건 라이브러리가 이미 검증된 부분)가 아니라 "패널을
 * 하나의 평탄화된 행 목록으로 만들고, 펼침/접힘 상태에 맞게 올바른 행을 순서대로 렌더링하는지"이므로
 * Virtuoso를 전부 그리는 단순 컴포넌트로 대체해서 그 부분만 테스트한다.
 */
vi.mock('react-virtuoso', () => ({
  Virtuoso: <T,>({ data, itemContent }: { data: T[]; itemContent: (index: number, item: T) => ReactNode }) => (
    <div>{data.map((item, i) => <div key={i}>{itemContent(i, item)}</div>)}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const makeRoom = (id: string, overrides: Partial<Room> = {}): Room => ({
  id,
  name: `room-${id}`,
  isGroup: false,
  members: [],
  lastMessage: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeFolder = (id: string, name: string): Folder => ({
  id,
  userId: 'me',
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const makePublicRoom = (id: string): PublicRoom => ({
  id,
  name: `public-${id}`,
  memberCount: 3,
  isMember: false,
  lastMessage: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

function baseProps(overrides: Partial<RoomSectionsProps> = {}): RoomSectionsProps {
  const folderedRoom = makeRoom('folder-room-1');
  const unclassifiedRoom = makeRoom('unclassified-1');
  const chatRoom = makeRoom('chat-1');
  const folder = makeFolder('f1', '업무');

  return {
    isDark: false,
    roomsError: null,
    folders: [folder],
    topicRooms: [folderedRoom, unclassifiedRoom],
    chatRooms: [chatRoom],
    topicUnreadCount: 0,
    chatUnreadCount: 0,
    sectionOpen: { topic: true, chat: true },
    roomsByFolder: new Map([
      ['f1', [folderedRoom]],
      [null, [unclassifiedRoom]],
    ]),
    folderOpen: { f1: true },
    publicRooms: [],
    allRooms: [folderedRoom, unclassifiedRoom, chatRoom],
    toggleSection: vi.fn(),
    toggleFolder: vi.fn(),
    setShowFolderManageModal: vi.fn(),
    setCreateGroupFor: vi.fn(),
    setShowCreateGroupModal: vi.fn(),
    renderRoomItem: (room: Room) => (
      <button key={room.id} type="button" data-testid={`room-${room.id}`}>{room.name}</button>
    ),
    onJoinPublicRoom: vi.fn(),
    ...overrides,
  };
}

describe('RoomSections (가상 스크롤)', () => {
  it('헤더·폴더·미분류·채팅 방을 모두 렌더링한다', () => {
    render(<RoomSections {...baseProps()} />);

    expect(screen.getByText('아젠다')).toBeInTheDocument();
    expect(screen.getByText('채팅')).toBeInTheDocument();
    expect(screen.getByText('업무')).toBeInTheDocument();
    expect(screen.getByText('미분류')).toBeInTheDocument();
    expect(screen.getByTestId('room-folder-room-1')).toBeInTheDocument();
    expect(screen.getByTestId('room-unclassified-1')).toBeInTheDocument();
    expect(screen.getByTestId('room-chat-1')).toBeInTheDocument();
  });

  it('폴더를 접으면 그 방은 안 보이고 폴더 헤더는 남는다', () => {
    render(<RoomSections {...baseProps({ folderOpen: { f1: false } })} />);

    expect(screen.getByText('업무')).toBeInTheDocument();
    expect(screen.queryByTestId('room-folder-room-1')).not.toBeInTheDocument();
    // 채팅 섹션은 별개로 계속 보임
    expect(screen.getByTestId('room-chat-1')).toBeInTheDocument();
  });

  it('아젠다 섹션을 접으면 아젠다 쪽 내용은 안 보이고 채팅은 그대로다', () => {
    render(<RoomSections {...baseProps({ sectionOpen: { topic: false, chat: true } })} />);

    expect(screen.getByText('아젠다')).toBeInTheDocument();
    expect(screen.queryByText('업무')).not.toBeInTheDocument();
    expect(screen.queryByTestId('room-folder-room-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('room-chat-1')).toBeInTheDocument();
  });

  it('방이 하나도 없으면 각 섹션에 빈 상태 문구가 뜬다', () => {
    render(<RoomSections {...baseProps({
      folders: [],
      topicRooms: [],
      chatRooms: [],
      roomsByFolder: new Map(),
      allRooms: [],
    })} />);

    expect(screen.getByText('아젠다가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('채팅이 없습니다')).toBeInTheDocument();
  });

  it('불러오기 실패 시 에러 문구가 뜬다', () => {
    render(<RoomSections {...baseProps({ roomsError: new Error('boom') })} />);
    expect(screen.getByText('목록을 불러올 수 없습니다')).toBeInTheDocument();
  });

  it('참가 가능한 공개 채널만 목록에 뜨고 참가 버튼이 동작한다', async () => {
    const user = userEvent.setup();
    const onJoinPublicRoom = vi.fn().mockResolvedValue(undefined);
    const alreadyMemberRoom = makeRoom('chat-1'); // allRooms에 이미 있는 id와 겹침 → 목록에서 제외돼야 함
    render(<RoomSections {...baseProps({
      publicRooms: [makePublicRoom('p1'), makePublicRoom('chat-1')],
      allRooms: [alreadyMemberRoom],
      onJoinPublicRoom,
    })} />);

    expect(screen.getByText('공개 채널')).toBeInTheDocument();
    expect(screen.getByText('public-p1')).toBeInTheDocument();
    expect(screen.queryByText('public-chat-1')).not.toBeInTheDocument();

    await user.click(screen.getByText('참가'));
    expect(onJoinPublicRoom).toHaveBeenCalledWith('p1');
  });

  it('섹션/폴더 헤더 클릭이 각각 toggleSection/toggleFolder를 호출한다', async () => {
    const user = userEvent.setup();
    const toggleSection = vi.fn();
    const toggleFolder = vi.fn();
    render(<RoomSections {...baseProps({ toggleSection, toggleFolder })} />);

    await user.click(screen.getByText('채팅'));
    expect(toggleSection).toHaveBeenCalledWith('chat');

    await user.click(screen.getByText('업무'));
    expect(toggleFolder).toHaveBeenCalledWith('f1');
  });
});
