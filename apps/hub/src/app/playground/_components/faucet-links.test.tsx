import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaucetLinks } from "./faucet-links";
import { FAUCET_LINKS } from "./playground-constants";

describe("FaucetLinks", () => {
  it("renders the faucet links card", () => {
    render(<FaucetLinks />);
    expect(screen.getByTestId("faucet-links")).toBeInTheDocument();
  });

  it("displays the title", () => {
    render(<FaucetLinks />);
    expect(screen.getByText("Get Testnet Tokens")).toBeInTheDocument();
  });

  it("renders ETH faucet link with correct href", () => {
    render(<FaucetLinks />);
    const ethLink = screen.getByTestId("eth-faucet-link");
    expect(ethLink).toHaveAttribute("href", FAUCET_LINKS.ethAlchemy);
    expect(ethLink).toHaveAttribute("target", "_blank");
    expect(ethLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders USDC faucet link with correct href", () => {
    render(<FaucetLinks />);
    const usdcLink = screen.getByTestId("usdc-faucet-link");
    expect(usdcLink).toHaveAttribute("href", FAUCET_LINKS.usdcCircle);
    expect(usdcLink).toHaveAttribute("target", "_blank");
    expect(usdcLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays descriptions for both token types", () => {
    render(<FaucetLinks />);
    expect(screen.getByText("Base Sepolia ETH")).toBeInTheDocument();
    expect(screen.getByText("Testnet USDC")).toBeInTheDocument();
    expect(screen.getByText("Required for gas fees")).toBeInTheDocument();
    expect(screen.getByText("Required for paying for services")).toBeInTheDocument();
  });
});
