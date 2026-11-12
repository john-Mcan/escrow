"use client";

import {
  erc20PermitAbi,
  formatUsdc,
  milestoneEscrowAbi,
  PERMIT_TYPES,
  type PublicCheckout,
  uuidToBytes32,
} from "@escrow/shared";
import {
  type SendTransactionModalUIOptions,
  useSendTransaction,
  useSignTypedData,
  useWallets,
} from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { type Address, encodeFunctionData, type Hex, parseSignature } from "viem";
import { useConfig } from "wagmi";
import {
  getAccount,
  readContract,
  sendTransaction,
  signTypedData,
  switchChain,
  waitForTransactionReceipt,
} from "wagmi/actions";
import type { SyncResponse } from "@/lib/api-types";
import { appChain, escrowContractAddress, usdcAddress } from "@/lib/env";
import { apiFetch } from "./use-api";
import { useMe } from "./use-me";

/**
 * Etapas de una operación, para mostrar avance: `authorizing` es la firma del permit (autorizar el monto) y
 * `signing` la confirmación de la transacción en la wallet.
 */
export type TxStep = "idle" | "preparing" | "authorizing" | "signing" | "confirming" | "syncing";

/** Con qué firma el usuario: smart wallet (una confirmación), wallet embebida de Privy o wallet externa. */
export type WalletKind = "smart" | "embedded" | "external";

/** Textos de la ventana de confirmación de Privy (solo aplica a wallets embebidas y smart wallets). */
export interface TxCopy {
  description: string;
  buttonText: string;
  action: string;
}

export class InsufficientBalanceError extends Error {
  constructor(
    readonly balance: bigint,
    readonly required: bigint,
  ) {
    super(`Saldo insuficiente: tienes ${formatUsdc(balance)} USDC y necesitas ${formatUsdc(required)} USDC.`);
    this.name = "InsufficientBalanceError";
  }
}

interface Call {
  to: Address;
  data: Hex;
}

const PENDING_KEY = (escrowId: string) => `extan:pending-sync:${escrowId}`;

/**
 * Pausa entre la firma del permit y la transacción. Privy cierra su ventana de firma con retraso; si la siguiente
 * solicitud llega antes, esa ventana se vuelve a renderizar con los datos de la transacción y falla
 * ("Cannot destructure property 'method' of 's.signMessage'", @privy-io/react-auth 3.51).
 */
const WALLET_MODAL_SETTLE_MS = 800;

/** Si el navegador se cierra entre la confirmación y la reconciliación, la vista reintenta el sync al volver. */
export function readPendingSync(escrowId: string): Hex | null {
  try {
    return (localStorage.getItem(PENDING_KEY(escrowId)) as Hex | null) ?? null;
  } catch {
    return null;
  }
}

function writePendingSync(escrowId: string, hash: Hex | null) {
  try {
    if (hash) localStorage.setItem(PENDING_KEY(escrowId), hash);
    else localStorage.removeItem(PENDING_KEY(escrowId));
  } catch {
    // Almacenamiento no disponible (modo privado): el sync igual se intenta en esta sesión.
  }
}

export async function syncTransaction(escrowId: string, txHash: Hex): Promise<SyncResponse> {
  const result = await apiFetch<SyncResponse>("/api/escrow/sync", {
    method: "POST",
    body: JSON.stringify({ escrowId, txHash }),
  });
  writePendingSync(escrowId, null);
  return result;
}

/**
 * Transacciones del escrow con dos caminos:
 * - Smart wallet de Privy (ERC-4337): approve + depósito en una sola UserOperation con gas patrocinado.
 * - Wallet EOA (embebida de Privy, MetaMask, Coinbase, Rainbow): firma EIP-2612 `permit` + depósito en una
 *   transacción; si el token no soporta permit, approve + depósito.
 * Con la wallet embebida se usan los hooks de Privy para que sus ventanas muestren nuestros textos en español.
 * Las passkeys/MFA de Privy se solicitan automáticamente al firmar con la embedded wallet.
 */
export function useEscrowTransactions(escrowId: string) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const { client: smartClient } = useSmartWallets();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { signTypedData: privySignTypedData } = useSignTypedData();
  const { sendTransaction: privySendTransaction } = useSendTransaction();
  const { data: me } = useMe();
  const [step, setStep] = useState<TxStep>("idle");

  const sender = (me?.walletAddress ?? null) as Address | null;
  const usesSmartWallet = !!smartClient && !!sender && smartClient.account.address.toLowerCase() === sender;
  const senderWallet = sender ? wallets.find((w) => w.address.toLowerCase() === sender) : undefined;
  const walletKind: WalletKind | null = usesSmartWallet
    ? "smart"
    : senderWallet?.walletClientType === "privy"
      ? "embedded"
      : sender
        ? "external"
        : null;

  const prepareEoa = useCallback(async (): Promise<Address> => {
    const wallet = wallets.find((w) => w.address.toLowerCase() === sender);
    if (!wallet) throw new Error("Conecta la wallet asociada a tu cuenta para continuar.");
    await setActiveWallet(wallet);
    if (getAccount(config).chainId !== appChain.id) {
      await switchChain(config, { chainId: appChain.id });
    }
    return wallet.address as Address;
  }, [config, sender, setActiveWallet, wallets]);

  /** Envía una o más llamadas con la wallet del usuario y devuelve el hash de la transacción. */
  const sendCalls = useCallback(
    async (calls: Call[], copy: TxCopy): Promise<Hex> => {
      const uiOptions: SendTransactionModalUIOptions = {
        description: copy.description,
        buttonText: copy.buttonText,
        transactionInfo: {
          title: "Detalles",
          action: copy.action,
          contractInfo: { name: "Contrato de garantía de extan" },
        },
        successHeader: "Listo",
        successDescription: "Estamos confirmando la operación en la red.",
        isCancellable: true,
      };
      setStep("signing");
      if (usesSmartWallet && smartClient) return smartClient.sendTransaction({ calls }, { uiOptions });
      const [call] = calls;
      if (!call || calls.length > 1) throw new Error("Esta wallet envía una llamada por transacción.");
      const account = await prepareEoa();
      if (walletKind === "embedded") {
        const { hash } = await privySendTransaction(
          { to: call.to, data: call.data, chainId: appChain.id },
          { address: account, uiOptions },
        );
        return hash;
      }
      return sendTransaction(config, { account, to: call.to, data: call.data, chainId: appChain.id });
    },
    [config, prepareEoa, privySendTransaction, smartClient, usesSmartWallet, walletKind],
  );

  const confirmAndSync = useCallback(
    async (hash: Hex) => {
      writePendingSync(escrowId, hash);
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash, chainId: appChain.id });
      setStep("syncing");
      const result = await syncTransaction(escrowId, hash);
      queryClient.setQueryData(["checkout", escrowId], result.checkout);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["escrow-detail", escrowId] }),
        queryClient.invalidateQueries({ queryKey: ["escrows"] }),
      ]);
      return result;
    },
    [config, escrowId, queryClient],
  );

  const run = useCallback(
    async (send: () => Promise<Hex>) => {
      if (!sender) throw new Error("Ingresa para continuar.");
      try {
        setStep("preparing");
        const hash = await send();
        return await confirmAndSync(hash);
      } finally {
        setStep("idle");
      }
    },
    [confirmAndSync, sender],
  );

  const signPermit = useCallback(
    async (owner: Address, value: bigint) => {
      const read = <T>(functionName: "nonces" | "eip712Domain" | "name" | "version", args?: readonly [Address]) =>
        readContract(config, { address: usdcAddress, abi: erc20PermitAbi, functionName, args } as never).then(
          (result) => result as T,
          () => null,
        );
      const [nonce, domainFields, name, version] = await Promise.all([
        read<bigint>("nonces", [owner]),
        read<readonly [Hex, string, string, bigint, Address, Hex, readonly bigint[]]>("eip712Domain"),
        read<string>("name"),
        read<string>("version"),
      ]);
      if (nonce === null) return null;
      const domain = domainFields
        ? {
            name: domainFields[1],
            version: domainFields[2],
            chainId: Number(domainFields[3]),
            verifyingContract: domainFields[4],
          }
        : name && version
          ? { name, version, chainId: appChain.id, verifyingContract: usdcAddress }
          : null;
      if (!domain) return null;

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
      setStep("authorizing");
      let signature: Hex;
      if (walletKind === "embedded") {
        // Privy serializa el mensaje como JSON: los uint256 van como texto decimal.
        const result = await privySignTypedData(
          {
            domain,
            types: PERMIT_TYPES as unknown as Record<string, { name: string; type: string }[]>,
            primaryType: "Permit",
            message: {
              owner,
              spender: escrowContractAddress,
              value: value.toString(),
              nonce: nonce.toString(),
              deadline: deadline.toString(),
            },
          },
          {
            address: owner,
            uiOptions: {
              title: "Autoriza el depósito",
              description: `Permites que el contrato de garantía tome ${formatUsdc(value)} USDC de tu cuenta. El dinero se mueve recién en el siguiente paso.`,
              buttonText: "Autorizar",
              isCancellable: true,
            },
          },
        );
        signature = result.signature as Hex;
      } else {
        signature = await signTypedData(config, {
          account: owner,
          domain,
          types: PERMIT_TYPES,
          primaryType: "Permit",
          message: { owner, spender: escrowContractAddress, value, nonce, deadline },
        });
      }
      const { r, s, v, yParity } = parseSignature(signature);
      return { deadline, r, s, v: Number(v ?? BigInt(yParity + 27)) };
    },
    [config, privySignTypedData, walletKind],
  );

  const fund = useCallback(
    (checkout: PublicCheckout) =>
      run(async () => {
        const amounts = checkout.milestones.map((m) => BigInt(m.amount));
        const total = BigInt(checkout.total_amount);
        const payee = checkout.payee_address;
        const referenceId = uuidToBytes32(checkout.id);
        const owner = sender as Address;
        const copy: TxCopy = {
          description: `Depositas ${formatUsdc(total)} USDC en garantía para "${checkout.title}". Se liberan solo cuando apruebes cada entrega.`,
          buttonText: "Depositar",
          action: "Depositar en garantía",
        };

        const balance = await readContract(config, {
          address: usdcAddress,
          abi: erc20PermitAbi,
          functionName: "balanceOf",
          args: [owner],
        });
        if (balance < total) throw new InsufficientBalanceError(balance, total);

        const createCall: Call = {
          to: escrowContractAddress,
          data: encodeFunctionData({
            abi: milestoneEscrowAbi,
            functionName: "createAndFundEscrow",
            args: [payee, usdcAddress, amounts, referenceId],
          }),
        };
        const approveCall: Call = {
          to: usdcAddress,
          data: encodeFunctionData({
            abi: erc20PermitAbi,
            functionName: "approve",
            args: [escrowContractAddress, total],
          }),
        };

        if (usesSmartWallet) return sendCalls([approveCall, createCall], copy);

        const account = await prepareEoa();
        const allowance = await readContract(config, {
          address: usdcAddress,
          abi: erc20PermitAbi,
          functionName: "allowance",
          args: [account, escrowContractAddress],
        });
        if (allowance >= total) return sendCalls([createCall], copy);

        const permit = await signPermit(account, total).catch((error: unknown) => {
          // Rechazo explícito del usuario: no seguimos con el plan B.
          if (error instanceof Error && /reject|denied|cancel|closed|exited/i.test(error.message)) throw error;
          return null;
        });
        if (permit) {
          await new Promise((resolve) => setTimeout(resolve, WALLET_MODAL_SETTLE_MS));
          const permitCall: Call = {
            to: escrowContractAddress,
            data: encodeFunctionData({
              abi: milestoneEscrowAbi,
              functionName: "createAndFundEscrowWithPermit",
              args: [payee, usdcAddress, amounts, referenceId, permit.deadline, permit.v, permit.r, permit.s],
            }),
          };
          return sendCalls([permitCall], copy);
        }

        // Plan B: token sin EIP-2612 -> approve + depósito (dos transacciones).
        const approveHash = await sendCalls([approveCall], {
          description: `Autorizas que el contrato de garantía tome ${formatUsdc(total)} USDC de tu cuenta.`,
          buttonText: "Autorizar",
          action: "Autorizar monto",
        });
        await waitForTransactionReceipt(config, { hash: approveHash, chainId: appChain.id });
        await new Promise((resolve) => setTimeout(resolve, WALLET_MODAL_SETTLE_MS));
        return sendCalls([createCall], copy);
      }),
    [config, prepareEoa, run, sendCalls, sender, signPermit, usesSmartWallet],
  );

  const milestoneCall = useCallback(
    (
      functionName: "releaseMilestone" | "refundMilestone" | "raiseDispute",
      onchainEscrowId: string,
      index: number,
      copy: TxCopy,
    ) =>
      run(() =>
        sendCalls(
          [
            {
              to: escrowContractAddress,
              data: encodeFunctionData({
                abi: milestoneEscrowAbi,
                functionName,
                args: [BigInt(onchainEscrowId), BigInt(index)],
              }),
            },
          ],
          copy,
        ),
      ),
    [run, sendCalls],
  );

  return {
    step,
    busy: step !== "idle",
    sender,
    walletKind,
    usesSmartWallet,
    fund,
    release: (onchainEscrowId: string, index: number, copy: TxCopy) =>
      milestoneCall("releaseMilestone", onchainEscrowId, index, copy),
    refund: (onchainEscrowId: string, index: number, copy: TxCopy) =>
      milestoneCall("refundMilestone", onchainEscrowId, index, copy),
    dispute: (onchainEscrowId: string, index: number, copy: TxCopy) =>
      milestoneCall("raiseDispute", onchainEscrowId, index, copy),
  };
}

export type EscrowTransactions = ReturnType<typeof useEscrowTransactions>;
