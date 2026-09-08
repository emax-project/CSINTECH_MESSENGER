import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const ROOM_NAME = process.env.E2E_ROOM_NAME;
const MESSAGE = process.env.E2E_MESSAGE || `E2E smoke ${Date.now()}`;

test.describe('smoke chat flow', () => {
  test('login -> open room -> send message', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD || !ROOM_NAME, 'Set E2E_EMAIL, E2E_PASSWORD, E2E_ROOM_NAME first.');

    await page.goto('/login');

    await page.getByPlaceholder(/아이디 또는 이메일/).fill(EMAIL!);
    await page.getByPlaceholder('비밀번호', { exact: true }).fill(PASSWORD!);
    await page.getByRole('button', { name: '로그인' }).click();

    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 10_000 }).catch(async () => {
      const invalidCredsVisible = await page.getByText(/Invalid email or password|로그인 실패/i).isVisible().catch(() => false);
      if (invalidCredsVisible) {
        throw new Error('E2E login failed: check E2E_EMAIL / E2E_PASSWORD test account credentials.');
      }
      throw new Error('E2E login did not navigate away from /login within timeout.');
    });

    await page.getByText('조직도').first().waitFor({ timeout: 15_000 });
    const noticeConfirm = page.getByRole('button', { name: '확인' });
    if (await noticeConfirm.isVisible().catch(() => false)) {
      await noticeConfirm.click();
    }
    await page.getByTitle('대화').click();

    const roomItem = page.getByText(ROOM_NAME!, { exact: true });
    if (await roomItem.isVisible().catch(() => false)) {
      await roomItem.click();
    } else {
      // Fallback: pick a concrete room row (includes view mode + time), not section header buttons.
      const firstRoomRow = page.getByRole('button', { name: /챗뷰.*(오전|오후)/ }).first();
      if (await firstRoomRow.isVisible().catch(() => false)) {
        await firstRoomRow.click();
      } else {
        // Last resort: try room-like names while excluding section headers.
        const firstRoomByName = page.getByRole('button', { name: /테스트.*(오전|오후)|채팅.*(오전|오후)/ }).first();
        await firstRoomByName.click();
      }
    }

    await page.waitForURL(/\/room\/.+/, { timeout: 10_000 });
    await expect(page.getByPlaceholder('메시지 입력')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('메시지 입력').fill(MESSAGE);
    await page.getByRole('button', { name: '전송' }).click();

    const sentMessageCandidates = page.getByText(MESSAGE);
    await expect(sentMessageCandidates.first()).toBeVisible();
  });
});
