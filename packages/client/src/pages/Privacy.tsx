import { Link } from 'react-router-dom';
import TitleBar from '../components/TitleBar';

const EFFECTIVE_DATE = '2026-10-27';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold text-[#0f172a]">{title}</h2>
      <div className="text-[13px] leading-relaxed text-[#334155] flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="w-full h-full min-h-0 flex flex-col bg-white">
      {!!window.electronAPI && <TitleBar title="개인정보처리방침" />}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-8 flex flex-col gap-6">
          <div>
            <Link to="/login" className="text-[12px] text-brand hover:underline">← 로그인으로 돌아가기</Link>
            <h1 className="text-[20px] font-bold text-[#0f172a] mt-2">CSIN-Tech 메신저 개인정보처리방침</h1>
            <p className="text-[12px] text-[#94a3b8] mt-1">시행일: {EFFECTIVE_DATE}</p>
          </div>

          <p className="text-[13px] leading-relaxed text-[#334155]">
            [회사명 — 사업자등록번호 — 대표자 — 주소] (이하 &apos;회사&apos;)는 CSIN-Tech 메신저(이하 &apos;서비스&apos;)를 제공하며,
            이용자의 개인정보를 중요하게 생각하고 「개인정보 보호법」 등 관련 법령을 준수합니다. 본 방침은 서비스가 PC(Windows/Mac)
            및 모바일(iOS/Android) 앱 형태로 제공될 때 동일하게 적용됩니다.
          </p>

          <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
            <p><strong>가입 시 수집(필수)</strong>: 이메일(로그인 ID), 비밀번호(암호화 저장), 이름</p>
            <p><strong>가입 시 수집(선택, 조직 설정에 따름)</strong>: 휴대전화번호, 사내 내선번호, 자리 전화번호, 부서, 직급</p>
            <p>
              <strong>서비스 이용 중 생성·수집</strong>: 대화 메시지 및 첨부파일, 프로필 사진, 상태 메시지, 캘린더 일정,
              게시판·프로젝트·업무(태스크) 내용, 메모, 북마크, 설문(투표) 응답, 읍은 확인(읍지 여부) 정보
            </p>
            <p>
              <strong>자동 수집</strong>: 접속 로그, 접속 IP, 기기 정보(OS·앱 버전), 로그인 세션 정보. 모바일 앱에서 알림 수신에
              동의한 경우 알림 발송을 위한 기기 푸시 토큰
            </p>
            <p>
              <strong>거래처(LDAP) 연동 계정의 경우</strong>: 소속 회사의 사내 인증 시스템(LDAP)에서 이메일·이름·부서 등 조직 정보를
              전달받아 계정을 생성·동기화할 수 있습니다.
            </p>
          </Section>

          <Section title="2. 개인정보의 수집·이용 목적">
            <p>· 회원 식별 및 로그인 인증, 부정 이용 방지</p>
            <p>· 메신저(대화·파일 전송), 캘린더, 게시판·프로젝트, 조직도 등 서비스 제공</p>
            <p>· 공지·알림 발송(앱/PC 푸시 알림 포함)</p>
            <p>· 서비스 개선 및 오류 대응을 위한 통계·로그 분석</p>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <p>
              회원 탈퇴 시 또는 소속 회사(거래처)와의 서비스 이용 계약이 종료될 때까지 보관하며, 이후 지체 없이 파기합니다.
              단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관합니다.
            </p>
          </Section>

          <Section title="4. 개인정보의 제3자 제공 및 처리위탁">
            <p>
              회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 소속 회사가 자체 인증(LDAP) 연동을 사용하는
              경우, 로그인 인증 목적으로 해당 회사의 인증 시스템과 정보를 연동합니다. 서비스는 소속 회사(거래처)가 자체적으로
              운영하는 서버에 설치되어 동작할 수 있으며, 이 경우 데이터는 해당 회사가 지정한 서버에 저장·관리됩니다.
            </p>
          </Section>

          <Section title="5. 이용자의 권리와 행사 방법">
            <p>
              이용자는 언제든지 자신의 개인정보를 조회·수정할 수 있으며, 소속 회사의 관리자 또는 아래 문의처를 통해 열람·정정·삭제·
              처리정지를 요구할 수 있습니다.
            </p>
          </Section>

          <Section title="6. 개인정보의 파기 절차 및 방법">
            <p>
              전자적 파일 형태로 저장된 개인정보는 복구·재생이 불가능한 방법으로 영구 삭제합니다. 종이 문서로 출력된 경우는
              존재하지 않습니다(서비스는 전산 시스템으로만 운영됩니다).
            </p>
          </Section>

          <Section title="7. 모바일 앱 권한 안내">
            <p>
              모바일 앱은 서버 통신을 위한 인터넷 접근 권한만 사용합니다. 파일 첨부·프로필 사진 등록 시에는 운영체제가 제공하는
              표준 파일/사진 선택 기능을 이용하며, 선택한 파일만 서비스로 전송됩니다. 알림 수신에 동의한 경우에만 푸시 알림을
              발송합니다.
            </p>
          </Section>

          <Section title="8. 개인정보의 안전성 확보 조치">
            <p>· 비밀번호는 암호화하여 저장합니다.</p>
            <p>· 서버-클라이언트 간 통신은 HTTPS로 암호화됩니다.</p>
            <p>· 접근 권한이 있는 담당자만 개인정보에 접근할 수 있도록 통제합니다.</p>
          </Section>

          <Section title="9. 개인정보 보호책임자">
            <p>
              성명: [담당자명] <br />
              연락처: [이메일/전화번호]
            </p>
          </Section>

          <Section title="10. 고지의 의무">
            <p>
              본 방침은 법령·정책 변경에 따라 수정될 수 있으며, 변경 시 서비스 내 공지 또는 본 페이지를 통해 고지합니다.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
