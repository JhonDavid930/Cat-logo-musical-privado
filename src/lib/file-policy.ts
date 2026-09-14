export const MAX_FILE_BYTES = 512 * 1024 * 1024;
export const MAX_PREVIEW_BYTES = 20 * 1024 * 1024;
export function fileSizeLabel(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toLocaleString("es", { maximumFractionDigits: 1 })} KiB`
      : `${(bytes / 1024 / 1024).toLocaleString("es", { maximumFractionDigits: 1 })} MiB`;
}
export const documentLabels = {
  certificate: "Certificado",
  lyrics: "Composición / letra",
  contract: "Contrato / legal",
  wav: "Audio / máster",
  video: "Vídeo",
  other: "Otro documento",
} as const;
export const previewLabels = {
  pdf: "PDF",
  text: "Texto",
  audio: "Audio",
  video: "Vídeo",
  docx: "Word",
  xlsx: "Excel",
  download: "Descarga",
} as const;
