import dns from 'dns';

const { promises: dnsPromises } = dns;

// 서버가 사용자 지정 URL을 직접 요청(fetch)할 때 내부망/루프백/링크로컬/클라우드
// 메타데이터 엔드포인트로 향하는 것을 막기 위한 공용 SSRF 방어 유틸.
// (routes/linkPreview.js, routes/settings.js 등에서 공통으로 사용)

const BLOCKED_HOSTNAMES = new Set(['localhost', '169.254.169.254', 'metadata.google.internal']);

function isPrivateIPv4(ip) {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true; // loopback / private / "this network"
  if (a === 169 && b === 254) return true; // link-local (클라우드 메타데이터 포함)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  return false;
}

function isPrivateIPv6(ip) {
  const host = ip.toLowerCase();
  if (host === '::1') return true; // loopback
  if (host === '::' ) return true;
  if (host.startsWith('fe80:')) return true; // link-local
  if (host.startsWith('fc') || host.startsWith('fd')) return true; // unique local
  if (host.startsWith('::ffff:')) return isPrivateIPv4(host.slice(7)); // IPv4-mapped
  return false;
}

/** 호스트명/IP 리터럴 자체만으로 판단 가능한 차단 여부 (DNS 조회 전 1차 필터) */
export function isBlockedHostname(hostname) {
  const host = (hostname || '').toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (isPrivateIPv4(host)) return true;
  if (host.includes(':') && isPrivateIPv6(host)) return true;
  return false;
}

/**
 * 호스트명이 가리키는 실제 IP까지 조회해 사설/루프백 대역인지 검증한다.
 * (DNS Rebinding 방지: 호스트명 문자열만 검사하면 attacker가 통과 후
 * 실제 연결 시점에 내부 IP로 응답하는 서버를 둘 수 있음)
 * 문제 없으면 통과, 문제 있으면 Error를 던진다.
 */
export async function assertPublicHost(urlString) {
  const parsed = new URL(urlString);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('허용되지 않은 프로토콜입니다');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('내부 주소는 사용할 수 없습니다');
  }
  let addresses;
  try {
    addresses = await dnsPromises.lookup(parsed.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('주소를 확인할 수 없습니다');
  }
  for (const { address } of addresses) {
    if (address.includes(':') ? isPrivateIPv6(address) : isPrivateIPv4(address)) {
      throw new Error('내부 주소는 사용할 수 없습니다');
    }
  }
  return parsed;
}

/**
 * fetch()를 SSRF 방어와 함께 감싼 래퍼. 리다이렉트를 자동으로 따라가지 않고
 * 매 홉마다 대상 호스트를 재검증한다 (DNS rebinding + 내부 주소로의 리다이렉트 방지).
 */
export async function safeFetch(urlString, options = {}, { maxRedirects = 3 } = {}) {
  let currentUrl = urlString;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicHost(currentUrl);
    const response = await fetch(currentUrl, { ...options, redirect: 'manual' });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) return response;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return response;
  }
  throw new Error('리다이렉트가 너무 많습니다');
}
