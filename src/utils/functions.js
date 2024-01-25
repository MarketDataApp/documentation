export function getLabelAndTag({ label }) {
  // check if there's "tg"
  if (!label.includes("tg")) {
    return {
      label,
      tag: "",
    };
  }
  return {
    label: label.split("tg")[0].trim(),
    tag: label.split("tg")[1].trim(),
  };
}
