import type { ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { mock } from "wagmi/connectors";

const MOCK_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as const;

export function createTestConfig(
  options: { connected?: boolean } = {},
) {
  const { connected = false } = options;
  return createConfig({
    chains: [base, baseSepolia],
    connectors: [
      mock({
        accounts: [MOCK_ADDRESS],
        features: { connectError: false, reconnect: true },
      }),
    ],
    transports: {
      [base.id]: http(),
      [baseSepolia.id]: http(),
    },
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface TestWrapperProps {
  readonly children: ReactNode;
}

export function createTestWrapper(config = createTestConfig()) {
  const queryClient = createTestQueryClient();

  return function TestWrapper({ children }: TestWrapperProps) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { config?: ReturnType<typeof createTestConfig> },
) {
  const { config, ...renderOptions } = options ?? {};
  const wrapper = createTestWrapper(config);
  return render(ui, { wrapper, ...renderOptions });
}

export { MOCK_ADDRESS };
