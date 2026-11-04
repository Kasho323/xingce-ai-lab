import { createHash } from "node:crypto";
export function fingerprint(
  stem: string,
  options: { key: string; text: string }[],
  material = "",
) {
  return createHash("sha256")
    .update(
      (
        material +
        "|" +
        stem +
        "|" +
        options
          .slice()
          .sort((a, b) => a.key.localeCompare(b.key))
          .map((x) => x.text)
          .join("|")
      )
        .normalize("NFKC")
        .replace(/[\s\p{P}]/gu, "")
        .toLowerCase(),
    )
    .digest("hex");
}
