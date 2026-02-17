"use client";

import { ExternalLink } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FAUCET_LINKS } from "./playground-constants";

export function FaucetLinks() {
  return (
    <Card data-testid="faucet-links">
      <CardHeader>
        <CardTitle>Get Testnet Tokens</CardTitle>
        <CardDescription>
          You need Base Sepolia ETH and USDC to test the protocol
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <h4 className="font-medium">Base Sepolia ETH</h4>
          <p className="text-sm text-muted-foreground">
            Required for gas fees
          </p>
          <Button asChild variant="outline" className="mt-2">
            <a
              href={FAUCET_LINKS.ethAlchemy}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="eth-faucet-link"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Get ETH from Alchemy Faucet
            </a>
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Testnet USDC</h4>
          <p className="text-sm text-muted-foreground">
            Required for paying for services
          </p>
          <Button asChild variant="outline" className="mt-2">
            <a
              href={FAUCET_LINKS.usdcCircle}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="usdc-faucet-link"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Get USDC from Circle Faucet
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
