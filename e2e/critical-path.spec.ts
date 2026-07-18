import { expect, test, type Browser } from "@playwright/test";

const fixture = {
  userEmail: process.env.E2E_USER_EMAIL,
  userPassword: process.env.E2E_USER_PASSWORD,
  moderatorEmail: process.env.E2E_MODERATOR_EMAIL,
  moderatorPassword: process.env.E2E_MODERATOR_PASSWORD,
  placeId: process.env.E2E_PLACE_ID,
};

async function signIn(browser: Browser, email: string, password: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#sign-in-password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/account(?:\?.*)?$/, { timeout: 20_000 });
  return { context, page };
}

test("sign in → submit → moderate → account history", async ({ browser }) => {
  // `next dev` compiles each page and Route Handler on first use in CI. The
  // complete two-session workflow needs more than Playwright's 30s default on
  // a cold runner even when every individual operation succeeds.
  test.setTimeout(90_000);

  test.skip(
    !fixture.userEmail || !fixture.userPassword || !fixture.moderatorEmail
      || !fixture.moderatorPassword || !fixture.placeId,
    "Set the E2E_* fixture variables documented in README.md",
  );

  const user = await test.step("sign in as the reporting user", () =>
    signIn(browser, fixture.userEmail!, fixture.userPassword!),
  );
  const report = await test.step("submit a report for moderation", async () => {
    const submitted = await user.context.request.post(
      `/api/places/${fixture.placeId}/reports`,
      {
        data: {
          multiplier: 5,
          transactionDate: new Date().toISOString().slice(0, 10),
          paymentContext: "in_store",
          intent: "error",
        },
      },
    );
    expect(submitted.status()).toBe(201);
    return (await submitted.json() as { report: { id: string } }).report;
  });

  const moderator = await test.step("sign in as the moderator", () =>
    signIn(
      browser,
      fixture.moderatorEmail!,
      fixture.moderatorPassword!,
    ),
  );
  await test.step("approve the submitted report", async () => {
    const moderated = await moderator.context.request.patch(
      `/api/admin/reports/${report.id}`,
      { data: { approve: true } },
    );
    expect(moderated.ok()).toBe(true);
  });

  await test.step("show the reviewed report in account history", async () => {
    await user.page.goto("/account");
    await user.page.getByRole("button", { name: "archive" }).first().click();
    await expect(user.page.getByText("Reviewed", { exact: true })).toBeVisible();
  });
  await test.step("trap and restore focus in the account deletion dialog", async () => {
    const trigger = user.page.getByRole("button", { name: "Delete account" });
    await trigger.click();

    const dialog = user.page.getByRole("dialog", {
      name: "Permanently delete account?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Confirmation")).toBeFocused();

    await user.page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await user.page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Confirmation")).toBeFocused();

    await user.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
  await user.context.close();
  await moderator.context.close();
});
