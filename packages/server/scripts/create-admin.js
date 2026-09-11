import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// 관리자 계정을 서버에서 직접(운영자 권한으로) 생성/재설정하는 CLI.
//
// 배경: isAdmin 여부는 User.email이 ADMIN_EMAIL 환경변수 목록에 있는지로만
// 판단한다 (lib/admin.js). LDAP를 쓰지 않는 로컬 인증 배포에서 이 계정을
// 예전처럼 공개 회원가입(POST /auth/register)으로 만들면, 그 이메일 주소를
// 아는 누구든 관리자보다 먼저 가입해 관리자 권한을 선점할 수 있다.
// 그래서 auth.js는 ADMIN_EMAIL에 해당하는 이메일의 공개 가입을 막아 두었고,
// 관리자 계정은 반드시 이 스크립트로 서버에서 직접 생성해야 한다.
//
// 사용법: node scripts/create-admin.js <email> <password> <name>
//   (또는 npm run admin:create -- <email> <password> <name>)

const prisma = new PrismaClient();

async function main() {
  const [email, password, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(' ');
  if (!email || !password || !name) {
    console.error('사용법: node scripts/create-admin.js <email> <password> <name>');
    process.exit(1);
  }

  const adminEmails = (process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!adminEmails.includes(email.trim().toLowerCase())) {
    console.warn(`[경고] ${email}이(가) 현재 ADMIN_EMAIL 목록에 없습니다. 계정은 생성되지만 isAdmin=true로 취급되지 않습니다.`);
  }

  const hashed = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hashed, name } });
    console.log(`관리자 계정 갱신: ${email}`);
  } else {
    await prisma.user.create({ data: { email, password: hashed, name } });
    console.log(`관리자 계정 생성: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
