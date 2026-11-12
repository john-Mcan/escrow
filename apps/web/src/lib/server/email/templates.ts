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
  /** Monto principal del correo, destacado bajo el título. */
  highlight?: { label: string; value: string };
  details?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  receiptUrl?: string | null;
  footnote?: string;
}

/** Versión clara de la marca (los clientes de correo no manejan bien el modo oscuro). */
const COLORS = {
  ink: "#08090b",
  paper: "#f4f5f4",
  card: "#ffffff",
  border: "#e2e4e2",
  muted: "#5b6168",
  emerald: "#7de7bb",
  emeraldEdge: "#5fd3a3",
  emeraldDeep: "#1fa774",
  link: "#0f7a55",
};

const FONT = "font-family:'Figtree',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Isotipo dibujado con celdas y bordes: se ve aunque el cliente bloquee las imágenes. */
const MARK = `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;vertical-align:middle;"><tr>
  <td style="width:4px;height:18px;border:2.5px solid ${COLORS.ink};border-right:0;border-radius:3px 0 0 3px;font-size:0;line-height:0;">&nbsp;</td>
  <td style="width:5px;font-size:0;line-height:0;">&nbsp;</td>
  <td style="vertical-align:middle;"><div style="width:8px;height:8px;background:${COLORS.emeraldDeep};border-radius:2px;font-size:0;line-height:0;">&nbsp;</div></td>
  <td style="width:5px;font-size:0;line-height:0;">&nbsp;</td>
  <td style="width:4px;height:18px;border:2.5px solid ${COLORS.ink};border-left:0;border-radius:0 3px 3px 0;font-size:0;line-height:0;">&nbsp;</td>
</tr></table>`;

/** Layout único para todos los correos: tablas + estilos inline (compatibles con Gmail/Outlook). */
function renderEmail(content: EmailContent): EmailMessage {
  const highlight = content.highlight
    ? `<p style="${FONT}margin:4px 0 0;font-size:13px;color:${COLORS.muted};">${escapeHtml(content.highlight.label)}</p>
       <p style="${FONT}margin:2px 0 20px;font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-0.03em;color:${COLORS.ink};">${escapeHtml(content.highlight.value)}</p>`
    : "";
  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 24px;border-top:1px solid ${COLORS.border};">
        ${content.details
          .map(
            (row) => `<tr>
              <td style="${FONT}padding:11px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.muted};font-size:14px;">${escapeHtml(row.label)}</td>
              <td align="right" style="${FONT}padding:11px 0;border-bottom:1px solid ${COLORS.border};color:${COLORS.ink};font-size:14px;font-weight:600;">${escapeHtml(row.value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";
  const cta = content.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="background:${COLORS.emerald};border:1px solid ${COLORS.emeraldEdge};border-radius:10px;">
        <a href="${escapeHtml(content.cta.url)}" style="${FONT}display:inline-block;padding:13px 24px;color:${COLORS.ink};font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(content.cta.label)}</a>
      </td></tr></table>`
    : "";
  const receipt = content.receiptUrl
    ? `<p style="${FONT}margin:18px 0 0;font-size:13px;color:${COLORS.muted};">Comprobante público: <a href="${escapeHtml(content.receiptUrl)}" style="color:${COLORS.link};font-weight:600;">ver la operación en Basescan</a></p>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600&display=swap" rel="stylesheet"><title>${escapeHtml(content.subject)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.paper};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};padding:36px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding:0 6px 18px;">
          ${MARK}<span style="${FONT}display:inline-block;vertical-align:middle;margin-left:8px;font-size:21px;font-weight:600;letter-spacing:-0.04em;color:${COLORS.ink};">extan</span>
        </td></tr>
        <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;padding:34px 30px;">
          <h1 style="${FONT}margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${COLORS.ink};">${escapeHtml(content.heading)}</h1>
          ${highlight}
          ${content.paragraphs.map((p) => `<p style="${FONT}margin:0 0 12px;font-size:15px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(p)}</p>`).join("")}
          ${details}
          ${cta}
          ${receipt}
        </td></tr>
        <tr><td style="${FONT}padding:18px 6px;font-size:12px;line-height:1.6;color:${COLORS.muted};">
          ${escapeHtml(content.footnote ?? "extan no custodia tu dinero: queda en un contrato público en la red Base hasta que se paga o se devuelve.")}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    content.heading,
    content.highlight ? `${content.highlight.label}: ${content.highlight.value}` : "",
    "",
    ...content.paragraphs,
    "",
    ...(content.details ?? []).map((row) => `${row.label}: ${row.value}`),
    content.cta ? `\n${content.cta.label}: ${content.cta.url}` : "",
    content.receiptUrl ? `Comprobante público: ${content.receiptUrl}` : "",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
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
    highlight: { label: ctx.title, value: `${ctx.total} USDC` },
    paragraphs: [
      "Depositas una vez y el dinero queda en garantía: solo se paga cada hito cuando tú apruebas la entrega. Si un hito se cancela, recuperas el 100%.",
      "Entras con tu email. No necesitas saber de cripto.",
    ],
    details: [{ label: "Hitos", value: String(ctx.milestones) }],
    cta: { label: "Revisar y depositar", url: ctx.checkoutUrl },
  });
}

export function fundedForPayeeEmail(ctx: EscrowContext & { total: string; receiptUrl: string | null }) {
  return renderEmail({
    subject: `Tu cliente depositó: ya puedes empezar "${ctx.title}"`,
    preheader: `${ctx.total} USDC quedaron en garantía`,
    heading: "Tu cliente depositó la garantía",
    highlight: { label: "En garantía", value: `${ctx.total} USDC` },
    paragraphs: [
      `El pago de "${ctx.title}" ya existe y nadie puede retirarlo. Puedes empezar a trabajar con tranquilidad.`,
      "Cuando termines cada hito, envía la entrega desde el link del acuerdo para que tu cliente la revise y libere ese pago.",
    ],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function fundedForPayerEmail(ctx: EscrowContext & { total: string; receiptUrl: string | null }) {
  return renderEmail({
    subject: `Comprobante: depositaste ${ctx.total} USDC en garantía`,
    preheader: `Tu depósito para "${ctx.title}" está protegido`,
    heading: "Tu depósito está en garantía",
    highlight: { label: "Depositaste", value: `${ctx.total} USDC` },
    paragraphs: [
      `${ctx.providerName} no puede retirar este dinero por su cuenta: tú liberas cada hito cuando apruebas la entrega.`,
      "Si algo sale mal, puedes abrir una disputa y el dinero de ese hito queda congelado hasta que un árbitro decida.",
    ],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function deliverableEmail(
  ctx: EscrowContext & { milestoneTitle: string; amount: string; notes: string | null },
) {
  return renderEmail({
    subject: `Entrega lista para revisar: ${ctx.milestoneTitle}`,
    preheader: `${ctx.providerName} entregó un hito de ${ctx.amount} USDC`,
    heading: `${ctx.providerName} entregó "${ctx.milestoneTitle}"`,
    highlight: { label: "Pago de este hito", value: `${ctx.amount} USDC` },
    paragraphs: [
      "Revisa la entrega. Si está bien, libera el pago de este hito; si no, conversa con quien te cobra o abre una disputa.",
      ...(ctx.notes ? [`Mensaje de ${ctx.providerName}: ${ctx.notes}`] : []),
    ],
    details: [{ label: "Acuerdo", value: ctx.title }],
    cta: { label: "Revisar la entrega", url: ctx.checkoutUrl },
  });
}

export function releasedEmail(
  ctx: EscrowContext & { milestoneTitle: string; payeeAmount: string; fee: string; receiptUrl: string | null },
) {
  return renderEmail({
    subject: `Recibiste ${ctx.payeeAmount} USDC por "${ctx.milestoneTitle}"`,
    preheader: "Tu cliente liberó el pago y ya está en tu cuenta",
    heading: "Recibiste un pago",
    highlight: { label: ctx.milestoneTitle, value: `${ctx.payeeAmount} USDC` },
    paragraphs: [
      `Tu cliente aprobó la entrega de "${ctx.milestoneTitle}" (${ctx.title}). El pago ya está en tu cuenta de extan.`,
    ],
    details: [{ label: "Comisión de extan", value: `${ctx.fee} USDC` }],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}

export function refundedEmail(
  ctx: EscrowContext & { milestoneTitle: string; amount: string; receiptUrl: string | null },
) {
  return renderEmail({
    subject: `Reembolso: ${ctx.amount} USDC por "${ctx.milestoneTitle}"`,
    preheader: "Te devolvieron el 100% de un hito",
    heading: "Te devolvieron un hito",
    highlight: { label: "Reembolsado", value: `${ctx.amount} USDC` },
    paragraphs: [
      `${ctx.providerName} canceló el hito "${ctx.milestoneTitle}" de "${ctx.title}". Recibiste el monto completo, sin comisiones.`,
    ],
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
    highlight: { label: "Congelado", value: `${ctx.amount} USDC` },
    paragraphs: [
      `${ctx.openedBy} abrió una disputa sobre el hito "${ctx.milestoneTitle}". Ese dinero queda congelado hasta que el árbitro decida cómo repartirlo.`,
      ctx.forArbitration
        ? "Revisa lo que cuenta cada parte en el panel de arbitraje y firma la resolución."
        : "Cuéntale al árbitro tu versión (mensajes, archivos, entregas) desde el link del acuerdo para que decida con toda la información.",
    ],
    details: [{ label: "Acuerdo", value: ctx.title }],
    cta: { label: ctx.forArbitration ? "Abrir panel de arbitraje" : "Enviar tu versión", url: ctx.checkoutUrl },
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
    preheader: "El árbitro repartió el dinero del hito",
    heading: "La disputa fue resuelta",
    paragraphs: [
      `El árbitro resolvió la disputa del hito "${ctx.milestoneTitle}" de "${ctx.title}". El dinero ya se transfirió.`,
    ],
    details: [
      { label: "Para el cliente", value: `${ctx.payerAmount} USDC` },
      { label: "Para el proveedor", value: `${ctx.payeeAmount} USDC` },
      { label: "Comisión de extan", value: `${ctx.fee} USDC` },
    ],
    cta: { label: "Ver el acuerdo", url: ctx.checkoutUrl },
    receiptUrl: ctx.receiptUrl,
  });
}
