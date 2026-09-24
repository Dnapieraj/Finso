import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the positioning and every section in order", async ({ page }) => {
  await expect(page).toHaveTitle(/Finso/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Czy stać cię na to teraz?");

  const sections = page.getByRole("heading", { level: 2 });
  await expect(sections).toHaveText([
    "Nie wykresy z przeszłości. Odpowiedź na teraz.",
    "Jak to działa",
    "Cennik",
  ]);
  await expect(page.locator("#wyrozniki").getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(page.locator("#jak-to-dziala").getByRole("listitem")).toHaveCount(4);
});

test("store links are the only calls to action", async ({ page }) => {
  for (const store of ["App Store", "Google Play"]) {
    // One set in the hero, one under the pricing.
    await expect(page.getByRole("link", { name: `Pobierz z ${store}` })).toHaveCount(2);
  }
  // No purchase, sign-in or form anywhere: the site sells nothing itself.
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page.locator("form, input")).toHaveCount(0);
  await expect(page.getByText(/zaloguj|zarejestruj|kup teraz/i)).toHaveCount(0);
});

test("pricing shows both plans with amounts formatted by formatMoney", async ({ page }) => {
  const pricing = page.locator("#cennik");
  await expect(pricing.getByRole("heading", { level: 3 })).toHaveText(["Free", "Plus"]);
  // formatMoney separates the currency with a non-breaking space, which \s matches.
  await expect(pricing).toContainText(/0\szł/);
  await expect(pricing).toContainText(/12,99\szł/);
  await expect(pricing).toContainText(/99\szł rocznie — wychodzi 8,25\szł miesięcznie/);
});

test("footer links to the legal pages required by the stores", async ({ page }) => {
  const legal = page.getByRole("navigation", { name: "Informacje prawne" });
  await expect(legal.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute(
    "href",
    "/polityka-prywatnosci",
  );
  await expect(legal.getByRole("link", { name: "Regulamin" })).toHaveAttribute(
    "href",
    "/regulamin",
  );
  await expect(legal.getByRole("link", { name: "Usuwanie konta" })).toHaveAttribute(
    "href",
    "/usuwanie-konta",
  );
});

test("the skip link is the first tab stop and moves focus to the content", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Keyboard navigation is a desktop concern.");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Przejdź do treści" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("header navigation jumps to the pricing section", async ({ page, isMobile }) => {
  test.skip(isMobile, "The section nav is hidden on narrow screens.");
  await page
    .getByRole("navigation", { name: "Sekcje strony" })
    .getByRole("link", { name: "Cennik" })
    .click();
  await expect(page.getByRole("heading", { name: "Cennik", level: 2 })).toBeInViewport();
});

test("the page never scrolls sideways", async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("follows the system color scheme", async ({ page }) => {
    // theme.colors.dark.background (#121611).
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 22, 17)");
  });
});
