import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletDisplay } from "./WalletDisplay";
import { renderWithProviders } from "@/test/test-utils";

describe("WalletDisplay", () => {
  const address = "0x1234567890abcdef1234567890abcdef12345678";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders truncated address", () => {
    renderWithProviders(<WalletDisplay address={address} />);
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("has a copy button", () => {
    renderWithProviders(<WalletDisplay address={address} />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("shows copied feedback after clicking copy", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const user = userEvent.setup();
    renderWithProviders(<WalletDisplay address={address} />);

    await user.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });
  });

  it("resets copied state after timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const user = userEvent.setup({
      advanceTimers: (ms) => vi.advanceTimersByTime(ms),
    });
    renderWithProviders(<WalletDisplay address={address} />);

    await user.click(screen.getByRole("button", { name: /copy/i }));

    // Copied state should be visible
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument();
    });

    // Advance past the 2s reset timeout
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    // Copied state should be gone
    expect(screen.queryByText(/copied/i)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("renders nothing when address is undefined", () => {
    const { container } = renderWithProviders(<WalletDisplay address={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});
