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
  await expect(page).not.toHaveURL(/\/login/);
  return { context, page };
}

test("sign in → submit → moderate → account history", async ({ browser }) => {
  test.skip(
    !fixture.userEmail || !fixture.userPassword || !fixture.moderatorEmail
      || !fixture.moderatorPassword || !fixture.placeId,
    "Set the E2E_* fixture variables documented in README.md",
  );

  const user = await signIn(browser, fixture.userEmail!, fixture.userPassword!);
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
  const { report } = await submitted.json() as { report: { id: string } };

  const moderator = await signIn(
    browser,
    fixture.moderatorEmail!,
    fixture.moderatorPassword!,
  );
  const moderated = await moderator.context.request.patch(
    `/api/admin/reports/${report.id}`,
    { data: { approve: true } },
  );
  expect(moderated.ok()).toBe(true);

  await user.page.goto("/account");
  await user.page.getByRole("button", { name: "archive" }).first().click();
  await expect(user.page.getByText("Reviewed")).toBeVisible();
  await user.context.close();
  await moderator.context.close();
});
