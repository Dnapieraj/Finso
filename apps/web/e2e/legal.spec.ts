import { expect, test } from "@playwright/test";

const SITE = "https://finso.app";
const CONTACT = "kontakt@finso.app";

const legalPages = [
  { path: "/polityka-prywatnosci", heading: "Polityka prywatności" },
  { path: "/regulamin", heading: "Regulamin" },
  { path: "/usuwanie-konta", heading: "Usuwanie konta" },
] as const;

for (const { path, heading } of legalPages) {
  test.describe(heading, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
    });

    test("has its own heading, title, description and canonical URL", async ({ page }) => {
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page).toHaveTitle(`${heading} — Finso`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{50,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}${path}`);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        `${SITE}${path}`,
      );
    });

    test("shows when it was last updated", async ({ page }) => {
      await expect(page.locator("main time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    });

    test("keeps the site header and footer", async ({ page }) => {
      await expect(page.getByRole("link", { name: "Finso — strona główna" })).toHaveAttribute(
        "href",
        "/",
      );
      await expect(
        page.getByRole("navigation", { name: "Informacje prawne" }).getByRole("link"),
      ).toHaveCount(3);
    });

    test("never scrolls sideways", async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  });
}

test("footer links open every legal page", async ({ page }) => {
  for (const { heading } of legalPages) {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Informacje prawne" })
      .getByRole("link", { name: heading })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});

test("header section links lead back to the landing page", async ({ page, isMobile }) => {
  test.skip(isMobile, "The section nav is hidden on narrow screens.");
  await page.goto("/regulamin");
  await page
    .getByRole("navigation", { name: "Sekcje strony" })
    .getByRole("link", { name: "Cennik" })
    .click();
  await expect(page).toHaveURL("/#cennik");
  await expect(page.getByRole("heading", { name: "Cennik", level: 2 })).toBeInViewport();
});

test.describe("account deletion page (Google Play requirement)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/usuwanie-konta");
  });

  test("names the app and lists the in-app steps in order", async ({ page }) => {
    await expect(page.locator("main")).toContainText("Finso");
    const steps = page.getByRole("region", { name: "W aplikacji" }).getByRole("listitem");
    await expect(steps.first()).toContainText("Ustawienia");
    expect(await steps.count()).toBeGreaterThanOrEqual(3);
  });

  test("offers deletion by e-mail without installing the app", async ({ page }) => {
    const section = page.getByRole("region", { name: "Bez aplikacji" });
    await expect(section.getByRole("link", { name: CONTACT })).toHaveAttribute(
      "href",
      new RegExp(`^mailto:${CONTACT}\\?subject=`),
    );
    await expect(section).toContainText("30 dni");
  });

  test("says which data is deleted", async ({ page }) => {
    await expect(page.getByRole("region", { name: "Jakie dane usuwamy" })).toContainText(
      /wszystkie/i,
    );
  });

  test("warns that a store subscription has to be cancelled separately", async ({ page }) => {
    const section = page.getByRole("region", { name: "Subskrypcja Plus" });
    await expect(section).toContainText("App Store");
    await expect(section).toContainText("Google Play");
  });
});

test("privacy policy gives contact, deletion and complaint routes", async ({ page }) => {
  await page.goto("/polityka-prywatnosci");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: CONTACT }).first()).toHaveAttribute(
    "href",
    `mailto:${CONTACT}`,
  );
  await expect(main.getByRole("link", { name: /usuwanie konta/i }).first()).toHaveAttribute(
    "href",
    "/usuwanie-konta",
  );
  await expect(main).toContainText("Prezesa Urzędu Ochrony Danych Osobowych");
});

// Lists only the services actually integrated. When Sentry or PostHog
// arrives, this fails on purpose: the policy has to be updated with it.
test("privacy policy names only the processors in use", async ({ page }) => {
  await page.goto("/polityka-prywatnosci");
  const recipients = page.getByRole("region", { name: "Komu przekazujemy dane" });
  for (const name of ["RevenueCat", "Apple", "Google"]) {
    await expect(recipients).toContainText(name);
  }
  await expect(page.locator("main")).not.toContainText(/Sentry|PostHog/);
});

test("privacy policy says biometrics stay on the phone", async ({ page }) => {
  await page.goto("/polityka-prywatnosci");
  const biometrics = page.getByRole("region", { name: "Logowanie biometryczne" });
  await expect(biometrics).toContainText("nie zbiera danych biometrycznych");
  await expect(biometrics).toContainText("system telefonu");
});

test("terms say payments go through the stores and are not financial advice", async ({ page }) => {
  await page.goto("/regulamin");
  const main = page.locator("main");
  await expect(main).toContainText("App Store");
  await expect(main).toContainText("Google Play");
  await expect(main).toContainText(/nie stanowi(ą)? porady finansowej/);
  await expect(main.getByRole("link", { name: "Polityka prywatności" }).first()).toHaveAttribute(
    "href",
    "/polityka-prywatnosci",
  );
});

// The privacy policy promises this, so the test keeps the promise true.
test("the site sets no cookies", async ({ page, context }) => {
  for (const path of ["/", ...legalPages.map((p) => p.path)]) await page.goto(path);
  expect(await context.cookies()).toEqual([]);
});

test.describe("SEO files", () => {
  test("robots.txt allows crawling and points to the sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });

  test("sitemap.xml lists the home page and every legal page", async ({ request }) => {
    const body = await (await request.get("/sitemap.xml")).text();
    for (const path of ["", ...legalPages.map((p) => p.path)]) {
      expect(body).toContain(`<loc>${SITE}${path}</loc>`);
    }
  });

  test("the home page has an absolute canonical URL", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https:\/\/finso\.app\/?$/,
    );
  });
});

test("unknown pages return 404 with a way back home", async ({ page }) => {
  const response = await page.goto("/nie-ma-takiej-strony");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nie ma takiej strony");
  await expect(
    page.locator("main").getByRole("link", { name: "Wróć na stronę główną" }),
  ).toHaveAttribute("href", "/");
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("legal pages follow the system color scheme", async ({ page }) => {
    await page.goto("/usuwanie-konta");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(18, 22, 17)");
  });
});
