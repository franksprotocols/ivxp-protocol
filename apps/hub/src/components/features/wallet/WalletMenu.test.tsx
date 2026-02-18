import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletMenu } from "./WalletMenu";
import { renderWithProviders } from "@/test/test-utils";

describe("WalletMenu", () => {
  const address = "0x1234567890abcdef1234567890abcdef12345678";
  const defaultProps = {
    address,
    onDisconnect: vi.fn(),
    onCopyAddress: vi.fn(),
  };

  it("renders the trigger with truncated address", () => {
    renderWithProviders(<WalletMenu {...defaultProps} />);
    expect(screen.getByText("0x1234...5678")).toBeInTheDocument();
  });

  it("shows menu items when trigger is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WalletMenu {...defaultProps} />);

    await user.click(screen.getByText("0x1234...5678"));

    expect(screen.getByText(/provider/i)).toBeInTheDocument();
    expect(screen.getByText(/my orders/i)).toBeInTheDocument();
    expect(screen.getByText(/copy address/i)).toBeInTheDocument();
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it("renders navigation links for provider and orders", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WalletMenu {...defaultProps} />);

    await user.click(screen.getByText("0x1234...5678"));

    expect(screen.getByRole("menuitem", { name: "Provider" })).toHaveAttribute("href", "/provider");
    expect(screen.getByRole("menuitem", { name: "My Orders" })).toHaveAttribute("href", "/orders");
  });

  it("calls onCopyAddress when copy is clicked", async () => {
    const onCopyAddress = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WalletMenu {...defaultProps} onCopyAddress={onCopyAddress} />);

    await user.click(screen.getByText("0x1234...5678"));
    await user.click(screen.getByText(/copy address/i));

    expect(onCopyAddress).toHaveBeenCalled();
  });

  it("calls onDisconnect when disconnect is clicked", async () => {
    const onDisconnect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<WalletMenu {...defaultProps} onDisconnect={onDisconnect} />);

    await user.click(screen.getByText("0x1234...5678"));
    await user.click(screen.getByText(/disconnect/i));

    expect(onDisconnect).toHaveBeenCalled();
  });
});
