import { expect, test, type Page } from "@playwright/test";

import { api, fixture, registerUser, signIn, type TestUser } from "./helpers";

// Полный цикл аренды двумя пользователями:
// владелец размещает вещь → арендатор бронирует, платит, получает (фото-акт) и возвращает →
// владелец подтверждает возврат → оба оставляют отзывы → сделка засчитана обоим

test.describe.configure({ mode: "serial" });

interface BookingState {
  status: string;
  reviewed_by_me: boolean | null;
}

interface ProfileState {
  stats: { total_deals: number };
}

async function next(page: Page) {
  await page.getByRole("button", { name: "Далее" }).click();
}

test("полный цикл: объявление → бронь → оплата → передача → возврат → отзывы", async ({ browser, request }) => {
  const title = `Шуруповёрт Makita E2E ${Date.now()}`;
  const owner: TestUser = await registerUser(request, "Владелец E2E");
  const renter: TestUser = await registerUser(request, "Арендатор E2E");

  const ownerContext = await browser.newContext();
  const renterContext = await browser.newContext();
  await signIn(ownerContext, owner);
  await signIn(renterContext, renter);
  const ownerPage = await ownerContext.newPage();
  const renterPage = await renterContext.newPage();
  const consoleErrors: string[] = [];
  for (const page of [ownerPage, renterPage]) {
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
  }

  // --- 1. Владелец размещает объявление через мастер -------------------------------------
  await test.step("владелец: мастер из 6 шагов", async () => {
    await ownerPage.goto("/", { waitUntil: "networkidle" });
    await ownerPage.getByRole("link", { name: "Разместить" }).first().click();
    await expect(ownerPage).toHaveURL(/\/listing\/new$/);

    await ownerPage.getByText("Инструменты", { exact: true }).click();
    await next(ownerPage);
    await ownerPage.getByRole("textbox", { name: "Название" }).fill(title);
    await ownerPage.getByRole("textbox", { name: "Описание" }).fill("Два аккумулятора, кейс, набор бит.");
    await next(ownerPage);
    await ownerPage.getByLabel("Цена за сутки, сом").fill("90");
    await ownerPage.getByLabel("Депозит, сом").fill("600");
    await next(ownerPage);
    await expect(ownerPage.getByLabel("Город")).toHaveValue("Душанбе");
    await next(ownerPage);
    await ownerPage.locator('input[type="file"]').setInputFiles([fixture("item-1.jpg"), fixture("item-2.jpg")]);
    await expect(ownerPage.getByText("2 из 8")).toBeVisible();
    await next(ownerPage);
    await expect(ownerPage.getByRole("heading", { name: "Так объявление увидят арендаторы" })).toBeVisible();
    await ownerPage.getByRole("button", { name: "Опубликовать" }).click();

    await expect(ownerPage).toHaveURL(/\/listing\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    await expect(ownerPage.getByRole("heading", { level: 1, name: title })).toBeVisible();
  });
  const listingUrl = ownerPage.url();

  // --- 2. Арендатор бронирует --------------------------------------------------------------
  await test.step("арендатор: календарь и бронь", async () => {
    await renterPage.goto(listingUrl, { waitUntil: "networkidle" });
    await renterPage.getByRole("button", { name: "Забронировать" }).first().click();
    const dialog = renterPage.getByRole("dialog", { name: "Бронирование" });
    const days = dialog.locator(".rdp-day:not(.rdp-disabled) button");
    await days.first().waitFor();
    await days.nth(0).click();
    await days.nth(1).click();
    // 2 дня × 90 + депозит 600 = 780
    await expect(dialog.getByText("780 сом")).toBeVisible();
    await dialog.getByRole("button", { name: "Забронировать" }).click();
    await expect(renterPage).toHaveURL(/\/booking\/[0-9a-f-]{36}$/);
    await expect(renterPage.getByText("Ждёт оплаты")).toBeVisible();
  });
  const bookingUrl = renterPage.url();
  const bookingPath = new URL(bookingUrl).pathname.replace("/booking/", "/bookings/");

  await test.step("арендатор: оплата", async () => {
    await renterPage.getByRole("button", { name: "Оплатить 780 сом" }).click();
    const dialog = renterPage.getByRole("dialog", { name: "Способ оплаты" });
    await dialog.getByText("Humo", { exact: true }).click();
    await dialog.getByRole("button", { name: "Оплатить 780 сом" }).click();
    await expect(renterPage.getByText("Оплачено", { exact: true })).toBeVisible();
  });

  await test.step("арендатор: фото-акт получения", async () => {
    await renterPage.getByRole("button", { name: "Получил вещь — фото-акт" }).click();
    const dialog = renterPage.getByRole("dialog", { name: "Фото-акт получения" });
    await dialog.locator('input[type="file"]').nth(0).setInputFiles(fixture("item-1.jpg"));
    await dialog.locator('input[type="file"]').nth(2).setInputFiles(fixture("item-2.jpg"));
    await expect(dialog.getByRole("img")).toHaveCount(2);
    await dialog.getByRole("button", { name: "Подтвердить получение" }).click();
    await expect(renterPage.getByText("В аренде", { exact: true })).toBeVisible();
  });

  await test.step("арендатор: фото-акт возврата", async () => {
    await renterPage.getByRole("button", { name: "Вернуть вещь — фото-акт" }).click();
    const dialog = renterPage.getByRole("dialog", { name: "Фото-акт возврата" });
    await dialog.locator('input[type="file"]').nth(0).setInputFiles(fixture("item-2.jpg"));
    await expect(dialog.getByRole("img")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Подтвердить возврат" }).click();
    await expect(renterPage.getByText("Возврат", { exact: true }).first()).toBeVisible();
    expect((await api<BookingState>(request, renter, bookingPath)).status).toBe("return_pending");
  });

  // --- 3. Владелец подтверждает возврат ---------------------------------------------------
  await test.step("владелец: входящая бронь и подтверждение возврата", async () => {
    await ownerPage.goto("/profile?tab=incoming", { waitUntil: "networkidle" });
    await ownerPage.getByRole("link", { name: new RegExp(title) }).click();
    await expect(ownerPage).toHaveURL(bookingUrl);
    await ownerPage.getByRole("button", { name: "Подтвердить возврат" }).click();
    const dialog = ownerPage.getByRole("dialog", { name: "Подтверждение возврата" });
    await expect(dialog.getByRole("img")).toHaveCount(3); // 2 фото «до» + 1 «после»
    await dialog.getByText("Всё в порядке").click();
    await dialog.getByRole("button", { name: "Подтвердить" }).click();
    await expect(ownerPage.getByText("Завершена", { exact: true })).toBeVisible();
  });

  // --- 4. Отзывы ---------------------------------------------------------------------------
  await test.step("оба оставляют отзывы", async () => {
    await ownerPage.getByRole("radio", { name: "5 из 5" }).click();
    await ownerPage.getByRole("textbox", { name: "Отзыв" }).fill("Вернул вовремя и в порядке.");
    await ownerPage.getByRole("button", { name: "Отправить отзыв" }).click();
    await expect(ownerPage.getByText("Спасибо! Вы оставили отзыв по этой сделке.")).toBeVisible();

    await renterPage.reload({ waitUntil: "networkidle" });
    await renterPage.getByRole("radio", { name: "4 из 5" }).click();
    await renterPage.getByRole("button", { name: "Отправить отзыв" }).click();
    await expect(renterPage.getByText("Спасибо! Вы оставили отзыв по этой сделке.")).toBeVisible();
  });

  // --- 5. Итог в данных -----------------------------------------------------------------
  await test.step("сделка завершена и засчитана обоим", async () => {
    const asOwner = await api<BookingState>(request, owner, bookingPath);
    const asRenter = await api<BookingState>(request, renter, bookingPath);
    expect(asOwner).toMatchObject({ status: "completed", reviewed_by_me: true });
    expect(asRenter).toMatchObject({ status: "completed", reviewed_by_me: true });

    const ownerProfile = await api<ProfileState>(request, owner, `/users/${owner.id}/profile`);
    const renterProfile = await api<ProfileState>(request, renter, `/users/${renter.id}/profile`);
    expect(ownerProfile.stats.total_deals).toBe(1);
    expect(renterProfile.stats.total_deals).toBe(1);
  });

  expect(consoleErrors).toEqual([]);
  await ownerContext.close();
  await renterContext.close();
});
