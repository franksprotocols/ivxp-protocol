import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdapterSubmitForm } from "../AdapterSubmitForm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validFormData = {
  name: "My Adapter",
  framework: "Model Context Protocol",
  npmPackage: "@ivxp/adapter-test",
  repositoryUrl: "https://github.com/example/adapter",
  description: "A test adapter for the IVXP protocol ecosystem",
  frameworkType: "MCP",
};

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<typeof validFormData> = {},
) {
  const data = { ...validFormData, ...overrides };

  await user.type(screen.getByLabelText(/^name/i), data.name);
  await user.type(screen.getByLabelText(/^framework$/i), data.framework);
  await user.type(screen.getByLabelText(/npm package/i), data.npmPackage);
  await user.type(screen.getByLabelText(/repository url/i), data.repositoryUrl);
  await user.type(screen.getByLabelText(/description/i), data.description);

  // shadcn/ui Select: click trigger then click the desired option
  await user.click(screen.getByRole("combobox", { name: /framework type/i }));
  await user.click(screen.getByRole("option", { name: data.frameworkType }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdapterSubmitForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Unit: renders all required fields ----

  it("renders all required form fields", () => {
    render(<AdapterSubmitForm />);

    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^framework$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/npm package/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/repository url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/framework type/i)).toBeInTheDocument();
  });

  it("renders correct input types", () => {
    render(<AdapterSubmitForm />);

    expect(screen.getByLabelText(/^name/i)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/^framework$/i)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/npm package/i)).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/repository url/i)).toHaveAttribute("type", "url");
    expect(screen.getByLabelText(/description/i).tagName).toBe("TEXTAREA");
    expect(screen.getByRole("combobox", { name: /framework type/i })).toBeInTheDocument();
  });

  it("renders frameworkType select with all options", async () => {
    const user = userEvent.setup();
    render(<AdapterSubmitForm />);

    await user.click(screen.getByRole("combobox", { name: /framework type/i }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["A2A", "LangGraph", "MCP", "Other"]);
  });

  it("frameworkType defaults to 'Other' and submits with that value", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<AdapterSubmitForm />);

    // Verify default display value
    expect(screen.getByRole("combobox", { name: /framework type/i })).toHaveTextContent("Other");

    // Fill all fields except frameworkType (leave as default)
    await user.type(screen.getByLabelText(/^name/i), validFormData.name);
    await user.type(screen.getByLabelText(/^framework$/i), validFormData.framework);
    await user.type(screen.getByLabelText(/npm package/i), validFormData.npmPackage);
    await user.type(screen.getByLabelText(/repository url/i), validFormData.repositoryUrl);
    await user.type(screen.getByLabelText(/description/i), validFormData.description);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.frameworkType).toBe("Other");
    });
  });

  it("renders submit button", () => {
    render(<AdapterSubmitForm />);
    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });

  it("renders Back to Adapters link", () => {
    render(<AdapterSubmitForm />);
    const link = screen.getByRole("link", { name: /back to adapters/i });
    expect(link).toHaveAttribute("href", "/adapters");
  });

  // ---- Integration: client-side validation ----

  it("shows validation errors when submitting empty form", async () => {
    const user = userEvent.setup();
    render(<AdapterSubmitForm />);

    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      const errors = screen.getAllByText(/is required/i);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
  });

  // ---- Integration: successful submission ----

  it("shows confirmation message on successful submission", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/your adapter has been submitted and is pending audit/i),
      ).toBeInTheDocument();
    });
  });

  it("shows View all Adapters link after successful submission", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view all adapters/i });
      expect(link).toHaveAttribute("href", "/adapters");
    });
  });

  // ---- Integration: API 400 response shows field errors ----

  it("shows field errors from API 400 response", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "INVALID_PARAMETERS",
            message: "Validation failed.",
            details: [{ path: ["name"], message: "name is required" }],
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  // ---- Integration: network error ----

  it("shows generic error message on network failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
    });
  });

  // ---- Integration: submit button disabled during submission ----

  it("disables submit button while request is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    });

    resolveFetch(
      new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/your adapter has been submitted and is pending audit/i),
      ).toBeInTheDocument();
    });
  });

  // ---- Integration: sends correct data to API ----

  it("sends form data as JSON to POST /api/adapters", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: "1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<AdapterSubmitForm />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith("/api/adapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validFormData),
      });
    });
  });
});
