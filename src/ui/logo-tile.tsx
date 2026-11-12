// Company logos are trademarks, so the tool shows the first letter of the
// company's name in a tile of its own.
export function LogoTile({ name, size = 40 }: { readonly name: string; readonly size?: number }) {
  const letter = name
    .replace(/[^A-Za-z0-9]/g, "")
    .charAt(0)
    .toUpperCase();
  return (
    <span
      className="logo-tile"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

// "COSTCO WHOLESALE CORP /NEW" reads as "Costco Wholesale Corp". The SEC
// writes some names in capitals and adds its own suffixes.
export const plainName = (name: string) => {
  const trimmed = name
    .replace(/\s+\/[A-Z]+\/?$/, "")
    .replace(/\s*\/[A-Z]{2}\/?$/, "")
    .trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word) =>
      word.length <= 3 && /^(llc|plc|ag|nv|sa|se)$/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ")
    .replace(/\bInc$/, "Inc.");
};

// "Apple Inc." reads as "Apple" in a sentence.
export const shortName = (name: string) =>
  plainName(name)
    .replace(/,?\s+(Inc\.?|Corp\.?|Corporation|Co\.?|Company|Ltd\.?|LLC|PLC|Holdings|Group)$/i, "")
    .trim();
