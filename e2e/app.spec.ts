import { test, expect, type Page } from "@playwright/test";

// Unique product per run so retries never collide.
const RUN = Date.now().toString(36);
const PRODUCT_NAME = `E2E Shirt ${RUN}`;

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter password").fill("admin123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL("/");
}

test.describe.serial("MEN'S EDIT COLLECTIONS E2E", () => {
  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Enter password").fill("wrongpass");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Incorrect password")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test("login and see dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Products")).toBeVisible();
    await expect(page.getByText("Available Stock")).toBeVisible();
  });

  test("add a product with default sizes", async ({ page }) => {
    await login(page);
    await page.goto("/products/new");
    await page.getByPlaceholder("e.g. Black Casual Shirt").fill(PRODUCT_NAME);
    await page.locator("select").first().selectOption("Shirt");
    await page.locator('input[type="number"]').first().fill("1500");
    await page.getByRole("button", { name: "Add Product" }).click();
    await expect(page).toHaveURL("/products");
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
  });

  test("open product, set stock, sell and retrieve", async ({ page }) => {
    await login(page);
    await page.goto("/products");
    await page.getByRole("heading", { name: PRODUCT_NAME }).click();
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();

    // Set M stock to 5
    const stockInput = page.locator("input[inputmode='numeric']").first();
    await stockInput.fill("5");
    await page.getByRole("button", { name: "SET STOCK" }).first().click();
    await expect(page.getByText("5 available · 0 sold")).toBeVisible({ timeout: 5000 });

    // Sell one M
    await page.getByRole("button", { name: "SELL", exact: true }).first().click();
    await page.getByRole("button", { name: "Mark Sold" }).click();
    await expect(page.getByText("4 available · 1 sold")).toBeVisible({ timeout: 5000 });

    // Retrieve it back
    await page.getByRole("button", { name: /RETRIEVE/ }).first().click();
    await page.getByRole("button", { name: "Retrieve", exact: true }).click();
    await expect(page.getByText("5 available · 0 sold")).toBeVisible({ timeout: 5000 });
  });

  test("add a custom size", async ({ page }) => {
    await login(page);
    await page.goto("/products");
    await page.getByRole("heading", { name: PRODUCT_NAME }).click();
    await page.getByPlaceholder("Add size (S, XXL, 30...)").fill("XXL");
    await page.getByRole("button", { name: "+ Size" }).click();
    await expect(page.getByText("Size XXL", { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("daily sales entry saves and lists", async ({ page }) => {
    await login(page);
    await page.goto("/sales");
    await page.locator('input[type="number"]').first().fill("2500");
    await page.getByPlaceholder("e.g. Cash / UPI collection").fill(`E2E note ${RUN}`);
    await page.getByRole("button", { name: "Save Daily Sales" }).click();
    await expect(page.getByText(`E2E note ${RUN}`)).toBeVisible({ timeout: 5000 });
  });

  test("history shows activity", async ({ page }) => {
    await login(page);
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Stock History" })).toBeVisible();
    await expect(page.locator("span", { hasText: /^Product Added$/ }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("p", { hasText: PRODUCT_NAME }).first()).toBeVisible();
  });

  test("search and filter products", async ({ page }) => {
    await login(page);
    await page.goto("/products");
    await page.getByPlaceholder("Search by name or SKU...").fill(PRODUCT_NAME);
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
    await page.getByPlaceholder("Search by name or SKU...").fill("nonexistent-xyz");
    await expect(page.getByText("No products match your filters")).toBeVisible();
  });

  test("delete product", async ({ page }) => {
    await login(page);
    await page.goto("/products");
    await page.getByRole("heading", { name: PRODUCT_NAME }).click();
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.getByRole("button", { name: "Delete", exact: true }).last().click();
    await expect(page).toHaveURL("/products");
    await page.getByPlaceholder("Search by name or SKU...").fill(PRODUCT_NAME);
    await expect(page.getByText("No products match your filters")).toBeVisible();
  });
});
