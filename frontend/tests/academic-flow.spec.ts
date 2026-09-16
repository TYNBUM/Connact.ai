import { expect, test } from "@playwright/test";
import type { Draft, Persona } from "../lib/types";

test("Academic search and workflow keep domain context through draft creation", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/people");
  await page
    .getByRole("button", { name: "Academic mentors", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Academic Mentor Search", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Academic title", { exact: true }).fill("Professor");
  await page.getByLabel("Institution / university", { exact: true }).fill("");
  await page.getByLabel("Research keywords", { exact: true }).fill("");
  await page.getByLabel("Research area", { exact: true }).fill("");
  const searchRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/academic/search/jobs",
  );
  await page
    .getByRole("button", { name: "Search mentors", exact: true })
    .click();
  const submittedSearch = (await searchRequest).postDataJSON();
  expect(submittedSearch).toMatchObject({
    title: "Professor",
    company: "",
    location: "",
    keywords: "",
    sector: "",
    page: 1,
    per_page: 10,
  });
  await expect(page.getByText(/mentors found$/)).toBeVisible();

  await page.goto("/academic");
  const flow = page.getByTestId("academic-flow");
  await expect(flow).toHaveAttribute("data-domain", "academic");
  await expect(flow).toHaveAttribute("data-step", "0");
  await expect(
    page
      .getByRole("navigation", { name: "Academic workflow steps" })
      .getByRole("button"),
  ).toHaveCount(5);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const personaLabel = `Academic flow ${suffix}`;
  const closeEditor = page.getByRole("button", {
    name: "Close persona editor",
    exact: true,
  });
  if (!(await page.getByLabel("Persona name", { exact: true }).isVisible())) {
    await page
      .getByRole("button", { name: "Create a persona", exact: true })
      .click();
  }
  await page.getByLabel("Persona name", { exact: true }).fill(personaLabel);
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Scholar");
  await page
    .getByLabel("Research interests", { exact: true })
    .fill("Medical AI");
  await page
    .getByLabel("Target institutions or roles", { exact: true })
    .fill("Computer Science Professor");
  await page
    .getByLabel("Default outreach purpose", { exact: true })
    .fill("Ask about PhD research fit");
  const personaResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/personas",
  );
  await page.getByRole("button", { name: "Save persona", exact: true }).click();
  const persona: Persona = await (await personaResponse).json();
  expect(persona.domain).toBe("academic");
  await expect(closeEditor).toBeHidden();
  await expect(
    page.getByLabel("Workflow persona", { exact: true }),
  ).toHaveValue(persona.id);

  await page
    .getByRole("button", { name: "Continue to mentors", exact: true })
    .click();
  await expect(flow).toHaveAttribute("data-step", "1");
  await page.getByLabel("Academic title", { exact: true }).fill("");
  await page.getByLabel("Research keywords", { exact: true }).fill("");
  await page.getByLabel("Research area", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Search mentors", exact: true })
    .click();
  await expect(page.getByText(/mentors found$/)).toBeVisible();
  const firstMentor = page.locator("tbody tr").first();
  await firstMentor
    .getByRole("button", { name: "Use this mentor", exact: true })
    .click();

  const draftResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/drafts",
  );
  await page
    .getByRole("button", { name: "Continue to writing", exact: true })
    .click();
  const createdDraftResponse = await draftResponse;
  const draft: Draft = await createdDraftResponse.json();
  expect(createdDraftResponse.request().postDataJSON()).toMatchObject({
    domain: "academic",
    persona_id: persona.id,
    starting_point: "PhD Inquiry",
  });
  expect(draft.domain).toBe("academic");
  await expect(flow).toHaveAttribute("data-step", "2");
  await expect(page.getByLabel("Writing starting point")).toHaveValue(
    "PhD Inquiry",
  );

  await page.goto(`/email?draft=${draft.id}`);
  const nextDraftResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/drafts",
  );
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  const nextDraft = await nextDraftResponse;
  expect(nextDraft.request().postDataJSON()).toMatchObject({
    domain: "academic",
    starting_point: "PhD Inquiry",
  });
  expect((await nextDraft.json()).domain).toBe("academic");

  await page.goto("/finance");
  await expect(
    page
      .getByLabel("Workflow persona", { exact: true })
      .locator("option", { hasText: personaLabel }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
