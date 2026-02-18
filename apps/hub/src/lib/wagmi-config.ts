import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { metaMask, coinbaseWallet, walletConnect } from "wagmi/connectors";
import { isValidWalletConnectProjectId } from "./walletconnect-project-id";

const rawWalletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const walletConnectProjectId = isValidWalletConnectProjectId(rawWalletConnectProjectId)
  ? rawWalletConnectProjectId.trim()
  : undefined;
const isBrowser = typeof window !== "undefined";

const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || "https://mainnet.base.org";

const baseSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";

const connectors = [
  metaMask(),
  coinbaseWallet({ appName: "IVXP Hub" }),
  ...(isBrowser && walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId })]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors,
  transports: {
    [base.id]: http(baseRpcUrl),
    [baseSepolia.id]: http(baseSepoliaRpcUrl),
  },
  ssr: true,
});
