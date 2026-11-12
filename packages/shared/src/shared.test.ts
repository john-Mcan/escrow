import { decodeEventLog, encodeEventTopics, getAbiItem, type Hex, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import {
  bytes32ToUuid,
  computeSplit,
  createEscrowSchema,
  deliverableSchema,
  deriveEscrowStatus,
  emailSchema,
  explorerTxUrl,
  formatBps,
  formatUsdc,
  milestoneEscrowAbi,
  parseUsdc,
  syncRequestSchema,
  uuidToBytes32,
} from "./index";

describe("computeSplit (paridad con MilestoneEscrow._computeSplit)", () => {
  it("liberación: 1.000 USDC con fee de 1,5%", () => {
    expect(computeSplit(1_000_000_000n, 150)).toEqual({ payerAmount: 0n, payeeAmount: 985_000_000n, fee: 15_000_000n });
  });

  it("el fee redondea hacia abajo", () => {
    expect(computeSplit(333_333n, 150)).toEqual({ payerAmount: 0n, payeeAmount: 328_334n, fee: 4_999n });
  });

  it("split arbitral: fee solo sobre la porción del payee", () => {
    expect(computeSplit(1_000_000_000n, 150, 4_000)).toEqual({
      payerAmount: 400_000_000n,
      payeeAmount: 591_000_000n,
      fee: 9_000_000n,
    });
    expect(computeSplit(1_500_000_000n, 150, 2_500)).toEqual({
      payerAmount: 375_000_000n,
      payeeAmount: 1_108_125_000n,
      fee: 16_875_000n,
    });
  });

  it("reembolso total no cobra fee y siempre conserva el valor", () => {
    expect(computeSplit(777n, 500, 10_000)).toEqual({ payerAmount: 777n, payeeAmount: 0n, fee: 0n });
    for (const amount of [1n, 99n, 123_456_789n, 5_000_000_000n]) {
      for (const share of [0, 1, 3_333, 9_999, 10_000]) {
        const { payerAmount, payeeAmount, fee } = computeSplit(amount, 500, share);
        expect(payerAmount + payeeAmount + fee).toBe(amount);
      }
    }
  });

  it("rechaza porcentajes fuera de rango", () => {
    expect(() => computeSplit(1n, 150, 10_001)).toThrow();
  });
});

describe("referenceId <-> UUID", () => {
  const uuid = "7f1c2a90-e4b3-4d0c-9f8a-1b2c3d4e5f60";

  it("coincide con bytes32(uint256(uuid)) en Solidity", () => {
    expect(uuidToBytes32(uuid)).toBe("0x000000000000000000000000000000007f1c2a90e4b34d0c9f8a1b2c3d4e5f60");
  });

  it("ida y vuelta", () => {
    expect(bytes32ToUuid(uuidToBytes32(uuid))).toBe(uuid);
    expect(bytes32ToUuid(uuidToBytes32(uuid.toUpperCase()))).toBe(uuid);
  });

  it("rechaza referencias que no son UUID", () => {
    expect(() => uuidToBytes32("no-es-uuid")).toThrow();
    expect(bytes32ToUuid(`0x${"1".repeat(64)}`)).toBeNull();
  });
});

describe("montos USDC", () => {
  it("parsea el formato chileno: punto de miles y coma decimal", () => {
    expect(parseUsdc("1500")).toBe(1_500_000_000n);
    expect(parseUsdc("1500,5")).toBe(1_500_500_000n);
    expect(parseUsdc("1.500,5")).toBe(1_500_500_000n);
    expect(parseUsdc("2.500")).toBe(2_500_000_000n);
    expect(parseUsdc("1.000.000")).toBe(1_000_000_000_000n);
    expect(parseUsdc("0,000001")).toBe(1n);
  });

  it("rechaza formatos ambiguos o con más de 6 decimales", () => {
    for (const input of ["1500.50", "2.5", "1,500.50", "1.50.000", "1.5000", "-1", "1,1234567", "abc", ""]) {
      expect(() => parseUsdc(input)).toThrow();
    }
  });

  it("formatea sin perder precisión", () => {
    expect(formatUsdc(1_500_500_000n)).toBe("1.500,50");
    expect(formatUsdc(9_920_000_000n)).toBe("9.920,00");
    expect(formatUsdc("1")).toBe("0,000001");
    expect(formatUsdc(0n)).toBe("0,00");
    expect(formatUsdc(123_456_789_012_345_678_901n)).toBe("123.456.789.012.345,678901");
  });

  it("formatea la comisión con coma decimal", () => {
    expect(formatBps(150)).toBe("1,5%");
  });
});

describe("esquemas", () => {
  it("createEscrowSchema transforma montos y normaliza emails", () => {
    const parsed = createEscrowSchema.parse({
      title: "  Sitio web  ",
      payerEmail: "  Cliente@Empresa.COM ",
      milestones: [
        { title: "Diseño", amount: "1000", dueDate: "2026-12-01" },
        { title: "Desarrollo", amount: "1500,25", description: "" },
      ],
    });
    expect(parsed.title).toBe("Sitio web");
    expect(parsed.payerEmail).toBe("cliente@empresa.com");
    expect(parsed.milestones.map((m) => m.amount)).toEqual([1_000_000_000n, 1_500_250_000n]);
    expect(parsed.milestones[1]?.description).toBeUndefined();
  });

  it("createEscrowSchema limita el total a 5.000 USDC", () => {
    const result = createEscrowSchema.safeParse({
      title: "Grande",
      milestones: [
        { title: "A", amount: "4000" },
        { title: "B", amount: "1.000,000001" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("createEscrowSchema exige entre 1 y 20 hitos con monto positivo", () => {
    expect(createEscrowSchema.safeParse({ title: "x", milestones: [] }).success).toBe(false);
    expect(createEscrowSchema.safeParse({ title: "x", milestones: [{ title: "A", amount: "0" }] }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => ({ title: `H${i}`, amount: "1" }));
    expect(createEscrowSchema.safeParse({ title: "x", milestones: many }).success).toBe(false);
  });

  it("los entregables solo aceptan https", () => {
    expect(deliverableSchema.safeParse({ url: "https://drive.example.com/archivo.pdf" }).success).toBe(true);
    expect(deliverableSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(deliverableSchema.safeParse({ url: "http://inseguro.example.com" }).success).toBe(false);
  });

  it("syncRequestSchema normaliza el hash", () => {
    const hash = `0x${"AB".repeat(32)}`;
    const parsed = syncRequestSchema.parse({ escrowId: "7f1c2a90-e4b3-4d0c-9f8a-1b2c3d4e5f60", txHash: hash });
    expect(parsed.txHash).toBe(hash.toLowerCase());
    expect(emailSchema.safeParse("sin-arroba").success).toBe(false);
  });
});

describe("deriveEscrowStatus", () => {
  it.each([
    [["pending", "pending"], "draft"],
    [["funded", "funded"], "funded"],
    [["delivered_review", "funded"], "in_progress"],
    [["released", "funded"], "in_progress"],
    [["released", "disputed"], "disputed"],
    [["released", "resolved", "refunded"], "completed"],
    [["refunded", "refunded"], "cancelled"],
  ] as const)("%j -> %s", (milestones, expected) => {
    expect(deriveEscrowStatus(milestones)).toBe(expected);
  });
});

describe("ABI y explorador", () => {
  it("expone las funciones y eventos que usa la app", () => {
    for (const name of [
      "createAndFundEscrow",
      "createAndFundEscrowWithPermit",
      "releaseMilestone",
      "refundMilestone",
      "raiseDispute",
      "resolveDispute",
    ] as const) {
      expect(getAbiItem({ abi: milestoneEscrowAbi, name })).toBeDefined();
    }
    expect(toFunctionSelector(getAbiItem({ abi: milestoneEscrowAbi, name: "releaseMilestone" }))).toBe(
      toFunctionSelector("releaseMilestone(uint256,uint256)"),
    );
  });

  it("decodifica DisputeRaised", () => {
    const raisedBy = "0x00000000000000000000000000000000000000b0";
    const topics = encodeEventTopics({
      abi: milestoneEscrowAbi,
      eventName: "DisputeRaised",
      args: { escrowId: 7n, milestoneIndex: 1n, raisedBy },
    });
    const decoded = decodeEventLog({ abi: milestoneEscrowAbi, topics: topics as [Hex, ...Hex[]], data: "0x" });
    expect(decoded).toMatchObject({ eventName: "DisputeRaised", args: { escrowId: 7n, milestoneIndex: 1n } });
  });

  it("arma links a Basescan", () => {
    const hash = `0x${"a".repeat(64)}` as const;
    expect(explorerTxUrl(8453, hash)).toBe(`https://basescan.org/tx/${hash}`);
    expect(explorerTxUrl(84532, hash)).toBe(`https://sepolia.basescan.org/tx/${hash}`);
    expect(explorerTxUrl(31337, hash)).toBeNull();
  });
});
