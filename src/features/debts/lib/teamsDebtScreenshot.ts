export type TeamsDebtScreenshotEntry = {
  name: string;
  details: string;
  total: string;
};

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";

  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

export async function createTeamsDebtScreenshotBase64(
  entries: TeamsDebtScreenshotEntry[],
) {
  const width = 1440;
  const padding = 64;
  const rowGap = 20;
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) throw new Error("Không thể tạo ảnh chi tiết tiền cơm.");

  measureContext.font = "26px Arial, sans-serif";
  const rows = entries.map((entry) => ({
    ...entry,
    nameLines: wrapText(
      measureContext,
      entry.name,
      width - padding * 2 - 360,
    ),
    detailLines: wrapText(
      measureContext,
      `Chi tiết ròng: ${entry.details} = ${entry.total}`,
      width - padding * 2 - 56,
    ),
  }));
  const height =
    210 +
    rows.reduce(
      (total, row) =>
        total +
        130 +
        row.detailLines.length * 38 +
        Math.max(0, row.nameLines.length - 1) * 38,
      0,
    ) +
    rowGap * Math.max(0, rows.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không thể tạo ảnh chi tiết tiền cơm.");

  context.fillStyle = "#f1f5f9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0f172a";
  context.font = "700 42px Arial, sans-serif";
  context.fillText("Chi tiết tiền cơm", padding, 82);
  context.fillStyle = "#475569";
  context.font = "24px Arial, sans-serif";
  context.fillText(
    `${entries.length} thành viên · ${new Date().toLocaleString("vi-VN")}`,
    padding,
    126,
  );

  let y = 166;
  for (const row of rows) {
    const rowHeight =
      130 +
      row.detailLines.length * 38 +
      Math.max(0, row.nameLines.length - 1) * 38;
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#cbd5e1";
    context.lineWidth = 2;
    context.fillRect(padding, y, width - padding * 2, rowHeight);
    context.strokeRect(padding, y, width - padding * 2, rowHeight);

    context.fillStyle = "#0f172a";
    context.font = "700 30px Arial, sans-serif";
    row.nameLines.forEach((line, index) => {
      context.fillText(line, padding + 28, y + 48 + index * 38);
    });
    context.textAlign = "right";
    context.fillStyle = "#7c3aed";
    context.fillText(row.total, width - padding - 28, y + 48);
    context.textAlign = "left";

    context.fillStyle = "#334155";
    context.font = "26px Arial, sans-serif";
    row.detailLines.forEach((line, index) => {
      context.fillText(
        line,
        padding + 28,
        y + 92 + (row.nameLines.length - 1) * 38 + index * 38,
      );
    });

    y += rowHeight + rowGap;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Không thể mã hóa ảnh chi tiết tiền cơm."));
    }, "image/png");
  });
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Không thể đọc ảnh chi tiết tiền cơm."));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh chi tiết tiền cơm."));
    reader.readAsDataURL(blob);
  });
  const base64 = dataUrl.split(",", 2)[1];
  if (!base64) throw new Error("Không thể mã hóa ảnh chi tiết tiền cơm.");
  if (base64.length > 900_000) {
    throw new Error("Ảnh chi tiết tiền cơm quá lớn để gửi. Hãy thử lại sau khi giảm số khoản nợ.");
  }

  return base64;
}
