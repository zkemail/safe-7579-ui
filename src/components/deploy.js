import "viem/window";
import {
  createWalletClient,
  custom,
  parseEther,
  parseAbiParameters,
  keccak256,
  encodeAbiParameters,
  getAddress,
} from "viem";
import {
  ENTRYPOINT_ADDRESS_V07,
  createSmartAccountClient,
} from "permissionless";
import { signerToSafeSmartAccount } from "permissionless/accounts";
import {
  createPimlicoBundlerClient,
  //   createPimlicoPaymasterClient,
} from "permissionless/clients/pimlico";
import { walletClientToSmartAccountSigner } from "permissionless/utils";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { erc7579Actions } from "permissionless/actions/erc7579";

export const publicClient = createPublicClient({
  transport: http("https://sepolia.base.org"),
});

export const pimlicoBundlerClient = createPimlicoBundlerClient({
  transport: http(
    `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
  ),
  entryPoint: ENTRYPOINT_ADDRESS_V07,
});

export async function run() {
  const addresses = await window.ethereum.request({
    method: "eth_requestAccounts",
  }); // Cast the result to string[]
  const [address] = addresses;
  console.log("address", address);

  const client = createWalletClient({
    account: address, // Type assertion to match the expected format
    chain: baseSepolia,
    transport: custom(window.ethereum),
  });
  console.log("client", client);

  const safeAccount = await signerToSafeSmartAccount(publicClient, {
    signer: walletClientToSmartAccountSigner(client),
    safeVersion: "1.4.1",
    entryPoint: ENTRYPOINT_ADDRESS_V07,
    saltNonce: 5n,
    safe4337ModuleAddress: "0x3Fdb5BC686e861480ef99A6E3FaAe03c0b9F32e2",
    erc7569LaunchpadAddress: "0xEBe001b3D534B9B6E2500FB78E67a1A137f561CE",
    validators: [
      { address: "0xCA19336BE38De066336E9774659D15Bf5ea8D550", context: "0x" },
    ],
  });
  console.log("safeAccount", safeAccount);

  // Transfer 0.01 ETH to the address
  const hash = await client.sendTransaction({
    to: safeAccount.address,
    value: parseEther("0.0001"),
  });
  console.log("hash", hash);

  const smartAccountClient = createSmartAccountClient({
    account: safeAccount,
    entryPoint: ENTRYPOINT_ADDRESS_V07,
    chain: baseSepolia,
    bundlerTransport: http(
      `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${process.env.PIMLICO_API_KEY}`
    ),
    middleware: {
      gasPrice: async () =>
        (await pimlicoBundlerClient.getUserOperationGasPrice()).fast, // if using pimlico bundler
    },
  }).extend(erc7579Actions({ entryPoint: ENTRYPOINT_ADDRESS_V07 }));
  console.log("smartAccountClient", smartAccountClient);

  const txHash = await smartAccountClient.sendTransaction({
    to: address,
    value: parseEther("0.00001"),
  });
  console.log("txHash", txHash);

  // Convert Uint8Array to hex string without using Buffer
  const toHexString = (bytes) =>
    bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

  const account = safeAccount.address;
  const isInstalledContext = new Uint8Array([0]);
  const functionSelector = keccak256(
    new TextEncoder().encode("swapOwner(address,address,address)")
  ).slice(0, 10);
  const guardianAddr = "0x9401296121FC9B78F84fc856B1F8dC88f4415B2e";
  const guardians = [guardianAddr];
  const guardianWeights = [1];
  const threshold = 1;
  const delay = 0; // seconds
  const expiry = 2 * 7 * 24 * 60 * 60; // 2 weeks in seconds

  const callData = encodeAbiParameters(
    parseAbiParameters(
      "address, bytes, bytes4, address[], uint256[], uint256, uint256, uint256"
    ),
    [
      account.toString(), // Ensure `account` is a string
      isInstalledContext instanceof Uint8Array
        ? `0x${toHexString(isInstalledContext)}`
        : isInstalledContext, // Convert Uint8Array to hex string if necessary
      functionSelector, // Assuming `functionSelector` is already a string
      guardians, // Ensure each `guardian` address is a string
      guardianWeights, // Convert `guardianWeights` to strings
      threshold.toString(),
      delay.toString(),
      expiry.toString(),
    ]
  );

  console.log("callData", callData);

  const opHash = await smartAccountClient.installModule({
    type: "executor",
    address: "0xd6503650Ecf85826A367cA8De2253e925B3174d9",
    context: callData,
  });
  const receipt = await pimlicoBundlerClient.waitForUserOperationReceipt({
    hash: opHash,
  });
  console.log("receipt", receipt);
}
