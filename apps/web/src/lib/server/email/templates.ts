import "server-only";

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

interface EmailContent {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  receiptUrl?: string | null;
  footnote?: string;
}

const COLORS = { ink: "#14213d", paper: "#f4f6f9", border: "#d8deea", muted: "#556079", seal: "#1b7356" };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Layout único para todos los correos: tablas + estilos inline (compatibles con Gmail/Outlook). */
function renderEmail(content: EmailContent): EmailMessage {
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid ${COLORS.border};">
        ${content.details
          .map(
            (row) => `<tr>
              <td style="${font}padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};font-size:14px;">${escapeHtml(row.label)}</td>
              <td align="right" style="${font}padding:10px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.ink};font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="background:${COLORS.ink};border-radius:8px;">
        <a href="${escapeHtml(content.cta.url)}" style="${font}display:inline-block;padding:12px 22px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
      </td></tr></table>`
    : "";
  const receipt = content.receiptUrl
    ? `<p style="${font}margin:16px 0 0;font-size:13px;color:${COLORS.muted};">Recibo on-chain: <a href="${escapeHtml(content.receiptUrl)}" style="color:${COLORS.seal};">ver la transacción en Basescan</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.paper};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="${font}padding:0 4px 16px;font-size:20px;font-weight:800;color:${COLORS.ink};letter-spacing:-0.02em;">hito</td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${COLORS.border};border-radius:12px;padding:32px 28px;">
          <h1 style="${font}margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORS.ink};">${escapeHtml(content.heading)}</h1>
          ${content.paragraphs.map((p) => `<p style="${font}margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(p)}</p>`).join("")}
          ${details}
          ${cta}
          ${receipt}
        </td></tr>
        <tr><td style="${font}padding:16px 4px;font-size:12px;line-height:1.5;color:${COLORS.muted};">
          ${escapeHtml(content.footnote ?? "Hito no custodia tu dinero: los fondos quedan en un contrato inteligente en la red Base hasta que se liberan o reembolsan.")}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    content.heading,
    "",
    ...content.paragraphs,
    "",
    ...(content.details ?? []).map((row) => `${row.label}: ${row.value}`),
    content.cta ? `\n${content.cta.label}: ${content.cta.url}` : "",
    content.receiptUrl ? `Recibo on-chain: ${content.receiptUrl}` : "",
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();

  return { subject: content.subject, html, text };
}

// -----------------------------------------------------------------------------
// Mensajes por evento
// -----------------------------------------------------------------------------

interface EscrowContext {
  title: string;
  providerName: string;
  checkoutUrl: string;
}

export function invitationEmail(ctx: EscrowContext & { total: string; milestones: number }) {
  return renderEmail({
    subject: `${ctx.providerName} te envió un link de pago en garantía`,
    preheader: `${ctx.total} USDC en ${ctx.milestones} hito(s) para "${ctx.title}"`,
    heading: `${ctx.providerName} te envió un acuerdo de pago`,
    paragraphs: [
      `El pago de "${ctx.title}" se deposita en garantía: el dinero queda bloqueado en un contrato inteligente y solo se libera cuando tú apruebes cada entrega.`,
      "Puedes ingresar con tu email o Google; no necesitas conocimientos de cripto.",
    ],
    details: [
      { label: "Total", value: `${ctx.total} USDC` },
      { label: "Hitos", value: String(ctx.milestones) },
    ],
    cta: { label: "Revisar y depositar", url: ctx.checkoutUrl },
  });
}

export function fundedForPayeeEmail(ctx: EscrowContext & { total: string; receiptUrl: string | null }) {
  return renderEmail({
    subject: `Garantía depositada: ya puedes empezar "${ctx.title}"`,
    preheader: `${ctx.total} USDC quedaron bloqueados en garantía`,
    heading: "Tu cliente depositó la garantía",
    paragraphs: [
      `Los ${ctx.total} USDC de "${ctx.title}" ya están bloqueados en el contrato. Puedes empezar a trabajar con la tranquilidad de que el pago existe.`,
      "Cuando termines cada hito, sube el entregable desde el link del acuerdo para que tu cliente lo revise y libere los fondos.",
    ],
    details: [{ label: "En garantía", value: `${ctx.total} USDC` }],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function fundedForPayerEmail(ctx: EscrowContext & { total: string; receiptUrl: string | null }) {
  return renderEmail({
    subject: `Recibo: depositaste ${ctx.total} USDC en garantía`,
    preheader: `Tu depósito para "${ctx.title}" está protegido`,
    heading: "Tu depósito está en garantía",
    paragraphs: [
      `Depositaste ${ctx.total} USDC para "${ctx.title}". ${ctx.providerName} no puede retirarlos: tú liberas cada hito cuando apruebes la entrega.`,
      "Si algo sale mal, puedes abrir una disputa y el dinero de ese hito queda congelado hasta que se resuelva.",
    ],
    details: [{ label: "Depositado", value: `${ctx.total} USDC` }],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function deliverableEmail(ctx: EscrowContext & { milestoneTitle: string; amount: string; notes: string | null }) {
  return renderEmail({
    subject: `Entrega lista para revisar: ${ctx.milestoneTitle}`,
    preheader: `${ctx.providerName} entregó un hito de ${ctx.amount} USDC`,
    heading: `${ctx.providerName} entregó "${ctx.milestoneTitle}"`,
    paragraphs: [
      "Revisa el entregable. Si estás conforme, libera los fondos del hito; si no, puedes conversar con el proveedor o abrir una disputa.",
      ...(ctx.notes ? [`Notas del proveedor: ${ctx.notes}`] : []),
    ],
    details: [
      { label: "Acuerdo", value: ctx.title },
      { label: "Monto del hito", value: `${ctx.amount} USDC` },
    ],
    cta: { label: "Revisar y liberar fondos", url: ctx.checkoutUrl },
  });
}

export function releasedEmail(
  ctx: EscrowContext & { milestoneTitle: string; payeeAmount: string; fee: string; receiptUrl: string | null },
) {
  return renderEmail({
    subject: `Fondos liberados: ${ctx.payeeAmount} USDC por "${ctx.milestoneTitle}"`,
    preheader: "El pago ya está en tu wallet",
    heading: "Recibiste un pago",
    paragraphs: [`Tu cliente liberó el hito "${ctx.milestoneTitle}" de "${ctx.title}". Los fondos ya están en tu wallet.`],
    details: [
      { label: "Recibido", value: `${ctx.payeeAmount} USDC` },
      { label: "Comisión de la plataforma", value: `${ctx.fee} USDC` },
    ],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function refundedEmail(ctx: EscrowContext & { milestoneTitle: string; amount: string; receiptUrl: string | null }) {
  return renderEmail({
    subject: `Reembolso: ${ctx.amount} USDC por "${ctx.milestoneTitle}"`,
    preheader: "El proveedor canceló un hito y te devolvió el 100%",
    heading: "Te devolvieron un hito",
    paragraphs: [
      `${ctx.providerName} canceló el hito "${ctx.milestoneTitle}" de "${ctx.title}". Recibiste el 100% del monto, sin comisiones.`,
    ],
    details: [{ label: "Reembolsado", value: `${ctx.amount} USDC` }],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function disputeOpenedEmail(
  ctx: EscrowContext & { milestoneTitle: string; amount: string; openedBy: string; forArbitration?: boolean },
) {
  return renderEmail({
    subject: ctx.forArbitration
      ? `[Arbitraje] Nueva disputa en "${ctx.title}"`
      : `Disputa abierta en "${ctx.milestoneTitle}"`,
    preheader: `${ctx.amount} USDC quedaron congelados`,
    heading: ctx.forArbitration ? "Hay una disputa que requiere arbitraje" : "Se abrió una disputa",
    paragraphs: [
      `${ctx.openedBy} abrió una disputa sobre el hito "${ctx.milestoneTitle}". Sus ${ctx.amount} USDC quedan congelados en el contrato hasta que el árbitro lo resuelva.`,
      ctx.forArbitration
        ? "Revisa la evidencia en el panel de arbitraje y prepara la resolución para firmarla desde la Safe."
        : "Aporta evidencia (mensajes, archivos, entregas) desde el link del acuerdo para que el árbitro decida con toda la información.",
    ],
    details: [
      { label: "Acuerdo", value: ctx.title },
      { label: "Monto congelado", value: `${ctx.amount} USDC` },
    ],
    cta: { label: ctx.forArbitration ? "Abrir panel de arbitraje" : "Aportar evidencia", url: ctx.checkoutUrl },
  });
}

export function disputeResolvedEmail(
  ctx: EscrowContext & {
    milestoneTitle: string;
    payerAmount: string;
    payeeAmount: string;
    fee: string;
    receiptUrl: string | null;
  },
) {
  return renderEmail({
    subject: `Disputa resuelta: "${ctx.milestoneTitle}"`,
    preheader: "El árbitro repartió los fondos del hito",
    heading: "La disputa fue resuelta",
    paragraphs: [`El árbitro resolvió la disputa del hito "${ctx.milestoneTitle}" de "${ctx.title}". Los fondos ya se transfirieron.`],
    details: [
      { label: "Para el cliente", value: `${ctx.payerAmount} USDC` },
      { label: "Para el proveedor", value: `${ctx.payeeAmount} USDC` },
      { label: "Comisión de la plataforma", value: `${ctx.fee} USDC` },
    ],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}
