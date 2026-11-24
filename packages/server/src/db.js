import { PrismaClient } from '@prisma/client';
import { decryptDeep, encryptText, getKey } from './lib/dataCrypto.js';

// 대화 내용(Message.content, MessageArchive.content)은 DATA_ENCRYPTION_KEY가 있으면 저장 시 암호화하고,
// 어떤 조회 결과에 섞여 나와도(include 포함) 읽을 때 자동으로 푼다. 키가 없으면 기존처럼 평문으로 동작한다.
const ENCRYPTED_MODELS = new Set(['Message', 'MessageArchive']);
const WRITE_OPS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany', 'createManyAndReturn']);

function encryptContentIn(data) {
  if (Array.isArray(data)) return data.map(encryptContentIn);
  if (data && typeof data === 'object' && typeof data.content === 'string') {
    return { ...data, content: encryptText(data.content) };
  }
  return data;
}

function encryptArgs(operation, args) {
  if (!args || !getKey()) return args;
  if (operation === 'upsert') {
    return { ...args, create: encryptContentIn(args.create), update: encryptContentIn(args.update) };
  }
  if (args.data !== undefined) return { ...args, data: encryptContentIn(args.data) };
  return args;
}

const base = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
    : [{ emit: 'stdout', level: 'error' }],
});

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const nextArgs = ENCRYPTED_MODELS.has(model) && WRITE_OPS.has(operation) ? encryptArgs(operation, args) : args;
        const result = await query(nextArgs);
        return decryptDeep(result);
      },
    },
  },
});

// 프로세스 종료 시 연결 정리
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
