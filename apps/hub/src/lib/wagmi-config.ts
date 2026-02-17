import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { metaMask, coinbaseWallet, walletConnect } from "wagmi/connectors";

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "";

const baseRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() || "https://mainnet.base.org";

const baseSepoliaRpcUrl =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL?.trim() || "https://sepolia.base.org";

const connectors = [
  metaMask(),
  coinbaseWallet({ appName: "IVXP Hub" }),
  ...(WALLETCONNECT_PROJECT_ID ? [walletConnect({ projectId: WALLETCONNECT_PROJECT_ID })] : []),
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
