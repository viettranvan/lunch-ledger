export type DebtRow = {
  name: string;
  totalDebt: number;
  absTotal: number;
  direction: string;
  details: number[];
};

function formatDetailValue(val: number): string {
  const display = (Math.abs(val) / 1000).toLocaleString("vi-VN");
  return val < 0 ? `-${display}` : display;
}

function formatDetails(details: number[]): string {
  return details.map(formatDetailValue).join(" + ");
}

function formatTotal(debt: DebtRow): string {
  if (debt.direction === "owes_you") {
    return `Bạn nợ: ${debt.absTotal.toLocaleString("vi-VN")}đ`;
  }
  return `${debt.totalDebt.toLocaleString("vi-VN")}đ`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTeamsDebtTable(debts: DebtRow[]): {
  html: string;
  plain: string;
} {
  const rows = debts
    .map((debt) => {
      const details = formatDetails(debt.details);
      const total = formatTotal(debt);
      return `<tr>
        <td>${escapeHtml(debt.name)}</td>
        <td>${escapeHtml(details)}</td>
        <td>${escapeHtml(total)}</td>
      </tr>`;
    })
    .join("");

  const html = `<table>
    <thead>
      <tr>
        <th>Thành viên</th>
        <th>Chi tiết</th>
        <th>Tổng nợ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;

  const plainLines = [
    "🍔 Tổng nợ tiền ăn",
    "",
    ...debts.map((debt) => {
      const details = formatDetails(debt.details);
      return `• ${debt.name} — ${details} = ${formatTotal(debt)}`;
    }),
  ];

  return { html, plain: plainLines.join("\n") };
}

export function buildTeamsMentions(debts: DebtRow[]): {
  html: string;
  plain: string;
} {
  const owedDebts = debts.filter((debt) => debt.direction !== "owes_you");

  const lines = owedDebts.map(
    (debt) =>
      `• ${debt.name} — ${debt.totalDebt.toLocaleString("vi-VN")}đ`,
  );

  const plain = ["Nhắc thanh toán tiền ăn:", "", ...lines].join("\n");
  const html = plain.replace(/\n/g, "<br>");

  return { html, plain };
}

export async function copyRichText(html: string, plain: string): Promise<void> {
  if (
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard.write !== undefined
  ) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  }

  await navigator.clipboard.writeText(plain);
}
