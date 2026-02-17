"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { QuickStartGuide } from "./quick-start-guide";
import { FaucetLinks } from "./faucet-links";
import { DemoProviderInfo } from "./demo-provider-info";
import { ServiceTester } from "./service-tester";
import type { ExecutionResult } from "./service-tester";
import { ProtocolInspector } from "./protocol-inspector";
import { DEMO_PROVIDER_URL, BASE_SEPOLIA_CHAIN_ID } from "./playground-constants";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { ServiceDetail } from "@/lib/types/service";
import type { ProtocolEvent, StateTransition } from "@/hooks/use-protocol-events";
import { MOCK_SERVICE_DETAILS } from "@/lib/mock-data/service-details";

export function PlaygroundContent() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isCorrectNetwork = chainId === BASE_SEPOLIA_CHAIN_ID;

  const [catalogServices, setCatalogServices] = useState<readonly ServiceDetail[]>([]);
  const [events, setEvents] = useState<readonly ProtocolEvent[]>([]);
  const [transitions, setTransitions] = useState<readonly StateTransition[]>([]);
  const [result, setResult] = useState<ExecutionResult | null>(null);

  const handleCatalogLoaded = useCallback((services: readonly ServiceDetail[]) => {
    setCatalogServices(services);
  }, []);

  const handleEvent = useCallback((event: ProtocolEvent) => {
    setEvents((prev) => [...prev, event]);
  }, []);

  const handleTransition = useCallback((transition: StateTransition) => {
    setTransitions((prev) => [...prev, transition]);
  }, []);

  const handleResult = useCallback((execResult: ExecutionResult) => {
    setResult(execResult);
  }, []);

  const handleClearEvents = useCallback(() => {
    setEvents([]);
    setTransitions([]);
    setResult(null);
  }, []);

  // Use catalog services if available, otherwise fall back to mock data
  const availableServices = catalogServices.length > 0 ? catalogServices : MOCK_SERVICE_DETAILS;

  return (
    <div className="space-y-6" data-testid="playground-content">
      {/* Quick start guide */}
      <QuickStartGuide />

      {/* Connection status */}
      <div className="flex flex-wrap gap-2" data-testid="connection-status">
        <Badge variant={isConnected ? "default" : "destructive"}>
          {isConnected ? "Wallet Connected" : "Wallet Not Connected"}
        </Badge>
        {isConnected && (
          <Badge variant={isCorrectNetwork ? "default" : "destructive"}>
            {isCorrectNetwork ? "Base Sepolia" : "Wrong Network"}
          </Badge>
        )}
      </div>

      {!isConnected && (
        <Alert variant="destructive" data-testid="connect-wallet-prompt">
          <AlertTitle>Wallet Required</AlertTitle>
          <AlertDescription>
            Connect your wallet using the button in the header to test the protocol.
          </AlertDescription>
        </Alert>
      )}

      {isConnected && !isCorrectNetwork && (
        <Alert variant="destructive" data-testid="switch-network-prompt">
          <AlertTitle>Wrong Network</AlertTitle>
          <AlertDescription>
            Please switch to Base Sepolia (chain ID {BASE_SEPOLIA_CHAIN_ID}) to use the playground.
          </AlertDescription>
        </Alert>
      )}

      {/* Faucet links */}
      <FaucetLinks />

      {/* Demo Provider info */}
      <DemoProviderInfo url={DEMO_PROVIDER_URL} onCatalogLoaded={handleCatalogLoaded} />

      {/* Service tester */}
      <ServiceTester
        services={availableServices}
        providerUrl={DEMO_PROVIDER_URL}
        onEvent={handleEvent}
        onTransition={handleTransition}
        onResult={handleResult}
      />

      {/* Protocol Inspector */}
      <ProtocolInspector
        events={events}
        transitions={transitions}
        result={result}
        onClear={handleClearEvents}
      />
    </div>
  );
}
